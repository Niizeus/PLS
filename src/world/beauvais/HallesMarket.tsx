import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const HALLES_LAT = 49.43032
const HALLES_LON = 2.08415
const Y_OFFSET = 0.15

const PAVING = ['#9d6f5c', '#ad7c63', '#8f6656', '#b8876b']
const LIGHT_PAVING = ['#c8baa5', '#d5c9b4', '#bfb19b']
const JOINT = '#665d52'
const CANOPIES = ['#b7473f', '#2e7180', '#d1a342', '#5d7b60']
const WOOD = '#8a5c3f'
const CRATE = '#6f4d36'
const PRODUCE = ['#6fa25a', '#c74e3f', '#d4b446', '#8f6a3d']
const METAL = '#34383a'

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

function buildMarketGround(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const halfW = 44
  const halfD = 32
  const cell = 4.6

  for (let x = cx - halfW; x < cx + halfW; x += cell) {
    for (let z = cz - halfD; z < cz + halfD; z += cell) {
      const x1 = Math.min(x + cell, cx + halfW)
      const z1 = Math.min(z + cell, cz + halfD)
      const px = (x + x1) / 2
      const pz = (z + z1) / 2
      if (isInsideBuilding(px, pz)) continue
      const onLightBand = Math.abs(px - cx) < 2.7 || Math.abs(pz - cz - 3) < 2.7
      color.set(
        onLightBand
          ? LIGHT_PAVING[Math.floor(hash01(px, pz) * LIGHT_PAVING.length)]
          : PAVING[Math.floor(hash01(px, pz) * PAVING.length)],
      )
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(px + 7, pz - 2) > 0.23) pushLine(lines, x, z, x1, z)
      if (hash01(px - 4, pz + 8) > 0.34) pushLine(lines, x, z, x, z1)
    }
  }

  // Bord sud plus rangé : rappel discret des emplacements payants conservés.
  for (let x = cx - 30; x <= cx + 30; x += 7.5) {
    if (isInsideBuilding(x, cz + 27)) continue
    pushLine(lines, x - 2.6, cz + 24.4, x + 2.6, cz + 24.4)
    pushLine(lines, x - 2.6, cz + 30.2, x + 2.6, cz + 30.2)
    pushLine(lines, x - 2.6, cz + 24.4, x - 2.6, cz + 30.2)
  }

  const paving = new THREE.BufferGeometry()
  paving.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  paving.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  paving.computeVertexNormals()

  const joints = new THREE.BufferGeometry()
  joints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { paving, joints }
}

function addStall(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number, color: string) {
  if (isInsideBuilding(x, z)) return
  const y = terrainHeight(x, z)
  const canopy = new THREE.Color(color)
  const wood = new THREE.Color(WOOD)
  addBox(geos, wood, x, y + 0.48, z, 3.1, 0.28, 1.35, rotY)
  addBox(geos, canopy, x, y + 1.62, z, 3.65, 0.18, 2.15, rotY)
  addBox(geos, new THREE.Color('#2f3335'), x - 1.42, y + 1.0, z - 0.72, 0.09, 1.1, 0.09, rotY)
  addBox(geos, new THREE.Color('#2f3335'), x + 1.42, y + 1.0, z + 0.72, 0.09, 1.1, 0.09, rotY)

  for (let i = -1; i <= 1; i++) {
    const px = x + Math.cos(rotY) * (i * 0.85)
    const pz = z + Math.sin(rotY) * (i * 0.85)
    addBox(geos, new THREE.Color(CRATE), px, y + 0.82, pz, 0.68, 0.22, 0.48, rotY)
    addBox(geos, new THREE.Color(PRODUCE[Math.abs(i + Math.floor(x)) % PRODUCE.length]), px, y + 1.02, pz, 0.5, 0.18, 0.34, rotY)
  }
}

function addOpenKiosk(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number) {
  if (isInsideBuilding(x, z)) return
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color('#9b8e78'), x, y + 0.18, z, 6.6, 0.24, 3.6, rotY)
  for (const sx of [-2.7, 2.7]) {
    for (const sz of [-1.35, 1.35]) {
      addCylinder(geos, new THREE.Color(METAL), x + sx, y + 1.15, z + sz, 0.07, 0.09, 1.95, 8)
    }
  }
  addBox(geos, new THREE.Color('#6f5d50'), x, y + 2.2, z, 7.3, 0.24, 4.25, rotY)
  addBox(geos, new THREE.Color('#3f4c52'), x, y + 2.44, z, 6.7, 0.24, 3.65, rotY)
  addBox(geos, new THREE.Color('#c2b49d'), x, y + 0.62, z - 1.52, 5.1, 0.18, 0.24, rotY)
}

function buildMarketProps(cx: number, cz: number) {
  const geos: THREE.BufferGeometry[] = []
  const rows: Array<[number, number, number]> = [
    [-18, -10, 0.08],
    [-6, -10, 0.08],
    [6, -10, 0.08],
    [18, -10, 0.08],
    [-18, 7, 0.08],
    [-6, 7, 0.08],
    [6, 7, 0.08],
    [18, 7, 0.08],
  ]

  for (let i = 0; i < rows.length; i++) {
    const [x, z, rot] = rows[i]
    addStall(geos, cx + x, cz + z, rot, CANOPIES[i % CANOPIES.length])
  }

  addOpenKiosk(geos, cx + 28, cz + 20, 0.08)

  addBox(geos, new THREE.Color('#3a332d'), cx - 30, terrainHeight(cx - 30, cz + 23) + 0.8, cz + 23, 0.12, 1.4, 0.12)
  addBox(geos, new THREE.Color('#7b526c'), cx - 30, terrainHeight(cx - 30, cz + 23) + 1.55, cz + 23, 2.7, 0.55, 0.12)

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function buildHalles() {
  const { x, z } = project(HALLES_LAT, HALLES_LON)
  return { center: { x, z }, props: buildMarketProps(x, z), ...buildMarketGround(x, z) }
}

export default function HallesMarket() {
  const { center, paving, joints, props } = useMemo(buildHalles, [])

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
      <Text
        position={[center.x - 30, terrainHeight(center.x - 30, center.z + 23) + 1.57, center.z + 23.08]}
        fontSize={0.52}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#25211e"
        outlineWidth={0.03}
      >
        HALLES
      </Text>
    </>
  )
}
