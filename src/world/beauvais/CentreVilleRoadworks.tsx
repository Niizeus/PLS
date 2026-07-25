import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

const BARRIER_RED = '#c64a3f'
const BARRIER_WHITE = '#e6ddc8'
const CONE_ORANGE = '#d96b2b'
const CONE_DARK = '#3a332d'
const SIGN_YELLOW = '#d8b84b'

interface Worksite {
  x: number
  z: number
  rot: number
  barriers: number
}

const WORKSITES: Worksite[] = [
  { x: -72, z: -84, rot: 0.08, barriers: 3 },
  { x: 94, z: -74, rot: -0.22, barriers: 2 },
  { x: -126, z: 18, rot: Math.PI * 0.5, barriers: 2 },
  { x: 82, z: 78, rot: 0.18, barriers: 3 },
]

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
  rotY: number,
) {
  const geo = new THREE.BoxGeometry(sx, sy, sz)
  tintGeometry(geo, color)
  geo.rotateY(rotY)
  geo.translate(x, y, z)
  geos.push(geo)
}

function addBarrier(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number) {
  if (isInsideBuilding(x, z)) return
  const y = terrainHeight(x, z)
  const red = new THREE.Color(BARRIER_RED)
  const white = new THREE.Color(BARRIER_WHITE)
  addBox(geos, red, x, y + 0.62, z, 2.45, 0.18, 0.16, rotY)
  addBox(geos, white, x - Math.cos(rotY) * 0.52, y + 0.63, z + Math.sin(rotY) * 0.52, 0.42, 0.2, 0.18, rotY)
  addBox(geos, white, x + Math.cos(rotY) * 0.52, y + 0.63, z - Math.sin(rotY) * 0.52, 0.42, 0.2, 0.18, rotY)
  addBox(geos, red, x - Math.sin(rotY) * 0.92, y + 0.34, z - Math.cos(rotY) * 0.92, 0.13, 0.58, 0.13, rotY)
  addBox(geos, red, x + Math.sin(rotY) * 0.92, y + 0.34, z + Math.cos(rotY) * 0.92, 0.13, 0.58, 0.13, rotY)
}

function addCone(geos: THREE.BufferGeometry[], x: number, z: number) {
  if (isInsideBuilding(x, z)) return
  const y = terrainHeight(x, z)
  const base = new THREE.CylinderGeometry(0.28, 0.32, 0.1, 8)
  tintGeometry(base, new THREE.Color(CONE_DARK))
  base.translate(x, y + 0.08, z)
  geos.push(base)

  const cone = new THREE.ConeGeometry(0.24, 0.74, 10)
  tintGeometry(cone, new THREE.Color(CONE_ORANGE))
  cone.translate(x, y + 0.48, z)
  geos.push(cone)
}

function addSign(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number) {
  if (isInsideBuilding(x, z)) return
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(CONE_DARK), x, y + 0.48, z, 0.1, 0.9, 0.1, rotY)
  addBox(geos, new THREE.Color(SIGN_YELLOW), x, y + 1.08, z, 0.95, 0.48, 0.09, rotY)
}

function buildRoadworks() {
  const geos: THREE.BufferGeometry[] = []

  for (const site of WORKSITES) {
    const c = Math.cos(site.rot)
    const s = Math.sin(site.rot)
    const start = -((site.barriers - 1) * 2.35) / 2
    for (let i = 0; i < site.barriers; i++) {
      const d = start + i * 2.35
      addBarrier(geos, site.x + d * c, site.z + d * s, site.rot)
    }

    for (let i = 0; i < site.barriers + 2; i++) {
      const d = start - 1.2 + i * 1.8
      const side = hash01(site.x + i, site.z - i) > 0.5 ? 1 : -1
      addCone(geos, site.x + d * c - s * side * 1.05, site.z + d * s + c * side * 1.05)
    }

    if (hash01(site.x, site.z) > 0.3) {
      addSign(geos, site.x - s * 1.8, site.z + c * 1.8, site.rot)
    }
  }

  if (geos.length === 0) return null
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function CentreVilleRoadworks() {
  const geometry = useMemo(buildRoadworks, [])

  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshToonMaterial vertexColors gradientMap={toonGradient} />
    </mesh>
  )
}
