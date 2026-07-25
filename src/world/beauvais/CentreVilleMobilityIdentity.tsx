import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

interface PedestrianEntry {
  id: string
  label: string
  x: number
  z: number
  rot: number
  width: number
}

interface VehicleCue {
  x: number
  z: number
  rot: number
  length: number
}

const PEDESTRIAN_ENTRIES: PedestrianEntry[] = [
  { id: '27-juin-west', label: 'PIETON', x: 205.4, z: -303.5, rot: 0.74, width: 7.2 },
  { id: '27-juin-east', label: 'PIETON', x: 518.5, z: -161.7, rot: 0.17, width: 7.2 },
  { id: 'gambetta-centre', label: 'PIETON', x: 239.1, z: 30.6, rot: -1.22, width: 7.6 },
  { id: 'gambetta-27', label: 'PIETON', x: 337.7, z: -194.2, rot: -1.15, width: 7.6 },
  { id: 'carnot-place', label: 'PIETON', x: 165, z: 135, rot: -0.62, width: 7.4 },
  { id: 'saint-pierre', label: 'PIETON', x: 40, z: 85, rot: -0.08, width: 7.8 },
  { id: 'taillerie', label: 'PIETON', x: 75, z: 235, rot: -0.22, width: 7.0 },
  { id: 'musee', label: 'PIETON', x: -58, z: -15, rot: 0.22, width: 6.6 },
]

const VEHICLE_CUES: VehicleCue[] = [
  { x: 0, z: -118, rot: Math.PI * 0.5, length: 120 },
  { x: -142, z: 0, rot: 0, length: 82 },
  { x: 142, z: 2, rot: 0, length: 82 },
  { x: 585, z: -45, rot: 0.05, length: 88 },
  { x: 647, z: -313, rot: 0.2, length: 72 },
  { x: 210, z: 1020, rot: 0.18, length: 80 },
]

const PAVING = ['#d6c7ad', '#c6b79f', '#b8ad99', '#e0d1b8']
const JOINT = '#655d52'
const BOLLARD = '#303235'
const BRASS = '#bd9144'
const VEHICLE_LINE = '#f1ead8'
const VEHICLE_EDGE = '#262a2f'
const Y_PED = 0.19
const Y_ROAD = 0.13

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

function addCylinder(
  geos: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  rt: number,
  rb: number,
  h: number,
  segments = 8,
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segments)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function local(x: number, z: number, rot: number, along: number, side: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return { x: x + c * along - s * side, z: z + s * along + c * side }
}

function pushQuad(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  pts2d: Array<[number, number]>,
  yOff: number,
) {
  const pts = pts2d.map(([x, z]) => [x, terrainHeight(x, z) + yOff, z] as [number, number, number])
  positions.push(...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3])
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function pushLine(lines: number[], x0: number, z0: number, x1: number, z1: number, yOff: number) {
  lines.push(x0, terrainHeight(x0, z0) + yOff, z0)
  lines.push(x1, terrainHeight(x1, z1) + yOff, z1)
}

function addPedestrianEntry(
  positions: number[],
  colors: number[],
  lines: number[],
  props: THREE.BufferGeometry[],
  entry: PedestrianEntry,
) {
  const color = new THREE.Color()
  const halfW = entry.width / 2
  const halfD = 2.4
  const cells = 5

  for (let i = 0; i < cells; i++) {
    const d0 = -halfD + (i / cells) * halfD * 2
    const d1 = -halfD + ((i + 1) / cells) * halfD * 2
    const a = local(entry.x, entry.z, entry.rot, d0, -halfW)
    const b = local(entry.x, entry.z, entry.rot, d1, -halfW)
    const c = local(entry.x, entry.z, entry.rot, d1, halfW)
    const d = local(entry.x, entry.z, entry.rot, d0, halfW)
    const mid = local(entry.x, entry.z, entry.rot, (d0 + d1) / 2, 0)
    if (isInsideBuilding(mid.x, mid.z)) continue
    color.set(PAVING[Math.floor(hash01(mid.x, mid.z) * PAVING.length)])
    pushQuad(positions, colors, color, [[a.x, a.z], [b.x, b.z], [c.x, c.z], [d.x, d.z]], Y_PED)
    pushLine(lines, a.x, a.z, d.x, d.z, Y_PED + 0.018)
    if (i === cells - 1) pushLine(lines, b.x, b.z, c.x, c.z, Y_PED + 0.018)
  }

  for (const side of [-1, 1]) {
    for (const along of [-1.7, 1.7]) {
      const p = local(entry.x, entry.z, entry.rot, along, side * (halfW + 0.65))
      if (isInsideBuilding(p.x, p.z)) continue
      const y = terrainHeight(p.x, p.z)
      addCylinder(props, new THREE.Color(BOLLARD), p.x, y + 0.45, p.z, 0.1, 0.14, 0.9, 8)
      addCylinder(props, new THREE.Color(BRASS), p.x, y + 0.94, p.z, 0.15, 0.18, 0.13, 8)
    }
  }
}

