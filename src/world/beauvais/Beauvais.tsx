import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { BUILDINGS, SPAWN, type Building } from './cityData'
import { buildBuilding } from './buildingMesh'
import { buildFromArchetype } from './archetypes/buildingGen'
import { FACADES_TEXTUREES, facadeAtlas } from './archetypes/facadeAtlas'
import { chunkInfo } from './chunkIndex'
import { CATHEDRAL } from './cathedralMesh'
import { editorTileReach } from '../editorStreaming'
import { createTileResourceCache } from './tileResourceCache'

/**
 * 🏙️  Beauvais, bâtiment par bâtiment.
 *
 * Chaque bâtiment = son contour réel (OpenStreetMap), sa hauteur réelle et son
 * toit (IGN BD TOPO). La FORME est juste partout dans la ville.
 *
 * ── Deux rendus coexistent, et c'est voulu ──────────────────────────────────
 *  - **Dans un chunk classé** (le centre-ville pour l'instant) : on connaît la
 *    FAMILLE du bâtiment, donc `archetypes/buildingGen.ts` lui donne des étages,
 *    des fenêtres et un rez-de-chaussée — texturés par l'atlas de façades.
 *  - **Partout ailleurs** : `buildingMesh.ts`, volumes en aplat comme avant.
 *
 * On ne supprime donc rien tant que les chunks ne couvrent pas toute la ville :
 * une tuile peut porter les deux, et un bâtiment absent de l'index retombe
 * simplement sur l'ancien rendu. Voir `docs/08-CHUNKFORGE.md`.
 *
 * Ce fichier-ci ne s'occupe que d'une chose : décider QUELS bâtiments sont montés
 * à un instant t.
 *
 * ⚠️ La ville fait ~34 000 bâtiments : impossible de tout afficher d'un coup.
 * On fait donc du STREAMING par tuiles :
 *  - les bâtiments sont rangés par tuile de TILE mètres (calcul léger, sans 3D) ;
 *  - seules les tuiles autour du joueur sont montées ; la géométrie d'une tuile
 *    passe par un cache LRU : elle survit aux petits allers-retours, puis se libère
 *    quand elle sort du cache.
 *
 * ⚠️ Cohérence avec les collisions : on affiche TOUS les bâtiments de la donnée,
 * à UNE exception près — la cathédrale, qui a son propre modèle (`Cathedral.tsx`)
 * bâti sur exactement la même emprise. `collision.ts` bloque les mêmes contours →
 * pas de « mur invisible » (un bâtiment qui bloque mais qu'on ne voit pas). Si un
 * jour tu exclus un autre bâtiment de l'affichage sans le remplacer, exclus-le
 * AUSSI des collisions.
 */

const TILE = 180 // côté d'une tuile, en mètres
const REACH = 1 // anneaux de tuiles autour du joueur (1 = 3×3 tuiles)
const PREPARE_DELAY_MS = 16
const CITY_TILE_MATERIAL = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient })

/**
 * Matériau des bâtiments d'un CHUNK classé : mêmes règles de cel-shading que le
 * reste de la ville.
 *
 * ⚠️ L'atlas de façades n'est PAS branché tant que `FACADES_TEXTUREES` vaut
 * `false` : les fenêtres dessinées donnaient des damiers de rectangles sombres
 * qui n'évoquaient pas Beauvais. Sans `map`, ce sont les couleurs de sommet
 * calculées par `buildingGen.ts` qui portent tout le rendu (mur par registre,
 * pignon, toit). Construit à la demande — l'atlas, lui, a besoin du DOM.
 */
let chunkMaterial: THREE.MeshToonMaterial | null = null
function materiauChunk() {
  if (!chunkMaterial) {
    chunkMaterial = new THREE.MeshToonMaterial({
      // `map` ET `vertexColors` se MULTIPLIENT : le jour où une vraie méthode de
      // façades existera, il suffira de rebrancher la texture ici et de repasser
      // `FACADES_TEXTUREES` à `true` — `buildingGen.ts` rendra alors la main sur
      // les couleurs de sommet, qui redeviendront une simple modulation.
      ...(FACADES_TEXTUREES ? { map: facadeAtlas() } : {}),
      vertexColors: true,
      gradientMap: toonGradient,
    })
  }
  return chunkMaterial
}

// --- Rangement des bâtiments par tuile (une seule fois, au chargement) ---
const tiles = new Map<string, Building[]>()
const keyOf = (tx: number, tz: number) => tx + ':' + tz

for (const b of BUILDINGS) {
  if (b === CATHEDRAL) continue // monument à part : voir Cathedral.tsx
  const key = keyOf(Math.floor(b.cx / TILE), Math.floor(b.cz / TILE))
  let list = tiles.get(key)
  if (!list) tiles.set(key, (list = []))
  list.push(b)
}

/** Une tuile de ville : géométrie streamée, gardée brièvement en cache pour les retours arrière. */
/**
 * Une tuile porte DEUX géométries : celle des bâtiments classés (texturés) et
 * celle des autres (aplats). Deux matériaux différents ne peuvent pas partager
 * une géométrie fusionnée, et découper en groupes coûterait plus cher que le
 * second mesh — d'autant que les tuiles hors chunk n'en auront qu'un.
 */
interface TileGeometries {
  legacy: THREE.BufferGeometry | null
  chunk: THREE.BufferGeometry | null
}

function fusionner(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  merged?.computeBoundingSphere()
  return merged
}

