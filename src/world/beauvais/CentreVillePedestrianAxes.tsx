import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const Y_OFFSET = 0.145

interface AxisPoint {
  lat?: number
  lon?: number
  x?: number
  z?: number
}

interface PedestrianAxis {
  id: string
  label: string
  width: number
  color: string
  points: AxisPoint[]
}

const AXES: PedestrianAxis[] = [
  {
    id: '27-juin',
    label: 'Rue du 27 Juin',
    width: 6.2,
    color: '#d1c1a4',
    points: [
      { x: 205.4, z: -303.5 },
      { x: 238.3, z: -274.8 },
      { x: 278.8, z: -240.9 },
      { x: 337.7, z: -194.2 },
      { x: 351.8, z: -190.4 },
      { x: 432.2, z: -176 },
      { x: 518.5, z: -161.7 },
    ],
  },
  {
    id: 'gambetta',
    label: 'Rue Gambetta',
    width: 6.8,
    color: '#c6b79f',
    points: [
      { x: 239.1, z: 30.6 },
      { x: 244.7, z: 14.3 },
      { x: 287.7, z: -96.9 },
      { x: 293.8, z: -108.4 },
      { x: 301.7, z: -122 },
      { x: 331.4, z: -180 },
      { x: 337.7, z: -194.2 },
    ],
  },
  {
    id: 'saint-pierre',
    label: 'Rue Saint-Pierre',
    width: 7.2,
    color: '#c8baa5',
    points: [
      { lat: 49.43245, lon: 2.08158 },
      { lat: 49.43184, lon: 2.08173 },
      { lat: 49.43128, lon: 2.08174 },
    ],
  },
  {
    id: 'taillerie',
    label: 'Rue de la Taillerie',
    width: 6.4,
    color: '#bcae98',
    points: [
      { lat: 49.43108, lon: 2.08158 },
      { lat: 49.4306, lon: 2.08174 },
      { lat: 49.43025, lon: 2.08208 },
    ],
  },
  {
    id: 'malherbe',
    label: 'Rue Malherbe',
    width: 5.8,
    color: '#d0c2aa',
    points: [
      { lat: 49.43074, lon: 2.08122 },
      { lat: 49.4305, lon: 2.08166 },
      { lat: 49.43035, lon: 2.08225 },
    ],
  },
  {
    id: 'desgroux',
    label: 'Rue Desgroux',
    width: 5.6,
    color: '#b5aa96',
    points: [
      { lat: 49.43032, lon: 2.08155 },
      { lat: 49.42978, lon: 2.08195 },
      { lat: 49.42928, lon: 2.08218 },
    ],
  },
  {
    id: 'musee',
    label: 'Rue du Musee',
    width: 5.6,
    color: '#cfc0a7',
    points: [
      { lat: 49.43288, lon: 2.08015 },
      { lat: 49.43234, lon: 2.08062 },
      { lat: 49.43202, lon: 2.08118 },
    ],
  },
  {
    id: 'saint-etienne-link',
    label: 'Saint-Etienne',
    width: 6.8,
    color: '#c4b59d',
    points: [
      { lat: 49.4301, lon: 2.08218 },
      { lat: 49.4295, lon: 2.08162 },
      { lat: 49.42916, lon: 2.0809 },
    ],
  },
]

const JOINT = '#655d52'
const BRASS = '#bd9144'
const IRON = '#293136'
const WOOD = '#74523b'
const PLASTER = '#dbcdb4'
const SIGN_BLUE = '#2f7184'
const MEMORY_RED = '#b84a42'

function project(lat: number, lon: number) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return { x, z }
}

function pointToWorld(point: AxisPoint) {
  if (point.x !== undefined && point.z !== undefined) return { x: point.x, z: point.z }
  return project(point.lat ?? ORIGIN.lat, point.lon ?? ORIGIN.lon)
}

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 80 || Math.abs(z - b.cz) > 80) continue
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
  segments = 8,
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segments)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function addStreetIdentityCue(
  props: THREE.BufferGeometry[],
  axis: PedestrianAxis,
  x: number,
  z: number,
  rot: number,
  side: number,
) {
  const y = terrainHeight(x, z)
  if (axis.id === '27-juin') {
    addBox(props, new THREE.Color(PLASTER), x, y + 1.05, z, 2.0, 1.2, 0.16, rot)
    addBox(props, new THREE.Color(WOOD), x, y + 1.05, z - side * 0.02, 0.16, 1.32, 0.2, rot)
    addBox(props, new THREE.Color(WOOD), x - Math.cos(rot) * 0.48, y + 1.05, z - Math.sin(rot) * 0.48, 0.12, 1.3, 0.2, rot + 0.45)
    addBox(props, new THREE.Color(WOOD), x + Math.cos(rot) * 0.48, y + 1.05, z + Math.sin(rot) * 0.48, 0.12, 1.3, 0.2, rot - 0.45)
    addBox(props, new THREE.Color(MEMORY_RED), x, y + 1.86, z, 1.9, 0.32, 0.08, rot)
    return
  }

  if (axis.id === 'gambetta') {
    addBox(props, new THREE.Color(SIGN_BLUE), x, y + 1.72, z, 2.35, 0.42, 0.1, rot)
    addBox(props, new THREE.Color('#e8dcc5'), x, y + 1.72, z + side * 0.04, 0.68, 0.16, 0.12, rot)
    addBox(props, new THREE.Color('#6e8e91'), x, y + 0.72, z, 2.05, 0.9, 0.16, rot)
  }
}

