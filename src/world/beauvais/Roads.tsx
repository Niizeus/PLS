import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { SPAWN, terrainHeight } from './cityData'
import { ROADWAY, ROADWAY_TILE, roadwayTiles, walkOuterReach, type RoadChunk } from './roadway'
import roadSurfaceTest from './data/road-surface-test.json'
import { editorTileReach } from '../editorStreaming'
import { createTileResourceCache } from './tileResourceCache'
import { buildRoadSurfaceBuffers } from './roadSurfaceGeometry'

/**
 * Routes de Beauvais en volume.
 *
 * La surface physique vient de `roadway.ts`. Le rendu se fait à TROIS couches, et
 * il faut savoir laquelle dessine quoi avant d'y toucher :
 *
 *  1. **la dalle de bitume** — un polygone fusionné par tuile, calculé hors-jeu ;
 *  2. **la dalle de trottoir** — le complément du précédent, moins les bâtiments,
 *     calculé par la même passe hors-jeu et posé à la hauteur de bordure ;
 *  3. **les rubans par voie** (`addChunk`) — ce qui reste : l'accotement en pente,
 *     et le profil complet là où aucune dalle n'existe (chemins, sentiers).
 *
 * ⚠️ Une voie couverte par les dalles ne dessine PLUS son bitume, sa bordure ni son
 * trottoir en ruban. C'est le fond du lot trottoirs : extrudés par voie, ils se
 * chevauchaient à chaque croisement. Voir la décision n°4 en tête de `roadway.ts`.
 */

const ASPHALT = '#454b52'
const KERB = '#8d9199'
const SHOULDER = '#6d6659'

const REACH = 1
const SURFACE_PREPARE_DELAY_MS = 12

const BAND_COLORS = [SHOULDER, KERB, KERB, ASPHALT, KERB, KERB, SHOULDER].map(
  (c) => new THREE.Color(c),
)

/**
 * Revêtement selon la classe d'usage IGN.
 *
 * C'est ici que le travail de `bdtopoRoads.mjs` devient visible : une rue
 * piétonne et une rue de quartier ont souvent la MÊME largeur, donc rien ne les
 * distinguait à l'écran. Maintenant, le pavé clair du centre-ville se lit d'un
 * coup d'œil, et les chemins de terre ne sont plus goudronnés.
 *
 * Les 174 rues piétonnes de Beauvais sortent du champ `acces_vehicule_leger` de
 * l'IGN — aucune n'a été dessinée à la main.
 */
const SURFACE_COLORS: Record<string, THREE.Color> = {
  pedestrian: new THREE.Color('#9a8f7e'), // pavé clair
  track: new THREE.Color('#7d6f57'), // terre / empierré
}

/** Couleur du bitume d'un tronçon, pavé ou terre selon sa classe. */
function surfaceColor(chunk: RoadChunk): THREE.Color {
  return (chunk.cls && SURFACE_COLORS[chunk.cls]) || BAND_COLORS[3]
}
const ROAD_TILE_MATERIAL = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient })
const SURFACE_MATERIAL = new THREE.MeshToonMaterial({
  color: ASPHALT,
  gradientMap: toonGradient,
  polygonOffset: true,
  polygonOffsetFactor: -2,
})
const SURFACE_EDGE_MATERIAL = new THREE.MeshToonMaterial({ color: KERB, gradientMap: toonGradient })

/**
 * Le dessus du trottoir, et sa tranche.
 *
 * Deux gris volontairement proches mais distincts : le dessus légèrement plus
 * clair que la bordure. C'est ce petit écart qui donne l'épaisseur — un trottoir
 * d'un seul ton se lit comme un autocollant posé sur l'herbe.
 *
 * `polygonOffset` comme le bitume : les deux dalles se touchent exactement le long
 * du caniveau, et sans décalage de profondeur le GPU ne sait pas laquelle est
 * devant (z-fighting scintillant sur toute la longueur de la rue).
 */
