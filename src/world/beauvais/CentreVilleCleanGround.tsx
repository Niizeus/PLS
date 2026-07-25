import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

interface GroundPatch {
  id: string
  x: number
  z: number
  length: number
  width: number
  rot: number
  cell: number
  palette: string[]
  joint: string
}

const Y_OFFSET = 0.055

const PATCHES: GroundPatch[] = [
  {
    id: 'gambetta-slope',
    x: (338 + 103) / 2,
    z: (-194 + 268) / 2,
    length: Math.hypot(103 - 338, 268 + 194),
    width: 34,
    rot: Math.atan2(268 + 194, 103 - 338),
    cell: 7,
    palette: ['#b9ad98', '#c7baa3', '#aea38f', '#d0c2aa'],
    joint: '#6a6156',
  },
  {
    id: 'gambetta-intermarche-climb',
    x: (338 + 850) / 2,
    z: (-194 - 1140) / 2,
    length: Math.hypot(850 - 338, -1140 + 194),
    width: 42,
    rot: Math.atan2(-1140 + 194, 850 - 338),
    cell: 9,
    palette: ['#b5aa96', '#c4b79f', '#a79d8a', '#d0c1aa'],
    joint: '#655d52',
  },
  {
    id: 'intermarche-lidl-plateau',
    x: (850 + 1211) / 2,
    z: (-1140 - 2171) / 2,
    length: Math.hypot(1211 - 850, -2171 + 1140),
    width: 165,
    rot: Math.atan2(-2171 + 1140, 1211 - 850),
    cell: 12,
    palette: ['#a99f8d', '#b9ad99', '#c5b7a1', '#9f9687'],
    joint: '#5f584f',
  },
  {
    id: 'mairie-fontaine',
    x: 108,
    z: 262,
    length: 98,
    width: 62,
    rot: 0.12,
    cell: 5.2,
    palette: ['#cabfa9', '#bdb19c', '#d6cab4', '#ada38f'],
    joint: '#665d52',
  },
  {
    id: 'halles-flat',
    x: 228,
    z: 254,
    length: 112,
    width: 78,
    rot: -0.08,
    cell: 5,
    palette: ['#bfa991', '#c8b8a0', '#ad9b87', '#d1c2aa'],
    joint: '#66584d',
  },
]

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 125 || Math.abs(z - b.cz) > 125) continue
    if (pointInFootprint(x, z, b.pts)) return true
  }
  return false
}

function tint(color: THREE.Color, amount: number) {
  const out = color.clone()
  if (amount > 0) out.lerp(new THREE.Color('#f4ead6'), amount)
  else out.lerp(new THREE.Color('#5d554d'), -amount)
  return out
}

function local(patch: GroundPatch, lx: number, lz: number) {
  const c = Math.cos(patch.rot)
  const s = Math.sin(patch.rot)
  return { x: patch.x + lx * c - lz * s, z: patch.z + lx * s + lz * c }
}

function pushQuad(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  patch: GroundPatch,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
) {
  const a = local(patch, x0, z0)
  const b = local(patch, x1, z0)
  const c = local(patch, x1, z1)
  const d = local(patch, x0, z1)
  if (isInsideBuilding((a.x + c.x) / 2, (a.z + c.z) / 2)) return

  const pts = [a, b, c, d].map((p) => [p.x, terrainHeight(p.x, p.z) + Y_OFFSET, p.z] as const)
  positions.push(...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3])
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function pushJoint(lines: number[], patch: GroundPatch, x0: number, z0: number, x1: number, z1: number) {
  const a = local(patch, x0, z0)
  const b = local(patch, x1, z1)
  lines.push(a.x, terrainHeight(a.x, a.z) + Y_OFFSET + 0.012, a.z)
  lines.push(b.x, terrainHeight(b.x, b.z) + Y_OFFSET + 0.012, b.z)
}

function buildCleanGround() {
  const positions: number[] = []
  const colors: number[] = []
  const jointPositions: number[] = []
  const jointColors: number[] = []

  for (const patch of PATCHES) {
    const halfL = patch.length / 2
    const halfW = patch.width / 2
    for (let x = -halfL; x < halfL; x += patch.cell) {
      for (let z = -halfW; z < halfW; z += patch.cell) {
        const x1 = Math.min(x + patch.cell, halfL)
        const z1 = Math.min(z + patch.cell, halfW)
        const center = local(patch, (x + x1) / 2, (z + z1) / 2)
        const base = new THREE.Color(patch.palette[Math.floor(hash01(center.x, center.z) * patch.palette.length)])
        const color = tint(base, (hash01(center.x + 19, center.z - 13) - 0.5) * 0.1)
        pushQuad(positions, colors, color, patch, x, z, x1, z1)

        if (hash01(center.x + 4, center.z - 8) > 0.24) pushJoint(jointPositions, patch, x, z, x1, z)
        if (hash01(center.x - 6, center.z + 5) > 0.36) pushJoint(jointPositions, patch, x, z, x, z1)
      }
    }

    const jointColor = new THREE.Color(patch.joint)
    const linesForPatch = jointPositions.length / 3 / 2
    while (jointColors.length / 3 < linesForPatch * 2) jointColors.push(jointColor.r, jointColor.g, jointColor.b)
  }

  const ground = new THREE.BufferGeometry()
  ground.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  ground.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  ground.computeVertexNormals()

  const joints = new THREE.BufferGeometry()
  joints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(jointPositions), 3))
  joints.setAttribute('color', new THREE.BufferAttribute(new Float32Array(jointColors), 3))

  return { ground, joints }
}

export default function CentreVilleCleanGround() {
  const { ground, joints } = useMemo(buildCleanGround, [])

  useEffect(
    () => () => {
      ground.dispose()
      joints.dispose()
    },
    [ground, joints],
  )

  return (
    <>
      <mesh geometry={ground} receiveShadow renderOrder={1}>
        <meshToonMaterial
          vertexColors
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <lineSegments geometry={joints} renderOrder={2}>
        <lineBasicMaterial vertexColors transparent opacity={0.28} depthTest />
      </lineSegments>
    </>
  )
}
