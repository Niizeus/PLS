import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { terrainHeight, UNDERPASS_CUTS } from './cityData'

const PASS = UNDERPASS_CUTS[0]
const ASPHALT = '#353b42'
const SIDEWALK = '#a99f8d'
const WALL = '#8d8373'
const WALL_DARK = '#5c544b'
const RAIL = '#32383a'
const LINE = '#efe5cf'
const CREAM = '#f2e8d6'
const Y_OFFSET = 0.12

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

function local(along: number, side: number) {
  const c = Math.cos(PASS.rot)
  const s = Math.sin(PASS.rot)
  return { x: PASS.x + c * along - s * side, z: PASS.z + s * along + c * side }
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
  a0: number,
  a1: number,
  s0: number,
  s1: number,
) {
  const p0 = local(a0, s0)
  const p1 = local(a1, s0)
  const p2 = local(a1, s1)
  const p3 = local(a0, s1)
  const pts = [p0, p1, p2, p3].map((p) => [p.x, terrainHeight(p.x, p.z) + Y_OFFSET, p.z] as const)
  positions.push(...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3])
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function pushLine(lines: number[], a0: number, a1: number, side: number, yOff: number) {
  const p0 = local(a0, side)
  const p1 = local(a1, side)
  lines.push(p0.x, terrainHeight(p0.x, p0.z) + yOff, p0.z)
  lines.push(p1.x, terrainHeight(p1.x, p1.z) + yOff, p1.z)
}

function buildRoad() {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const asphalt = new THREE.Color(ASPHALT)
  const sidewalk = new THREE.Color(SIDEWALK)
  const half = PASS.length / 2 + PASS.ramp
  const roadHalf = PASS.width / 2 - 3.2
  const walkHalf = PASS.width / 2 + 1.6

  for (let a = -half; a < half; a += 6) {
    const a1 = Math.min(a + 6, half)
    pushQuad(positions, colors, sidewalk, a, a1, -walkHalf, walkHalf)
    pushQuad(positions, colors, asphalt, a, a1, -roadHalf, roadHalf)
    if (Math.floor((a + half) / 18) % 2 === 0) pushQuad(positions, colors, new THREE.Color(LINE), a + 2, Math.min(a + 8, a1), -0.12, 0.12)
  }

  for (const side of [-roadHalf, roadHalf]) {
    for (let a = -half; a < half; a += 12) pushLine(lines, a, Math.min(a + 8, half), side, Y_OFFSET + 0.018)
  }

  const road = new THREE.BufferGeometry()
  road.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  road.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  road.computeVertexNormals()

  const markings = new THREE.BufferGeometry()
  markings.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { road, markings }
}

function buildWalls() {
  const geos: THREE.BufferGeometry[] = []
  const half = PASS.length / 2
  const wallColor = new THREE.Color(WALL)
  const dark = new THREE.Color(WALL_DARK)
  const rail = new THREE.Color(RAIL)

  for (const side of [-1, 1]) {
    for (let a = -half; a < half; a += 12) {
      const a1 = Math.min(a + 12, half)
      const p = local((a + a1) / 2, side * (PASS.width / 2 + 1.2))
      const groundY = terrainHeight(p.x, p.z)
      const depth = 1.05 + (1 - Math.abs((a + a1) / 2) / half) * 1.7
      addBox(geos, wallColor, p.x, groundY + depth * 0.48, p.z, a1 - a + 0.35, depth, 0.58, -PASS.rot)
      addBox(geos, rail, p.x, groundY + depth + 0.18, p.z, a1 - a + 0.45, 0.12, 0.26, -PASS.rot)
    }
  }

  for (const along of [-half + 6, half - 6]) {
    const p = local(along, 0)
    const y = terrainHeight(p.x, p.z)
    addBox(geos, dark, p.x, y + 1.15, p.z, 10.5, 2.25, PASS.width + 2.6, -PASS.rot)
    addBox(geos, new THREE.Color(ASPHALT), p.x, y + 0.58, p.z, 11.2, 1.08, PASS.width - 3.2, -PASS.rot)
  }

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function JeanMoulinUnderpass() {
  const { road, markings } = useMemo(buildRoad, [])
  const walls = useMemo(buildWalls, [])

  useEffect(
    () => () => {
      road.dispose()
      markings.dispose()
      walls.dispose()
    },
    [road, markings, walls],
  )

  const label = local(-PASS.length / 2 - 18, -PASS.width / 2 - 4)

  return (
    <>
      <mesh geometry={road} receiveShadow renderOrder={7}>
        <meshToonMaterial
          vertexColors
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-7}
          polygonOffsetUnits={-7}
        />
      </mesh>
      <lineSegments geometry={markings} renderOrder={8}>
        <lineBasicMaterial color={LINE} transparent opacity={0.65} depthTest />
      </lineSegments>
      <mesh geometry={walls} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[label.x, terrainHeight(label.x, label.z) + 1.34, label.z]}
        rotation={[0, PASS.rot, 0]}
        fontSize={0.48}
        color={CREAM}
        anchorX="center"
        anchorY="middle"
        outlineColor="#25211e"
        outlineWidth={0.03}
      >
        PASSAGE SOUTERRAIN
      </Text>
    </>
  )
}
