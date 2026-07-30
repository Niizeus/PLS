import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { BUILDINGS, SPAWN, type Building } from './cityData'
import { buildBuilding } from './buildingMesh'
import { CATHEDRAL } from './cathedralMesh'
import { editorTileReach } from '../editorStreaming'
import { createTileResourceCache } from './tileResourceCache'

/**
 * 🏙️  Beauvais, bâtiment par bâtiment.
 *
 * Chaque bâtiment = son contour réel (OpenStreetMap), sa hauteur réelle et son
 * toit (IGN BD TOPO). Pas encore de texture ni de fenêtres : les façades restent
 * unies, c'est la prochaine étape. La FORME, elle, est juste.
 *
 * La fabrication du volume (murs + toit) vit dans `buildingMesh.ts` ; ce fichier-ci
 * ne s'occupe que d'une chose : décider QUELS bâtiments sont montés à un instant t.
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
const cityTileCache = createTileResourceCache<THREE.BufferGeometry | null>({
  name: 'city-buildings',
  maxEntries: 72,
  build: (tileKey) => {
    const list = tiles.get(tileKey)
    if (!list) return null
    const parts: THREE.BufferGeometry[] = []
    for (const b of list) {
      const geo = buildBuilding(b)
      if (geo) parts.push(geo)
    }
    if (parts.length === 0) return null
    const merged = mergeGeometries(parts, false)
    parts.forEach((p) => p.dispose())
    merged?.computeBoundingSphere()
    return merged
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
  const geometry = useMemo(() => cityTileCache.get(tileKey), [tileKey])

  // Libère la mémoire GPU quand la tuile sort du cache.
  useEffect(() => {
    cityTileCache.retain(tileKey)
    return () => cityTileCache.release(tileKey)
  }, [tileKey])

  if (!geometry) return null
  return (
    <mesh
      geometry={geometry}
      material={CITY_TILE_MATERIAL}
      castShadow
      receiveShadow
      matrixAutoUpdate={false}
      dispose={null}
    />
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
