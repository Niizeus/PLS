import { useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { ROADS } from './cityData'

/**
 * 🛣️  Les routes de Beauvais (depuis OpenStreetMap).
 *
 * Chaque route est une polyligne + une largeur. On transforme chaque segment en
 * un petit rectangle plat posé au sol, et on fusionne TOUT en une seule géométrie
 * (comme les bâtiments) → un seul draw call. Les segments sont légèrement
 * rallongés à leurs extrémités pour combler les jointures dans les virages.
 */

const ROAD_Y = 0.03 // posé juste au-dessus du sol (évite le z-fighting)
const ROAD_COLOR = '#595d63' // bitume

function buildRoadsGeometry(): THREE.BufferGeometry {
  let segments = 0
  for (const r of ROADS) segments += Math.max(0, r.pts.length - 1)

  const positions = new Float32Array(segments * 6 * 3) // 2 triangles = 6 sommets / segment
  let o = 0

  for (const road of ROADS) {
    const half = road.w / 2
    const pts = road.pts
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      let dx = bx - ax
      let dz = bz - az
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
      // perpendiculaire (largeur) et extension aux bouts (jointures)
      const px = -dz * half
      const pz = dx * half
      const ex = dx * half
      const ez = dz * half
      const a0x = ax - ex
      const a0z = az - ez
      const b0x = bx + ex
      const b0z = bz + ez
      const c = [
        a0x + px, a0z + pz,
        a0x - px, a0z - pz,
        b0x - px, b0z - pz,
        a0x + px, a0z + pz,
        b0x - px, b0z - pz,
        b0x + px, b0z + pz,
      ]
      for (let k = 0; k < 6; k++) {
        positions[o++] = c[k * 2]
        positions[o++] = ROAD_Y
        positions[o++] = c[k * 2 + 1]
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

export default function Roads() {
  const geometry = useMemo(buildRoadsGeometry, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial color={ROAD_COLOR} gradientMap={toonGradient} side={THREE.DoubleSide} />
    </mesh>
  )
}
