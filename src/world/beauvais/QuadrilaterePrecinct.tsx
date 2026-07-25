import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, pointInFootprint, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const QUAD_LAT = 49.43232
const QUAD_LON = 2.08267
const Y_OFFSET = 0.145

const CONCRETE = '#c9c5b8'
const CONCRETE_DARK = '#a9a59b'
const GLASS = '#496978'
const GARDEN = '#516f4f'
const PATH = ['#b8ad99', '#c6baa5', '#aaa08f']
const JOINT = '#625a50'
const TAPESTRY = ['#b84a42', '#d0a64a', '#2f7184', '#6f5b8e', '#f1e4c8']

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
    if (Math.abs(x - b.cx) > 90 || Math.abs(z - b.cz) > 90) continue
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

function buildGround(cx: number, cz: number) {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const x0 = cx - 34
  const x1 = cx + 38
  const z0 = cz - 24
  const z1 = cz + 28
  const cell = 5

  for (let x = x0; x < x1; x += cell) {
    for (let z = z0; z < z1; z += cell) {
      const nx = Math.min(x + cell, x1)
      const nz = Math.min(z + cell, z1)
      const px = (x + nx) / 2
      const pz = (z + nz) / 2
      if (isInsideBuilding(px, pz)) continue
      color.set(PATH[Math.floor(hash01(px, pz) * PATH.length)])
      pushQuad(positions, colors, color, x, z, nx, nz)
      if (hash01(px + 2, pz - 7) > 0.25) pushLine(lines, x, z, nx, z)
      if (hash01(px - 6, pz + 3) > 0.36) pushLine(lines, x, z, x, nz)
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

function buildProps(cx: number, cz: number) {
  const geos: THREE.BufferGeometry[] = []
  const rot = -0.12
  const y = terrainHeight(cx, cz)

  // Signal moderne : socle béton, grande baie vitrée et volumes orthogonaux.
  addBox(geos, new THREE.Color(CONCRETE), cx, y + 0.32, cz, 24, 0.26, 4.8, rot)
  addBox(geos, new THREE.Color(GLASS), cx + 2.2, y + 1.65, cz - 2.3, 14, 2.2, 0.18, rot)
  addBox(geos, new THREE.Color(CONCRETE_DARK), cx - 9.5, y + 1.4, cz - 2.2, 3.2, 2.8, 0.24, rot)
  addBox(geos, new THREE.Color(CONCRETE), cx + 9.5, y + 1.4, cz - 2.2, 3.2, 2.8, 0.24, rot)
  addBox(geos, new THREE.Color('#343b40'), cx, y + 2.9, cz - 2.35, 18, 0.18, 0.24, rot)

  // Jardin / terrasse ouest évoquée par la réhabilitation, en version simple.
  addBox(geos, new THREE.Color(GARDEN), cx - 16, y + 0.22, cz + 14, 16, 0.16, 8, rot)
  addBox(geos, new THREE.Color('#7d735f'), cx - 16, y + 0.42, cz + 9.8, 16, 0.18, 0.5, rot)
  addBox(geos, new THREE.Color('#7d735f'), cx - 16, y + 0.62, cz + 14, 12, 0.16, 0.5, rot)
  addBox(geos, new THREE.Color('#7d735f'), cx - 16, y + 0.82, cz + 18.2, 8, 0.16, 0.5, rot)

  // Totem discret "centre d'art".
  addBox(geos, new THREE.Color('#3b4348'), cx + 18, y + 1.05, cz + 10, 0.16, 2, 0.16, rot)
  addBox(geos, new THREE.Color('#675a82'), cx + 18, y + 2.1, cz + 10, 2.6, 0.66, 0.12, rot)

  // Clin d'oeil a l'ancienne Galerie nationale de la tapisserie : motif textile en facade.
  for (let i = 0; i < 7; i++) {
    const color = new THREE.Color(TAPESTRY[i % TAPESTRY.length])
    addBox(geos, color, cx - 4.6 + i * 1.55, y + 1.7 + (i % 2) * 0.28, cz - 2.52, 0.58, 1.45, 0.1, rot)
  }
  addBox(geos, new THREE.Color('#2d3336'), cx - 0.1, y + 2.62, cz - 2.58, 11.4, 0.12, 0.12, rot)
  addBox(geos, new THREE.Color('#2d3336'), cx - 0.1, y + 0.78, cz - 2.58, 11.4, 0.12, 0.12, rot)

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function buildQuadrilatere() {
  const { x, z } = project(QUAD_LAT, QUAD_LON)
  return { center: { x, z }, props: buildProps(x, z), ...buildGround(x, z) }
}

export default function QuadrilaterePrecinct() {
  const { center, paving, joints, props } = useMemo(buildQuadrilatere, [])

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
        position={[center.x + 18, terrainHeight(center.x + 18, center.z + 10) + 2.12, center.z + 10.08]}
        rotation={[0, -0.12, 0]}
        fontSize={0.44}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.03}
      >
        QUADRILATERE
      </Text>
      <Text
        position={[center.x - 0.1, terrainHeight(center.x - 0.1, center.z - 2.58) + 2.64, center.z - 2.72]}
        rotation={[0, -0.12, 0]}
        fontSize={0.24}
        color="#f5ecd9"
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.018}
        maxWidth={4.2}
      >
        TAPISSERIE
      </Text>
    </>
  )
}