const WALK_TOP = '#9aa0a7'
const WALK_MATERIAL = new THREE.MeshToonMaterial({
  color: WALK_TOP,
  gradientMap: toonGradient,
  polygonOffset: true,
  polygonOffsetFactor: -3,
})

const PROFILE = 8
const SURFACE_HIDE_PAD = 8

type RoadSurfaceTile = {
  polygons: number[][][][]
}

type RoadSurfaceTest = {
  center: { x: number; z: number }
  radius: number
  mask?: number[][] | null
  polygons?: number[][][][]
  preview?: { polygons?: number[][][][] }
  tileSize?: number
  tiles?: Record<string, RoadSurfaceTile>
  walkTiles?: Record<string, RoadSurfaceTile>
}

const ROAD_SURFACE_TEST = roadSurfaceTest as RoadSurfaceTest
const SURFACE_TILE_SIZE = ROAD_SURFACE_TEST.tileSize ?? ROADWAY_TILE
const SURFACE_TILES = ROAD_SURFACE_TEST.tiles ?? null
const LEGACY_SURFACE_POLYGONS = ROAD_SURFACE_TEST.polygons ?? ROAD_SURFACE_TEST.preview?.polygons ?? []

/**
 * 🚶 Les trottoirs, calculés hors-jeu par `debug:roads` (voir
 * `debug-road-geometry.mjs`) : réseau élargi − chaussée − bâtiments.
 *
 * Absent d'un `road-surface-test.json` produit avant ce lot → pas de trottoir,
 * plutôt qu'un plantage. Relancer `npm run debug:roads` suffit à les faire
 * apparaître.
 */
const WALK_TILES = ROAD_SURFACE_TEST.walkTiles ?? null

function walkPolygonsForTile(tileKey: string): number[][][][] {
  return WALK_TILES?.[tileKey]?.polygons ?? []
}

function pointInRing(x: number, z: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const zi = ring[i][1]
    const xj = ring[j][0]
    const zj = ring[j][1]
    const crosses = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function surfacePolygonsForTile(tileKey: string): number[][][][] {
  return SURFACE_TILES?.[tileKey]?.polygons ?? []
}

function hasSurfaceTile(tileKey: string): boolean {
  return surfacePolygonsForTile(tileKey).length > 0
}

function surfacePolygonsNear(x: number, z: number): number[][][][] {
  if (!SURFACE_TILES) return LEGACY_SURFACE_POLYGONS

  const tx = Math.floor(x / SURFACE_TILE_SIZE)
  const tz = Math.floor(z / SURFACE_TILE_SIZE)
  const polygons: number[][][][] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const tile = SURFACE_TILES[tx + dx + ':' + (tz + dz)]
      if (tile) polygons.push(...tile.polygons)
    }
  }
  return polygons
}

