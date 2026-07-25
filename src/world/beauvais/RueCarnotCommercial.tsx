import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

const CARNOT_POINTS = [
  { lat: 49.43108, lon: 2.08337 },
  { lat: 49.4316832, lon: 2.0842057 },
  { lat: 49.4318179, lon: 2.0841599 },
]

const SHOP_LABELS = ['CARNOT', 'MODE', 'OPTIC', 'CAFE', 'VIN', 'LOCAL']
const SIGN_COLORS = ['#b84a42', '#2f7184', '#d0a63e', '#5d6f95', '#7a5287']
const PAVING = ['#b9ae99', '#cabda7', '#a99f8d', '#d4c7b0']
const JOINT = '#655d52'
const Y_OFFSET = 0.16

function project(lat: number, lon: number) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return { x, z }
}

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 75 || Math.abs(z - b.cz) > 75) continue
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

function pushQuad(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
) {
  const p = [a, b, c, d].map(([x, z]) => [x, terrainHeight(x, z) + Y_OFFSET, z] as [number, number, number])
  positions.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3])
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function pushLine(lines: number[], x0: number, z0: number, x1: number, z1: number) {
  lines.push(x0, terrainHeight(x0, z0) + Y_OFFSET + 0.02, z0)
  lines.push(x1, terrainHeight(x1, z1) + Y_OFFSET + 0.02, z1)
}

function buildAxis() {
  const pts = CARNOT_POINTS.map((p) => project(p.lat, p.lon))
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const geos: THREE.BufferGeometry[] = []
  const labels: Array<{ text: string; x: number; z: number; rot: number }> = []

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    const ux = dx / len
    const uz = dz / len
    const nx = -uz
    const nz = ux
    const rot = Math.atan2(uz, ux)
    const step = 5
    const half = 4.5

    for (let t = 0; t < len; t += step) {
      const t1 = Math.min(t + step, len)
      const x0 = a.x + ux * t
      const z0 = a.z + uz * t
      const x1 = a.x + ux * t1
      const z1 = a.z + uz * t1
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      color.set(PAVING[Math.floor(hash01(cx, cz) * PAVING.length)])
      pushQuad(
        positions,
        colors,
        color,
        [x0 - nx * half, z0 - nz * half],
        [x1 - nx * half, z1 - nz * half],
        [x1 + nx * half, z1 + nz * half],
        [x0 + nx * half, z0 + nz * half],
      )
      if (hash01(cx + 2, cz - 5) > 0.2) pushLine(lines, x0 - nx * half, z0 - nz * half, x0 + nx * half, z0 + nz * half)
    }

    for (let t = 7; t < len - 5; t += 10.5) {
      for (const side of [-1, 1]) {
        const x = a.x + ux * t + nx * side * 6.2
        const z = a.z + uz * t + nz * side * 6.2
        if (isInsideBuilding(x, z)) continue
        const y = terrainHeight(x, z)
        const signColor = new THREE.Color(SIGN_COLORS[Math.floor(hash01(x, z) * SIGN_COLORS.length)])
        addBox(geos, signColor, x, y + 1.95, z, 2.4, 0.62, 0.12, rot)
        addBox(geos, new THREE.Color('#2c3438'), x, y + 1.3, z, 0.1, 1.2, 0.1, rot)
        addBox(geos, new THREE.Color('#6e8e91'), x, y + 0.56, z, 2.25, 1.05, 0.16, rot)
        addBox(geos, signColor, x + nx * side * 0.55, y + 1.12, z + nz * side * 0.55, 2.25, 0.12, 1.0, rot)
        labels.push({ text: SHOP_LABELS[(labels.length + i) % SHOP_LABELS.length], x, z, rot })
      }
    }
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

export default function RueCarnotCommercial() {
  const { paving, joints, props, labels } = useMemo(buildAxis, [])

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
      {labels.map((label, i) => (
        <Text
          key={`${label.text}-${i}`}
          position={[label.x, terrainHeight(label.x, label.z) + 1.96, label.z]}
          rotation={[0, label.rot, 0]}
          fontSize={0.48}
          color="#f5ecd9"
          anchorX="center"
          anchorY="middle"
          outlineColor="#25211e"
          outlineWidth={0.03}
        >
          {label.text}
        </Text>
      ))}
    </>
  )
}
