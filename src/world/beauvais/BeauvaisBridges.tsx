import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BRIDGE_DECKS, pointInFootprint, ROADS, terrainHeight, WATERS, WATER_INFO, type BridgeDeck } from './cityData'

interface WaterBox {
  index: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  pts: number[][]
}

interface BridgeCandidate {
  x: number
  z: number
  rot: number
  length: number
  width: number
  ramp?: number
  name?: string
  waterIndex: number
  score: number
}

const STONE = '#8d8474'
const STONE_LIGHT = '#b5aa95'
const ASPHALT = '#3f444b'
const RAIL = '#4d4b45'
const SHADOW = '#24313a'
const LABEL = '#f4ead6'

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

function waterBoxes(): WaterBox[] {
  return WATERS.map((water, index) => {
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const [x, z] of water.pts) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
    return { index, minX, maxX, minZ, maxZ, pts: water.pts }
  })
}

function waterIndexAt(x: number, z: number, boxes: WaterBox[]): number {
  for (const box of boxes) {
    if (x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ) continue
    if (pointInFootprint(x, z, box.pts)) return box.index
  }
  return -1
}

function local(x: number, z: number, rot: number, along: number, side: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return { x: x + c * along - s * side, z: z + s * along + c * side }
}

function addBox(
  out: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  length: number,
  height: number,
  width: number,
  rot: number,
) {
  const geo = new THREE.BoxGeometry(length, height, width)
  tintGeometry(geo, color)
  geo.rotateY(-rot)
  geo.translate(x, y, z)
  out.push(geo)
}

function addBridge(candidates: BridgeCandidate[], candidate: BridgeCandidate) {
  const duplicateIndex = candidates.findIndex(
    (bridge) =>
      bridge.waterIndex === candidate.waterIndex &&
      (bridge.x - candidate.x) ** 2 + (bridge.z - candidate.z) ** 2 < 22 ** 2,
  )
  if (duplicateIndex === -1) {
    candidates.push(candidate)
    return
  }
  if (candidate.score > candidates[duplicateIndex].score) candidates[duplicateIndex] = candidate
}

function bridgeFromDeck(deck: BridgeDeck): BridgeCandidate {
  return {
    x: deck.x,
    z: deck.z,
    rot: deck.rot,
    length: deck.length,
    width: deck.width,
    ramp: deck.ramp,
    name: deck.name,
    waterIndex: -1,
    score: 999,
  }
}

function detectBridges(): BridgeCandidate[] {
  const boxes = waterBoxes()
  const candidates: BridgeCandidate[] = []

  for (const road of ROADS) {
    if (road.w < 3) continue

    for (let i = 0; i < road.pts.length - 1; i++) {
      const a = road.pts[i]
      const b = road.pts[i + 1]
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const segmentLength = Math.hypot(dx, dz)
      if (segmentLength < 5 || segmentLength > 110) continue

      let waterIndex = -1
      for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        const x = a[0] + dx * t
        const z = a[1] + dz * t
        waterIndex = waterIndexAt(x, z, boxes)
        if (waterIndex !== -1) break
      }
      if (waterIndex === -1) continue

      const x = (a[0] + b[0]) / 2
      const z = (a[1] + b[1]) / 2
      if (BRIDGE_DECKS.some((deck) => (deck.x - x) ** 2 + (deck.z - z) ** 2 < 65 ** 2)) continue
      addBridge(candidates, {
        x,
        z,
        rot: Math.atan2(dz, dx),
        length: Math.min(56, Math.max(15, segmentLength + 8)),
        width: Math.max(road.w + 2.8, 6.8),
        waterIndex,
        score: segmentLength + road.w * 2,
      })
    }
  }

  return candidates.slice(0, 34)
}

function bridgeTopY(bridge: BridgeCandidate): number {
  const half = bridge.length / 2
  const a = local(bridge.x, bridge.z, bridge.rot, -half * 0.42, 0)
  const b = local(bridge.x, bridge.z, bridge.rot, half * 0.42, 0)
  const roadY = Math.max(terrainHeight(a.x, a.z), terrainHeight(bridge.x, bridge.z), terrainHeight(b.x, b.z)) + 0.24
  const waterY = (bridge.waterIndex >= 0 ? WATER_INFO[bridge.waterIndex]?.surfaceY ?? roadY - 0.6 : roadY - 0.6) + 0.82
  return Math.max(roadY, waterY)
}

