import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

// Tour Boileau, rue Desgroux / rue Tetard. Coordonnees Wikidata, monument historique.
const TOUR_LAT = 49.4264722222
const TOUR_LON = 2.0751666667

const STONE = ['#9e917d', '#b5a68d', '#867b6d', '#c4b69c']
const DARK = '#26231f'
const CAP = '#3d4850'
const FLAG_RED = '#b94645'
const FLAG_WHITE = '#f3e7d2'
const JOINT = '#5d554c'

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
  segments = 18,
  thetaStart = 0,
  thetaLength = Math.PI * 2,
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segments, 1, false, thetaStart, thetaLength)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function addStoneBand(geos: THREE.BufferGeometry[], cx: number, cz: number, baseY: number, level: number) {
  const radius = 4.15 + (level % 2) * 0.08
  const y = baseY + 0.54 + level * 0.52
  const thetaStart = 0.34
  const thetaLength = Math.PI * 1.55
  const geo = new THREE.CylinderGeometry(radius, radius + 0.1, 0.48, 18, 1, false, thetaStart, thetaLength)
  tintGeometry(geo, new THREE.Color(STONE[level % STONE.length]))
  geo.translate(cx, y, cz)
  geos.push(geo)
}

function addWindowSlit(geos: THREE.BufferGeometry[], cx: number, cz: number, baseY: number, angle: number, level: number) {
  const x = cx + Math.cos(angle) * 4.28
  const z = cz + Math.sin(angle) * 4.28
  addBox(geos, new THREE.Color(DARK), x, baseY + 1.2 + level * 1.05, z, 0.18, 0.64, 0.12, -angle + Math.PI * 0.5)
}

function addPennant(
  geos: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  rot: number,
  flip = 1,
) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(0.88 * flip, 0.18)
  shape.lineTo(0, 0.36)
  shape.lineTo(0, 0)
  const geo = new THREE.ShapeGeometry(shape)
  tintGeometry(geo, color)
  geo.rotateY(rot)
  geo.translate(x, y, z)
  geos.push(geo)
}

function buildTour() {
  const { x, z } = project(TOUR_LAT, TOUR_LON)
  const y = terrainHeight(x, z)
  const geos: THREE.BufferGeometry[] = []
  const lines: number[] = []
  const rot = -0.62

  addBox(geos, new THREE.Color('#a89c87'), x, y + 0.12, z, 11.5, 0.22, 10.2, rot)
  addBox(geos, new THREE.Color('#786f61'), x + 2.8, y + 0.34, z - 4.2, 5.8, 0.18, 0.32, rot)

  for (let level = 0; level < 8; level++) addStoneBand(geos, x, z, y, level)

  addCylinder(geos, new THREE.Color('#807465'), x, y + 4.8, z, 4.25, 4.35, 0.42, 18, 0.36, Math.PI * 1.55)
  addCylinder(geos, new THREE.Color(CAP), x, y + 5.16, z, 3.75, 4.05, 0.35, 18, 0.5, Math.PI * 1.35)

  for (const angle of [-0.98, -0.05, 0.92]) addWindowSlit(geos, x, z, y, angle, Math.floor(hash01(angle, z) * 3))

  addBox(geos, new THREE.Color('#7f7363'), x - 6.2, y + 0.82, z + 2.8, 6.5, 1.55, 1.0, rot + 0.18)
  addBox(geos, new THREE.Color('#b7a890'), x - 6.2, y + 1.68, z + 2.8, 6.8, 0.18, 1.12, rot + 0.18)
  addBox(geos, new THREE.Color(DARK), x - 3.0, y + 1.05, z + 3.0, 0.16, 1.55, 0.16, rot)

  for (let i = -2; i <= 2; i++) {
    const px = x + i * 1.5
    const pz = z - 5.8
    addBox(geos, new THREE.Color(DARK), px, terrainHeight(px, pz) + 1.05, pz, 0.09, 2.1, 0.09, rot)
    addPennant(geos, new THREE.Color(i % 2 === 0 ? FLAG_RED : FLAG_WHITE), px, terrainHeight(px, pz) + 1.86, pz, rot, i % 2 === 0 ? 1 : -1)
  }

  addBox(geos, new THREE.Color('#473f36'), x + 5.5, y + 0.72, z + 1.5, 0.14, 1.44, 0.14, rot)
  addBox(geos, new THREE.Color('#66513f'), x + 5.5, y + 1.52, z + 1.5, 2.6, 0.5, 0.12, rot)

  for (let i = 0; i <= 15; i++) {
    const a = 0.36 + (i / 15) * Math.PI * 1.5
    const px = x + Math.cos(a) * 4.46
    const pz = z + Math.sin(a) * 4.46
    lines.push(px, y + 0.4, pz, px, y + 4.75, pz)
  }

  const solid = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { center: { x, z }, solid, lineGeometry, rot }
}

export default function TourBoileauPrecinct() {
  const { center, solid, lineGeometry, rot } = useMemo(buildTour, [])

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
        <lineBasicMaterial color={JOINT} transparent opacity={0.58} depthTest />
      </lineSegments>
      <Text
        position={[center.x + 5.5, terrainHeight(center.x + 5.5, center.z + 1.5) + 1.53, center.z + 1.58]}
        rotation={[0, rot, 0]}
        fontSize={0.32}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.022}
        maxWidth={2.25}
      >
        TOUR BOILEAU
      </Text>
    </>
  )
}