function addVehicleCue(positions: number[], colors: number[], cue: VehicleCue) {
  const line = new THREE.Color(VEHICLE_LINE)
  const edge = new THREE.Color(VEHICLE_EDGE)
  const half = cue.length / 2

  for (const side of [-1, 1]) {
    for (let t = -half; t < half; t += 9) {
      const a = local(cue.x, cue.z, cue.rot, t, side * 3.2)
      const b = local(cue.x, cue.z, cue.rot, Math.min(t + 4.4, half), side * 3.2)
      const c = local(cue.x, cue.z, cue.rot, Math.min(t + 4.4, half), side * 3.36)
      const d = local(cue.x, cue.z, cue.rot, t, side * 3.36)
      pushQuad(positions, colors, edge, [[a.x, a.z], [b.x, b.z], [c.x, c.z], [d.x, d.z]], Y_ROAD)
    }
  }

  for (let t = -half + 6; t < half; t += 18) {
    const a = local(cue.x, cue.z, cue.rot, t, -0.12)
    const b = local(cue.x, cue.z, cue.rot, Math.min(t + 5, half), -0.12)
    const c = local(cue.x, cue.z, cue.rot, Math.min(t + 5, half), 0.12)
    const d = local(cue.x, cue.z, cue.rot, t, 0.12)
    pushQuad(positions, colors, line, [[a.x, a.z], [b.x, b.z], [c.x, c.z], [d.x, d.z]], Y_ROAD + 0.01)
  }
}

function buildMobilityIdentity() {
  const pedestrianPositions: number[] = []
  const pedestrianColors: number[] = []
  const pedestrianLines: number[] = []
  const roadPositions: number[] = []
  const roadColors: number[] = []
  const props: THREE.BufferGeometry[] = []

  for (const entry of PEDESTRIAN_ENTRIES) addPedestrianEntry(pedestrianPositions, pedestrianColors, pedestrianLines, props, entry)
  for (const cue of VEHICLE_CUES) addVehicleCue(roadPositions, roadColors, cue)

  const pedestrian = new THREE.BufferGeometry()
  pedestrian.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pedestrianPositions), 3))
  pedestrian.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pedestrianColors), 3))
  pedestrian.computeVertexNormals()

  const pedestrianJoints = new THREE.BufferGeometry()
  pedestrianJoints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pedestrianLines), 3))

  const road = new THREE.BufferGeometry()
  road.setAttribute('position', new THREE.BufferAttribute(new Float32Array(roadPositions), 3))
  road.setAttribute('color', new THREE.BufferAttribute(new Float32Array(roadColors), 3))
  road.computeVertexNormals()

  const furniture = mergeGeometries(props, false)
  props.forEach((g) => g.dispose())
  return { pedestrian, pedestrianJoints, road, furniture }
}

export default function CentreVilleMobilityIdentity() {
  const { pedestrian, pedestrianJoints, road, furniture } = useMemo(buildMobilityIdentity, [])

  useEffect(
    () => () => {
      pedestrian.dispose()
      pedestrianJoints.dispose()
      road.dispose()
      furniture.dispose()
    },
    [pedestrian, pedestrianJoints, road, furniture],
  )

  return (
    <>
      <mesh geometry={road} receiveShadow renderOrder={6}>
        <meshBasicMaterial
          vertexColors
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-6}
          polygonOffsetUnits={-6}
        />
      </mesh>
      <mesh geometry={pedestrian} receiveShadow renderOrder={7}>
        <meshToonMaterial
          vertexColors
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-7}
          polygonOffsetUnits={-7}
        />
      </mesh>
      <lineSegments geometry={pedestrianJoints} renderOrder={8}>
        <lineBasicMaterial color={JOINT} transparent opacity={0.48} depthTest />
      </lineSegments>
      <mesh geometry={furniture} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {PEDESTRIAN_ENTRIES.map((entry) => (
        <Text
          key={entry.id}
          position={[entry.x, terrainHeight(entry.x, entry.z) + Y_PED + 0.05, entry.z]}
          rotation={[-Math.PI * 0.5, 0, entry.rot]}
          fontSize={0.42}
          color="#4b4138"
          anchorX="center"
          anchorY="middle"
          outlineColor="#f0e7d4"
          outlineWidth={0.018}
          maxWidth={3.8}
        >
          {entry.label}
        </Text>
      ))}
    </>
  )
}
