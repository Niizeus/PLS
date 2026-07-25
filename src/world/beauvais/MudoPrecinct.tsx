import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const MUDO_LAT = 49.432936
const MUDO_LON = 2.079881
const Y_OFFSET = 0.14

const COURTYARD = ['#b5aa95', '#c5b9a3', '#a79d8b', '#d1c5ae']
const JOINT = '#655c51'
const OLD_STONE = '#b8aa92'
const WALL_TOP = '#d5cab3'
const HEDGE = '#496b48'
const SIGN = '#634b73'
const SLATE = '#3f4f58'
const GLASS = '#2e4a57'

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
    if (Math.abs(x - b.cx) > 100 || Math.abs(z - b.cz) > 100) continue
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

function buildCourtyard(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const halfW = 34
  const halfD = 27
  const cell = 4.6

  for (let x = cx - halfW; x < cx + halfW; x += cell) {
    for (let z = cz - halfD; z < cz + halfD; z += cell) {
      const x1 = Math.min(x + cell, cx + halfW)
      const z1 = Math.min(z + cell, cz + halfD)
      const px = (x + x1) / 2
      const pz = (z + z1) / 2
      if (isInsideBuilding(px, pz)) continue
      color.set(COURTYARD[Math.floor(hash01(px, pz) * COURTYARD.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(px + 4, pz - 8) > 0.25) pushLine(lines, x, z, x1, z)
      if (hash01(px - 6, pz + 11) > 0.34) pushLine(lines, x, z, x, z1)
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

function addWallSegment(geos: THREE.BufferGeometry[], x: number, z: number, sx: number, sz: number, rotY: number) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(OLD_STONE), x, y + 0.42, z, sx, 0.84, sz, rotY)
  addBox(geos, new THREE.Color(WALL_TOP), x, y + 0.9, z, sx + 0.18, 0.16, sz + 0.18, rotY)
}

function addHedge(geos: THREE.BufferGeometry[], x: number, z: number, sx: number, sz: number, rotY: number) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(HEDGE), x, y + 0.46, z, sx, 0.72, sz, rotY)
}

function addChateletTower(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number) {
  const y = terrainHeight(x, z)
  addCylinder(geos, new THREE.Color(OLD_STONE), x, y + 2.0, z, 1.45, 1.65, 4.0, 14)
  addCylinder(geos, new THREE.Color(SLATE), x, y + 4.25, z, 1.2, 1.42, 0.52, 14)
  const roof = new THREE.ConeGeometry(1.45, 1.35, 14)
  tintGeometry(roof, new THREE.Color(SLATE))
  roof.translate(x, y + 5.18, z)
  geos.push(roof)
  addBox(geos, new THREE.Color(GLASS), x, y + 2.28, z - 1.48, 0.42, 0.78, 0.08, rotY)
  addBox(geos, new THREE.Color(GLASS), x, y + 3.28, z - 1.5, 0.36, 0.66, 0.08, rotY)
}

function addRenaissancePalaceCues(geos: THREE.BufferGeometry[], cx: number, cz: number, rot: number) {
  const y = terrainHeight(cx, cz)
  const facadeZ = cz - 23.5
  addBox(geos, new THREE.Color('#c6b79b'), cx - 8, y + 1.4, facadeZ, 14, 2.2, 0.22, rot)
  addBox(geos, new THREE.Color('#d8cbb2'), cx + 7.5, y + 1.5, facadeZ, 15, 2.4, 0.22, rot)
  addBox(geos, new THREE.Color(SLATE), cx - 0.2, y + 2.85, facadeZ - 0.04, 30, 0.32, 0.3, rot)

  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) === 1) continue
    const x = cx + i * 2.55
    addBox(geos, new THREE.Color(GLASS), x, y + 1.72, facadeZ - 0.16, 0.66, 0.88, 0.08, rot)
    addBox(geos, new THREE.Color('#9f927d'), x, y + 2.24, facadeZ - 0.17, 0.84, 0.12, 0.1, rot)
  }

  const towerX = cx + 1.2
  addCylinder(geos, new THREE.Color('#b9aa91'), towerX, y + 2.35, facadeZ + 0.85, 1.0, 1.12, 4.4, 12)
  addCylinder(geos, new THREE.Color(SLATE), towerX, y + 4.7, facadeZ + 0.85, 0.82, 0.96, 0.48, 12)
  const roof = new THREE.ConeGeometry(1.05, 1.15, 12)
  tintGeometry(roof, new THREE.Color(SLATE))
  roof.translate(towerX, y + 5.45, facadeZ + 0.85)
  geos.push(roof)
  addBox(geos, new THREE.Color('#e7dbc1'), towerX, y + 3.0, facadeZ - 0.2, 0.58, 0.58, 0.08, rot)
  addBox(geos, new THREE.Color('#2c3032'), towerX, y + 3.0, facadeZ - 0.26, 0.08, 0.58, 0.1, rot)
  addBox(geos, new THREE.Color('#2c3032'), towerX, y + 3.0, facadeZ - 0.26, 0.58, 0.08, 0.1, rot)
}

