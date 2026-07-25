import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { PLACE_MARECHAUX, terrainHeight } from './cityData'

const PAVING = ['#bfb29b', '#cbbda5', '#aea38f', '#d5c7ad']
const GRASS = '#5f844c'
const STONE = '#b9aa91'
const DARK_STONE = '#756a5c'
const METAL = '#313739'
const CREAM = '#f1e8d6'
const JOINT = '#62594f'
const Y_OFFSET = 0.13

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

function local(lx: number, lz: number) {
  const c = Math.cos(PLACE_MARECHAUX.rot)
  const s = Math.sin(PLACE_MARECHAUX.rot)
  return {
    x: PLACE_MARECHAUX.x + lx * c - lz * s,
    z: PLACE_MARECHAUX.z + lx * s + lz * c,
  }
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

function pushQuad(positions: number[], colors: number[], color: THREE.Color, x0: number, z0: number, x1: number, z1: number) {
  const a = local(x0, z0)
  const b = local(x1, z0)
  const c = local(x1, z1)
  const d = local(x0, z1)
  const pts = [a, b, c, d].map((p) => [p.x, terrainHeight(p.x, p.z) + Y_OFFSET, p.z] as const)
  positions.push(...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3])
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function pushLine(lines: number[], x0: number, z0: number, x1: number, z1: number) {
  const a = local(x0, z0)
  const b = local(x1, z1)
  lines.push(a.x, terrainHeight(a.x, a.z) + Y_OFFSET + 0.018, a.z)
  lines.push(b.x, terrainHeight(b.x, b.z) + Y_OFFSET + 0.018, b.z)
}

function buildGround() {
  const positions: number[] = []
  const colors: number[] = []
  const lines: number[] = []
  const color = new THREE.Color()
  const cell = 5
  const halfX = PLACE_MARECHAUX.halfX
  const halfZ = PLACE_MARECHAUX.halfZ

  for (let x = -halfX; x < halfX; x += cell) {
    for (let z = -halfZ; z < halfZ; z += cell) {
      const x1 = Math.min(x + cell, halfX)
      const z1 = Math.min(z + cell, halfZ)
      const cx = (x + x1) / 2
      const cz = (z + z1) / 2
      const ellipse = Math.hypot(cx / halfX, cz / halfZ)
      if (ellipse > 1) continue
      const centralWalk = Math.abs(cz) < 5.2 || Math.abs(cx) < 5.2
      color.set(centralWalk ? PAVING[Math.floor(hash01(cx, cz) * PAVING.length)] : GRASS)
      pushQuad(positions, colors, color, x, z, x1, z1)
      if (centralWalk && hash01(cx + 5, cz - 2) > 0.22) pushLine(lines, x, z, x1, z)
      if (centralWalk && hash01(cx - 3, cz + 8) > 0.34) pushLine(lines, x, z, x, z1)
    }
  }

  const ground = new THREE.BufferGeometry()
  ground.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  ground.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  ground.computeVertexNormals()

  const joints = new THREE.BufferGeometry()
  joints.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))
  return { ground, joints }
}

function buildProps() {
  const geos: THREE.BufferGeometry[] = []
  const centerY = terrainHeight(PLACE_MARECHAUX.x, PLACE_MARECHAUX.z)

  addCylinder(geos, new THREE.Color(DARK_STONE), PLACE_MARECHAUX.x, centerY + 0.23, PLACE_MARECHAUX.z, 2.8, 3.15, 0.46, 18)
  addCylinder(geos, new THREE.Color(STONE), PLACE_MARECHAUX.x, centerY + 0.92, PLACE_MARECHAUX.z, 1.25, 1.55, 1.15, 14)
  addBox(geos, new THREE.Color(METAL), PLACE_MARECHAUX.x, centerY + 1.78, PLACE_MARECHAUX.z, 0.42, 1.15, 0.42, PLACE_MARECHAUX.rot)

  const names = ['JUIN', 'LECLERC', 'KOENIG', 'DE LATTRE']
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.45
    const p = local(Math.cos(a) * 9.5, Math.sin(a) * 7)
    addBox(geos, new THREE.Color(STONE), p.x, terrainHeight(p.x, p.z) + 0.42, p.z, 3.5, 0.72, 0.52, PLACE_MARECHAUX.rot + a)
    addBox(geos, new THREE.Color(DARK_STONE), p.x, terrainHeight(p.x, p.z) + 0.84, p.z, 2.8, 0.1, 0.6, PLACE_MARECHAUX.rot + a)
  }

  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    const p = local(Math.cos(a) * 54, Math.sin(a) * 33)
    const y = terrainHeight(p.x, p.z)
    addCylinder(geos, new THREE.Color('#5b3e2d'), p.x, y + 0.52, p.z, 0.12, 0.16, 1.04, 8)
    addCylinder(geos, new THREE.Color(i % 3 === 0 ? '#6d8f4d' : '#4f7d46'), p.x, y + 1.35, p.z, 0.86, 1.08, 1.1, 10)
  }

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return { props: merged, names }
}

export default function PlaceMarechauxPrecinct() {
  const { ground, joints } = useMemo(buildGround, [])
  const { props, names } = useMemo(buildProps, [])

  useEffect(
    () => () => {
      ground.dispose()
      joints.dispose()
      props.dispose()
    },
    [ground, joints, props],
  )

  return (
    <>
      <mesh geometry={ground} receiveShadow renderOrder={4}>
        <meshToonMaterial
          vertexColors
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
      <lineSegments geometry={joints} renderOrder={5}>
        <lineBasicMaterial color={JOINT} transparent opacity={0.34} depthTest />
      </lineSegments>
      <mesh geometry={props} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[PLACE_MARECHAUX.x, terrainHeight(PLACE_MARECHAUX.x, PLACE_MARECHAUX.z) + 2.72, PLACE_MARECHAUX.z]}
        rotation={[0, PLACE_MARECHAUX.rot, 0]}
        fontSize={0.62}
        color={CREAM}
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.035}
      >
        PLACE DES MARECHAUX
      </Text>
      {names.map((name, i) => {
        const a = (i / 4) * Math.PI * 2 + 0.45
        const p = local(Math.cos(a) * 9.5, Math.sin(a) * 7)
        return (
          <Text
            key={name}
            position={[p.x, terrainHeight(p.x, p.z) + 0.9, p.z]}
            rotation={[0, PLACE_MARECHAUX.rot + a, 0]}
            fontSize={0.22}
            color={CREAM}
            anchorX="center"
            anchorY="middle"
            outlineColor="#24201d"
            outlineWidth={0.012}
          >
            {name}
          </Text>
        )
      })}
    </>
  )
}