function inExperimentalSurfaceZone(x: number, z: number): boolean {
  if (!SURFACE_TILES) {
    const dx = x - ROAD_SURFACE_TEST.center.x
    const dz = z - ROAD_SURFACE_TEST.center.z
    if (Math.hypot(dx, dz) > ROAD_SURFACE_TEST.radius + SURFACE_HIDE_PAD) return false
  }

  for (const poly of surfacePolygonsNear(x, z)) {
    const outer = poly[0]
    if (!outer || !pointInRing(x, z, outer)) continue
    let inHole = false
    for (const hole of poly.slice(1)) {
      if (pointInRing(x, z, hole)) {
        inHole = true
        break
      }
    }
    if (!inHole) return true
  }
  return false
}
function section(
  chunk: RoadChunk,
  i: number,
  n: number,
  ox: Float64Array,
  oy: Float64Array,
  oz: Float64Array,
) {
  const pts = chunk.pts
  const x = pts[i * 3]
  const z = pts[i * 3 + 1]
  const top = pts[i * 3 + 2]
  const half = chunk.half

  const pi = Math.max(0, i - 1)
  const ni = Math.min(n - 1, i + 1)
  let dx = pts[ni * 3] - pts[pi * 3]
  let dz = pts[ni * 3 + 1] - pts[pi * 3 + 1]
  const len = Math.hypot(dx, dz) || 1
  dx /= len
  dz /= len
  const nx = -dz
  const nz = dx

  const put = (k: number, offset: number, y: number) => {
    ox[i * PROFILE + k] = x + nx * offset
    oy[i * PROFILE + k] = y
    oz[i * PROFILE + k] = z + nz * offset
  }

  if (chunk.junction[i]) {
    for (let k = 0; k < PROFILE; k++) put(k, k < 4 ? half : -half, top)
    return
  }

  const kerbY = top + ROADWAY.KERB_H
  const leftMerge = chunk.leftMerge[i]
  const rightMerge = chunk.rightMerge[i]

  // Bord extérieur du TROTTOIR. Même fonction que la physique et que le découpage
  // des polygones hors-jeu : les trois sortent de `walkOuterReach`, il n'y a plus
  // qu'un seul endroit où la largeur est décidée.
  const walkOutL = walkOuterReach(half)
  const walkOutR = walkOutL
  // Puis l'accotement en pente rattrape le terrain naturel, comme avant.
  const outerL = walkOutL + ROADWAY.SHOULDER_W
  const outerR = walkOutR + ROADWAY.SHOULDER_W

  const footY = (offset: number) =>
    Math.min(terrainHeight(x + nx * offset, z + nz * offset) - ROADWAY.EMBED, kerbY)

  if (leftMerge > 0) {
    put(0, half + leftMerge, top)
    put(1, half + leftMerge * 0.66, top)
    put(2, half + leftMerge * 0.33, top)
  } else {
    put(0, outerL, footY(outerL))
    put(1, walkOutL, kerbY)
    put(2, half, kerbY)
  }

  put(3, half, top)
  put(4, -half, top)

  if (rightMerge > 0) {
    put(5, -(half + rightMerge * 0.33), top)
    put(6, -(half + rightMerge * 0.66), top)
    put(7, -(half + rightMerge), top)
  } else {
    put(5, -half, kerbY)
    put(6, -walkOutR, kerbY)
    put(7, -outerR, footY(-outerR))
  }
}

function bandColor(chunk: RoadChunk, i: number, band: number): THREE.Color {
  const leftMerged = chunk.leftMerge[i] > 0 || chunk.leftMerge[i + 1] > 0
  const rightMerged = chunk.rightMerge[i] > 0 || chunk.rightMerge[i + 1] > 0
  if ((leftMerged && band <= 2) || (rightMerged && band >= 4)) return surfaceColor(chunk)
  // Bande 3 = la chaussée elle-même ; les autres (bordure, accotement) gardent
  // leur teinte quelle que soit la classe.
  return band === 3 ? surfaceColor(chunk) : BAND_COLORS[band]
}

