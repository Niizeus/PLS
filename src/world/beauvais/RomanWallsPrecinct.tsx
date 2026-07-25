import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const WALL_LAT = 49.432161
const WALL_LON = 2.083079

const STONE = ['#9f927d', '#b4a58b', '#8f8372', '#c0b196']
const TOP = '#d0c3aa'
const DARK = '#29241f'

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

function addWallBlock(geos: THREE.BufferGeometry[], x: number, z: number, rot: number, index: number) {
  const y = terrainHeight(x, z)
  const color = new THREE.Color(STONE[index % STONE.length])
  addBox(geos, color, x, y + 0.62, z, 2.7, 1.24 + hash01(x, z) * 0.36, 1.35, rot)
  if (index % 3 === 0) addBox(geos, new THREE.Color(TOP), x, y + 1.38, z, 2.8, 0.18, 1.45, rot)
}

function addSemiTower(geos: THREE.BufferGeometry[], cx: number, cz: number) {
  const y = terrainHeight(cx, cz)
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * 0.1 + (i / 11) * Math.PI * 0.85
    const x = cx + Math.cos(a) * 5.4
    const z = cz + Math.sin(a) * 5.4
    addWallBlock(geos, x, z, -a + Math.PI * 0.5, i)
  }
  const core = new THREE.CylinderGeometry(3.8, 4.6, 1.2, 16, 1, false, 0.15, Math.PI * 0.9)
  tintGeometry(core, new THREE.Color('#8d806c'))
  core.rotateY(-0.2)
  core.translate(cx, y + 0.45, cz)
  geos.push(core)
}

function buildRomanWalls() {
  const { x, z } = project(WALL_LAT, WALL_LON)
  const geos: THREE.BufferGeometry[] = []
  const lines: number[] = []
  const rot = -0.35
  const c = Math.cos(rot)
  const s = Math.sin(rot)

  for (let i = -7; i <= 7; i++) {
    const px = x + i * 3.1 * c
    const pz = z + i * 3.1 * s
    addWallBlock(geos, px, pz, rot, i + 7)
    lines.push(px, terrainHeight(px, pz) + 1.55, pz)
    lines.push(px + c * 1.2, terrainHeight(px + c * 1.2, pz + s * 1.2) + 1.55, pz + s * 1.2)
  }

  addSemiTower(geos, x + 25 * c, z + 25 * s)
  addBox(geos, new THREE.Color('#3b3430'), x - 24 * c, terrainHeight(x - 24 * c, z - 24 * s) + 0.9, z - 24 * s, 0.14, 1.8, 0.14, rot)
  addBox(geos, new THREE.Color('#6a5b4a'), x - 24 * c, terrainHeight(x - 24 * c, z - 24 * s) + 1.82, z - 24 * s, 3.6, 0.55, 0.12, rot)

  const solid = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { center: { x, z }, solid, lineGeometry, rot }
}

export default function RomanWallsPrecinct() {
  const { center, solid, lineGeometry, rot } = useMemo(buildRomanWalls, [])

  useEffect(
    () => () => {
      solid.dispose()
      lineGeometry.dispose()
    },
    [solid, lineGeometry],
  )

  return (
    <>
      <mesh geometry={solid} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <lineSegments geometry={lineGeometry} renderOrder={7}>
        <lineBasicMaterial color={DARK} transparent opacity={0.65} depthTest />
      </lineSegments>
      <Text
        position={[center.x - Math.cos(rot) * 24, terrainHeight(center.x, center.z) + 1.83, center.z - Math.sin(rot) * 24]}
        rotation={[0, rot, 0]}
        fontSize={0.42}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.03}
      >
        REMPART
      </Text>
    </>
  )
}
