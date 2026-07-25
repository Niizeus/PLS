import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

const SPACE_LAT = 49.43359
const SPACE_LON = 2.08726
const COUR_LAT = 49.43376
const COUR_LON = 2.08727
const ROT = -0.18
const Y_OFFSET = 0.14

const PAVING = ['#cbbda7', '#b9ae99', '#d7c9b2', '#a99f8d']
const JOINT = '#655d52'
const WALL = '#d0c1a8'
const DARK = '#293136'
const GLASS = '#314d5a'
const BLUE = '#2f7184'
const PURPLE = '#7a5287'
const GOLD = '#d0a63e'
const RED = '#b84a42'
const CREAM = '#f0e7d4'
const WOOD = '#74523b'

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
    if (Math.abs(x - b.cx) > 82 || Math.abs(z - b.cz) > 82) continue
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

function local(cx: number, cz: number, ox: number, oz: number) {
  const c = Math.cos(ROT)
  const s = Math.sin(ROT)
  return { x: cx + ox * c - oz * s, z: cz + ox * s + oz * c }
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
  const cell = 4.3
  const halfW = 35
  const halfD = 26

  for (let ox = -halfW; ox < halfW; ox += cell) {
    for (let oz = -halfD; oz < halfD; oz += cell) {
      const a = local(cx, cz, ox, oz)
      const b = local(cx, cz, Math.min(ox + cell, halfW), Math.min(oz + cell, halfD))
      const mid = local(cx, cz, ox + cell * 0.5, oz + cell * 0.5)
      if (isInsideBuilding(mid.x, mid.z)) continue
      color.set(PAVING[Math.floor(hash01(mid.x, mid.z) * PAVING.length)])
      pushQuad(positions, colors, color, a.x, a.z, b.x, b.z)
      if (hash01(mid.x + 5, mid.z - 8) > 0.2) pushLine(lines, a.x, a.z, b.x, a.z)
      if (hash01(mid.x - 6, mid.z + 4) > 0.28) pushLine(lines, a.x, a.z, a.x, b.z)
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

function addMainFacade(geos: THREE.BufferGeometry[], cx: number, cz: number) {
  const p = local(cx, cz, 0, -17)
  const y = terrainHeight(p.x, p.z)
  addBox(geos, new THREE.Color(WALL), p.x, y + 1.65, p.z, 32, 3.3, 0.36, ROT)
  addBox(geos, new THREE.Color(DARK), p.x, y + 3.45, p.z, 32.6, 0.32, 0.58, ROT)
  addBox(geos, new THREE.Color(BLUE), p.x, y + 2.85, p.z - 0.18, 9.6, 0.72, 0.1, ROT)

  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) === 1) continue
    const w = local(cx, cz, i * 2.55, -17.24)
    addBox(geos, new THREE.Color(GLASS), w.x, terrainHeight(w.x, w.z) + 1.62, w.z, 0.86, 0.98, 0.08, ROT)
    addBox(geos, new THREE.Color('#e1d4bb'), w.x, terrainHeight(w.x, w.z) + 2.24, w.z, 1.05, 0.12, 0.1, ROT)
  }
}

