import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const PLAY_LAT = 49.43072
const PLAY_LON = 2.0829
const Y_OFFSET = 0.155

const RUBBER = ['#a54f49', '#7f8f5a', '#b8a15a', '#4f788a']
const JOINT = '#5b5048'
const METAL = '#30383d'
const WOOD = '#8a5d3f'
const BLUE = '#2f7184'
const RED = '#b84a42'
const GOLD = '#d1a342'

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
    if (Math.abs(x - b.cx) > 65 || Math.abs(z - b.cz) > 65) continue
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
  lines.push(x0, terrainHeight(x0, z0) + Y_OFFSET + 0.018, z0)
  lines.push(x1, terrainHeight(x1, z1) + Y_OFFSET + 0.018, z1)
}

function buildGround(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const halfW = 15
  const halfD = 10
  const cell = 3.6

  for (let x = cx - halfW; x < cx + halfW; x += cell) {
    for (let z = cz - halfD; z < cz + halfD; z += cell) {
      const x1 = Math.min(x + cell, cx + halfW)
      const z1 = Math.min(z + cell, cz + halfD)
      const px = (x + x1) / 2
      const pz = (z + z1) / 2
      if (isInsideBuilding(px, pz)) continue
      color.set(RUBBER[Math.floor(hash01(px, pz) * RUBBER.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(px + 7, pz - 3) > 0.18) pushLine(lines, x, z, x1, z)
      if (hash01(px - 5, pz + 8) > 0.32) pushLine(lines, x, z, x, z1)
    }
  }

  const ground = new THREE.BufferGeometry()
  ground.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  ground.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  ground.computeVertexNormals()

  const joints = new THREE.BufferGeometry()
  joints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { ground, joints }
}

function addSwing(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number) {
  const y = terrainHeight(x, z)
  for (const sx of [-1.9, 1.9]) {
    addCylinder(geos, new THREE.Color(METAL), x + sx, y + 1.08, z - 0.75, 0.06, 0.07, 2.15, 8)
    addCylinder(geos, new THREE.Color(METAL), x + sx, y + 1.08, z + 0.75, 0.06, 0.07, 2.15, 8)
  }
  addBox(geos, new THREE.Color(METAL), x, y + 2.18, z, 4.45, 0.12, 0.18, rotY)
  for (const sx of [-0.85, 0.85]) {
    addCylinder(geos, new THREE.Color('#26292b'), x + sx, y + 1.55, z, 0.025, 0.025, 1.05, 6)
    addBox(geos, new THREE.Color(RED), x + sx, y + 0.98, z, 0.72, 0.12, 0.42, rotY)
  }
}

function addSlide(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(WOOD), x, y + 0.72, z, 1.45, 1.18, 1.4, rotY)
  addBox(geos, new THREE.Color(BLUE), x + 1.25, y + 0.55, z, 2.45, 0.16, 0.78, rotY - 0.35)
  addBox(geos, new THREE.Color(GOLD), x - 0.15, y + 1.42, z, 1.75, 0.16, 1.65, rotY)
  addCylinder(geos, new THREE.Color(RED), x - 0.65, y + 1.65, z, 0.22, 0.28, 0.42, 10)
}

function addSpringHorse(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number, color: string) {
  const y = terrainHeight(x, z)
  addCylinder(geos, new THREE.Color(METAL), x, y + 0.32, z, 0.08, 0.09, 0.55, 8)
  addBox(geos, new THREE.Color(color), x, y + 0.76, z, 0.92, 0.34, 0.32, rotY)
  addBox(geos, new THREE.Color(color), x + Math.cos(rotY) * 0.42, y + 0.9, z + Math.sin(rotY) * 0.42, 0.26, 0.24, 0.22, rotY)
  addBox(geos, new THREE.Color('#f5ecd9'), x, y + 1.0, z, 0.36, 0.08, 0.26, rotY)
}

function buildProps(cx: number, cz: number) {
  const geos: THREE.BufferGeometry[] = []
  addSwing(geos, cx - 6.2, cz + 1.2, 0.08)
  addSlide(geos, cx + 4.8, cz - 1.4, 0.12)
  addSpringHorse(geos, cx - 0.9, cz - 4.2, -0.4, GOLD)
  addSpringHorse(geos, cx + 2.4, cz + 4.4, 0.35, BLUE)

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function buildPlayArea() {
  const { x, z } = project(PLAY_LAT, PLAY_LON)
  return { center: { x, z }, props: buildProps(x, z), ...buildGround(x, z) }
}

export default function PlaceJeannePlayArea() {
  const { center, ground, joints, props } = useMemo(buildPlayArea, [])

  useEffect(
    () => () => {
      ground.dispose()
      joints.dispose()
      props.dispose()
    },
    [ground, joints, props],
  )

  return (
    <>
      <mesh geometry={ground} receiveShadow renderOrder={2}>
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
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[center.x, terrainHeight(center.x, center.z) + 1.18, center.z + 8.8]}
        rotation={[0, 0.08, 0]}
        fontSize={0.28}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#25211e"
        outlineWidth={0.02}
        maxWidth={3.2}
      >
        Aire de jeux
      </Text>
    </>
  )
}
