import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight, type Building } from './cityData'

const PAVING = ['#c8bea9', '#b8ad99', '#d2c7b1', '#a89e8d']
const JOINT = '#6f665a'
const STONE = '#dcd4c1'
const OLD_STONE = '#b9a98f'
const DARK_STONE = '#3a4248'
const GLASS = '#263f54'
const WARM_BRICK = '#9b6653'
const ROSE_GLASS = '#6e5d8d'
const Y_OFFSET = 0.145

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
    if (Math.abs(x - b.cx) > 120 || Math.abs(z - b.cz) > 120) continue
    if (pointInFootprint(x, z, b.pts)) return true
  }
  return false
}

function findCentralBuilding(kind: string): Building | null {
  let best: Building | null = null
  let bestD = Infinity
  for (const b of BUILDINGS) {
    if (b.kind !== kind) continue
    const d = b.cx * b.cx + b.cz * b.cz
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

function addCylinder(
  geos: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  rt: number,
  rb: number,
  h: number,
) {
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

function pushLine(lines: number[], x0: number, z0: number, x1: number, z1: number, yOffset = 0) {
  lines.push(x0, terrainHeight(x0, z0) + Y_OFFSET + yOffset, z0)
  lines.push(x1, terrainHeight(x1, z1) + Y_OFFSET + yOffset, z1)
}

function buildParvis() {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const x0 = -72
  const x1 = 98
  const z0 = -96
  const z1 = 78
  const cell = 5.2

  for (let x = x0; x < x1; x += cell) {
    for (let z = z0; z < z1; z += cell) {
      const nx = Math.min(x + cell, x1)
      const nz = Math.min(z + cell, z1)
      const cx = (x + nx) / 2
      const cz = (z + nz) / 2
      if (isInsideBuilding(cx, cz)) continue

      color.set(PAVING[Math.floor(hash01(cx, cz) * PAVING.length)])
      pushQuad(positions, colors, color, x, z, nx, nz)
      if (hash01(cx + 3, cz - 9) > 0.22) pushLine(lines, x, z, nx, z, 0.01)
      if (hash01(cx - 11, cz + 5) > 0.28) pushLine(lines, x, z, x, nz, 0.01)
    }
  }

  // Axe visuel du parvis vers la cathédrale, façon dallage cérémoniel.
  for (let z = -88; z < 68; z += 13) {
    if (!isInsideBuilding(0, z)) pushLine(lines, -7.5, z, 7.5, z, 0.025)
  }
  pushLine(lines, -7.5, -88, -7.5, 68, 0.025)
  pushLine(lines, 7.5, -88, 7.5, 68, 0.025)

  const paving = new THREE.BufferGeometry()
  paving.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  paving.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  paving.computeVertexNormals()

  const joints = new THREE.BufferGeometry()
  joints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { paving, joints }
}

function addFootprintRhythm(geos: THREE.BufferGeometry[], lines: number[], b: Building, color: THREE.Color) {
  const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts
  const baseY = terrainHeight(b.cx, b.cz)
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    const dx = bx - ax
    const dz = bz - az
    const len = Math.hypot(dx, dz)
    if (len < 9 || len > 65) continue
    const ux = dx / len
    const uz = dz / len
    const nx = dz / len
    const nz = -dx / len
    const steps = Math.max(1, Math.min(4, Math.floor(len / 15)))

    pushLine(lines, ax, az, bx, bz, 0.055)
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps
      const x = ax + ux * len * t
      const z = az + uz * len * t
      addBox(geos, color, x + nx * 0.45, baseY + 0.75, z + nz * 0.45, 0.38, 1.5, 0.42, Math.atan2(uz, ux))
    }
  }
}

function addBasseOeuvreCue(geos: THREE.BufferGeometry[], lines: number[], b: Building) {
  const y = terrainHeight(b.cx, b.cz)
  addBox(geos, new THREE.Color(OLD_STONE), b.cx, y + 0.28, b.cz, 12, 0.18, 5.5, 0.05)
  addBox(geos, new THREE.Color('#7d735f'), b.cx, y + b.h + 0.18, b.cz, 10, 0.16, 4.8, 0.05)
  for (let i = -3; i <= 3; i++) {
    addBox(geos, new THREE.Color(i % 2 === 0 ? OLD_STONE : WARM_BRICK), b.cx + i * 1.7, y + 1.2, b.cz - 2.92, 0.82, 1.15, 0.12, 0.05)
  }
  pushLine(lines, b.cx - 7, b.cz - 4, b.cx + 7, b.cz - 4, 0.08)
  pushLine(lines, b.cx - 7, b.cz + 4, b.cx + 7, b.cz + 4, 0.08)
}

function addFlyingButtresses(geos: THREE.BufferGeometry[], lines: number[], b: Building, y: number) {
  for (const side of [-1, 1]) {
    for (let i = -3; i <= 3; i++) {
      const z = b.cz - 18 + i * 7.6
      const wallX = b.cx + side * 13
      const pierX = b.cx + side * 22
      addBox(geos, new THREE.Color(STONE), pierX, y + 4.2, z, 0.72, 8.4, 0.82, 0)
      addBox(geos, new THREE.Color(DARK_STONE), pierX, y + 8.6, z, 1.0, 0.25, 1.05, 0)
      lines.push(wallX, y + 12.2, z, pierX, y + 8.45, z)
      lines.push(wallX, y + 11.7, z + 0.35, pierX, y + 7.95, z + 0.35)
    }
  }
}

function addSouthPortalCue(geos: THREE.BufferGeometry[], lines: number[], b: Building, y: number) {
  const x = b.cx + 16.5
  const z = b.cz + 4.5
  addBox(geos, new THREE.Color(STONE), x, y + 3.6, z, 0.3, 7.2, 7.8, 0)
  addBox(geos, new THREE.Color('#2d3134'), x + 0.18, y + 1.95, z, 0.12, 2.6, 2.2, 0)
  addCylinder(geos, new THREE.Color(ROSE_GLASS), x + 0.22, y + 5.7, z, 0.9, 0.9, 0.12)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    lines.push(x + 0.32, y + 5.7, z, x + 0.32, y + 5.7 + Math.sin(a) * 0.92, z + Math.cos(a) * 0.92)
  }
}

