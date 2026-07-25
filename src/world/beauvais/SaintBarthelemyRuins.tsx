import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const SAINT_BARTHELEMY_LAT = 49.43148
const SAINT_BARTHELEMY_LON = 2.082189
const ROT = 0.08

const OLD_STONE = '#b7aa92'
const DARK_STONE = '#7d715f'
const CRYPT = '#4c4a43'
const GROUND = ['#b9ae99', '#c7baa4', '#a89f8d']

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

function addWall(geos: THREE.BufferGeometry[], cx: number, cz: number, ox: number, oz: number, sx: number, sz: number) {
  const c = Math.cos(ROT)
  const s = Math.sin(ROT)
  const x = cx + ox * c - oz * s
  const z = cz + ox * s + oz * c
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(OLD_STONE), x, y + 0.34, z, sx, 0.68, sz, ROT)
  addBox(geos, new THREE.Color(DARK_STONE), x, y + 0.72, z, sx * 0.96, 0.12, sz * 0.96, ROT)
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
  const y00 = terrainHeight(x0, z0) + 0.16
  const y10 = terrainHeight(x1, z0) + 0.16
  const y01 = terrainHeight(x0, z1) + 0.16
  const y11 = terrainHeight(x1, z1) + 0.16
  positions.push(x0, y00, z0, x1, y10, z0, x1, y11, z1)
  positions.push(x0, y00, z0, x1, y11, z1, x0, y01, z1)
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function buildGround(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const color = new THREE.Color()
  const halfW = 17
  const halfD = 13
  const cell = 4.1

  for (let x = cx - halfW; x < cx + halfW; x += cell) {
    for (let z = cz - halfD; z < cz + halfD; z += cell) {
      const x1 = Math.min(x + cell, cx + halfW)
      const z1 = Math.min(z + cell, cz + halfD)
      const px = (x + x1) / 2
      const pz = (z + z1) / 2
      color.set(GROUND[Math.floor(hash01(px, pz) * GROUND.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
    }
  }

  const ground = new THREE.BufferGeometry()
  ground.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  ground.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  ground.computeVertexNormals()
  return ground
}

function buildRuins() {
  const { x, z } = project(SAINT_BARTHELEMY_LAT, SAINT_BARTHELEMY_LON)
  const geos: THREE.BufferGeometry[] = []

  addWall(geos, x, z, 0, -8, 19, 0.75)
  addWall(geos, x, z, 0, 8, 19, 0.75)
  addWall(geos, x, z, -9.5, 0, 0.75, 16)
  addWall(geos, x, z, 9.5, 0, 0.75, 16)
  addWall(geos, x, z, 0, 0, 6.4, 0.65)
  addWall(geos, x, z, 0, -2.7, 0.65, 5.2)
  addWall(geos, x, z, 0, 2.7, 0.65, 5.2)

  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(CRYPT), x, y + 0.1, z, 4.8, 0.16, 3.4, ROT)
  addBox(geos, new THREE.Color('#d6c7aa'), x + 7.6, y + 1.3, z - 5.8, 1.1, 1.2, 0.42, ROT)
  addBox(geos, new THREE.Color('#d6c7aa'), x - 7.2, y + 1.05, z + 6.3, 0.9, 0.9, 0.42, ROT)

  const solid = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return { center: { x, z }, solid, ground: buildGround(x, z) }
}

export default function SaintBarthelemyRuins() {
  const { center, solid, ground } = useMemo(buildRuins, [])

  useEffect(
    () => () => {
      solid.dispose()
      ground.dispose()
    },
    [solid, ground],
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
      <mesh geometry={solid} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[center.x, terrainHeight(center.x, center.z) + 1.06, center.z + 0.2]}
        rotation={[0, ROT, 0]}
        fontSize={0.34}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#25211e"
        outlineWidth={0.024}
        maxWidth={4.8}
      >
        St-Barthelemy
      </Text>
    </>
  )
}
