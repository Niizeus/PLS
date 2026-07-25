import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight } from './cityData'

const MARKING = '#e8dfc7'
const Y_OFFSET = 0.105

interface Crosswalk {
  x: number
  z: number
  rot: number
  length: number
  width: number
  stripes: number
}

interface DashLine {
  x: number
  z: number
  rot: number
  length: number
  dash: number
  gap: number
}

const CROSSWALKS: Crosswalk[] = [
  { x: -38, z: -92, rot: 0.08, length: 8.5, width: 5.6, stripes: 6 },
  { x: 52, z: -88, rot: -0.12, length: 8, width: 5.2, stripes: 6 },
  { x: -118, z: -26, rot: Math.PI * 0.5, length: 7.5, width: 5, stripes: 5 },
  { x: 118, z: -18, rot: Math.PI * 0.5, length: 7.5, width: 5, stripes: 5 },
  { x: -44, z: 64, rot: -0.04, length: 8, width: 5.2, stripes: 6 },
  { x: 48, z: 66, rot: 0.07, length: 8, width: 5.2, stripes: 6 },
]

const DASH_LINES: DashLine[] = [
  { x: 0, z: -118, rot: Math.PI * 0.5, length: 145, dash: 3.5, gap: 5 },
  { x: -142, z: 0, rot: 0, length: 95, dash: 3, gap: 4.8 },
  { x: 142, z: 2, rot: 0, length: 95, dash: 3, gap: 4.8 },
]

function pushQuad(
  positions: number[],
  x: number,
  z: number,
  halfW: number,
  halfD: number,
  rot: number,
) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const corners: Array<[number, number]> = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ]
  const pts = corners.map(([lx, lz]) => {
    const wx = x + lx * c - lz * s
    const wz = z + lx * s + lz * c
    return [wx, terrainHeight(wx, wz) + Y_OFFSET, wz] as [number, number, number]
  })
  positions.push(...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3])
}

function buildMarkings() {
  const positions: number[] = []

  for (const crossing of CROSSWALKS) {
    const step = crossing.width / crossing.stripes
    const stripeDepth = step * 0.58
    for (let i = 0; i < crossing.stripes; i++) {
      const localZ = -crossing.width / 2 + step * (i + 0.5)
      const c = Math.cos(crossing.rot)
      const s = Math.sin(crossing.rot)
      const x = crossing.x - localZ * s
      const z = crossing.z + localZ * c
      pushQuad(positions, x, z, crossing.length / 2, stripeDepth / 2, crossing.rot)
    }
  }

  for (const line of DASH_LINES) {
    const stride = line.dash + line.gap
    for (let t = -line.length / 2; t <= line.length / 2; t += stride) {
      const c = Math.cos(line.rot)
      const s = Math.sin(line.rot)
      const x = line.x + t * c
      const z = line.z + t * s
      pushQuad(positions, x, z, line.dash / 2, 0.08, line.rot)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geometry.computeVertexNormals()
  return geometry
}

export default function CentreVilleRoadMarkings() {
  const geometry = useMemo(buildMarkings, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} renderOrder={5}>
      <meshBasicMaterial
        color={MARKING}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-5}
        polygonOffsetUnits={-5}
      />
    </mesh>
  )
}