function addCathedralCues() {
  const geos: THREE.BufferGeometry[] = []
  const lines: number[] = []
  const cathedral = findCentralBuilding('cathedral')
  const basse = findCentralBuilding('chapel')

  if (cathedral) {
    addFootprintRhythm(geos, lines, cathedral, new THREE.Color(STONE))
    const y = terrainHeight(cathedral.cx, cathedral.cz)
    // Haute masse du chœur gothique : grandes verrières et nervures, pas de flèche inventée.
    addBox(geos, new THREE.Color(GLASS), cathedral.cx + 2, y + cathedral.h * 0.62, cathedral.cz - 22, 7, 13, 0.18, 0)
    addBox(geos, new THREE.Color(GLASS), cathedral.cx - 11, y + cathedral.h * 0.55, cathedral.cz - 12, 5, 10, 0.18, 0.12)
    addBox(geos, new THREE.Color(DARK_STONE), cathedral.cx + 2, y + cathedral.h + 0.42, cathedral.cz, 28, 0.2, 6, 0)
    addFlyingButtresses(geos, lines, cathedral, y)
    addSouthPortalCue(geos, lines, cathedral, y)
    for (let i = -2; i <= 2; i++) {
      addCylinder(geos, new THREE.Color(STONE), cathedral.cx + i * 6, y + cathedral.h + 1.15, cathedral.cz - 3, 0.12, 0.18, 1.45)
    }
  }

  if (basse) {
    addFootprintRhythm(geos, lines, basse, new THREE.Color(OLD_STONE))
    addBasseOeuvreCue(geos, lines, basse)
  }

  const solid = geos.length ? mergeGeometries(geos, false) : null
  geos.forEach((g) => g.dispose())
  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { solid, lineGeometry }
}

export default function CathedralPrecinct() {
  const { paving, joints } = useMemo(buildParvis, [])
  const { solid, lineGeometry } = useMemo(addCathedralCues, [])

  useEffect(
    () => () => {
      paving.dispose()
      joints.dispose()
      solid?.dispose()
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
        <lineBasicMaterial color={JOINT} transparent opacity={0.38} depthTest />
      </lineSegments>
      {solid ? (
        <mesh geometry={solid} castShadow receiveShadow>
          <meshToonMaterial vertexColors gradientMap={toonGradient} />
        </mesh>
      ) : null}
      <lineSegments geometry={lineGeometry} renderOrder={7}>
        <lineBasicMaterial color="#25211e" transparent opacity={0.72} depthTest />
      </lineSegments>
      <Text
        position={[-16, terrainHeight(-16, -33) + 1.7, -33]}
        rotation={[0, -0.15, 0]}
        fontSize={0.82}
        color="#f4ead4"
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.045}
      >
        Basse-Oeuvre
      </Text>
    </>
  )
}
