import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

const CX = 205.4
const CZ = -303.5
const ROT_27 = 0.74
const ROT_GESVRES = -0.08
const Y_OFFSET = 0.14

const STONE = '#b8aa92'
const STONE_DARK = '#7d715f'
const MEMORY_RED = '#b84a42'
const CREAM = '#f0e7d4'
const IRON = '#293136'
const WOOD = '#74523b'
const PLASTER = '#dacdb6'
const ART_BLUE = '#2f7184'
const GLASS = '#314d5a'
const PAVING = ['#cdbda4', '#b8ad99', '#d6c7ad', '#a99f8d']
const JOINT = '#655d52'

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 72 || Math.abs(z - b.cz) > 72) continue
    if (pointInFootprint(x, z, b.pts)) return true
  }
  return false
}

function tintGeometry(geo: THREE.BufferGeometry, color: THREE.Color) {
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

function addBox(
  geos: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotY = 0,
) {
  const geo = new THREE.BoxGeometry(sx, sy, sz)
  tintGeometry(geo, color)
  geo.rotateY(rotY)
  geo.translate(x, y, z)
  geos.push(geo)
}

function addCylinder(
  geos: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  rt: number,
  rb: number,
  h: number,
  segments = 10,
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segments)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function offset(ox: number, oz: number, rot = ROT_27) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return { x: CX + ox * c - oz * s, z: CZ + ox * s + oz * c }
}

