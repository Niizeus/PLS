import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

type LandmarkKind = 'cathedral' | 'statue' | 'mairie' | 'museum'

interface Landmark {
  id: string
  label: string
  lat: number
  lon: number
  kind: LandmarkKind
  rot?: number
}

const LANDMARKS: Landmark[] = [
  { id: 'cathedrale', label: 'Cathedrale', lat: 49.432619, lon: 2.081512, kind: 'cathedral', rot: -0.15 },
  { id: 'mudo', label: 'MUDO', lat: 49.432936, lon: 2.079881, kind: 'museum', rot: 0.32 },
  { id: 'jeanne-hachette', label: 'Jeanne Hachette', lat: 49.43042, lon: 2.08268, kind: 'statue', rot: -0.2 },
  { id: 'mairie', label: 'Mairie', lat: 49.430113, lon: 2.082542, kind: 'mairie', rot: 0.12 },
]

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
  radiusTop: number,
  radiusBottom: number,
  height: number,
) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 10)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function addSignBoard(geos: THREE.BufferGeometry[], x: number, z: number, rot: number, color: THREE.Color) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color('#252a2d'), x, y + 0.85, z, 0.1, 1.45, 0.1, rot)
  addBox(geos, color, x, y + 1.62, z, 2.2, 0.58, 0.12, rot)
}

function addStatue(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  const y = terrainHeight(x, z)
  const stone = new THREE.Color('#bdb19b')
  const bronze = new THREE.Color('#5f4a35')
  addCylinder(geos, stone, x, y + 0.18, z, 1.2, 1.35, 0.36)
  addCylinder(geos, stone, x, y + 0.85, z, 0.72, 0.92, 1.0)
  addBox(geos, bronze, x, y + 1.65, z, 0.42, 1.05, 0.36, rot)
  addCylinder(geos, bronze, x, y + 2.32, z, 0.22, 0.18, 0.32)
  addBox(geos, bronze, x + Math.cos(rot) * 0.38, y + 1.92, z + Math.sin(rot) * 0.38, 0.68, 0.13, 0.13, rot)
}

function addMairieAccent(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  const y = terrainHeight(x, z)
  addSignBoard(geos, x, z, rot, new THREE.Color('#2f5f85'))
  addBox(geos, new THREE.Color('#d8d0bb'), x, y + 0.28, z - Math.cos(rot) * 1.1, 3.6, 0.16, 1.2, rot)
  addBox(geos, new THREE.Color('#32424a'), x - Math.cos(rot) * 0.8, y + 1.9, z + Math.sin(rot) * 0.8, 0.08, 1.25, 0.08, rot)
  addBox(geos, new THREE.Color('#2f5fba'), x - Math.cos(rot) * 0.55, y + 2.35, z + Math.sin(rot) * 0.55, 0.5, 0.3, 0.06, rot)
  addBox(geos, new THREE.Color('#ffffff'), x - Math.cos(rot) * 0.1, y + 2.35, z + Math.sin(rot) * 0.1, 0.42, 0.3, 0.06, rot)
  addBox(geos, new THREE.Color('#c9463d'), x + Math.cos(rot) * 0.32, y + 2.35, z - Math.sin(rot) * 0.32, 0.45, 0.3, 0.06, rot)
}

function addMuseumAccent(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  const y = terrainHeight(x, z)
  addSignBoard(geos, x, z, rot, new THREE.Color('#6b4c82'))
  addBox(geos, new THREE.Color('#cfc2a8'), x, y + 0.42, z, 2.4, 0.18, 0.9, rot)
  addBox(geos, new THREE.Color('#3a4650'), x, y + 1.0, z, 0.7, 1.05, 0.12, rot)
}

function addCathedralPlaque(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  const y = terrainHeight(x, z)
  addSignBoard(geos, x + 30, z + 34, rot, new THREE.Color('#596773'))
  addBox(geos, new THREE.Color('#d9d1bd'), x + 30, y + 0.35, z + 31, 3.2, 0.22, 1.45, rot)
}

function buildLandmarkGeometry() {
  const geos: THREE.BufferGeometry[] = []
  for (const landmark of LANDMARKS) {
    const { x, z } = project(landmark.lat, landmark.lon)
    const rot = landmark.rot ?? 0
    if (landmark.kind === 'statue') addStatue(geos, x, z, rot)
    if (landmark.kind === 'mairie') addMairieAccent(geos, x, z, rot)
    if (landmark.kind === 'museum') addMuseumAccent(geos, x, z, rot)
    if (landmark.kind === 'cathedral') addCathedralPlaque(geos, x, z, rot)
  }
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function CentreVilleLandmarks() {
  const geometry = useMemo(buildLandmarkGeometry, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {LANDMARKS.map((landmark) => {
        const { x, z } = project(landmark.lat, landmark.lon)
        const y = terrainHeight(x, z) + 2.05
        return (
          <Text
            key={landmark.id}
            position={[x, y, z]}
            rotation={[0, landmark.rot ?? 0, 0]}
            fontSize={landmark.kind === 'statue' ? 0.9 : 0.78}
            color="#f3ead4"
            anchorX="center"
            anchorY="middle"
            outlineColor="#24201d"
            outlineWidth={0.045}
            maxWidth={4.6}
          >
            {landmark.label}
          </Text>
        )
      })}
    </>
  )
}