function addArtProps(geos: THREE.BufferGeometry[], cx: number, cz: number) {
  const posterColors = [RED, BLUE, GOLD, PURPLE]
  for (let i = 0; i < 6; i++) {
    const p = local(cx, cz, -17 + i * 6.4, 12)
    if (isInsideBuilding(p.x, p.z)) continue
    const y = terrainHeight(p.x, p.z)
    addBox(geos, new THREE.Color(DARK), p.x, y + 1.05, p.z, 0.08, 1.9, 0.08, ROT)
    addBox(geos, new THREE.Color(posterColors[i % posterColors.length]), p.x, y + 1.8, p.z, 2.0, 1.05, 0.12, ROT)
    addBox(geos, new THREE.Color(CREAM), p.x, y + 1.54, p.z + 0.07, 1.48, 0.08, 0.14, ROT)
  }

  for (const [ox, oz, color] of [
    [-22, -3, RED],
    [-18, -1, BLUE],
    [-14, -3.3, GOLD],
  ] as Array<[number, number, string]>) {
    const p = local(cx, cz, ox, oz)
    const y = terrainHeight(p.x, p.z)
    addCylinder(geos, new THREE.Color(DARK), p.x, y + 0.56, p.z, 0.08, 0.1, 1.12, 8)
    addBox(geos, new THREE.Color(color), p.x + 0.2, y + 1.1, p.z, 0.5, 0.42, 0.05, ROT)
  }

  const table = local(cx, cz, 18, 4)
  const ty = terrainHeight(table.x, table.z)
  addBox(geos, new THREE.Color(WOOD), table.x, ty + 0.52, table.z, 3.0, 0.18, 1.4, ROT)
  for (const ox of [-1.1, 1.1]) addBox(geos, new THREE.Color(DARK), table.x + ox, ty + 0.28, table.z, 0.1, 0.52, 0.1, ROT)
  addBox(geos, new THREE.Color(PURPLE), table.x - 0.65, ty + 0.72, table.z, 0.72, 0.08, 0.56, ROT + 0.35)
  addBox(geos, new THREE.Color(GOLD), table.x + 0.55, ty + 0.72, table.z - 0.1, 0.7, 0.08, 0.52, ROT - 0.2)
}

function addLetterCourtCues(geos: THREE.BufferGeometry[], cx: number, cz: number) {
  const letters = [
    [-28, 19, 0.8, 1.7],
    [-24.8, 19, 0.8, 1.05],
    [-21.8, 19, 0.8, 1.4],
    [-18.5, 19, 0.8, 1.1],
  ] as Array<[number, number, number, number]>

  for (const [ox, oz, sx, sy] of letters) {
    const p = local(cx, cz, ox, oz)
    const y = terrainHeight(p.x, p.z)
    addBox(geos, new THREE.Color(CREAM), p.x, y + 0.08, p.z, sx, 0.06, sy, ROT)
  }
}

function buildProps(cx: number, cz: number) {
  const geos: THREE.BufferGeometry[] = []
  addMainFacade(geos, cx, cz)
  addArtProps(geos, cx, cz)
  addLetterCourtCues(geos, cx, cz)
  const entrance = local(cx, cz, 0, 18)
  addBox(geos, new THREE.Color(DARK), entrance.x, terrainHeight(entrance.x, entrance.z) + 0.88, entrance.z, 0.12, 1.76, 0.12, ROT)
  addBox(geos, new THREE.Color(PURPLE), entrance.x, terrainHeight(entrance.x, entrance.z) + 1.86, entrance.z, 5.2, 0.54, 0.12, ROT)
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function buildMitterrand() {
  const center = project(COUR_LAT, COUR_LON)
  const space = project(SPACE_LAT, SPACE_LON)
  return { center, space, props: buildProps(center.x, center.z), ...buildCourtyard(center.x, center.z) }
}

export default function MitterrandCourDesLettres() {
  const { center, space, paving, joints, props } = useMemo(buildMitterrand, [])
  const entrance = local(center.x, center.z, 0, 18)

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
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
      <lineSegments geometry={joints} renderOrder={3}>
        <lineBasicMaterial color={JOINT} transparent opacity={0.42} depthTest />
      </lineSegments>
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[space.x, terrainHeight(space.x, space.z) + 2.86, space.z - 0.28]}
        rotation={[0, ROT, 0]}
        fontSize={0.42}
        color={CREAM}
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.026}
        maxWidth={9.2}
      >
        FRANCOIS MITTERRAND
      </Text>
      <Text
        position={[entrance.x, terrainHeight(entrance.x, entrance.z) + 1.88, entrance.z + 0.08]}
        rotation={[0, ROT, 0]}
        fontSize={0.32}
        color={CREAM}
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.022}
        maxWidth={4.6}
      >
        COUR DES LETTRES
      </Text>
    </>
  )
}