function pushQuad(
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

function pushLine(lines: number[], x0: number, z0: number, x1: number, z1: number) {
  lines.push(x0, terrainHeight(x0, z0) + Y_OFFSET + 0.02, z0)
  lines.push(x1, terrainHeight(x1, z1) + Y_OFFSET + 0.02, z1)
}

function buildPaving() {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const cell = 4.2
  const halfW = 24
  const halfD = 19

  for (let x = CX - halfW; x < CX + halfW; x += cell) {
    for (let z = CZ - halfD; z < CZ + halfD; z += cell) {
      const x1 = Math.min(x + cell, CX + halfW)
      const z1 = Math.min(z + cell, CZ + halfD)
      const mx = (x + x1) / 2
      const mz = (z + z1) / 2
      if (isInsideBuilding(mx, mz)) continue
      color.set(PAVING[Math.floor(hash01(mx, mz) * PAVING.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(mx + 4, mz - 9) > 0.2) pushLine(lines, x, z, x1, z)
      if (hash01(mx - 7, mz + 5) > 0.28) pushLine(lines, x, z, x, z1)
    }
  }

  const paving = new THREE.BufferGeometry()
  paving.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  paving.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  paving.computeVertexNormals()

  const joints = new THREE.BufferGeometry()
  joints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { paving, joints }
}

function addGhostGate(geos: THREE.BufferGeometry[]) {
  for (const side of [-1, 1]) {
    const p = offset(-7.2, side * 4.7)
    const y = terrainHeight(p.x, p.z)
    addCylinder(geos, new THREE.Color(STONE), p.x, y + 1.45, p.z, 1.0, 1.18, 2.9, 12)
    addCylinder(geos, new THREE.Color(STONE_DARK), p.x, y + 2.98, p.z, 1.06, 1.16, 0.18, 12)
    addBox(geos, new THREE.Color(STONE_DARK), p.x, y + 1.52, p.z, 0.18, 0.62, 0.12, ROT_27 + Math.PI * 0.5)
  }
  const arch = offset(-7.2, 0)
  const ay = terrainHeight(arch.x, arch.z)
  addBox(geos, new THREE.Color(STONE), arch.x, ay + 3.0, arch.z, 8.6, 0.54, 0.72, ROT_27)
  addBox(geos, new THREE.Color(MEMORY_RED), arch.x, ay + 3.38, arch.z, 7.7, 0.34, 0.14, ROT_27)
}

function addCulturalCorner(geos: THREE.BufferGeometry[]) {
  const p = offset(8.5, -8.2, ROT_GESVRES)
  const y = terrainHeight(p.x, p.z)
  addBox(geos, new THREE.Color('#d6c8ad'), p.x, y + 1.25, p.z, 7.8, 2.5, 0.24, ROT_GESVRES)
  addBox(geos, new THREE.Color(ART_BLUE), p.x, y + 2.75, p.z, 7.6, 0.46, 0.18, ROT_GESVRES)
  for (let i = -2; i <= 2; i++) {
    addBox(geos, new THREE.Color(GLASS), p.x + i * 1.28, y + 1.42, p.z - 0.12, 0.72, 0.78, 0.08, ROT_GESVRES)
  }

  for (const [ox, oz, color] of [
    [13.8, -4.5, '#d0a63e'],
    [15.4, -4.0, '#7a5287'],
    [17.0, -3.4, '#2f7184'],
  ] as Array<[number, number, string]>) {
    const s = offset(ox, oz, ROT_GESVRES)
    const sy = terrainHeight(s.x, s.z)
    addCylinder(geos, new THREE.Color(IRON), s.x, sy + 0.86, s.z, 0.07, 0.09, 1.72, 8)
    addBox(geos, new THREE.Color(color), s.x + 0.22, sy + 1.48, s.z, 0.55, 0.38, 0.05, ROT_GESVRES)
  }
}

function addStreetLife(geos: THREE.BufferGeometry[]) {
  for (const [ox, oz, rot] of [
    [1, 6.2, ROT_27],
    [9, 5.2, ROT_27],
    [16, 5.8, ROT_27],
  ] as Array<[number, number, number]>) {
    const p = offset(ox, oz)
    if (isInsideBuilding(p.x, p.z)) continue
    const y = terrainHeight(p.x, p.z)
    addCylinder(geos, new THREE.Color('#70513b'), p.x, y + 0.38, p.z, 0.08, 0.1, 0.76, 8)
    addCylinder(geos, new THREE.Color('#c4a46e'), p.x, y + 0.8, p.z, 0.6, 0.68, 0.08, 12)
    addBox(geos, new THREE.Color(IRON), p.x - Math.cos(rot) * 0.62, y + 0.42, p.z - Math.sin(rot) * 0.62, 0.55, 0.08, 0.55, rot)
    addBox(geos, new THREE.Color(IRON), p.x + Math.cos(rot) * 0.62, y + 0.42, p.z + Math.sin(rot) * 0.62, 0.55, 0.08, 0.55, rot)
  }

  for (const [ox, oz] of [
    [4.8, -6.0],
    [12.4, -6.6],
  ] as Array<[number, number]>) {
    const p = offset(ox, oz)
    const y = terrainHeight(p.x, p.z)
    addBox(geos, new THREE.Color(PLASTER), p.x, y + 1.05, p.z, 1.6, 1.25, 0.16, ROT_27)
    addBox(geos, new THREE.Color(WOOD), p.x, y + 1.05, p.z - 0.03, 0.18, 1.35, 0.2, ROT_27)
    addBox(geos, new THREE.Color(WOOD), p.x - Math.cos(ROT_27) * 0.45, y + 1.05, p.z - Math.sin(ROT_27) * 0.45, 0.1, 1.28, 0.2, ROT_27 + 0.45)
    addBox(geos, new THREE.Color(WOOD), p.x + Math.cos(ROT_27) * 0.45, y + 1.05, p.z + Math.sin(ROT_27) * 0.45, 0.1, 1.28, 0.2, ROT_27 - 0.45)
  }
}

function buildProps() {
  const geos: THREE.BufferGeometry[] = []
  addGhostGate(geos)
  addCulturalCorner(geos)
  addStreetLife(geos)
  const props = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return props
}

export default function BreslesGesvresCorner() {
  const { paving, joints } = useMemo(buildPaving, [])
  const props = useMemo(buildProps, [])
  const gateLabel = offset(-7.2, 0)
  const artLabel = offset(8.5, -8.2, ROT_GESVRES)

  useEffect(
    () => () => {
      paving.dispose()
      joints.dispose()
      props.dispose()
    },
    [paving, joints, props],
  )

  return (
    <>
      <mesh geometry={paving} receiveShadow renderOrder={2}>
        <meshToonMaterial
          vertexColors
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
      <lineSegments geometry={joints} renderOrder={3}>
        <lineBasicMaterial color={JOINT} transparent opacity={0.43} depthTest />
      </lineSegments>
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[gateLabel.x, terrainHeight(gateLabel.x, gateLabel.z) + 3.4, gateLabel.z + 0.08]}
        rotation={[0, ROT_27, 0]}
        fontSize={0.34}
        color={CREAM}
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.026}
        maxWidth={6.8}
      >
        PORTE DE BRESLES
      </Text>
      <Text
        position={[artLabel.x, terrainHeight(artLabel.x, artLabel.z) + 2.76, artLabel.z + 0.12]}
        rotation={[0, ROT_GESVRES, 0]}
        fontSize={0.32}
        color={CREAM}
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.022}
        maxWidth={6.8}
      >
        ECOLE D'ART
      </Text>
    </>
  )
}
