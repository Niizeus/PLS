import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

// Espace Saint-Quentin, 1 place de la Prefecture. Ancienne abbaye Saint-Quentin.
const PREF_LAT = 49.4344406128
const PREF_LON = 2.07387709618
const ROT = -0.28
const Y_OFFSET = 0.13

const PAVING = ['#b9ad98', '#c8baa2', '#a89f8c', '#d2c4aa']
const JOINT = '#62584e'
const STONE = '#c4b69d'
const STONE_DARK = '#8d806d'
const SLATE = '#3d4951'
const GLASS = '#334d57'
const IRON = '#262b2e'
const HEDGE = '#496947'

function project(lat: number, lon: number) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return { x, z }
}

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
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
  const cell = 4.6

  for (let ox = -31; ox < 31; ox += cell) {
    for (let oz = -24; oz < 23; oz += cell) {
      const a = local(cx, cz, ox, oz)
      const b = local(cx, cz, Math.min(ox + cell, 31), Math.min(oz + cell, 23))
      const mid = local(cx, cz, ox + cell * 0.5, oz + cell * 0.5)
      color.set(PAVING[Math.floor(hash01(mid.x, mid.z) * PAVING.length)])
      pushQuad(positions, colors, color, a.x, a.z, b.x, b.z)
      if (hash01(mid.x + 6, mid.z - 7) > 0.2) pushLine(lines, a.x, a.z, b.x, a.z)
      if (hash01(mid.x - 9, mid.z + 5) > 0.32) pushLine(lines, a.x, a.z, a.x, b.z)
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

function addWing(geos: THREE.BufferGeometry[], cx: number, cz: number, ox: number, oz: number, sx: number, sz: number) {
  const p = local(cx, cz, ox, oz)
  const y = terrainHeight(p.x, p.z)
  addBox(geos, new THREE.Color(STONE), p.x, y + 1.55, p.z, sx, 3.1, sz, ROT)
  addBox(geos, new THREE.Color(STONE_DARK), p.x, y + 0.23, p.z, sx + 0.35, 0.28, sz + 0.25, ROT)
  addBox(geos, new THREE.Color(SLATE), p.x, y + 3.26, p.z, sx + 0.65, 0.36, sz + 0.55, ROT)

  const count = Math.max(3, Math.floor(sx / 4.2))
  for (let i = 0; i < count; i++) {
    const wx = ox - sx * 0.38 + (sx * 0.76 * i) / Math.max(1, count - 1)
    const w = local(cx, cz, wx, oz - sz * 0.52)
    addBox(geos, new THREE.Color(GLASS), w.x, terrainHeight(w.x, w.z) + 1.8, w.z, 0.78, 0.9, 0.08, ROT)
    addBox(geos, new THREE.Color('#d8cbb2'), w.x, terrainHeight(w.x, w.z) + 2.38, w.z, 0.98, 0.12, 0.1, ROT)
  }
}

function addGate(geos: THREE.BufferGeometry[], cx: number, cz: number) {
  for (const ox of [-4.2, 4.2]) {
    const p = local(cx, cz, ox, 28)
    addBox(geos, new THREE.Color(STONE_DARK), p.x, terrainHeight(p.x, p.z) + 1.1, p.z, 1.0, 2.2, 1.0, ROT)
    addBox(geos, new THREE.Color('#d9ccb2'), p.x, terrainHeight(p.x, p.z) + 2.3, p.z, 1.25, 0.26, 1.25, ROT)
  }

  for (let i = -5; i <= 5; i++) {
    const p = local(cx, cz, i * 0.72, 28.1)
    addBox(geos, new THREE.Color(IRON), p.x, terrainHeight(p.x, p.z) + 1.08, p.z, 0.08, 2.15, 0.08, ROT)
  }
  const bar = local(cx, cz, 0, 28.1)
  addBox(geos, new THREE.Color(IRON), bar.x, terrainHeight(bar.x, bar.z) + 1.55, bar.z, 7.4, 0.1, 0.1, ROT)
}

function addFlag(geos: THREE.BufferGeometry[], cx: number, cz: number, ox: number, color: string) {
  const p = local(cx, cz, ox, 22)
  const y = terrainHeight(p.x, p.z)
  addBox(geos, new THREE.Color(IRON), p.x, y + 1.45, p.z, 0.08, 2.9, 0.08, ROT)
  addBox(geos, new THREE.Color(color), p.x + Math.cos(ROT) * 0.36, y + 2.45, p.z + Math.sin(ROT) * 0.36, 0.72, 0.42, 0.05, ROT)
}

function addParkCue(geos: THREE.BufferGeometry[], cx: number, cz: number) {
  for (const [ox, oz, sx, sz] of [
    [-34, -6, 1.1, 27],
    [34, -6, 1.1, 27],
    [-18, -28, 18, 1.1],
    [18, -28, 18, 1.1],
  ]) {
    const p = local(cx, cz, ox, oz)
    addBox(geos, new THREE.Color(HEDGE), p.x, terrainHeight(p.x, p.z) + 0.44, p.z, sx, 0.72, sz, ROT)
  }

  for (const [ox, oz] of [
    [-25, -21],
    [25, -20],
    [-27, 12],
    [27, 11],
  ]) {
    const p = local(cx, cz, ox, oz)
    const y = terrainHeight(p.x, p.z)
    addCylinder(geos, new THREE.Color('#6b4d35'), p.x, y + 0.52, p.z, 0.12, 0.16, 1.04, 8)
    addCylinder(geos, new THREE.Color('#54734d'), p.x, y + 1.35, p.z, 0.82, 1.02, 0.9, 10)
  }
}

function addAbbeyChapelCue(geos: THREE.BufferGeometry[], cx: number, cz: number) {
  const p = local(cx, cz, -24, -19)
  const y = terrainHeight(p.x, p.z)
  addBox(geos, new THREE.Color('#b9ab92'), p.x, y + 2.0, p.z, 6.2, 4.0, 1.3, ROT)
  addBox(geos, new THREE.Color(SLATE), p.x, y + 4.22, p.z, 6.7, 0.36, 1.65, ROT)
  addBox(geos, new THREE.Color('#3a4650'), p.x, y + 2.55, p.z - 0.72, 1.8, 1.1, 0.08, ROT)
  addBox(geos, new THREE.Color('#d8cbb2'), p.x, y + 3.25, p.z - 0.74, 2.1, 0.14, 0.1, ROT)
}

function buildPrefectureProps(cx: number, cz: number) {
  const geos: THREE.BufferGeometry[] = []

  addWing(geos, cx, cz, 0, -18, 46, 6.5)
  addWing(geos, cx, cz, -25, 2, 7.2, 34)
  addWing(geos, cx, cz, 25, 2, 7.2, 34)
  addAbbeyChapelCue(geos, cx, cz)
  addGate(geos, cx, cz)
  addFlag(geos, cx, cz, -2.1, '#2f5fba')
  addFlag(geos, cx, cz, -1.25, '#ffffff')
  addFlag(geos, cx, cz, -0.4, '#c9463d')
  addFlag(geos, cx, cz, 2.0, '#244f8f')
  addParkCue(geos, cx, cz)

  const sign = local(cx, cz, 10, 27.2)
  addBox(geos, new THREE.Color('#51616d'), sign.x, terrainHeight(sign.x, sign.z) + 1.28, sign.z, 3.7, 0.55, 0.12, ROT)

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function buildPrefecture() {
  const { x, z } = project(PREF_LAT, PREF_LON)
  return { center: { x, z }, props: buildPrefectureProps(x, z), ...buildCourtyard(x, z) }
}

export default function PrefectureSaintQuentinPrecinct() {
  const { center, paving, joints, props } = useMemo(buildPrefecture, [])

  useEffect(
    () => () => {
      paving.dispose()
      joints.dispose()
      props.dispose()
    },
    [paving, joints, props],
  )

  const label = local(center.x, center.z, 10, 27.35)

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
        <lineBasicMaterial color={JOINT} transparent opacity={0.4} depthTest />
      </lineSegments>
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[label.x, terrainHeight(label.x, label.z) + 1.3, label.z + 0.08]}
        rotation={[0, ROT, 0]}
        fontSize={0.35}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.024}
        maxWidth={3.4}
      >
        PREFECTURE
      </Text>
    </>
  )
}
