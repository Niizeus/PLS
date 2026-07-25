import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, ORIGIN, terrainHeight, type Building } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180
const DETAIL_DEPTH = 0.052

interface StreetPlaque {
  id: string
  label: string
  lat: number
  lon: number
  rot: number
  kind?: 'street' | 'district'
}

interface PlaquePlacement {
  x: number
  z: number
  rot: number
  frontX: number
  frontZ: number
}

const STREET_PLAQUES: StreetPlaque[] = [
  { id: 'carnot', label: 'Rue Carnot', lat: 49.43139, lon: 2.08379, rot: 0.64 },
  { id: 'saint-pierre', label: 'Rue Saint-Pierre', lat: 49.43166, lon: 2.08188, rot: -0.08 },
  { id: 'taillerie', label: 'Rue de la Taillerie', lat: 49.43095, lon: 2.08155, rot: -0.25 },
  { id: '27-juin', label: 'Rue du 27 Juin', lat: 49.43431, lon: 2.08585, rot: 0.18 },
  { id: 'gambetta', label: 'Rue Gambetta', lat: 49.43338, lon: 2.08485, rot: 0.82 },
  { id: 'ecole-chant', label: 'Ecole du Chant', lat: 49.4321, lon: 2.0789, rot: -0.36, kind: 'district' },
  { id: 'malherbe', label: 'Rue Malherbe', lat: 49.43048, lon: 2.08164, rot: 0.14 },
  { id: 'desgroux', label: 'Rue Desgroux', lat: 49.43004, lon: 2.08193, rot: 0.04 },
  { id: 'musee', label: 'Rue du Musee', lat: 49.4327, lon: 2.08018, rot: 0.24, kind: 'district' },
]

const PANEL_COLORS = ['#d6c8ad', '#c9b99c', '#ded3be', '#c0b2a0']
const BAY_COLORS = ['#394d54', '#49616a', '#31464f']
const AWNING_COLORS = ['#b84d44', '#2e7280', '#d0a64a', '#5d6f95']
const PLACE_STONE = '#e2d7c2'
const PLACE_SHADOW = '#8d806d'

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
  if (len2 === 0) return { x: ax, z: az }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2))
  return { x: ax + dx * t, z: az + dz * t }
}

