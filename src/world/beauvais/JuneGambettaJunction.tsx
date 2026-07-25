import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

const CX = 337.7
const CZ = -194.2
const ROT_27_JUIN = 0.67
const ROT_GAMBETTA = -1.15
const Y_OFFSET = 0.155

const PAVING = ['#d0c0a3', '#c1b39c', '#b3a993', '#dccdb3']
const JOINT = '#655d52'
const BLUE = '#245678'
const CREAM = '#f0e7d4'
const IRON = '#293136'
const STONE = '#bba991'
const WOOD = '#74523b'
const RED = '#b84a42'
const PLANT = '#4d7048'

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 70 || Math.abs(z - b.cz) > 70) continue
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

function addStreetPlaque(
  geos: THREE.BufferGeometry[],
  labels: Array<{ id: string; text: string; x: number; z: number; rot: number; y: number; size: number }>,
  id: string,
  text: string,
  x: number,
  z: number,
  rot: number,
) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(IRON), x, y + 1.04, z, 0.1, 1.8, 0.1, rot)
  addBox(geos, new THREE.Color(BLUE), x, y + 2.0, z, 3.4, 0.48, 0.12, rot)
  addBox(geos, new THREE.Color(CREAM), x, y + 2.0, z + 0.06, 3.62, 0.08, 0.14, rot)
  addBox(geos, new THREE.Color(CREAM), x, y + 1.72, z + 0.06, 3.62, 0.08, 0.14, rot)
  labels.push({ id, text, x, z: z + 0.12, rot, y: y + 2.02, size: 0.25 })
}

function addMemoryCorner(geos: THREE.BufferGeometry[], x: number, z: number) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(STONE), x, y + 0.36, z, 2.2, 0.52, 1.25, ROT_27_JUIN)
  addBox(geos, new THREE.Color(WOOD), x, y + 1.35, z, 2.6, 1.6, 0.18, ROT_27_JUIN)
  addBox(geos, new THREE.Color(RED), x, y + 2.28, z, 2.4, 0.36, 0.12, ROT_27_JUIN)
  addBox(geos, new THREE.Color(CREAM), x, y + 2.28, z + 0.07, 1.2, 0.08, 0.14, ROT_27_JUIN)
}

function addPlanter(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  if (isInsideBuilding(x, z)) return
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color('#77695a'), x, y + 0.28, z, 1.25, 0.52, 0.72, rot)
  addBox(geos, new THREE.Color(PLANT), x, y + 0.65, z, 0.94, 0.34, 0.48, rot)
}

function buildPaving() {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const cell = 4.1
  const half = 18

  for (let x = CX - half; x < CX + half; x += cell) {
    for (let z = CZ - half; z < CZ + half; z += cell) {
      const x1 = Math.min(x + cell, CX + half)
      const z1 = Math.min(z + cell, CZ + half)
      const mx = (x + x1) / 2
      const mz = (z + z1) / 2
      if ((mx - CX) ** 2 + (mz - CZ) ** 2 > half ** 2) continue
      if (isInsideBuilding(mx, mz)) continue
      color.set(PAVING[Math.floor(hash01(mx, mz) * PAVING.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(mx + 4, mz - 9) > 0.18) pushLine(lines, x, z, x1, z)
      if (hash01(mx - 7, mz + 5) > 0.24) pushLine(lines, x, z, x, z1)
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

function buildJunctionProps() {
  const geos: THREE.BufferGeometry[] = []
  const labels: Array<{ id: string; text: string; x: number; z: number; rot: number; y: number; size: number }> = []

  const y = terrainHeight(CX, CZ)
  addCylinder(geos, new THREE.Color('#8f806b'), CX, y + 0.045, CZ, 2.3, 2.55, 0.09, 18)
  addCylinder(geos, new THREE.Color(CREAM), CX, y + 0.105, CZ, 1.2, 1.34, 0.08, 18)

  addStreetPlaque(geos, labels, '27-juin-plaque', '27 JUIN', CX + 10.8, CZ + 7.6, ROT_27_JUIN)
  addStreetPlaque(geos, labels, 'gambetta-plaque', 'GAMBETTA', CX - 9.4, CZ - 7.2, ROT_GAMBETTA)
  addMemoryCorner(geos, CX + 13.5, CZ - 8.5)

  for (const [x, z, rot] of [
    [CX - 12.5, CZ + 11.5, ROT_GAMBETTA],
    [CX + 12.5, CZ + 11.2, ROT_27_JUIN],
    [CX - 13, CZ - 12, ROT_27_JUIN],
  ] as Array<[number, number, number]>) {
    addPlanter(geos, x, z, rot)
  }

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const x = CX + Math.cos(a) * 15.5
    const z = CZ + Math.sin(a) * 15.5
    if (isInsideBuilding(x, z)) continue
    addCylinder(geos, new THREE.Color(IRON), x, terrainHeight(x, z) + 0.44, z, 0.1, 0.13, 0.88, 8)
  }

  const props = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return { props, labels }
}

export default function JuneGambettaJunction() {
  const { paving, joints } = useMemo(buildPaving, [])
  const { props, labels } = useMemo(buildJunctionProps, [])

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
        <lineBasicMaterial color={JOINT} transparent opacity={0.45} depthTest />
      </lineSegments>
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[CX, terrainHeight(CX, CZ) + 0.19, CZ]}
        rotation={[-Math.PI * 0.5, 0, ROT_27_JUIN]}
        fontSize={0.64}
        color="#4b4138"
        anchorX="center"
        anchorY="middle"
        outlineColor={CREAM}
        outlineWidth={0.018}
      >
        27
      </Text>
      {labels.map((label) => (
        <Text
          key={label.id}
          position={[label.x, label.y, label.z]}
          rotation={[0, label.rot, 0]}
          fontSize={label.size}
          color={CREAM}
          anchorX="center"
          anchorY="middle"
          outlineColor="#1f2224"
          outlineWidth={0.018}
          maxWidth={3.1}
        >
          {label.text}
        </Text>
      ))}
    </>
  )
}
