import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BUILDINGS, terrainHeight } from './cityData'

const CENTRE_RADIUS = 620
const BASE_LINE = '#2f2924'
const PLINTH = '#9a8a74'
const Y_OFFSET = 0.11

function isCentreBuilding(cx: number, cz: number): boolean {
  return Math.abs(cx) <= CENTRE_RADIUS && Math.abs(cz) <= CENTRE_RADIUS
}

function signedArea(pts: number[][]): number {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    area += x1 * z2 - x2 * z1
  }
  return area / 2
}

function pushGroundLine(positions: number[], x1: number, z1: number, x2: number, z2: number) {
  positions.push(x1, terrainHeight(x1, z1) + Y_OFFSET, z1)
  positions.push(x2, terrainHeight(x2, z2) + Y_OFFSET, z2)
}

function pushPlinthQuad(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  nx: number,
  nz: number,
) {
  const inset = 0.045
  const h = 0.34
  const ax = x1 + nx * inset
  const az = z1 + nz * inset
  const bx = x2 + nx * inset
  const bz = z2 + nz * inset
  const y1 = terrainHeight(x1, z1) + 0.08
  const y2 = terrainHeight(x2, z2) + 0.08

  positions.push(ax, y1, az, bx, y2, bz, bx, y2 + h, bz)
  positions.push(ax, y1, az, bx, y2 + h, bz, ax, y1 + h, az)
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function buildBases() {
  const linePositions: number[] = []
  const plinthPositions: number[] = []
  const plinthColors: number[] = []
  const plinthColor = new THREE.Color(PLINTH)

  for (const b of BUILDINGS) {
    if (!isCentreBuilding(b.cx, b.cz) || b.pts.length < 3) continue
    const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts

    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 2 || len > 95) continue

      pushGroundLine(linePositions, ax, az, bx, bz)
      if (len < 5) continue

      const nx = dz / len
      const nz = -dx / len
      pushPlinthQuad(plinthPositions, plinthColors, plinthColor, ax, az, bx, bz, nx, nz)
    }
  }

  const lines = new THREE.BufferGeometry()
  lines.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3))

  const plinths = new THREE.BufferGeometry()
  plinths.setAttribute('position', new THREE.BufferAttribute(new Float32Array(plinthPositions), 3))
  plinths.setAttribute('color', new THREE.BufferAttribute(new Float32Array(plinthColors), 3))
  plinths.computeVertexNormals()

  return { lines, plinths }
}

export default function CentreVilleBuildingBases() {
  const { lines, plinths } = useMemo(buildBases, [])

  useEffect(
    () => () => {
      lines.dispose()
      plinths.dispose()
    },
    [lines, plinths],
  )

  return (
    <>
      <mesh geometry={plinths} renderOrder={3} receiveShadow>
        <meshToonMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={lines} renderOrder={7}>
        <lineBasicMaterial color={BASE_LINE} transparent opacity={0.62} depthTest />
      </lineSegments>
    </>
  )
}
