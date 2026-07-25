import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

interface Gateway {
  id: string
  title: string
  subtitle: string
  x: number
  z: number
  rot: number
  tone: 'memory' | 'commerce'
}

const GATEWAYS: Gateway[] = [
  { id: 'gambetta-centre', title: 'Gambetta', subtitle: 'Cathedrale', x: 239.1, z: 30.6, rot: -1.22, tone: 'commerce' },
  { id: 'gambetta-june', title: 'Gambetta', subtitle: '27 Juin', x: 337.7, z: -194.2, rot: -1.15, tone: 'commerce' },
  { id: 'june-west', title: '27 Juin', subtitle: 'Remparts', x: 205.4, z: -303.5, rot: 0.74, tone: 'memory' },
  { id: 'june-east', title: '27 Juin', subtitle: 'Gambetta', x: 518.5, z: -161.7, rot: 0.17, tone: 'memory' },
]

const IRON = '#293136'
const BLUE = '#245678'
const RED = '#b84a42'
const CREAM = '#f0e7d4'
const STONE = '#b9aa91'
const WOOD = '#74523b'
const GLASS = '#314d5a'
const BRASS = '#bd9144'

function isInsideBuilding(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    if (Math.abs(x - b.cx) > 58 || Math.abs(z - b.cz) > 58) continue
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

function offset(g: Gateway, along: number, side: number) {
  const c = Math.cos(g.rot)
  const s = Math.sin(g.rot)
  return {
    x: g.x + c * along - s * side,
    z: g.z + s * along + c * side,
  }
}

function addGatewayFrame(geos: THREE.BufferGeometry[], gateway: Gateway) {
  const boardColor = new THREE.Color(gateway.tone === 'memory' ? RED : BLUE)
  const left = offset(gateway, 0, -3.6)
  const right = offset(gateway, 0, 3.6)
  const center = offset(gateway, 0, 0)
  const y = terrainHeight(center.x, center.z)

  if (!isInsideBuilding(left.x, left.z)) {
    addCylinder(geos, new THREE.Color(IRON), left.x, terrainHeight(left.x, left.z) + 0.9, left.z, 0.12, 0.16, 1.8, 8)
    addCylinder(geos, new THREE.Color(BRASS), left.x, terrainHeight(left.x, left.z) + 1.88, left.z, 0.2, 0.23, 0.16, 8)
  }
  if (!isInsideBuilding(right.x, right.z)) {
    addCylinder(geos, new THREE.Color(IRON), right.x, terrainHeight(right.x, right.z) + 0.9, right.z, 0.12, 0.16, 1.8, 8)
    addCylinder(geos, new THREE.Color(BRASS), right.x, terrainHeight(right.x, right.z) + 1.88, right.z, 0.2, 0.23, 0.16, 8)
  }

  addBox(geos, boardColor, center.x, y + 2.1, center.z, 5.6, 0.58, 0.12, gateway.rot)
  addBox(geos, new THREE.Color(CREAM), center.x, y + 2.1, center.z + 0.08, 5.9, 0.08, 0.15, gateway.rot)
  addBox(geos, new THREE.Color(CREAM), center.x, y + 1.77, center.z + 0.08, 5.9, 0.08, 0.15, gateway.rot)

  for (const side of [-1, 1]) {
    const p = offset(gateway, -2.2, side * 5.0)
    if (isInsideBuilding(p.x, p.z)) continue
    const py = terrainHeight(p.x, p.z)
    if (gateway.tone === 'memory') {
      addBox(geos, new THREE.Color(STONE), p.x, py + 0.34, p.z, 1.6, 0.44, 0.92, gateway.rot)
      addBox(geos, new THREE.Color(WOOD), p.x, py + 1.06, p.z, 1.8, 1.2, 0.14, gateway.rot)
      addBox(geos, boardColor, p.x, py + 1.82, p.z, 1.7, 0.28, 0.08, gateway.rot)
    } else {
      addBox(geos, new THREE.Color(GLASS), p.x, py + 0.78, p.z, 1.85, 1.0, 0.14, gateway.rot)
      addBox(geos, boardColor, p.x, py + 1.48, p.z, 1.9, 0.32, 0.1, gateway.rot)
    }
  }
}

function buildGateways() {
  const geos: THREE.BufferGeometry[] = []
  for (const gateway of GATEWAYS) addGatewayFrame(geos, gateway)
  const geometry = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return geometry
}

export default function JuneGambettaGateways() {
  const geometry = useMemo(buildGateways, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {GATEWAYS.flatMap((gateway) => {
        const p = offset(gateway, 0, 0)
        const y = terrainHeight(p.x, p.z)
        return [
          <Text
            key={`${gateway.id}-title`}
            position={[p.x, y + 2.12, p.z + 0.14]}
            rotation={[0, gateway.rot, 0]}
            fontSize={0.33}
            color={CREAM}
            anchorX="center"
            anchorY="middle"
            outlineColor="#1f2224"
            outlineWidth={0.02}
            maxWidth={4.9}
          >
            {gateway.title}
          </Text>,
          <Text
            key={`${gateway.id}-subtitle`}
            position={[p.x, y + 1.78, p.z + 0.14]}
            rotation={[0, gateway.rot, 0]}
            fontSize={0.24}
            color={CREAM}
            anchorX="center"
            anchorY="middle"
            outlineColor="#1f2224"
            outlineWidth={0.016}
            maxWidth={4.8}
          >
            {gateway.subtitle}
          </Text>,
        ]
      })}
    </>
  )
}