function buildMudoProps(cx: number, cz: number) {
  const geos: THREE.BufferGeometry[] = []
  const rot = 0.18

  addRenaissancePalaceCues(geos, cx, cz, rot)
  addWallSegment(geos, cx - 35, cz, 1.2, 42, rot)
  addWallSegment(geos, cx + 35, cz, 1.2, 42, rot)
  addWallSegment(geos, cx, cz - 29, 54, 1.2, rot)
  addHedge(geos, cx - 18, cz + 27, 18, 1.1, rot)
  addHedge(geos, cx + 18, cz + 27, 18, 1.1, rot)

  addChateletTower(geos, cx - 6.6, cz + 30.2, rot)
  addChateletTower(geos, cx + 6.6, cz + 30.2, rot)
  addBox(geos, new THREE.Color(OLD_STONE), cx, terrainHeight(cx, cz + 30.2) + 2.0, cz + 30.2, 7.2, 3.0, 1.0, rot)
  addBox(geos, new THREE.Color('#2c3032'), cx, terrainHeight(cx, cz + 30.2) + 0.92, cz + 29.6, 2.3, 1.5, 0.18, rot)
  addBox(geos, new THREE.Color(SLATE), cx, terrainHeight(cx, cz + 30.2) + 3.65, cz + 30.2, 7.8, 0.32, 1.3, rot)

  // Petits piliers d'entrée et plaque musée, pour identifier le palais sans surcharger.
  addCylinder(geos, new THREE.Color(OLD_STONE), cx - 4.4, terrainHeight(cx - 4.4, cz + 29) + 0.62, cz + 29, 0.32, 0.4, 1.24)
  addCylinder(geos, new THREE.Color(OLD_STONE), cx + 4.4, terrainHeight(cx + 4.4, cz + 29) + 0.62, cz + 29, 0.32, 0.4, 1.24)
  addBox(geos, new THREE.Color(SIGN), cx, terrainHeight(cx, cz + 31.5) + 1.35, cz + 31.5, 3.1, 0.72, 0.12, rot)

  for (const [x, z] of [
    [cx - 24, cz - 15],
    [cx + 24, cz - 14],
    [cx - 22, cz + 14],
    [cx + 22, cz + 13],
  ]) {
    if (isInsideBuilding(x, z)) continue
    const y = terrainHeight(x, z)
    addCylinder(geos, new THREE.Color('#6b4d35'), x, y + 0.48, z, 0.1, 0.14, 0.96, 8)
    addCylinder(geos, new THREE.Color('#4d7048'), x, y + 1.22, z, 0.62, 0.78, 0.75, 9)
  }

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function buildMudo() {
  const { x, z } = project(MUDO_LAT, MUDO_LON)
  return { center: { x, z }, props: buildMudoProps(x, z), ...buildCourtyard(x, z) }
}

export default function MudoPrecinct() {
  const { center, paving, joints, props } = useMemo(buildMudo, [])

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
        position={[center.x, terrainHeight(center.x, center.z + 31.5) + 1.37, center.z + 31.6]}
        rotation={[0, 0.18, 0]}
        fontSize={0.7}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#241f22"
        outlineWidth={0.04}
      >
        MUDO
      </Text>
    </>
  )
}
