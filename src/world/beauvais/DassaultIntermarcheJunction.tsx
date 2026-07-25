import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { terrainHeight } from './cityData'

interface Crosswalk {
  x: number
  z: number
  rot: number
  length: number
  width: number
  stripes: number
}

interface TrafficLight {
  x: number
  z: number
  rot: number
}

const CROSSWALK = '#f1ead9'
const POLE = '#2f3436'
const HEAD = '#20272a'
const RED = '#d9473f'
const AMBER = '#d6a43d'
const GREEN = '#4e9a58'
const BUTTON = '#c7b078'
const Y_MARKING = 0.13

const CROSSWALKS: Crosswalk[] = [
  { x: 868, z: -1184, rot: 0.36, length: 13.5, width: 6.8, stripes: 7 },
  { x: 825, z: -1106, rot: 0.48, length: 12.6, width: 6.4, stripes: 7 },
  { x: 808, z: -1142, rot: Math.PI * 0.5, length: 12.8, width: 6.2, stripes: 6 },
]

const TRAFFIC_LIGHTS: TrafficLight[] = [
  { x: 837, z: -1098, rot: -0.48 },
  { x: 879, z: -1121, rot: 2.72 },
  { x: 834, z: -1180, rot: 0.58 },
  { x: 890, z: -1166, rot: -2.54 },
  { x: 795, z: -1128, rot: Math.PI },
  { x: 814, z: -1160, rot: 0.06 },
]

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

function addLightDisc(geos: THREE.BufferGeometry[], color: THREE.Color, x: number, y: number, z: number, rotY: number) {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  const geo = new THREE.CylinderGeometry(0.095, 0.095, 0.035, 14)
  tintGeometry(geo, color)
  geo.rotateZ(Math.PI * 0.5)
  geo.rotateY(rotY)
  geo.translate(x + c * 0.065, y, z + s * 0.065)
  geos.push(geo)
}

function pushQuad(
  positions: number[],
  x: number,
  z: number,
  halfW: number,
  halfD: number,
  rot: number,
) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const corners: Array<[number, number]> = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ]
  const pts = corners.map(([lx, lz]) => {
    const wx = x + lx * c - lz * s
    const wz = z + lx * s + lz * c
    return [wx, terrainHeight(wx, wz) + Y_MARKING, wz] as [number, number, number]
  })
  positions.push(...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3])
}

function buildCrosswalks() {
  const positions: number[] = []
  for (const crossing of CROSSWALKS) {
    const step = crossing.width / crossing.stripes
    const stripeDepth = step * 0.56
    for (let i = 0; i < crossing.stripes; i++) {
      const localZ = -crossing.width / 2 + step * (i + 0.5)
      const c = Math.cos(crossing.rot)
      const s = Math.sin(crossing.rot)
      const x = crossing.x - localZ * s
      const z = crossing.z + localZ * c
      pushQuad(positions, x, z, crossing.length / 2, stripeDepth / 2, crossing.rot)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildTrafficLights() {
  const geos: THREE.BufferGeometry[] = []
  const pole = new THREE.Color(POLE)
  const head = new THREE.Color(HEAD)
  const red = new THREE.Color(RED)
  const amber = new THREE.Color(AMBER)
  const green = new THREE.Color(GREEN)
  const button = new THREE.Color(BUTTON)

  for (const light of TRAFFIC_LIGHTS) {
    const y = terrainHeight(light.x, light.z)
    addCylinder(geos, pole, light.x, y + 1.15, light.z, 0.055, 0.07, 2.3, 10)
    addBox(geos, head, light.x, y + 2.45, light.z, 0.32, 0.78, 0.2, light.rot)
    addLightDisc(geos, red, light.x, y + 2.68, light.z, light.rot)
    addLightDisc(geos, amber, light.x, y + 2.45, light.z, light.rot)
    addLightDisc(geos, green, light.x, y + 2.22, light.z, light.rot)

    const sideX = light.x - Math.sin(light.rot) * 0.18
    const sideZ = light.z + Math.cos(light.rot) * 0.18
    addBox(geos, button, sideX, y + 1.25, sideZ, 0.18, 0.22, 0.08, light.rot)
  }

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function DassaultIntermarcheJunction() {
  const crosswalks = useMemo(buildCrosswalks, [])
  const trafficLights = useMemo(buildTrafficLights, [])

  useEffect(
    () => () => {
      crosswalks.dispose()
      trafficLights.dispose()
    },
    [crosswalks, trafficLights],
  )

  return (
    <>
      <mesh geometry={crosswalks} renderOrder={12}>
        <meshBasicMaterial
          color={CROSSWALK}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-12}
          polygonOffsetUnits={-12}
        />
      </mesh>
      <mesh geometry={trafficLights} castShadow receiveShadow renderOrder={13}>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
    </>
  )
}
