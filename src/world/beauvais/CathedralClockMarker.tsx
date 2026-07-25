import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { terrainHeight } from './cityData'

const X = -7.5
const Z = -48
const ROT = -0.12

const STONE = '#b9aa91'
const DARK = '#25292c'
const GOLD = '#d0a64a'
const BLUE = '#2f7184'
const RED = '#b84a42'
const CREAM = '#f3ead6'

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
  segments = 16,
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segments)
  tintGeometry(geo, color)
  geo.rotateX(Math.PI / 2)
  geo.rotateZ(rotYToZ(ROT))
  geo.translate(x, y, z)
  geos.push(geo)
}

function rotYToZ(rotY: number) {
  return rotY
}

function buildClockMarker() {
  const geos: THREE.BufferGeometry[] = []
  const y = terrainHeight(X, Z)
  const fx = -Math.sin(ROT)
  const fz = -Math.cos(ROT)

  addBox(geos, new THREE.Color(STONE), X, y + 1.42, Z, 3.25, 2.65, 0.28, ROT)
  addBox(geos, new THREE.Color(DARK), X + fx * 0.18, y + 1.42, Z + fz * 0.18, 2.75, 2.15, 0.12, ROT)
  addBox(geos, new THREE.Color(BLUE), X + fx * 0.25, y + 2.95, Z + fz * 0.25, 2.65, 0.32, 0.1, ROT)
  addBox(geos, new THREE.Color(GOLD), X + fx * 0.26, y + 2.72, Z + fz * 0.26, 2.3, 0.22, 0.08, ROT)
  addBox(geos, new THREE.Color(GOLD), X + fx * 0.26, y + 0.23, Z + fz * 0.26, 3.4, 0.18, 0.34, ROT)

  for (let i = 0; i < 6; i++) {
    const row = Math.floor(i / 3)
    const col = i % 3
    const x = X + (col - 1) * 0.72
    const yy = y + 1.42 + (row === 0 ? 0.36 : -0.42)
    const z = Z + fz * 0.32 + fx * 0
    addCylinder(geos, new THREE.Color(i % 2 === 0 ? CREAM : BLUE), x, yy, z, 0.22, 0.22, 0.08, 18)
    addBox(geos, new THREE.Color(GOLD), x, yy, z + fz * 0.04, 0.04, 0.36, 0.05, ROT)
  }

  for (let i = 0; i < 5; i++) {
    addBox(geos, new THREE.Color(i % 2 === 0 ? RED : CREAM), X - 1.04 + i * 0.52, y + 2.15, Z + fz * 0.34, 0.18, 0.34, 0.08, ROT)
  }
  addBox(geos, new THREE.Color(GOLD), X, y + 2.38, Z + fz * 0.34, 0.58, 0.18, 0.08, ROT)
  addBox(geos, new THREE.Color(GOLD), X, y + 2.5, Z + fz * 0.34, 0.16, 0.28, 0.08, ROT)

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function CathedralClockMarker() {
  const geometry = useMemo(buildClockMarker, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshToonMaterial vertexColors gradientMap={toonGradient} />
    </mesh>
  )
}