function resolvePlaquePlacement(plaque: StreetPlaque): PlaquePlacement {
  const projected = project(plaque.lat, plaque.lon)
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
    if ((projected.x - b.cx) ** 2 + (projected.z - b.cz) ** 2 > 52 ** 2) continue
    const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts

    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 3.5) continue

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

  if (!best || best.d2 > 18 ** 2) {
    const frontX = -Math.sin(plaque.rot)
    const frontZ = -Math.cos(plaque.rot)
    return { ...projected, rot: plaque.rot, frontX, frontZ }
  }

  return {
    x: best.x + best.nx * 0.22,
    z: best.z + best.nz * 0.22,
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

function addPlaque(
  geos: THREE.BufferGeometry[],
  x: number,
  z: number,
  rot: number,
  frontX: number,
  frontZ: number,
  district = false,
) {
  const y = terrainHeight(x, z)
  const face = district ? new THREE.Color('#5b4e75') : new THREE.Color('#245678')
  addBox(geos, new THREE.Color('#2b2925'), x, y + 1.04, z, 0.1, 1.82, 0.1, rot)
  addBox(geos, face, x, y + 2.02, z, district ? 3.1 : 2.7, 0.48, 0.12, rot)
  addBox(
    geos,
    new THREE.Color('#f0e7d4'),
    x + frontX * 0.05,
    y + 2.02,
    z + frontZ * 0.05,
    district ? 3.28 : 2.88,
    0.08,
    0.16,
    rot,
  )
  addBox(
    geos,
    new THREE.Color('#f0e7d4'),
    x + frontX * 0.05,
    y + 1.74,
    z + frontZ * 0.05,
    district ? 3.28 : 2.88,
    0.08,
    0.16,
    rot,
  )
}

function addFacadeQuad(
  positions: number[],
  colors: number[],
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  y1: number,
  y2: number,
  color: THREE.Color,
) {
  positions.push(x1, y1, z1, x2, y1, z2, x2, y2, z2)
  positions.push(x1, y1, z1, x2, y2, z2, x1, y2, z1)
  for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
}

function isReconstructionBlock(b: Building): boolean {
  if (b.kind || b.h < 6 || b.h > 22) return false
  const aroundPlace = b.cx > -20 && b.cx < 165 && b.cz > 135 && b.cz < 330
  const aroundCarnot = b.cx > 85 && b.cx < 225 && b.cz > 55 && b.cz < 210
  const aroundSaintPierre = b.cx > -35 && b.cx < 70 && b.cz > 70 && b.cz < 175
  const aroundGambetta = b.cx > 210 && b.cx < 385 && b.cz > -225 && b.cz < 45
  const aroundJune = b.cx > 175 && b.cx < 545 && b.cz > -325 && b.cz < -135
  return aroundPlace || aroundCarnot || aroundSaintPierre || aroundGambetta || aroundJune
}

function isPlaceFrameBlock(b: Building): boolean {
  return !b.kind && b.cx > -30 && b.cx < 175 && b.cz > 130 && b.cz < 338 && b.h >= 7 && b.h <= 22
}

function isJuneOrGambettaBlock(b: Building): boolean {
  const aroundGambetta = b.cx > 210 && b.cx < 385 && b.cz > -225 && b.cz < 45
  const aroundJune = b.cx > 175 && b.cx < 545 && b.cz > -325 && b.cz < -135
  return !b.kind && (aroundGambetta || aroundJune) && b.h >= 6 && b.h <= 22
}

function buildReconstructionFacades() {
  const positions: number[] = []
  const colors: number[] = []
  const panel = new THREE.Color()
  const bay = new THREE.Color()
  const line = new THREE.Color('#8d806d')
  const awning = new THREE.Color()

  for (const b of BUILDINGS) {
    if (!isReconstructionBlock(b) || b.pts.length < 3) continue
    const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts
    const baseY = terrainHeight(b.cx, b.cz) + 0.36
    const topY = terrainHeight(b.cx, b.cz) + b.h - 0.45

    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 12 || len > 58) continue

      const ux = dx / len
      const uz = dz / len
      const nx = dz / len
      const nz = -dx / len
      const bayCount = Math.max(2, Math.min(7, Math.floor(len / 5.4)))
      const margin = Math.min(2, len * 0.13)
      const step = (len - margin * 2) / bayCount
      const placeFrame = isPlaceFrameBlock(b) && len > 16
      const juneGambettaFrame = isJuneOrGambettaBlock(b) && len > 10

      panel.set(PANEL_COLORS[Math.floor(hash01(b.cx + i * 17, b.cz - i * 11) * PANEL_COLORS.length)])
      addFacadeQuad(
        positions,
        colors,
        ax + ux * 0.5 + nx * DETAIL_DEPTH,
        az + uz * 0.5 + nz * DETAIL_DEPTH,
        bx - ux * 0.5 + nx * DETAIL_DEPTH,
        bz - uz * 0.5 + nz * DETAIL_DEPTH,
        baseY + 0.25,
        Math.min(topY, baseY + 2.35),
        panel,
      )

      if (juneGambettaFrame) {
        const accent = b.cz < -135 ? new THREE.Color('#a85a4d') : new THREE.Color('#2f7184')
        addFacadeQuad(
          positions,
          colors,
          ax + ux * 0.65 + nx * (DETAIL_DEPTH + 0.02),
          az + uz * 0.65 + nz * (DETAIL_DEPTH + 0.02),
          bx - ux * 0.65 + nx * (DETAIL_DEPTH + 0.02),
          bz - uz * 0.65 + nz * (DETAIL_DEPTH + 0.02),
          baseY + 2.48,
          baseY + 2.78,
          accent,
        )
        for (let s = 0; s < bayCount; s += 2) {
          const d = margin + step * (s + 0.5)
          const x = ax + ux * d
          const z = az + uz * d
          addFacadeQuad(
            positions,
            colors,
            x - ux * 0.22 + nx * (DETAIL_DEPTH + 0.024),
            z - uz * 0.22 + nz * (DETAIL_DEPTH + 0.024),
            x + ux * 0.22 + nx * (DETAIL_DEPTH + 0.024),
            z + uz * 0.22 + nz * (DETAIL_DEPTH + 0.024),
            baseY + 1.08,
            baseY + 1.34,
            new THREE.Color('#f1e7d3'),
          )
        }
      }

      if (placeFrame) {
        addFacadeQuad(
          positions,
          colors,
          ax + ux * 0.4 + nx * (DETAIL_DEPTH + 0.018),
          az + uz * 0.4 + nz * (DETAIL_DEPTH + 0.018),
          bx - ux * 0.4 + nx * (DETAIL_DEPTH + 0.018),
          bz - uz * 0.4 + nz * (DETAIL_DEPTH + 0.018),
          baseY + 2.72,
          baseY + 2.96,
          new THREE.Color(PLACE_STONE),
        )
        addFacadeQuad(
          positions,
          colors,
          ax + ux * 0.55 + nx * (DETAIL_DEPTH + 0.016),
          az + uz * 0.55 + nz * (DETAIL_DEPTH + 0.016),
          bx - ux * 0.55 + nx * (DETAIL_DEPTH + 0.016),
          bz - uz * 0.55 + nz * (DETAIL_DEPTH + 0.016),
          topY - 0.6,
          topY - 0.36,
          new THREE.Color(PLACE_STONE),
        )
        for (let s = 0; s <= bayCount; s++) {
          const d = margin + step * s
          if (d < 0.6 || d > len - 0.6) continue
          const x = ax + ux * d
          const z = az + uz * d
          addFacadeQuad(
            positions,
            colors,
            x - ux * 0.08 + nx * (DETAIL_DEPTH + 0.02),
            z - uz * 0.08 + nz * (DETAIL_DEPTH + 0.02),
            x + ux * 0.08 + nx * (DETAIL_DEPTH + 0.02),
            z + uz * 0.08 + nz * (DETAIL_DEPTH + 0.02),
            baseY + 0.34,
            baseY + 2.82,
            new THREE.Color(PLACE_SHADOW),
          )
        }
      }

      if (hash01(b.cx - i * 13, b.cz + i * 31) > 0.55) {
        awning.set(AWNING_COLORS[Math.floor(hash01(b.cz + i * 5, b.cx - i * 9) * AWNING_COLORS.length)])
        addFacadeQuad(
          positions,
          colors,
          ax + ux * margin + nx * (DETAIL_DEPTH + 0.03),
          az + uz * margin + nz * (DETAIL_DEPTH + 0.03),
          bx - ux * margin + nx * (DETAIL_DEPTH + 0.03),
          bz - uz * margin + nz * (DETAIL_DEPTH + 0.03),
          baseY + 2.42,
          baseY + 2.78,
          awning,
        )
      }

      const floors = Math.max(1, Math.min(5, Math.floor((b.h - 3) / 2.8)))
      for (let f = 0; f < floors; f++) {
        const y1 = baseY + 3.05 + f * 2.55
        const y2 = y1 + 1.08
        if (y2 > topY) continue
        addFacadeQuad(
          positions,
          colors,
          ax + ux * 0.8 + nx * DETAIL_DEPTH,
          az + uz * 0.8 + nz * DETAIL_DEPTH,
          bx - ux * 0.8 + nx * DETAIL_DEPTH,
          bz - uz * 0.8 + nz * DETAIL_DEPTH,
          y1 - 0.26,
          y1 - 0.12,
          line,
        )

        for (let s = 0; s < bayCount; s++) {
          const center = margin + step * (s + 0.5)
          const half = Math.min(0.72, step * 0.34)
          bay.set(BAY_COLORS[Math.floor(hash01(b.cx + s * 23, b.cz + f * 19) * BAY_COLORS.length)])
          addFacadeQuad(
            positions,
            colors,
            ax + ux * (center - half) + nx * DETAIL_DEPTH,
            az + uz * (center - half) + nz * DETAIL_DEPTH,
            ax + ux * (center + half) + nx * DETAIL_DEPTH,
            az + uz * (center + half) + nz * DETAIL_DEPTH,
            y1,
            y2,
            bay,
          )
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  geo.computeVertexNormals()
  return geo
}

function buildPlaqueGeometry() {
  const geos: THREE.BufferGeometry[] = []
  for (const plaque of STREET_PLAQUES) {
    const { x, z, rot, frontX, frontZ } = resolvePlaquePlacement(plaque)
    addPlaque(geos, x, z, rot, frontX, frontZ, plaque.kind === 'district')
  }
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function CentreVilleStreetIdentity() {
  const facadeGeometry = useMemo(buildReconstructionFacades, [])
  const plaqueGeometry = useMemo(buildPlaqueGeometry, [])

  useEffect(
    () => () => {
      facadeGeometry.dispose()
      plaqueGeometry.dispose()
    },
    [facadeGeometry, plaqueGeometry],
  )

  return (
    <>
      <mesh geometry={facadeGeometry} renderOrder={4}>
        <meshToonMaterial
          vertexColors
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-6}
          polygonOffsetUnits={-6}
        />
      </mesh>
      <mesh geometry={plaqueGeometry} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {STREET_PLAQUES.map((plaque) => {
        const { x, z, rot, frontX, frontZ } = resolvePlaquePlacement(plaque)
        return (
          <Text
            key={plaque.id}
            position={[x + frontX * 0.12, terrainHeight(x, z) + 2.04, z + frontZ * 0.12]}
            rotation={[0, rot, 0]}
            fontSize={plaque.kind === 'district' ? 0.28 : 0.25}
            color="#f4ead6"
            anchorX="center"
            anchorY="middle"
            outlineColor="#1f2224"
            outlineWidth={0.018}
            maxWidth={plaque.kind === 'district' ? 2.8 : 2.35}
          >
            {plaque.label}
          </Text>
        )
      })}
    </>
  )
}
