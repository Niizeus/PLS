import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

interface ServiceSpot {
  id: string
  label: string
  shortLabel: string
  lat: number
  lon: number
  rot: number
  color: string
}

interface Placement {
  x: number
  z: number
  rot: number
  frontX: number
  frontZ: number
}

const SERVICES: ServiceSpot[] = [
  {
    id: 'office-tourisme',
    label: 'Office de Tourisme',
    shortLabel: 'VISIT',
    lat: 49.43146,
    lon: 2.08257,
    rot: 0.18,
    color: '#2c7184',
  },
]

function project(lat: number, lon: number) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return { x, z }
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
  if (len2 === 0) return { x: ax, z: az }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2))
  return { x: ax + dx * t, z: az + dz * t }
}

function resolvePlacement(spot: ServiceSpot): Placement {
  const projected = project(spot.lat, spot.lon)
  let best:
    | {
        x: number
        z: number
        rot: number
        nx: number
        nz: number
        d2: number
      }
    | undefined

  for (const b of BUILDINGS) {
    if (b.kind || b.pts.length < 3) continue
    if ((projected.x - b.cx) ** 2 + (projected.z - b.cz) ** 2 > 44 ** 2) continue
    const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts

    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 4) continue
      const p = closestPointOnSegment(projected.x, projected.z, ax, az, bx, bz)
      const d2 = (projected.x - p.x) ** 2 + (projected.z - p.z) ** 2
      if (best && d2 >= best.d2) continue
      best = {
        x: p.x,
        z: p.z,
        rot: Math.atan2(dz / len, dx / len),
        nx: dz / len,
        nz: -dx / len,
        d2,
      }
    }
  }

  if (!best || best.d2 > 16 ** 2) {
    return {
      ...projected,
      rot: spot.rot,
      frontX: -Math.sin(spot.rot),
      frontZ: -Math.cos(spot.rot),
    }
  }

  return {
    x: best.x + best.nx * 0.28,
    z: best.z + best.nz * 0.28,
    rot: best.rot,
    frontX: best.nx,
    frontZ: best.nz,
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

function addServiceMarker(geos: THREE.BufferGeometry[], spot: ServiceSpot) {
  const { x, z, rot, frontX, frontZ } = resolvePlacement(spot)
  const y = terrainHeight(x, z)
  addBox(geos, new THREE.Color('#252a2d'), x, y + 0.78, z, 0.1, 1.38, 0.1, rot)
  addBox(geos, new THREE.Color(spot.color), x, y + 1.6, z, 3.25, 0.62, 0.14, rot)
  addBox(geos, new THREE.Color('#e8dcc5'), x + frontX * 0.08, y + 1.6, z + frontZ * 0.08, 0.54, 0.42, 0.08, rot)
  addBox(geos, new THREE.Color('#d1a342'), x + frontX * 0.95, y + 0.6, z + frontZ * 0.95, 1.05, 0.82, 0.24, rot)
  addBox(geos, new THREE.Color('#f3ead6'), x + frontX * 0.98, y + 0.82, z + frontZ * 0.98, 0.68, 0.12, 0.28, rot)
}

function buildServices() {
  const geos: THREE.BufferGeometry[] = []
  for (const spot of SERVICES) addServiceMarker(geos, spot)
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function CentreVilleServices() {
  const geometry = useMemo(buildServices, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {SERVICES.map((spot) => {
        const { x, z, rot, frontX, frontZ } = resolvePlacement(spot)
        return (
          <Text
            key={spot.id}
            position={[x + frontX * 0.16, terrainHeight(x, z) + 1.61, z + frontZ * 0.16]}
            rotation={[0, rot, 0]}
            fontSize={0.34}
            color="#f5ecd9"
            anchorX="center"
            anchorY="middle"
            outlineColor="#25211e"
            outlineWidth={0.024}
            maxWidth={2.85}
          >
            {spot.shortLabel}
          </Text>
        )
      })}
    </>
  )
}