function pushSurfaceQuad(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  x: number,
  z: number,
  rot: number,
  a0: number,
  a1: number,
  s0: number,
  s1: number,
  fixedY?: number,
) {
  const p0 = local(x, z, rot, a0, s0)
  const p1 = local(x, z, rot, a1, s0)
  const p2 = local(x, z, rot, a1, s1)
  const p3 = local(x, z, rot, a0, s1)
  const pts = [p0, p1, p2, p3].map((p) => [p.x, fixedY ?? terrainHeight(p.x, p.z) + 0.08, p.z] as const)
  positions.push(...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3])
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function buildSurfaceGeometry(bridges: BridgeCandidate[]): THREE.BufferGeometry | null {
  const positions: number[] = []
  const colors: number[] = []
  const asphalt = new THREE.Color(ASPHALT)
  const stone = new THREE.Color(STONE_LIGHT)

  for (const bridge of bridges) {
    const half = bridge.length / 2
    const ramp = bridge.ramp ?? 10
    const halfRoad = Math.max(2.4, bridge.width / 2 - 1.35)
    const halfStone = bridge.width / 2 - 0.22
    const fixedY = bridge.name ? undefined : bridgeTopY(bridge) + 0.08
    for (let a = -half - ramp; a < half + ramp; a += 5) {
      const a1 = Math.min(a + 5, half + ramp)
      pushSurfaceQuad(positions, colors, stone, bridge.x, bridge.z, bridge.rot, a, a1, -halfStone, halfStone, fixedY)
      pushSurfaceQuad(positions, colors, asphalt, bridge.x, bridge.z, bridge.rot, a, a1, -halfRoad, halfRoad, fixedY ? fixedY + 0.015 : undefined)
    }
  }

  if (positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  geo.computeVertexNormals()
  return geo
}

function buildBridgeGeometry() {
  const bridgeGeos: THREE.BufferGeometry[] = []
  const shadowGeos: THREE.BufferGeometry[] = []
  const bridges = [...BRIDGE_DECKS.map(bridgeFromDeck), ...detectBridges()]

  for (const bridge of bridges) {
    const topY = bridgeTopY(bridge)
    const stone = new THREE.Color(STONE)
    const stoneLight = new THREE.Color(STONE_LIGHT)
    const rail = new THREE.Color(RAIL)
    const shadow = new THREE.Color(SHADOW)

    addBox(shadowGeos, shadow, bridge.x, topY - 0.34, bridge.z, bridge.length * 0.86, 0.08, bridge.width * 0.82, bridge.rot)
    addBox(bridgeGeos, stone, bridge.x, topY - 0.2, bridge.z, bridge.length, 0.28, bridge.width, bridge.rot)

    for (const side of [-1, 1]) {
      const railBase = local(bridge.x, bridge.z, bridge.rot, 0, side * (bridge.width / 2 - 0.25))
      addBox(bridgeGeos, stoneLight, railBase.x, topY + 0.23, railBase.z, bridge.length * 0.96, 0.34, 0.28, bridge.rot)
      addBox(bridgeGeos, rail, railBase.x, topY + 0.52, railBase.z, bridge.length * 0.86, 0.08, 0.2, bridge.rot)

      const posts = Math.max(3, Math.floor(bridge.length / 8))
      for (let i = 0; i <= posts; i++) {
        const along = -bridge.length * 0.42 + (i / posts) * bridge.length * 0.84
        const p = local(bridge.x, bridge.z, bridge.rot, along, side * (bridge.width / 2 - 0.26))
        addBox(bridgeGeos, stoneLight, p.x, topY + 0.54, p.z, 0.24, 0.62, 0.24, bridge.rot)
      }
    }
  }

  const bridgesMerged = bridgeGeos.length ? mergeGeometries(bridgeGeos, false) : null
  const shadowsMerged = shadowGeos.length ? mergeGeometries(shadowGeos, false) : null
  const surfaces = buildSurfaceGeometry(bridges)
  bridgeGeos.forEach((geo) => geo.dispose())
  shadowGeos.forEach((geo) => geo.dispose())
  return { bridges: bridgesMerged, shadows: shadowsMerged, surfaces, authored: BRIDGE_DECKS, count: bridges.length }
}

export default function BeauvaisBridges() {
  const { bridges, shadows, surfaces, authored } = useMemo(buildBridgeGeometry, [])

  useEffect(
    () => () => {
      bridges?.dispose()
      shadows?.dispose()
      surfaces?.dispose()
    },
    [bridges, shadows, surfaces],
  )

  if (!bridges && !surfaces) return null

  return (
    <>
      {shadows ? (
        <mesh geometry={shadows} receiveShadow renderOrder={8}>
          <meshBasicMaterial vertexColors transparent opacity={0.32} />
        </mesh>
      ) : null}
      {surfaces ? (
        <mesh geometry={surfaces} receiveShadow renderOrder={9}>
          <meshToonMaterial
            vertexColors
            gradientMap={toonGradient}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-9}
            polygonOffsetUnits={-9}
          />
        </mesh>
      ) : null}
      {bridges ? (
        <mesh geometry={bridges} castShadow receiveShadow renderOrder={10}>
          <meshToonMaterial vertexColors gradientMap={toonGradient} />
        </mesh>
      ) : null}
      {authored.map((bridge) => {
        const sign = local(bridge.x, bridge.z, bridge.rot, 0, -bridge.width / 2 - 0.58)
        return (
          <Text
            key={bridge.id}
            position={[sign.x, terrainHeight(sign.x, sign.z) + 1.28, sign.z]}
            rotation={[0, -bridge.rot + Math.PI * 0.5, 0]}
            fontSize={0.55}
            color={LABEL}
            anchorX="center"
            anchorY="middle"
            outlineColor="#25211e"
            outlineWidth={0.035}
          >
            {bridge.name.toUpperCase()}
          </Text>
        )
      })}
    </>
  )
}
