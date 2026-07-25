import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

type FacadeKind = 'timber' | 'stone' | 'art-nouveau' | 'memory'

interface HistoricFacade {
  id: string
  label: string
  lat: number
  lon: number
  kind: FacadeKind
  rot: number
}

interface FacadePlacement {
  x: number
  z: number
  rot: number
  snapped: boolean
}

const FACADES: HistoricFacade[] = [
  { id: 'trois-piliers', label: 'Trois Piliers', lat: 49.42966, lon: 2.082737, kind: 'memory', rot: 0.1 },
  { id: 'ecole-du-chant', label: 'Ecole du Chant', lat: 49.4321, lon: 2.0789, kind: 'timber', rot: -0.38 },
  { id: 'gambetta-52', label: '52 Gambetta', lat: 49.4339, lon: 2.0855, kind: 'stone', rot: 0.22 },
  { id: 'odet-chatillon', label: 'Pans de bois', lat: 49.42496, lon: 2.08562, kind: 'timber', rot: 0.18 },
  { id: 'maison-greber', label: 'Maison Greber', lat: 49.4379, lon: 2.0831, kind: 'art-nouveau', rot: -0.1 },
]

const STONE = '#c8baa2'
const STONE_DARK = '#998c78'
const WOOD = '#6f4c35'
const PLASTER = '#d8cdb8'
const GLASS = '#314d5a'
const CERAMIC = ['#4f876c', '#91699a', '#d8a94a', '#496d8f']

function project(lat: number, lon: number) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return { x, z }
}

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function signedArea(pts: number[][]): number {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    area += x1 * z2 - x2 * z1
  }
  return area / 2
}

function closestPointOnSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  if (len2 === 0) return { x: ax, z: az, t: 0 }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2))
  return { x: ax + dx * t, z: az + dz * t, t }
}

function resolvePlacement(facade: HistoricFacade): FacadePlacement {
  const projected = project(facade.lat, facade.lon)
  let best:
    | {
        x: number
        z: number
        rot: number
        d2: number
        nx: number
        nz: number
      }
    | undefined

  for (const building of BUILDINGS) {
    if (building.kind || building.pts.length < 3) continue
    if ((projected.x - building.cx) ** 2 + (projected.z - building.cz) ** 2 > 58 ** 2) continue

    const ring = signedArea(building.pts) < 0 ? [...building.pts].reverse() : building.pts
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 3) continue

      const p = closestPointOnSegment(projected.x, projected.z, ax, az, bx, bz)
      const d2 = (projected.x - p.x) ** 2 + (projected.z - p.z) ** 2
      if (best && d2 >= best.d2) continue

      const ux = dx / len
      const uz = dz / len
      best = {
        x: p.x,
        z: p.z,
        rot: Math.atan2(uz, ux),
        d2,
        nx: dz / len,
        nz: -dx / len,
      }
    }
  }

  if (!best || best.d2 > 24 ** 2) return { ...projected, rot: facade.rot, snapped: false }
  return {
    x: best.x + best.nx * 0.24,
    z: best.z + best.nz * 0.24,
    rot: best.rot,
    snapped: true,
  }
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
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, 10)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function addTimberFacade(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(PLASTER), x, y + 1.5, z, 6.4, 3, 0.24, rot)
  addBox(geos, new THREE.Color('#7a5a3e'), x, y + 3.12, z, 7, 0.32, 0.45, rot)
  addBox(geos, new THREE.Color(WOOD), x, y + 1.5, z - 0.03, 0.28, 3.1, 0.28, rot)
  for (let i = -2; i <= 2; i++) {
    addBox(geos, new THREE.Color(WOOD), x + i * 1.28, y + 1.55, z - 0.04, 0.18, 3.1, 0.28, rot)
  }
  for (let i = -1; i <= 1; i++) {
    addBox(geos, new THREE.Color(WOOD), x + i * 1.7, y + 1.55, z - 0.05, 0.18, 3.5, 0.26, rot + 0.55)
    addBox(geos, new THREE.Color(WOOD), x + i * 1.7, y + 1.55, z - 0.05, 0.18, 3.5, 0.26, rot - 0.55)
  }
  for (const [wx, wy] of [
    [-1.85, 1.4],
    [1.85, 1.4],
    [-1.85, 2.25],
    [1.85, 2.25],
  ]) {
    addBox(geos, new THREE.Color(GLASS), x + wx, y + wy, z - 0.13, 0.72, 0.52, 0.08, rot)
  }
}

