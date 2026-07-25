import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

const TRAIL = [
  { x: 12, z: -32, label: 'Alerte' },
  { x: 98, z: -86, label: '1472' },
  { x: 205, z: -132, label: 'Remparts' },
  { x: 337.7, z: -194.2, label: '27 Juin' },
]

const LINE = '#b84a42'
const BRASS = '#bd9144'
const STONE = '#b9aa91'
const DARK = '#282b2d'
const CREAM = '#f0e7d4'
const Y_OFFSET = 0.18

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 65 || Math.abs(z - b.cz) > 65) continue
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
  segments = 12,
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segments)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function pushRibbon(positions: number[], a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  if (len < 1) return
  const ux = dx / len
  const uz = dz / len
  const nx = -uz
  const nz = ux
  const half = 0.28
  const step = 5.2

  for (let t = 0; t < len; t += step * 2) {
    const t1 = Math.min(t + step, len)
    const x0 = a.x + ux * t
    const z0 = a.z + uz * t
    const x1 = a.x + ux * t1
    const z1 = a.z + uz * t1
    if (isInsideBuilding((x0 + x1) / 2, (z0 + z1) / 2)) continue
    const pts: Array<[number, number]> = [
      [x0 - nx * half, z0 - nz * half],
      [x1 - nx * half, z1 - nz * half],
      [x1 + nx * half, z1 + nz * half],
      [x0 + nx * half, z0 + nz * half],
    ]
    const p = pts.map(([x, z]) => [x, terrainHeight(x, z) + Y_OFFSET, z] as [number, number, number])
    positions.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3])
  }
}

function buildTrail() {
  const ribbonPositions: number[] = []
  const geos: THREE.BufferGeometry[] = []

  for (let i = 0; i < TRAIL.length - 1; i++) pushRibbon(ribbonPositions, TRAIL[i], TRAIL[i + 1])

  for (const [i, point] of TRAIL.entries()) {
    if (isInsideBuilding(point.x, point.z)) continue
    const y = terrainHeight(point.x, point.z)
    addCylinder(geos, new THREE.Color(STONE), point.x, y + 0.08, point.z, 0.82, 0.94, 0.16, 14)
    addCylinder(geos, new THREE.Color(BRASS), point.x, y + 0.2, point.z, 0.46, 0.52, 0.12, 14)
    addBox(geos, new THREE.Color(DARK), point.x + 1.0, y + 0.74, point.z + 0.5, 0.08, 1.2, 0.08, 0.45)
    addBox(geos, new THREE.Color(i % 2 === 0 ? LINE : CREAM), point.x + 1.18, y + 1.2, point.z + 0.58, 0.82, 0.38, 0.06, 0.45)
  }

  const ribbon = new THREE.BufferGeometry()
  ribbon.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ribbonPositions), 3))
  ribbon.computeVertexNormals()

  const props = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return { ribbon, props }
}

export default function JeanneHachetteMemoryTrail() {
  const { ribbon, props } = useMemo(buildTrail, [])

  useEffect(
    () => () => {
      ribbon.dispose()
      props.dispose()
    },
    [ribbon, props],
  )

  return (
    <>
      <mesh geometry={ribbon} receiveShadow renderOrder={5}>
        <meshBasicMaterial
          color={LINE}
          side={THREE.DoubleSide}
          transparent
          opacity={0.78}
          polygonOffset
          polygonOffsetFactor={-6}
          polygonOffsetUnits={-6}
        />
      </mesh>
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {TRAIL.map((point) => (
        <Text
          key={point.label}
          position={[point.x, terrainHeight(point.x, point.z) + 0.34, point.z]}
          rotation={[-Math.PI * 0.5, 0, -0.42]}
          fontSize={0.36}
          color="#4b4138"
          anchorX="center"
          anchorY="middle"
          outlineColor={CREAM}
          outlineWidth={0.018}
          maxWidth={2.6}
        >
          {point.label}
        </Text>
      ))}
    </>
  )
}
