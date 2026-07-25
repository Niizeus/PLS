import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const CARROUSEL_LAT = 49.4306
const CARROUSEL_LON = 2.08273

const RED = '#b8463e'
const CREAM = '#f0e3c8'
const GOLD = '#d2a84a'
const BLUE = '#2f7184'
const WOOD = '#7a563e'
const DARK = '#292c2e'

function project(lat: number, lon: number) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return { x, z }
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
  segments = 24,
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segments)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function addHorse(geos: THREE.BufferGeometry[], cx: number, y: number, cz: number, radius: number, angle: number, color: string) {
  const x = cx + Math.cos(angle) * radius
  const z = cz + Math.sin(angle) * radius
  const rot = -angle
  addCylinder(geos, new THREE.Color(DARK), x, y + 0.95, z, 0.04, 0.04, 1.55, 8)
  addBox(geos, new THREE.Color(color), x, y + 0.72, z, 0.82, 0.34, 0.28, rot)
  addBox(geos, new THREE.Color(color), x + Math.cos(angle) * 0.36, y + 0.88, z + Math.sin(angle) * 0.36, 0.32, 0.28, 0.22, rot)
  addBox(geos, new THREE.Color('#f5ecd9'), x - Math.sin(angle) * 0.24, y + 0.97, z + Math.cos(angle) * 0.24, 0.18, 0.12, 0.16, rot)
  addBox(geos, new THREE.Color(GOLD), x, y + 0.93, z, 0.42, 0.08, 0.32, rot)
}

function buildCarrousel() {
  const { x, z } = project(CARROUSEL_LAT, CARROUSEL_LON)
  const y = terrainHeight(x, z)
  const geos: THREE.BufferGeometry[] = []

  addCylinder(geos, new THREE.Color('#a9967e'), x, y + 0.12, z, 4.25, 4.45, 0.24, 32)
  addCylinder(geos, new THREE.Color(WOOD), x, y + 0.28, z, 3.82, 3.96, 0.18, 32)
  addCylinder(geos, new THREE.Color(DARK), x, y + 1.22, z, 0.12, 0.14, 2.2, 12)

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const px = x + Math.cos(a) * 3.35
    const pz = z + Math.sin(a) * 3.35
    addCylinder(geos, new THREE.Color(DARK), px, y + 1.18, pz, 0.055, 0.07, 2.05, 8)
  }

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const px = x + Math.cos(a) * 2.55
    const pz = z + Math.sin(a) * 2.55
    addHorse(geos, x, y, z, i % 2 === 0 ? 2.45 : 1.55, a, i % 3 === 0 ? RED : i % 3 === 1 ? BLUE : CREAM)
    addBox(geos, new THREE.Color(GOLD), px, y + 1.88, pz, 0.16, 0.22, 0.16, -a)
  }

  addCylinder(geos, new THREE.Color(CREAM), x, y + 2.42, z, 4.55, 4.05, 0.42, 32)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const px = x + Math.cos(a) * 3.55
    const pz = z + Math.sin(a) * 3.55
    addBox(geos, new THREE.Color(i % 2 === 0 ? RED : GOLD), px, y + 2.55, pz, 0.92, 0.22, 0.14, -a)
  }

  const roof = new THREE.ConeGeometry(4.7, 1.4, 32)
  tintGeometry(roof, new THREE.Color(RED))
  roof.translate(x, y + 3.27, z)
  geos.push(roof)
  addCylinder(geos, new THREE.Color(GOLD), x, y + 4.1, z, 0.14, 0.2, 0.38, 12)

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return { center: { x, z }, geometry: merged }
}

export default function CarrouselJeanneHachette() {
  const { center, geometry } = useMemo(buildCarrousel, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[center.x, terrainHeight(center.x, center.z) + 1.66, center.z + 4.45]}
        rotation={[0, 0.05, 0]}
        fontSize={0.32}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#25211e"
        outlineWidth={0.024}
        maxWidth={3.4}
      >
        Carrousel
      </Text>
    </>
  )
}
