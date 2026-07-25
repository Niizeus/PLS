import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const MAIRIE_LAT = 49.430113
const MAIRIE_LON = 2.082542
const Y_OFFSET = 0.145

const STONE = '#d9cfb9'
const STONE_DARK = '#a99c87'
const PAVING = ['#c6baa4', '#b7ab96', '#d2c6af', '#a89e8d']
const JOINT = '#665e54'
const SIGN_BLUE = '#2e5f84'
const IRON = '#30383d'
const GLASS = '#364f59'
const WATER = '#7fb5c4'

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

function buildMairiePaving(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const halfW = 34
  const halfD = 20
  const cell = 4.4

  for (let x = cx - halfW; x < cx + halfW; x += cell) {
    for (let z = cz - halfD; z < cz + halfD; z += cell) {
      const x1 = Math.min(x + cell, cx + halfW)
      const z1 = Math.min(z + cell, cz + halfD)
      const px = (x + x1) / 2
      const pz = (z + z1) / 2
      if (isInsideBuilding(px, pz)) continue
      color.set(PAVING[Math.floor(hash01(px, pz) * PAVING.length)])
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (hash01(px + 3, pz - 8) > 0.22) pushLine(lines, x, z, x1, z)
      if (hash01(px - 5, pz + 9) > 0.32) pushLine(lines, x, z, x, z1)
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

function addFlag(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number, colors: string[]) {
  const y = terrainHeight(x, z)
  addCylinder(geos, new THREE.Color(IRON), x, y + 1.55, z, 0.04, 0.05, 3.1, 8)
  for (let i = 0; i < colors.length; i++) {
    addBox(geos, new THREE.Color(colors[i]), x + Math.cos(rotY) * (0.22 + i * 0.28), y + 2.45, z + Math.sin(rotY) * (0.22 + i * 0.28), 0.28, 0.55, 0.06, rotY)
  }
}

function addMairieProps(cx: number, cz: number) {
  const geos: THREE.BufferGeometry[] = []
  const rot = 0.12
  const y = terrainHeight(cx, cz)

  addBox(geos, new THREE.Color(STONE), cx, y + 2.45, cz + 6.7, 24.5, 4.25, 0.36, rot)
  addBox(geos, new THREE.Color(STONE_DARK), cx, y + 0.46, cz + 6.88, 25.5, 0.36, 0.46, rot)
  addBox(geos, new THREE.Color(STONE_DARK), cx, y + 4.78, cz + 6.72, 25.5, 0.28, 0.5, rot)
  for (let i = -5; i <= 5; i++) {
    const x = cx + i * 2.15
    addBox(geos, new THREE.Color(GLASS), x, y + 2.05, cz + 6.48, 0.72, 1.18, 0.08, rot)
    addBox(geos, new THREE.Color(GLASS), x, y + 3.42, cz + 6.48, 0.7, 1.0, 0.08, rot)
    if (i % 2 === 0) addCylinder(geos, new THREE.Color(STONE_DARK), x, y + 2.63, cz + 6.4, 0.07, 0.09, 3.55, 8)
  }
  for (let i = -6; i <= 6; i++) {
    addCylinder(geos, new THREE.Color(STONE), cx + i * 1.85, y + 5.16, cz + 6.62, 0.07, 0.08, 0.58, 8)
  }
  const pediment = new THREE.ConeGeometry(3.05, 1.15, 3)
  tintGeometry(pediment, new THREE.Color(STONE))
  pediment.rotateZ(Math.PI / 2)
  pediment.rotateY(rot)
  pediment.translate(cx, y + 5.2, cz + 6.55)
  geos.push(pediment)
  addCylinder(geos, new THREE.Color('#f0e5cb'), cx, y + 4.86, cz + 6.32, 0.42, 0.42, 0.09, 18)
  addBox(geos, new THREE.Color('#222528'), cx, y + 4.86, cz + 6.26, 0.04, 0.52, 0.06, rot)
  addBox(geos, new THREE.Color('#222528'), cx, y + 4.86, cz + 6.26, 0.52, 0.04, 0.06, rot)

  // Parvis et emmarchement côté place.
  addBox(geos, new THREE.Color(STONE_DARK), cx, y + 0.18, cz + 8.5, 19, 0.24, 3.2, rot)
  addBox(geos, new THREE.Color(STONE), cx, y + 0.42, cz + 10.1, 16, 0.18, 1.2, rot)
  addBox(geos, new THREE.Color('#d9cfb9'), cx, y + 0.16, cz + 15.25, 18.2, 0.08, 2.35, rot)
  addBox(geos, new THREE.Color(WATER), cx, y + 0.2, cz + 15.25, 16.7, 0.06, 1.55, rot)

  // Signal de façade publique : colonnes courtes + linteau + plaque bleue.
  for (let i = -3; i <= 3; i++) {
    addCylinder(geos, new THREE.Color(STONE), cx + i * 2.35, y + 1.02, cz + 7.1, 0.16, 0.2, 1.8, 10)
  }
  addBox(geos, new THREE.Color(STONE), cx, y + 2.05, cz + 7.1, 17.5, 0.24, 0.42, rot)
  addBox(geos, new THREE.Color(SIGN_BLUE), cx, y + 2.48, cz + 7.02, 4.8, 0.72, 0.12, rot)

  // Drapeaux français et européen : vrai signal mairie sans détailler toute la façade.
  addFlag(geos, cx - 5.8, cz + 11.4, rot, ['#244b9b', '#ffffff', '#c63d35'])
  addFlag(geos, cx + 5.8, cz + 11.4, rot, ['#244b9b', '#244b9b', '#244b9b'])
  addBox(geos, new THREE.Color('#d8b84b'), cx + 6.15, y + 2.49, cz + 11.45, 0.12, 0.12, 0.07, rot)
  addBox(geos, new THREE.Color('#d8b84b'), cx + 6.42, y + 2.33, cz + 11.48, 0.12, 0.12, 0.07, rot)

  // Deux bancs sobres pour l'échelle humaine de la place.
  for (const sx of [-12, 12]) {
    addBox(geos, new THREE.Color('#8b5d3f'), cx + sx, y + 0.45, cz + 17, 2.4, 0.16, 0.55, rot)
    addBox(geos, new THREE.Color(IRON), cx + sx - 0.72, y + 0.24, cz + 17, 0.12, 0.42, 0.12, rot)
    addBox(geos, new THREE.Color(IRON), cx + sx + 0.72, y + 0.24, cz + 17, 0.12, 0.42, 0.12, rot)
  }

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function buildMairie() {
  const { x, z } = project(MAIRIE_LAT, MAIRIE_LON)
  return { center: { x, z }, props: addMairieProps(x, z), ...buildMairiePaving(x, z) }
}

export default function MairiePrecinct() {
  const { center, paving, joints, props } = useMemo(buildMairie, [])

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
        position={[center.x, terrainHeight(center.x, center.z + 7.02) + 2.49, center.z + 6.94]}
        rotation={[0, 0.12, 0]}
        fontSize={0.58}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#1e2428"
        outlineWidth={0.035}
      >
        MAIRIE
      </Text>
    </>
  )
}
