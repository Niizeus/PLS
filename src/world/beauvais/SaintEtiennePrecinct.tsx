import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight, type Building } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const SAINT_ETIENNE_LAT = 49.428454
const SAINT_ETIENNE_LON = 2.080667
const Y_OFFSET = 0.15

const PAVING = ['#b9ae99', '#c9bda7', '#a99f8c', '#d1c5ad']
const JOINT = '#635b51'
const STONE = '#d4cab4'
const ROMAN_STONE = '#b9a98f'
const GLASS = '#2d4a5c'
const ROOF = '#38454c'
const STAINED = ['#2f7184', '#b84a42', '#d1a342', '#6f5b8e', '#5f8b5a']

function project(lat: number, lon: number) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return { x, z }
}

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
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

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 100 || Math.abs(z - b.cz) > 100) continue
    if (pointInFootprint(x, z, b.pts)) return true
  }
  return false
}

function findSaintEtienneBuilding(): Building | null {
  const target = project(SAINT_ETIENNE_LAT, SAINT_ETIENNE_LON)
  let best: Building | null = null
  let bestD = Infinity
  for (const b of BUILDINGS) {
    if (b.kind !== 'church') continue
    const d = (b.cx - target.x) ** 2 + (b.cz - target.z) ** 2
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
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

function addCylinder(geos: THREE.BufferGeometry[], color: THREE.Color, x: number, y: number, z: number, rt: number, rb: number, h: number) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, 10)
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

function buildChurchSquare(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const halfW = 54
  const halfD = 42
  const cell = 5.2

  for (let x = cx - halfW; x < cx + halfW; x += cell) {
    for (let z = cz - halfD; z < cz + halfD; z += cell) {
      const x1 = Math.min(x + cell, cx + halfW)
      const z1 = Math.min(z + cell, cz + halfD)
      const px = (x + x1) / 2
      const pz = (z + z1) / 2
      if (isInsideBuilding(px, pz)) continue
      color.set(PAVING[Math.floor(hash01(px, pz) * PAVING.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(px + 4, pz - 10) > 0.22) pushLine(lines, x, z, x1, z)
      if (hash01(px - 7, pz + 9) > 0.34) pushLine(lines, x, z, x, z1)
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

function addChurchAccents(b: Building | null) {
  const geos: THREE.BufferGeometry[] = []
  const lines: number[] = []
  if (!b) {
    const target = project(SAINT_ETIENNE_LAT, SAINT_ETIENNE_LON)
    const y = terrainHeight(target.x, target.z)
    addBox(geos, new THREE.Color(STONE), target.x, y + 0.5, target.z, 4, 1, 2)
  } else {
    const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts
    const baseY = terrainHeight(b.cx, b.cz)
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 8 || len > 62) continue
      const ux = dx / len
      const uz = dz / len
      const nx = dz / len
      const nz = -dx / len
      const rot = Math.atan2(uz, ux)
      const count = Math.max(1, Math.min(4, Math.floor(len / 14)))
      pushLine(lines, ax, az, bx, bz)
      for (let s = 0; s < count; s++) {
        const t = (s + 0.5) / count
        const x = ax + ux * len * t
        const z = az + uz * len * t
        addBox(geos, new THREE.Color(ROMAN_STONE), x + nx * 0.42, baseY + 0.75, z + nz * 0.42, 0.46, 1.5, 0.42, rot)
        if (hash01(x, z) > 0.52) {
          addBox(geos, new THREE.Color(GLASS), x + nx * 0.5, baseY + Math.min(7, b.h * 0.48), z + nz * 0.5, 1.05, 2.5, 0.16, rot)
        }
      }
    }

    // Signatures Saint-Etienne : roman + gothique, rose/roue et vitraux Le Prince.
    addBox(geos, new THREE.Color(ROMAN_STONE), b.cx - 15.5, baseY + 3.0, b.cz - 1.5, 0.32, 6.0, 8.4, 0)
    addCylinder(geos, new THREE.Color('#6f5b8e'), b.cx - 15.8, baseY + 4.55, b.cz - 1.5, 1.05, 1.05, 0.12)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      lines.push(b.cx - 15.9, baseY + 4.55, b.cz - 1.5, b.cx - 15.9, baseY + 4.55 + Math.sin(a) * 1.05, b.cz - 1.5 + Math.cos(a) * 1.05)
    }
    addBox(geos, new THREE.Color('#2b3032'), b.cx - 15.9, baseY + 1.8, b.cz - 1.5, 0.12, 2.2, 2.0, 0)

    for (let i = -2; i <= 2; i++) {
      const color = new THREE.Color(STAINED[Math.abs(i) % STAINED.length])
      addBox(geos, color, b.cx + i * 2.3, baseY + Math.min(8, b.h * 0.52), b.cz - 9.5, 0.78, 2.8, 0.14, 0)
    }

    for (const side of [-1, 1]) {
      for (let i = -2; i <= 2; i++) {
        const z = b.cz + i * 5.6
        const wallX = b.cx + side * 8.5
        const pierX = b.cx + side * 14.0
        addBox(geos, new THREE.Color(STONE), pierX, baseY + 2.8, z, 0.56, 5.6, 0.64, 0)
        lines.push(wallX, baseY + 7.3, z, pierX, baseY + 5.4, z)
      }
    }

    addBox(geos, new THREE.Color(STONE), b.cx + 7.8, baseY + b.h + 1.6, b.cz - 3.8, 2.3, 3.2, 2.0, 0.05)
    addBox(geos, new THREE.Color(ROOF), b.cx + 7.8, baseY + b.h + 3.35, b.cz - 3.8, 2.7, 0.28, 2.4, 0.05)
    addBox(geos, new THREE.Color(ROOF), b.cx, baseY + b.h + 0.18, b.cz, 18, 0.2, 4.8, 0.05)
    addCylinder(geos, new THREE.Color(STONE), b.cx + 6, baseY + b.h + 0.95, b.cz - 4, 0.11, 0.16, 1.45)
  }

  const solid = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { solid, lineGeometry }
}

function buildSaintEtienne() {
  const target = project(SAINT_ETIENNE_LAT, SAINT_ETIENNE_LON)
  const church = findSaintEtienneBuilding()
  const center = church ? { x: church.cx, z: church.cz } : target
  return { center, ...buildChurchSquare(center.x, center.z), ...addChurchAccents(church) }
}

export default function SaintEtiennePrecinct() {
  const { center, paving, joints, solid, lineGeometry } = useMemo(buildSaintEtienne, [])

  useEffect(
    () => () => {
      paving.dispose()
      joints.dispose()
      solid.dispose()
      lineGeometry.dispose()
    },
    [paving, joints, solid, lineGeometry],
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
      <mesh geometry={solid} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <lineSegments geometry={lineGeometry} renderOrder={7}>
        <lineBasicMaterial color="#29231f" transparent opacity={0.7} depthTest />
      </lineSegments>
      <Text
        position={[center.x, terrainHeight(center.x, center.z) + 2.1, center.z + 20]}
        fontSize={0.72}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.04}
      >
        Saint-Etienne
      </Text>
    </>
  )
}