const cityTileCache = createTileResourceCache<TileGeometries | null>({
  name: 'city-buildings',
  maxEntries: 72,
  build: (tileKey) => {
    const list = tiles.get(tileKey)
    if (!list) return null
    const legacyParts: THREE.BufferGeometry[] = []
    const chunkParts: THREE.BufferGeometry[] = []

    for (const b of list) {
      const info = chunkInfo(b)
      if (info) {
        // Bâtiment classé : on lui donne des étages et des ouvertures.
        const geo = buildFromArchetype({
          pts: b.pts,
          h: b.h,
          rh: b.rh,
          ra: b.ra,
          rm: b.rm,
          cx: b.cx,
          cz: b.cz,
          archetype: info.archetype,
          ign: { etages: info.etages },
          rue: info.rue,
        })
        // Repli sur l'ancien rendu si la génération échoue : mieux vaut un volume
        // en aplat qu'un trou dans la rue.
        if (geo) {
          chunkParts.push(geo)
          continue
        }
      }
      const geo = buildBuilding(b)
      if (geo) legacyParts.push(geo)
    }

    const legacy = fusionner(legacyParts)
    const chunk = fusionner(chunkParts)
    if (!legacy && !chunk) return null
    return { legacy, chunk }
  },
})

export function warmCityTilesAround(x: number, z: number, reach = REACH): number {
  const centerTx = Math.floor(x / TILE)
  const centerTz = Math.floor(z / TILE)
  let warmed = 0
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      const key = keyOf(centerTx + dx, centerTz + dz)
      if (!tiles.has(key)) continue
      cityTileCache.get(key)
      warmed += 1
    }
  }
  return warmed
}

function CityTile({ tileKey }: { tileKey: string }) {
  const geometries = useMemo(() => cityTileCache.get(tileKey), [tileKey])

  // Libère la mémoire GPU quand la tuile sort du cache.
  useEffect(() => {
    cityTileCache.retain(tileKey)
    return () => cityTileCache.release(tileKey)
  }, [tileKey])

  if (!geometries) return null
  return (
    <>
      {geometries.legacy && (
        <mesh
          geometry={geometries.legacy}
          material={CITY_TILE_MATERIAL}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
          dispose={null}
        />
      )}
      {geometries.chunk && (
        <mesh
          geometry={geometries.chunk}
          material={materiauChunk()}
          castShadow
          receiveShadow
          matrixAutoUpdate={false}
          dispose={null}
        />
      )}
    </>
  )
}

export default function Beauvais({ mode = 'game' }: { mode?: 'game' | 'editor' }) {
  const { camera, size } = useThree()
  // Tuile courante du joueur : on ne recalcule la liste que quand elle CHANGE.
  const [center, setCenter] = useState(() => ({
    tx: Math.floor(SPAWN.x / TILE),
    tz: Math.floor(SPAWN.z / TILE),
    reach: REACH,
  }))
  const [preparedKeys, setPreparedKeys] = useState<Set<string>>(() => new Set())
  const frame = useRef(0)

  useFrame(() => {
    // Inutile de tester à chaque image : une fois toutes les ~12 images suffit.
    frame.current = (frame.current + 1) % 12
    if (frame.current !== 0) return

    const p = usePlayerStore.getState().playerObject
    const tx = Math.floor((p ? p.position.x : SPAWN.x) / TILE)
    const tz = Math.floor((p ? p.position.z : SPAWN.z) / TILE)
    const wanted = mode === 'editor' ? editorTileReach(camera, size, TILE, REACH) : REACH
    setCenter((c) => {
      // On n'ajoute (ou n'enleve) qu'UN anneau de tuiles a la fois. Un gros dezoom dans
      // l'editeur passe donc de 3x3 a 15x15 en plusieurs etapes au lieu de construire des
      // centaines de tuiles dans la meme image, ce qui figeait l'affichage une seconde ou
      // deux. Ce test tourne une image sur 12 : la zone finit de se remplir en un clin d'oeil.
      const reach = c.reach + Math.sign(wanted - c.reach)
      return c.tx === tx && c.tz === tz && c.reach === reach ? c : { tx, tz, reach }
    })
  })

  const keys: string[] = []
  for (let dx = -center.reach; dx <= center.reach; dx++) {
    for (let dz = -center.reach; dz <= center.reach; dz++) {
      const key = keyOf(center.tx + dx, center.tz + dz)
      if (tiles.has(key)) keys.push(key)
    }
  }
  const tileSignature = keys.join('|')

  useEffect(() => {
    let cancelled = false
    let cursor = 0

    const publishPrepared = () => {
      setPreparedKeys((current) => {
        const next = new Set<string>()
        for (const key of keys) {
          if (cityTileCache.has(key)) next.add(key)
        }
        const changed = next.size !== current.size || [...next].some((key) => !current.has(key))
        return changed ? next : current
      })
    }

    const prepareNext = () => {
      if (cancelled) return
      while (cursor < keys.length) {
        const key = keys[cursor++]
        if (!cityTileCache.has(key)) {
          cityTileCache.get(key)
          publishPrepared()
          window.setTimeout(prepareNext, PREPARE_DELAY_MS)
          return
        }
      }
      publishPrepared()
    }

    prepareNext()
    return () => {
      cancelled = true
    }
  }, [tileSignature])

  const visibleKeys = keys.filter((key) => preparedKeys.has(key) && cityTileCache.has(key))

  return (
    <>
      {visibleKeys.map((key) => (
        <CityTile key={key} tileKey={key} />
      ))}
    </>
  )
}
