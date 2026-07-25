import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const PLACE_LAT = 49.43042
const PLACE_LON = 2.08268
const Y_OFFSET = 0.13

const STONE_COLORS = ['#b8ad99', '#c7baa4', '#a99f8d', '#d3c6ae', '#9b9182']
const JOINT = '#665d52'
const BRONZE = '#5a4632'
const STONE = '#beb39d'
const CAFE_RED = '#b7473f'
const CAFE_GREEN = '#3e7667'
const CAFE_CREAM = '#e7dcc5'
const IRON = '#30383d'
const WATER = '#7fb5c4'

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
    if (Math.abs(x - b.cx) > 90 || Math.abs(z - b.cz) > 90) continue
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
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments = 14,
) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
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
  lines.push(x0, terrainHeight(x0, z0) + Y_OFFSET + 0.015, z0)
  lines.push(x1, terrainHeight(x1, z1) + Y_OFFSET + 0.015, z1)
}

function buildPlazaSurface(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const halfW = 46
  const halfD = 38
  const cell = 4.8

  for (let x = cx - halfW; x < cx + halfW; x += cell) {
    for (let z = cz - halfD; z < cz + halfD; z += cell) {
      const x1 = Math.min(x + cell, cx + halfW)
      const z1 = Math.min(z + cell, cz + halfD)
      const px = (x + x1) / 2
      const pz = (z + z1) / 2
      if (isInsideBuilding(px, pz)) continue

      const ceremonialAxis = Math.abs(px - cx) < 4.8 || (Math.abs(px - cx) < 18 && pz > cz + 17)
      color.set(ceremonialAxis ? '#d8ccb7' : STONE_COLORS[Math.floor(hash01(px, pz) * STONE_COLORS.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(px + 5, pz - 7) > 0.18) pushLine(lines, x, z, x1, z)
      if (hash01(px - 9, pz + 3) > 0.28) pushLine(lines, x, z, x, z1)
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

function addJeanneStatue(geos: THREE.BufferGeometry[], x: number, z: number) {
  const y = terrainHeight(x, z)
  const bronze = new THREE.Color(BRONZE)
  const stone = new THREE.Color(STONE)
  addCylinder(geos, stone, x, y + 0.18, z, 1.25, 1.42, 0.36)
  addCylinder(geos, new THREE.Color(WATER), x, y + 0.13, z, 2.2, 2.3, 0.08)
  addCylinder(geos, stone, x, y + 0.78, z, 0.72, 0.95, 0.9)
  addCylinder(geos, bronze, x, y + 1.55, z, 0.22, 0.25, 1.05, 8)
  addCylinder(geos, bronze, x, y + 2.22, z, 0.2, 0.17, 0.28, 10)
  addBox(geos, bronze, x + 0.34, y + 1.94, z - 0.1, 0.72, 0.12, 0.12, -0.25)
  addBox(geos, bronze, x - 0.1, y + 1.14, z + 0.28, 0.15, 0.8, 0.12, 0.15)
  addBox(geos, new THREE.Color(IRON), x + 0.77, y + 2.28, z - 0.22, 0.12, 0.8, 0.12, -0.65)
  addBox(geos, new THREE.Color(IRON), x + 0.98, y + 2.66, z - 0.34, 0.46, 0.18, 0.12, -0.65)
  addBox(geos, bronze, x - 0.62, y + 2.03, z + 0.08, 0.13, 1.7, 0.13, 0.25)
  addBox(geos, new THREE.Color('#6f2330'), x - 0.78, y + 2.34, z + 0.1, 0.72, 0.5, 0.08, 0.25)
  addBox(geos, new THREE.Color('#d8cbb2'), x - 0.52, y + 1.56, z + 0.52, 1.15, 0.12, 0.28, 0.4)
  addBox(geos, new THREE.Color('#7d6f5c'), x + 0.08, y + 0.72, z - 0.7, 1.55, 0.12, 0.24, -0.28)
  addBox(geos, new THREE.Color('#7d6f5c'), x + 0.64, y + 0.92, z - 0.73, 0.16, 0.46, 0.18, -0.28)

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.32
    const px = x + Math.cos(a) * 1.62
    const pz = z + Math.sin(a) * 1.62
    addCylinder(geos, new THREE.Color('#d9f2f4'), px, y + 0.54, pz, 0.035, 0.05, 0.74, 6)
    addCylinder(geos, new THREE.Color(WATER), px, y + 0.18, pz, 0.16, 0.18, 0.06, 8)
  }
  addBox(geos, new THREE.Color('#d9f2f4'), x - 0.65, y + 0.22, z + 1.72, 1.1, 0.04, 0.08, 0.1)
  addBox(geos, new THREE.Color('#d9f2f4'), x + 0.75, y + 0.22, z - 1.68, 1.0, 0.04, 0.08, -0.18)
}

function addCafeTerrace(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number, accent: string) {
  const y = terrainHeight(x, z)
  const cream = new THREE.Color(CAFE_CREAM)
  const accentColor = new THREE.Color(accent)
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 2.2
    const px = x + Math.cos(rotY) * dx
    const pz = z + Math.sin(rotY) * dx
    if (isInsideBuilding(px, pz)) continue
    addCylinder(geos, cream, px, y + 0.36, pz, 0.48, 0.48, 0.12, 12)
    addCylinder(geos, new THREE.Color('#3a342f'), px, y + 0.18, pz, 0.06, 0.06, 0.34, 8)
    addBox(geos, accentColor, px, y + 1.36, pz, 1.35, 0.08, 1.35, rotY)
    addCylinder(geos, accentColor, px, y + 0.88, pz, 0.08, 0.08, 0.95, 8)
  }
}

function addPlaceFurniture(geos: THREE.BufferGeometry[], cx: number, cz: number) {
  addJeanneStatue(geos, cx, cz)
  addCafeTerrace(geos, cx - 22, cz + 21, 0.1, CAFE_RED)
  addCafeTerrace(geos, cx + 24, cz + 18, -0.18, CAFE_GREEN)

  const treeColor = new THREE.Color('#4a714b')
  const trunk = new THREE.Color('#6a4d35')
  for (const [x, z] of [
    [cx - 34, cz - 25],
    [cx + 34, cz - 24],
    [cx - 36, cz + 28],
    [cx + 36, cz + 27],
  ]) {
    if (isInsideBuilding(x, z)) continue
    const y = terrainHeight(x, z)
    addCylinder(geos, trunk, x, y + 0.55, z, 0.12, 0.16, 1.1, 8)
    addCylinder(geos, treeColor, x, y + 1.45, z, 0.72, 0.92, 0.9, 9)
  }
}

function buildPlace() {
  const { x, z } = project(PLACE_LAT, PLACE_LON)
  const geos: THREE.BufferGeometry[] = []
  addPlaceFurniture(geos, x, z)
  const props = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return { center: { x, z }, props, ...buildPlazaSurface(x, z) }
}

export default function PlaceJeanneHachette() {
  const { paving, joints, props } = useMemo(buildPlace, [])

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
        <lineBasicMaterial color={JOINT} transparent opacity={0.45} depthTest />
      </lineSegments>
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
    </>
  )
}
