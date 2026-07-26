import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { SPAWN, terrainHeight } from './cityData'
import { ROADWAY, ROADWAY_TILE, roadwayTiles, type RoadChunk } from './roadway'

/**
 * 🛣️  Les routes de Beauvais (OpenStreetMap), en VOLUME.
 *
 * Ce fichier ne fait que MONTRER la chaussée : sa forme, ses cotes et son
 * altitude sont décidées une fois pour toutes dans `roadway.ts`, qui sert aussi
 * à faire MARCHER le joueur dessus. Les deux ne peuvent donc pas diverger.
 *
 * Chaque point de l'axe donne une coupe en travers de 8 sommets, ordonnés de la
 * gauche vers la droite. Entre deux coupes, on tend 7 bandes de quads :
 *
 *   0 ────1═══2                       5═══6────7      ← index de la coupe
 *   accot. bordure│ 3 ─── bitume ─── 4 │bordure accot.
 *
 *   bande 0 : accotement gauche (remblai / talus)
 *   bande 1 : dessus de la bordure gauche
 *   bande 2 : face verticale de la bordure gauche  ← c'est ELLE qui donne l'épaisseur
 *   bande 3 : le bitume
 *   bandes 4-6 : idem, à droite
 *
 * ⚠️ L'ORDRE DES SOMMETS COMPTE (il décide de quel côté la face est vue, donc si
 * elle est éclairée par le ciel ou par en dessous). La règle est simple et vaut
 * pour les 7 bandes : la coupe va TOUJOURS de la gauche vers la droite, et pour
 * une face verticale, du HAUT vers le BAS. Ne réordonne pas le profil sans
 * revérifier — c'est ce qui avait mis tout le réseau à l'envers en 2026-07.
 *
 * ⚠️ Streaming par TUILES, comme les bâtiments : à 14 triangles par mètre de rue,
 * les 754 km du réseau feraient 1,7 million de triangles. On ne construit donc
 * que les 3×3 tuiles autour du joueur (le brouillard masque bien avant).
 */

const ASPHALT = '#454b52' // le bitume
const KERB = '#8d9199' // béton clair de la bordure de trottoir
const SHOULDER = '#6d6659' // accotement : terre / remblai, pour se fondre au sol

const REACH = 1 // anneaux de tuiles autour du joueur (1 = 3×3 tuiles)

/** Couleur de chacune des 7 bandes, dans l'ordre du profil. */
const BAND_COLORS = [SHOULDER, KERB, KERB, ASPHALT, KERB, KERB, SHOULDER].map(
  (c) => new THREE.Color(c),
)

/** Nombre de sommets d'une coupe en travers. */
const PROFILE = 8

/**
 * Construit une coupe en travers au point `i` de l'axe, dans `ox/oy/oz`.
 *
 * L'accotement descend jusqu'au terrain naturel, enfoncé de `EMBED` pour ne pas
 * laisser de jour au raccord — et jamais plus haut que la bordure, sinon il
 * viendrait recouvrir la rue là où le terrain remonte (rue en déblai).
 */
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

  // Perpendiculaire à l'axe : moyenne des deux segments voisins, pour que les
  // virages restent lisses au lieu de faire des marches.
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

  // Carrefour : ni bordure ni accotement. Tout se rabat sur le bord du bitume,
  // les bandes correspondantes deviennent plates et disparaissent.
  if (chunk.junction[i]) {
    for (let k = 0; k < PROFILE; k++) put(k, k < 4 ? half : -half, top)
    return
  }

  const kerbY = top + ROADWAY.KERB_H
  const outer = half + ROADWAY.KERB_W + ROADWAY.SHOULDER_W
  const kerbOut = half + ROADWAY.KERB_W

  // Pied d'accotement : sous le terrain, mais jamais au-dessus de la bordure.
  const footY = (offset: number) =>
    Math.min(terrainHeight(x + nx * offset, z + nz * offset) - ROADWAY.EMBED, kerbY)

  put(0, outer, footY(outer))
  put(1, kerbOut, kerbY)
  put(2, half, kerbY)
  put(3, half, top)
  put(4, -half, top)
  put(5, -half, kerbY)
  put(6, -kerbOut, kerbY)
  put(7, -outer, footY(-outer))
}

/** Met un tronçon en volume et pousse ses triangles dans `positions` / `colors`. */
function addChunk(chunk: RoadChunk, positions: number[], colors: number[]) {
  const n = chunk.pts.length / 3
  if (n < 2) return

  const ox = new Float64Array(n * PROFILE)
  const oy = new Float64Array(n * PROFILE)
  const oz = new Float64Array(n * PROFILE)
  for (let i = 0; i < n; i++) section(chunk, i, n, ox, oy, oz)

  for (let i = 0; i < n - 1; i++) {
    const junction = chunk.junction[i] === 1 && chunk.junction[i + 1] === 1
    for (let band = 0; band < PROFILE - 1; band++) {
      // Dans un carrefour, seul le bitume subsiste : le reste est plat, inutile
      // de charger la carte graphique avec des triangles d'aire nulle.
      if (junction && band !== 3) continue

      const c = BAND_COLORS[band]
      const l = i * PROFILE + band // gauche, coupe i
      const r = l + 1 // droite, coupe i
      const l2 = l + PROFILE // gauche, coupe i+1
      const r2 = r + PROFILE // droite, coupe i+1

      // Deux triangles, dans le sens qui met la face du bon côté (voir en tête).
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
  // La chaussée n'est pas plate : il lui faut de vraies normales pour l'éclairage.
  geo.computeVertexNormals()
  return geo
}

/** Une tuile de chaussée : géométrie construite au montage, libérée au démontage. */
function RoadTile({ tileKey }: { tileKey: string }) {
  const geometry = useMemo(() => {
    const chunks = roadwayTiles().get(tileKey)
    return chunks ? buildTile(chunks) : null
  }, [tileKey])

  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {/* Face avant seulement (défaut) : le profil est orienté de façon homogène,
          donc rien n'est éclairé par en dessous. Voir l'avertissement en tête. */}
      <meshToonMaterial vertexColors gradientMap={toonGradient} />
    </mesh>
  )
}

export default function Roads() {
  // Tuile courante du joueur : on ne recalcule la liste que quand elle CHANGE.
  const [center, setCenter] = useState(() => ({
    tx: Math.floor(SPAWN.x / ROADWAY_TILE),
    tz: Math.floor(SPAWN.z / ROADWAY_TILE),
  }))
  const frame = useRef(0)

  useFrame(() => {
    // Inutile de tester à chaque image : une fois toutes les ~12 images suffit.
    frame.current = (frame.current + 1) % 12
    if (frame.current !== 0) return

    const p = usePlayerStore.getState().playerObject
    const tx = Math.floor((p ? p.position.x : SPAWN.x) / ROADWAY_TILE)
    const tz = Math.floor((p ? p.position.z : SPAWN.z) / ROADWAY_TILE)
    setCenter((c) => (c.tx === tx && c.tz === tz ? c : { tx, tz }))
  })

  const tiles = roadwayTiles()
  const keys: string[] = []
  for (let dx = -REACH; dx <= REACH; dx++) {
    for (let dz = -REACH; dz <= REACH; dz++) {
      const key = center.tx + dx + ':' + (center.tz + dz)
      if (tiles.has(key)) keys.push(key)
    }
  }

  return (
    <>
      {keys.map((key) => (
        <RoadTile key={key} tileKey={key} />
      ))}
    </>
  )
}
