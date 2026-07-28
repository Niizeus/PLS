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
 *    est construite à son montage et libérée à son démontage.
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

/** Une tuile de ville : géométrie construite au montage, libérée au démontage. */
function CityTile({ tileKey }: { tileKey: string }) {
  const geometry = useMemo(() => {
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
    return merged
  }, [tileKey])

  // Libère la mémoire GPU quand la tuile s'éloigne du joueur.
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshToonMaterial vertexColors gradientMap={toonGradient} />
    </mesh>
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
  const frame = useRef(0)

  useFrame(() => {
    // Inutile de tester à chaque image : une fois toutes les ~12 images suffit.
    frame.current = (frame.current + 1) % 12
    if (frame.current !== 0) return

    const p = usePlayerStore.getState().playerObject
    const tx = Math.floor((p ? p.position.x : SPAWN.x) / TILE)
    const tz = Math.floor((p ? p.position.z : SPAWN.z) / TILE)
    const reach = mode === 'editor' ? editorTileReach(camera, size, TILE, REACH) : REACH
    setCenter((c) => (c.tx === tx && c.tz === tz && c.reach === reach ? c : { tx, tz, reach }))
  })

  const keys: string[] = []
  for (let dx = -center.reach; dx <= center.reach; dx++) {
    for (let dz = -center.reach; dz <= center.reach; dz++) {
      const key = keyOf(center.tx + dx, center.tz + dz)
      if (tiles.has(key)) keys.push(key)
    }
  }

  return (
    <>
      {keys.map((key) => (
        <CityTile key={key} tileKey={key} />
      ))}
    </>
  )
}
