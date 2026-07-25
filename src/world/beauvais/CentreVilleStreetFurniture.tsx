import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, pointInFootprint, terrainHeight } from './cityData'

const BOLLARD = '#3b3732'
const BENCH_WOOD = '#8b5d3f'
const BENCH_METAL = '#343b40'
const PLANTER = '#77695a'
const PLANT = '#456f4b'

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

function addBollard(geos: THREE.BufferGeometry[], color: THREE.Color, x: number, z: number) {
  if (isInsideBuilding(x, z)) return
  const h = 0.75
  const geo = new THREE.CylinderGeometry(0.13, 0.16, h, 8)
  tintGeometry(geo, color)
  geo.translate(x, terrainHeight(x, z) + h / 2 + 0.05, z)
  geos.push(geo)
}

function addBench(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number) {
  if (isInsideBuilding(x, z)) return
  const y = terrainHeight(x, z)
  const wood = new THREE.Color(BENCH_WOOD)
  const metal = new THREE.Color(BENCH_METAL)
  addBox(geos, wood, x, y + 0.48, z, 2.25, 0.16, 0.55, rotY)
  addBox(geos, wood, x, y + 0.82, z - Math.cos(rotY) * 0.27, 2.25, 0.14, 0.18, rotY)
  addBox(geos, metal, x - Math.cos(rotY) * 0.72, y + 0.24, z + Math.sin(rotY) * 0.72, 0.12, 0.42, 0.12, rotY)
  addBox(geos, metal, x + Math.cos(rotY) * 0.72, y + 0.24, z - Math.sin(rotY) * 0.72, 0.12, 0.42, 0.12, rotY)
}

function addPlanter(geos: THREE.BufferGeometry[], x: number, z: number, rotY: number) {
  if (isInsideBuilding(x, z)) return
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color(PLANTER), x, y + 0.28, z, 1.35, 0.52, 0.75, rotY)
  addBox(geos, new THREE.Color(PLANT), x, y + 0.65, z, 1.05, 0.34, 0.52, rotY)
}

function buildFurniture() {
  const geos: THREE.BufferGeometry[] = []
  const bollard = new THREE.Color(BOLLARD)

  for (let x = -96; x <= 96; x += 12) {
    if (Math.abs(x) < 18) continue
    addBollard(geos, bollard, x, -48)
    addBollard(geos, bollard, x, 32)
  }

  for (let z = -42; z <= 26; z += 11) {
    addBollard(geos, bollard, -112, z)
    addBollard(geos, bollard, 112, z)
  }

  const benches: Array<[number, number, number]> = [
    [-82, -24, Math.PI * 0.5],
    [82, -24, -Math.PI * 0.5],
    [-62, 24, Math.PI * 0.5],
    [62, 24, -Math.PI * 0.5],
    [-18, 48, 0],
    [22, 48, 0],
  ]
  for (const [x, z, rot] of benches) addBench(geos, x, z, rot)

  const planters: Array<[number, number, number]> = [
    [-104, -52, 0],
    [104, -52, 0],
    [-104, 36, 0],
    [104, 36, 0],
    [-38, -56, Math.PI * 0.5],
    [38, -56, Math.PI * 0.5],
  ]
  for (const [x, z, rot] of planters) {
    if (hash01(x, z) > 0.18) addPlanter(geos, x, z, rot)
  }

  if (geos.length === 0) return null
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function CentreVilleStreetFurniture() {
  const geometry = useMemo(buildFurniture, [])

  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshToonMaterial vertexColors gradientMap={toonGradient} />
    </mesh>
  )
}