function addChunk(chunk: RoadChunk, positions: number[], colors: number[]) {
  const n = chunk.pts.length / 3
  if (n < 2) return

  const ox = new Float64Array(n * PROFILE)
  const oy = new Float64Array(n * PROFILE)
  const oz = new Float64Array(n * PROFILE)
  for (let i = 0; i < n; i++) section(chunk, i, n, ox, oy, oz)

  for (let i = 0; i < n - 1; i++) {
    const ax = chunk.pts[i * 3]
    const az = chunk.pts[i * 3 + 1]
    const bx = chunk.pts[(i + 1) * 3]
    const bz = chunk.pts[(i + 1) * 3 + 1]
    /**
     * La dalle fusionnée remplace-t-elle le bitume ici ?
     *
     * ⚠️ Le test porte sur l'AXE de la voie, qui est forcément à l'intérieur de
     * la dalle — celle-ci est construite à partir de ces mêmes routes. Il est
     * donc vrai presque partout, et il servait à sauter TOUTE la coupe : bitume,
     * bordure ET trottoir. Comme la dalle ne dessine que le bitume, la ville se
     * retrouvait en plaques de goudron nues, sans le moindre bord.
     *
     * Ce n'est plus un problème depuis que la dalle de TROTTOIR existe : les deux
     * dalles couvrent ensemble tout ce que le ruban dessinait, tranche comprise. Le
     * masque peut donc sauter la coupe entière — et il le doit, voir plus bas.
     */
    const paved =
      inExperimentalSurfaceZone(ax, az) ||
      inExperimentalSurfaceZone(bx, bz) ||
      inExperimentalSurfaceZone((ax + bx) * 0.5, (az + bz) * 0.5)

    const junction = chunk.junction[i] === 1 || chunk.junction[i + 1] === 1

    for (let band = 0; band < PROFILE - 1; band++) {
      if (junction && band !== 3) continue

      /**
       * ⚠️ Sous les dalles, le ruban ne dessine PLUS RIEN.
       *
       * C'est le fond du lot trottoirs. Extrudés par voie, bordure et trottoir se
       * chevauchaient à chaque croisement — d'où la règle « pas de trottoir dans un
       * carrefour », donc un trou à chaque intersection. Les deux dalles les
       * remplacent : un polygone fusionné pour toute la ville, juste aux carrefours
       * par construction, et leurs jupes verticales fournissent la tranche.
       *
       * Garder l'accotement du ruban ici a été essayé, et c'est faux : il part du
       * bord du trottoir, alors que les vetos (terre-plein, absence de bâti)
       * suppriment le trottoir sur 71 % des côtés de voie de la commune. L'accotement
       * partait donc dans le vide. Une seule autorité par surface, sinon les deux
       * divergent — c'est exactement le bug qu'on vient de payer.
       *
       * `roadway.ts` applique la règle SYMÉTRIQUE côté physique (`segPaved`).
       */
      if (paved) continue

      const c = bandColor(chunk, i, band)
      const l = i * PROFILE + band
      const r = l + 1
      const l2 = l + PROFILE
      const r2 = r + PROFILE

      for (const v of [l, r2, r, l, l2, r2]) {
        positions.push(ox[v], oy[v], oz[v])
        colors.push(c.r, c.g, c.b)
      }
    }
  }
}