function pushQuad(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
) {
  const pts = [a, b, c, d].map(([x, z]) => [x, terrainHeight(x, z) + Y_OFFSET, z] as [number, number, number])
  positions.push(...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3])
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function pushLine(lines: number[], x0: number, z0: number, x1: number, z1: number) {
  lines.push(x0, terrainHeight(x0, z0) + Y_OFFSET + 0.018, z0)
  lines.push(x1, terrainHeight(x1, z1) + Y_OFFSET + 0.018, z1)
}

function addAxisSegment(
  positions: number[],
  colors: number[],
  lines: number[],
  props: THREE.BufferGeometry[],
  labels: Array<{ id: string; label: string; x: number; z: number; rot: number; secondary?: boolean }>,
  axis: PedestrianAxis,
  a: { x: number; z: number },
  b: { x: number; z: number },
  segmentIndex: number,
) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  if (len < 1) return
  const ux = dx / len
  const uz = dz / len
  const nx = -uz
  const nz = ux
  const rot = Math.atan2(uz, ux)
  const half = axis.width / 2
  const color = new THREE.Color(axis.color)
  const step = 4.4

  for (let t = 0; t < len; t += step) {
    const t1 = Math.min(t + step, len)
    const x0 = a.x + ux * t
    const z0 = a.z + uz * t
    const x1 = a.x + ux * t1
    const z1 = a.z + uz * t1
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    if (isInsideBuilding(cx, cz)) continue

    color.offsetHSL(0, 0, (hash01(cx, cz) - 0.5) * 0.08)
    pushQuad(
      positions,
      colors,
      color,
      [x0 - nx * half, z0 - nz * half],
      [x1 - nx * half, z1 - nz * half],
      [x1 + nx * half, z1 + nz * half],
      [x0 + nx * half, z0 + nz * half],
    )
    color.set(axis.color)

    if (hash01(cx + 3, cz - 8) > 0.18) pushLine(lines, x0 - nx * half, z0 - nz * half, x0 + nx * half, z0 + nz * half)
    pushLine(lines, x0 - nx * half, z0 - nz * half, x1 - nx * half, z1 - nz * half)
    pushLine(lines, x0 + nx * half, z0 + nz * half, x1 + nx * half, z1 + nz * half)
  }

  for (const side of [-1, 1]) {
    for (let t = 7 + segmentIndex * 2; t < len - 5; t += 18) {
      const x = a.x + ux * t + nx * side * (half + 0.7)
      const z = a.z + uz * t + nz * side * (half + 0.7)
      if (isInsideBuilding(x, z)) continue
      const y = terrainHeight(x, z)
      addCylinder(props, new THREE.Color(IRON), x, y + 0.42, z, 0.1, 0.13, 0.84, 8)
      addCylinder(props, new THREE.Color(BRASS), x, y + 0.93, z, 0.16, 0.18, 0.16, 8)
      if ((axis.id === '27-juin' || axis.id === 'gambetta') && hash01(x + side * 4, z - t) > 0.58) {
        addStreetIdentityCue(props, axis, x + nx * side * 0.72, z + nz * side * 0.72, rot, side)
      }
    }
  }

  if (segmentIndex === 0) {
    const t = Math.min(len * 0.58, len - 3)
    const x = a.x + ux * t
    const z = a.z + uz * t
    labels.push({ id: axis.id, label: axis.label, x, z, rot })
  }

  const importantRelay =
    (axis.id === '27-juin' && (segmentIndex === 2 || segmentIndex === 5)) ||
    (axis.id === 'gambetta' && (segmentIndex === 1 || segmentIndex === 4))
  if (importantRelay) {
    const t = Math.max(len * 0.45, 4)
    const x = a.x + ux * t
    const z = a.z + uz * t
    labels.push({ id: `${axis.id}-${segmentIndex}-relay`, label: axis.label, x, z, rot, secondary: true })
  }
}

function buildAxes() {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const geos: THREE.BufferGeometry[] = []
  const labels: Array<{ id: string; label: string; x: number; z: number; rot: number; secondary?: boolean }> = []

  for (const axis of AXES) {
    const pts = axis.points.map(pointToWorld)
    for (let i = 0; i < pts.length - 1; i++) addAxisSegment(positions, colors, lines, geos, labels, axis, pts[i], pts[i + 1], i)
  }

  const paving = new THREE.BufferGeometry()
  paving.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  paving.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  paving.computeVertexNormals()

  const joints = new THREE.BufferGeometry()
  joints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))

  const props = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return { paving, joints, props, labels }
}

export default function CentreVillePedestrianAxes() {
  const { paving, joints, props, labels } = useMemo(buildAxes, [])

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
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>
      <lineSegments geometry={joints} renderOrder={3}>
        <lineBasicMaterial color={JOINT} transparent opacity={0.42} depthTest />
      </lineSegments>
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {labels.map((label) => (
        <Text
          key={label.id}
          position={[label.x, terrainHeight(label.x, label.z) + 0.22, label.z]}
          rotation={[-Math.PI * 0.5, 0, label.rot]}
          fontSize={label.secondary ? 0.42 : 0.54}
          color="#f4ead6"
          anchorX="center"
          anchorY="middle"
          outlineColor="#4a4138"
          outlineWidth={0.022}
          maxWidth={5.6}
        >
          {label.label}
        </Text>
      ))}
    </>
  )
}
