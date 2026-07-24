import { useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { WALLS, terrainHeight } from './cityData'

/**
 * 🧱 Murs et clôtures (OSM `barrier=wall/fence/hedge`).
 *
 * Chaque tracé devient une bande verticale (du sol à WALL_H). Tout est fusionné
 * en une seule géométrie (1 draw call). DoubleSide pour être visible des 2 côtés.
 */

const WALL_H = 1.6
const WALL_COLOR = '#9a938a'

function buildWallsGeometry(): THREE.BufferGeometry {
  const out: number[] = []
  const push = (x: number, y: number, z: number) => out.push(x, y, z)

  for (const wall of WALLS) {
    const pts = wall.pts
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      const ya = terrainHeight(ax, az)
      const yb = terrainHeight(bx, bz)
      // Quad vertical : (A sol, B sol, B haut) + (A sol, B haut, A haut)
      push(ax, ya, az); push(bx, yb, bz); push(bx, yb + WALL_H, bz)
      push(ax, ya, az); push(bx, yb + WALL_H, bz); push(ax, ya + WALL_H, az)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3))
  geo.computeVertexNormals()
  return geo
}

export default function Walls() {
  const geometry = useMemo(buildWallsGeometry, [])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshToonMaterial color={WALL_COLOR} gradientMap={toonGradient} side={THREE.DoubleSide} />
    </mesh>
  )
}