function buildTile(chunks: RoadChunk[]): THREE.BufferGeometry | null {
  const positions: number[] = []
  const colors: number[] = []
  for (const chunk of chunks) addChunk(chunk, positions, colors)
  if (positions.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}


type SurfaceGeometryResource = {
  surfaceGeometry: THREE.BufferGeometry | null
  edgeGeometry: THREE.BufferGeometry | null
  walkGeometry: THREE.BufferGeometry | null
  walkEdgeGeometry: THREE.BufferGeometry | null
  dispose: () => void
}

const roadTileCache = createTileResourceCache<THREE.BufferGeometry | null>({
  name: 'road-ribbons',
  maxEntries: 96,
  build: (tileKey) => {
    const chunks = roadwayTiles().get(tileKey)
    return chunks ? buildTile(chunks) : null
  },
})

const surfaceTileCache = createTileResourceCache<SurfaceGeometryResource>({
  name: 'road-surfaces',
  maxEntries: 96,
  build: (tileKey) => {
    const polygons = tileKey === '__legacy__' ? LEGACY_SURFACE_POLYGONS : surfacePolygonsForTile(tileKey)
    const buffers = buildRoadSurfaceBuffers(polygons)
    const surfaceGeometry = buildGeometryFromPositions(buffers.surfacePositions)
    const edgeGeometry = buildGeometryFromPositions(buffers.edgePositions)

    // Le trottoir : mêmes contours tuilés, même échantillonnage de hauteur, relevé
    // de la bordure. Il vit dans la MÊME entrée de cache que le bitume — mêmes
    // montage, démontage et budget de préparation, donc les deux apparaissent
    // toujours ensemble. Une rue qui reçoit son bitume une image avant son
    // trottoir, ça se voit.
    const walkBuffers = buildRoadSurfaceBuffers(walkPolygonsForTile(tileKey), ROADWAY.KERB_H)
    const walkGeometry = buildGeometryFromPositions(walkBuffers.surfacePositions)
    const walkEdgeGeometry = buildGeometryFromPositions(walkBuffers.edgePositions)

    return {
      surfaceGeometry,
      edgeGeometry,
      walkGeometry,
      walkEdgeGeometry,
      dispose: () => {
        surfaceGeometry?.dispose()
        edgeGeometry?.dispose()
        walkGeometry?.dispose()
        walkEdgeGeometry?.dispose()
      },
    }
  },
})

function buildGeometryFromPositions(positions: Float32Array | null): THREE.BufferGeometry | null {
  if (!positions || positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export function warmRoadTilesAround(x: number, z: number, reach = REACH): number {
  const centerTx = Math.floor(x / ROADWAY_TILE)
  const centerTz = Math.floor(z / ROADWAY_TILE)
  const tiles = roadwayTiles()
  let warmed = 0

  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      const key = centerTx + dx + ':' + (centerTz + dz)
      if (tiles.has(key)) {
        roadTileCache.get(key)
        warmed += 1
      }
      if (hasSurfaceTile(key)) {
        surfaceTileCache.get(key)
        warmed += 1
      }
    }
  }

  return warmed
}

function ExperimentalRoadSurface({ tileKey }: { tileKey?: string }) {
  const cacheKey = tileKey ?? '__legacy__'
  const resource = useMemo(() => surfaceTileCache.get(cacheKey), [cacheKey])
  useEffect(() => {
    surfaceTileCache.retain(cacheKey)
    return () => surfaceTileCache.release(cacheKey)
  }, [cacheKey])

  if (!resource) return null
  const { surfaceGeometry, edgeGeometry, walkGeometry, walkEdgeGeometry } = resource
  if (!surfaceGeometry && !edgeGeometry && !walkGeometry) return null
  return (
    <>
      {walkGeometry && (
        <mesh
          geometry={walkGeometry}
          material={WALK_MATERIAL}
          castShadow={false}
          receiveShadow={false}
          matrixAutoUpdate={false}
          dispose={null}
        />
      )}
      {walkEdgeGeometry && (
        <mesh
          geometry={walkEdgeGeometry}
          material={SURFACE_EDGE_MATERIAL}
          castShadow={false}
          receiveShadow={false}
          matrixAutoUpdate={false}
          dispose={null}
        />
      )}
      {surfaceGeometry && (
        <mesh
          geometry={surfaceGeometry}
          material={SURFACE_MATERIAL}
          castShadow={false}
          receiveShadow={false}
          matrixAutoUpdate={false}
          dispose={null}
        />
      )}
      {edgeGeometry && (
        <mesh
          geometry={edgeGeometry}
          material={SURFACE_EDGE_MATERIAL}
          castShadow={false}
          receiveShadow={false}
          matrixAutoUpdate={false}
          dispose={null}
        />
      )}
    </>
  )
}

function RoadTile({ tileKey }: { tileKey: string }) {
  const geometry = useMemo(() => roadTileCache.get(tileKey), [tileKey])

  useEffect(() => {
    roadTileCache.retain(tileKey)
    return () => roadTileCache.release(tileKey)
  }, [tileKey])

  if (!geometry) return null
  return (
    <mesh
      geometry={geometry}
      material={ROAD_TILE_MATERIAL}
      castShadow={false}
      receiveShadow={false}
      matrixAutoUpdate={false}
      dispose={null}
    />
  )
}

export default function Roads({ mode = 'game' }: { mode?: 'game' | 'editor' }) {
  const { camera, size } = useThree()
  const [center, setCenter] = useState(() => ({
    tx: Math.floor(SPAWN.x / ROADWAY_TILE),
    tz: Math.floor(SPAWN.z / ROADWAY_TILE),
    reach: REACH,
  }))
  const [preparedRoadKeys, setPreparedRoadKeys] = useState<Set<string>>(() => new Set())
  const [preparedSurfaceKeys, setPreparedSurfaceKeys] = useState<Set<string>>(() => new Set())
  const frame = useRef(0)

  useFrame(() => {
    frame.current = (frame.current + 1) % 12
    if (frame.current !== 0) return

    const p = usePlayerStore.getState().playerObject
    const tx = Math.floor((p ? p.position.x : SPAWN.x) / ROADWAY_TILE)
    const tz = Math.floor((p ? p.position.z : SPAWN.z) / ROADWAY_TILE)
    const reach = mode === 'editor' ? editorTileReach(camera, size, ROADWAY_TILE, REACH) : REACH
    setCenter((c) => (c.tx === tx && c.tz === tz && c.reach === reach ? c : { tx, tz, reach }))
  })

  const tiles = roadwayTiles()
  const keys: string[] = []
  for (let dx = -center.reach; dx <= center.reach; dx++) {
    for (let dz = -center.reach; dz <= center.reach; dz++) {
      const key = center.tx + dx + ':' + (center.tz + dz)
      if (tiles.has(key) || hasSurfaceTile(key)) keys.push(key)
    }
  }

  const roadKeys = keys.filter((key) => tiles.has(key))
  const surfaceKeys = SURFACE_TILES ? keys.filter(hasSurfaceTile) : ['__legacy__']
  const prepareSignature = roadKeys.map((key) => 'r:' + key).concat(surfaceKeys.map((key) => 's:' + key)).join('|')

  useEffect(() => {
    if (roadKeys.length === 0 && surfaceKeys.length === 0) {
      setPreparedRoadKeys((current) => (current.size === 0 ? current : new Set()))
      setPreparedSurfaceKeys((current) => (current.size === 0 ? current : new Set()))
      return undefined
    }

    let cancelled = false
    let cursor = 0

    const publishPrepared = () => {
      setPreparedRoadKeys((current) => {
        const next = new Set<string>()
        for (const key of roadKeys) {
          if (roadTileCache.has(key)) next.add(key)
        }
        const changed = next.size !== current.size || [...next].some((key) => !current.has(key))
        return changed ? next : current
      })
      setPreparedSurfaceKeys((current) => {
        const next = new Set<string>()
        for (const key of surfaceKeys) {
          if (surfaceTileCache.has(key)) next.add(key)
        }
        const changed = next.size !== current.size || [...next].some((key) => !current.has(key))
        return changed ? next : current
      })
    }

    const prepareNext = () => {
      if (cancelled) return

      const total = roadKeys.length + surfaceKeys.length
      while (cursor < total) {
        const cursorIndex = cursor++
        const isRoad = cursorIndex < roadKeys.length
        const key = isRoad ? roadKeys[cursorIndex] : surfaceKeys[cursorIndex - roadKeys.length]
        const cache = isRoad ? roadTileCache : surfaceTileCache
        if (!cache.has(key)) {
          cache.get(key)
          publishPrepared()
          window.setTimeout(prepareNext, SURFACE_PREPARE_DELAY_MS)
          return
        }
      }

      publishPrepared()
    }

    prepareNext()
    return () => {
      cancelled = true
    }
  }, [prepareSignature])

  const visibleRoadKeys = roadKeys.filter((key) => preparedRoadKeys.has(key) && roadTileCache.has(key))
  const visibleSurfaceKeys = surfaceKeys.filter((key) => preparedSurfaceKeys.has(key) && surfaceTileCache.has(key))

  return (
    <>
      {visibleRoadKeys.map((key) => (
        <RoadTile key={key} tileKey={key} />
      ))}
      {SURFACE_TILES
        ? visibleSurfaceKeys.map((key) => <ExperimentalRoadSurface key={'surface:' + key} tileKey={key} />)
        : preparedSurfaceKeys.has('__legacy__') && <ExperimentalRoadSurface />}
    </>
  )
}
