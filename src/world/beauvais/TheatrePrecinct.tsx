import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const THEATRE_LAT = 49.42924
const THEATRE_LON = 2.08117
const Y_OFFSET = 0.14

const PAVING = ['#b8ad99', '#c8baa5', '#a99f8d', '#d2c5ad']
const JOINT = '#665d52'
const DARK = '#25292c'
const GLASS = '#2f4d5a'
const WOOD = '#b88d61'

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

function buildForecourt(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const halfW = 29
  const halfD = 18
  const cell = 4.2

  for (let x = cx - halfW; x < cx + halfW; x += cell) {
    for (let z = cz - halfD; z < cz + halfD; z += cell) {
      const x1 = Math.min(x + cell, cx + halfW)
      const z1 = Math.min(z + cell, cz + halfD)
      const px = (x + x1) / 2
      const pz = (z + z1) / 2
      if (isInsideBuilding(px, pz)) continue
      color.set(PAVING[Math.floor(hash01(px, pz) * PAVING.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(px + 2, pz - 6) > 0.2) pushLine(lines, x, z, x1, z)
      if (hash01(px - 8, pz + 4) > 0.34) pushLine(lines, x, z, x, z1)
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

function buildTheatreProps(cx: number, cz: number) {
  const geos: THREE.BufferGeometry[] = []
  const rot = -0.1
  const y = terrainHeight(cx, cz)

  addBox(geos, new THREE.Color(DARK), cx, y + 1.9, cz - 5.2, 18, 3.6, 0.38, rot)
  addBox(geos, new THREE.Color(GLASS), cx - 3.9, y + 1.45, cz - 5.45, 5.6, 2.35, 0.16, rot)
  addBox(geos, new THREE.Color(GLASS), cx + 3.9, y + 1.45, cz - 5.45, 5.6, 2.35, 0.16, rot)
  addBox(geos, new THREE.Color(WOOD), cx, y + 3.95, cz - 5.28, 18.6, 0.32, 0.62, rot)
  addBox(geos, new THREE.Color('#6d536e'), cx, y + 2.85, cz - 5.62, 6.2, 0.72, 0.14, rot)

  for (const sx of [-9.5, -6.8, 6.8, 9.5]) {
    addCylinder(geos, new THREE.Color('#3b4449'), cx + sx, y + 0.42, cz + 7.8, 0.08, 0.08, 0.84, 8)
    addCylinder(geos, new THREE.Color('#3b4449'), cx + sx + 0.7, y + 0.42, cz + 7.8, 0.08, 0.08, 0.84, 8)
    addBox(geos, new THREE.Color('#3b4449'), cx + sx + 0.35, y + 0.78, cz + 7.8, 0.7, 0.08, 0.08, 0)
  }

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function buildTheatre() {
  const { x, z } = project(THEATRE_LAT, THEATRE_LON)
  return { center: { x, z }, props: buildTheatreProps(x, z), ...buildForecourt(x, z) }
}

export default function TheatrePrecinct() {
  const { center, paving, joints, props } = useMemo(buildTheatre, [])

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
        position={[center.x, terrainHeight(center.x, center.z - 5.62) + 2.86, center.z - 5.72]}
        rotation={[0, -0.1, 0]}
        fontSize={0.42}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#25211e"
        outlineWidth={0.03}
        maxWidth={5.8}
      >
        THEATRE
      </Text>
    </>
  )
}
