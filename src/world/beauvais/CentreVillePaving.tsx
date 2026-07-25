import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

const PAVING_COLORS = ['#b9ae99', '#c6baa5', '#a99f8d', '#d1c5ad', '#958c7e']
const Y_OFFSET = 0.075

interface PavingPatch {
  x: number
  z: number
  w: number
  d: number
  cell: number
}

const PATCHES: PavingPatch[] = [
  { x: -105, z: -115, w: 210, d: 145, cell: 5.5 },
  { x: -145, z: -10, w: 80, d: 125, cell: 5 },
  { x: 65, z: -10, w: 80, d: 125, cell: 5 },
]

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 130 || Math.abs(z - b.cz) > 130) continue
    if (pointInFootprint(x, z, b.pts)) return true
  }
  return false
}

function pushPavingQuad(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
) {
  const y00 = terrainHeight(x0, z0) + Y_OFFSET
  const y10 = terrainHeight(x1, z0) + Y_OFFSET
  const y01 = terrainHeight(x0, z1) + Y_OFFSET
  const y11 = terrainHeight(x1, z1) + Y_OFFSET

  positions.push(x0, y00, z0, x1, y10, z0, x1, y11, z1)
  positions.push(x0, y00, z0, x1, y11, z1, x0, y01, z1)
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function pushJointLine(positions: number[], x0: number, z0: number, x1: number, z1: number) {
  positions.push(x0, terrainHeight(x0, z0) + Y_OFFSET + 0.01, z0)
  positions.push(x1, terrainHeight(x1, z1) + Y_OFFSET + 0.01, z1)
}

function buildPaving() {
  const positions: number[] = []
  const colors: number[] = []
  const jointPositions: number[] = []
  const color = new THREE.Color()

  for (const patch of PATCHES) {
    const xStart = patch.x
    const zStart = patch.z
    const xEnd = patch.x + patch.w
    const zEnd = patch.z + patch.d

    for (let x = xStart; x < xEnd; x += patch.cell) {
      for (let z = zStart; z < zEnd; z += patch.cell) {
        const x1 = Math.min(x + patch.cell, xEnd)
        const z1 = Math.min(z + patch.cell, zEnd)
        const cx = (x + x1) / 2
        const cz = (z + z1) / 2
        if (isInsideBuilding(cx, cz)) continue

        const index = Math.floor(hash01(cx, cz) * PAVING_COLORS.length)
        color.set(PAVING_COLORS[index])
        pushPavingQuad(positions, colors, color, x, z, x1, z1)

        if (hash01(cx + 11, cz - 7) > 0.24) pushJointLine(jointPositions, x, z, x1, z)
        if (hash01(cx - 5, cz + 13) > 0.3) pushJointLine(jointPositions, x, z, x, z1)
      }
    }
  }

  const paving = new THREE.BufferGeometry()
  paving.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  paving.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  paving.computeVertexNormals()

  const joints = new THREE.BufferGeometry()
  joints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(jointPositions), 3))

  return { paving, joints }
}

export default function CentreVillePaving() {
  const { paving, joints } = useMemo(buildPaving, [])

  useEffect(
    () => () => {
      paving.dispose()
      joints.dispose()
    },
    [paving, joints],
  )

  return (
    <>
      <mesh geometry={paving} receiveShadow renderOrder={1}>
        <meshToonMaterial
          vertexColors
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <lineSegments geometry={joints} renderOrder={2}>
        <lineBasicMaterial color="#675f54" transparent opacity={0.38} depthTest />
      </lineSegments>
    </>
  )
}