function addStoneFacade(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(STONE), x, y + 1.35, z, 6.8, 2.7, 0.28, rot)
  addBox(geos, new THREE.Color(STONE_DARK), x, y + 0.26, z - 0.04, 7.2, 0.36, 0.32, rot)
  addBox(geos, new THREE.Color('#5e5a54'), x, y + 2.8, z - 0.02, 7.2, 0.2, 0.34, rot)
  for (let i = -2; i <= 2; i++) {
    addBox(geos, new THREE.Color(GLASS), x + i * 1.25, y + 1.55, z - 0.15, 0.62, 0.86, 0.08, rot)
    addBox(geos, new THREE.Color(STONE_DARK), x + i * 1.25, y + 2.08, z - 0.16, 0.78, 0.12, 0.1, rot)
  }
}

function addArtNouveauFacade(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color('#c8b898'), x, y + 1.55, z, 6.2, 3.1, 0.28, rot)
  addBox(geos, new THREE.Color('#6b4c35'), x, y + 0.5, z - 0.1, 1.7, 1, 0.12, rot)
  for (let i = -2; i <= 2; i++) {
    const color = new THREE.Color(CERAMIC[Math.abs(i) % CERAMIC.length])
    addBox(geos, color, x + i * 1.05, y + 2.35 + hash01(x + i, z) * 0.25, z - 0.15, 0.58, 0.58, 0.08, rot)
    addCylinder(geos, color, x + i * 1.05, y + 1.3, z - 0.18, 0.2, 0.24, 0.46)
  }
  addBox(geos, new THREE.Color('#f0e5cf'), x, y + 1.08, z - 0.16, 1.15, 0.4, 0.08, rot)
}

function addMemoryPlaque(geos: THREE.BufferGeometry[], x: number, z: number, rot: number) {
  const y = terrainHeight(x, z)
  addCylinder(geos, new THREE.Color(STONE_DARK), x, y + 0.2, z, 0.86, 1, 0.4)
  addBox(geos, new THREE.Color('#6b5b4a'), x, y + 1.1, z, 2.4, 1.4, 0.16, rot)
  addBox(geos, new THREE.Color('#d8cbb2'), x, y + 1.48, z - 0.08, 1.8, 0.32, 0.08, rot)
}

function buildHistoricFacades() {
  const geos: THREE.BufferGeometry[] = []
  for (const facade of FACADES) {
    const { x, z, rot } = resolvePlacement(facade)
    if (facade.kind === 'timber') addTimberFacade(geos, x, z, rot)
    if (facade.kind === 'stone') addStoneFacade(geos, x, z, rot)
    if (facade.kind === 'art-nouveau') addArtNouveauFacade(geos, x, z, rot)
    if (facade.kind === 'memory') addMemoryPlaque(geos, x, z, rot)
  }
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function HistoricFacades() {
  const geometry = useMemo(buildHistoricFacades, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {FACADES.map((facade) => {
        const { x, z, rot, snapped } = resolvePlacement(facade)
        return (
          <Text
            key={facade.id}
            position={[x, terrainHeight(x, z) + (facade.kind === 'memory' ? 1.48 : 3.25), z - (snapped ? 0 : 0.2)]}
            rotation={[0, rot, 0]}
            fontSize={facade.kind === 'memory' ? 0.28 : 0.38}
            color="#f5ecd9"
            anchorX="center"
            anchorY="middle"
            outlineColor="#24201d"
            outlineWidth={0.026}
            maxWidth={3.2}
          >
            {facade.label}
          </Text>
        )
      })}
    </>
  )
}
