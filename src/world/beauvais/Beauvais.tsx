import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { BUILDINGS, SPAWN, type Building } from './cityData'

/**
 * 🏙️  Beauvais généré depuis OpenStreetMap (le "Temps 3" du pipeline, voir docs/04).
 *
 * ⚠️ Toute la ville = ~34 000 bâtiments : impossible de tout afficher. Or le
 * brouillard (voir GameCanvas) masque déjà tout au-delà de ~110 m. On ne construit
 * donc et n'affiche QUE les TUILES proches du joueur (streaming) :
 *  - les bâtiments sont regroupés par tuile de TILE mètres (calcul léger, sans 3D) ;
 *  - à chaque fois que le joueur change de tuile, on monte les tuiles voisines et on
 *    démonte les autres. La géométrie d'une tuile n'est construite qu'à son montage,
 *    et libérée à son démontage.
 * → chargement quasi instantané et rendu léger, quelle que soit la taille de la ville.
 */

const TILE = 180 // côté d'une tuile, en mètres
const REACH = 1 // nombre d'anneaux de tuiles autour du joueur (1 = 3×3 tuiles)

const FACADES = [
  '#d8cdb8', '#cdbfa6', '#c8c4b9', '#d3c3a4', '#bfb4a0',
  '#c9b79a', '#baa98f', '#d6cbb0', '#c2a98c', '#cfc7bd',
]
const ROOFS = ['#8a7f72', '#7f7d79', '#9a6b57', '#6f6b64', '#8b6f5e', '#767c7a']

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function signedArea(pts: number[][]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return a / 2
}

/** Extrude + colore un bâtiment (façade + toit). */
function buildOne(b: Building, facade: THREE.Color, roof: THREE.Color): THREE.BufferGeometry | null {
  if (b.pts.length < 3) return null
  const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts

  const shape = new THREE.Shape()
  shape.moveTo(ring[0][0], -ring[0][1])
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], -ring[i][1])
  shape.closePath()

  // Cours intérieures (patios) : découpées comme des trous dans l'extrusion.
  if (b.holes) {
    for (const hole of b.holes) {
      if (hole.length < 3) continue
      const path = new THREE.Path()
      path.moveTo(hole[0][0], -hole[0][1])
      for (let i = 1; i < hole.length; i++) path.lineTo(hole[i][0], -hole[i][1])
      path.closePath()
      shape.holes.push(path)
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)

  if (b.kind) {
    // Monuments (cathédrale, églises) : pierre claire + toit ardoise → repères nets.
    facade.set('#e7e1d2')
    roof.set('#4d5b66')
  } else {
    facade.set(FACADES[Math.floor(hash01(b.cx, b.cz) * FACADES.length)])
    roof.set(ROOFS[Math.floor(hash01(b.cz, b.cx) * ROOFS.length)])
  }

  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let v = 0; v < pos.count; v++) {
    const c = pos.getY(v) >= b.h - 0.05 ? roof : facade
    colors[v * 3] = c.r
    colors[v * 3 + 1] = c.g
    colors[v * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

/** Regroupe les bâtiments par tuile (léger : pas de géométrie ici). */
function groupByTile(): Map<string, Building[]> {
  const map = new Map<string, Building[]>()
  for (const b of BUILDINGS) {
    const key = Math.floor(b.cx / TILE) + ':' + Math.floor(b.cz / TILE)
    let g = map.get(key)
    if (!g) map.set(key, (g = []))
    g.push(b)
  }
  return map
}

/** Clés des tuiles existantes autour d'une position monde. */
function tilesAround(px: number, pz: number, tiles: Map<string, Building[]>): string[] {
  const tx = Math.floor(px / TILE)
  const tz = Math.floor(pz / TILE)
  const out: string[] = []
  for (let dx = -REACH; dx <= REACH; dx++) {
    for (let dz = -REACH; dz <= REACH; dz++) {
      const k = tx + dx + ':' + (tz + dz)
      if (tiles.has(k)) out.push(k)
    }
  }
  return out
}

/** Une tuile : construit sa géométrie fusionnée à son montage, la libère au démontage. */
function BuildingTile({ buildings, material }: { buildings: Building[]; material: THREE.Material }) {
  const geometry = useMemo(() => {
    const facade = new THREE.Color()
    const roof = new THREE.Color()
    const geos: THREE.BufferGeometry[] = []
    for (const b of buildings) {
      const g = buildOne(b, facade, roof)
      if (g) geos.push(g)
    }
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    return merged
  }, [buildings])

  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}

export default function Beauvais() {
  const tiles = useMemo(groupByTile, [])
  const material = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap: toonGradient,
        side: THREE.DoubleSide,
      }),
    [],
  )

  // On sème les tuiles autour du spawn dès le départ (rendu immédiat, pas de trou).
  const [active, setActive] = useState<string[]>(() => tilesAround(SPAWN.x, SPAWN.z, tiles))
  const lastKey = useRef(Math.floor(SPAWN.x / TILE) + ':' + Math.floor(SPAWN.z / TILE))

  useFrame(() => {
    const p = usePlayerStore.getState().playerObject
    const px = p ? p.position.x : SPAWN.x
    const pz = p ? p.position.z : SPAWN.z
    const key = Math.floor(px / TILE) + ':' + Math.floor(pz / TILE)
    // On ne recalcule la liste que quand le joueur CHANGE de tuile (rare).
    if (key === lastKey.current) return
    lastKey.current = key
    setActive(tilesAround(px, pz, tiles))
  })

  return (
    <>
      {active.map((key) => (
        <BuildingTile key={key} buildings={tiles.get(key)!} material={material} />
      ))}
    </>
  )
}
