import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight } from './cityData'

interface ReliefPatch {
  x: number
  z: number
  width: number
  depth: number
  step: number
}

interface Sample {
  x: number
  z: number
  h: number
}

const CONTOUR_COLOR = '#61714f'
const TALUS_COLOR = '#4f5b45'
const CONTOUR_INTERVAL = 2.5
const CONTOUR_Y = 0.16
const TALUS_Y = 0.19

const PATCHES: ReliefPatch[] = [
  { x: 75, z: 120, width: 620, depth: 700, step: 20 },
  { x: 335, z: -200, width: 470, depth: 330, step: 18 },
  { x: 650, z: -220, width: 300, depth: 260, step: 18 },
  { x: 765, z: -475, width: 360, depth: 430, step: 18 },
  { x: 760, z: -1040, width: 620, depth: 980, step: 24 },
  { x: 1105, z: -1870, width: 540, depth: 560, step: 24 },
  { x: -410, z: 505, width: 430, depth: 430, step: 20 },
  { x: 610, z: -170, width: 420, depth: 430, step: 20 },
  { x: 210, z: 1020, width: 360, depth: 300, step: 20 },
  { x: -520, z: -210, width: 360, depth: 300, step: 20 },
]

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function edgeHit(a: Sample, b: Sample, level: number): [number, number, number] | null {
  const da = a.h - level
  const db = b.h - level
  if (da === 0 && db === 0) return null
  if ((da < 0 && db < 0) || (da > 0 && db > 0)) return null
  const t = (level - a.h) / (b.h - a.h)
  if (!Number.isFinite(t) || t < 0 || t > 1) return null
  const x = a.x + (b.x - a.x) * t
  const z = a.z + (b.z - a.z) * t
  return [x, level + CONTOUR_Y, z]
}

function pushContourCell(out: number[], a: Sample, b: Sample, c: Sample, d: Sample, level: number) {
  const hits = [
    edgeHit(a, b, level),
    edgeHit(b, d, level),
    edgeHit(d, c, level),
    edgeHit(c, a, level),
  ].filter(Boolean) as Array<[number, number, number]>

  if (hits.length < 2) return
  out.push(...hits[0], ...hits[1])
  if (hits.length >= 4) out.push(...hits[2], ...hits[3])
}

function pushTalus(out: number[], x: number, z: number, step: number) {
  const left = terrainHeight(x - step * 0.45, z)
  const right = terrainHeight(x + step * 0.45, z)
  const back = terrainHeight(x, z - step * 0.45)
  const front = terrainHeight(x, z + step * 0.45)
  const gx = right - left
  const gz = front - back
  const slope = Math.hypot(gx, gz)
  if (slope < 0.95 || hash01(x, z) < 0.38) return

  const inv = 1 / (slope || 1)
  const dx = (-gx * inv * step) / 3.2
  const dz = (-gz * inv * step) / 3.2
  const px = -dz * 0.32
  const pz = dx * 0.32
  const x0 = x + px
  const z0 = z + pz
  const x1 = x + dx - px
  const z1 = z + dz - pz
  out.push(x0, terrainHeight(x0, z0) + TALUS_Y, z0)
  out.push(x1, terrainHeight(x1, z1) + TALUS_Y, z1)
}

function buildPatch(outContours: number[], outTalus: number[], patch: ReliefPatch) {
  const cols = Math.floor(patch.width / patch.step) + 1
  const rows = Math.floor(patch.depth / patch.step) + 1
  const x0 = patch.x - ((cols - 1) * patch.step) / 2
  const z0 = patch.z - ((rows - 1) * patch.step) / 2
  const samples: Sample[] = []
  let minH = Infinity
  let maxH = -Infinity

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = x0 + i * patch.step
      const z = z0 + j * patch.step
      const h = terrainHeight(x, z)
      samples.push({ x, z, h })
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }
  }

  const firstLevel = Math.ceil((minH + 0.4) / CONTOUR_INTERVAL) * CONTOUR_INTERVAL
  const lastLevel = Math.floor((maxH - 0.4) / CONTOUR_INTERVAL) * CONTOUR_INTERVAL

  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = samples[j * cols + i]
      const b = samples[j * cols + i + 1]
      const c = samples[(j + 1) * cols + i]
      const d = samples[(j + 1) * cols + i + 1]
      for (let level = firstLevel; level <= lastLevel; level += CONTOUR_INTERVAL) {
        pushContourCell(outContours, a, b, c, d, level)
      }
      if ((i + j) % 2 === 0) pushTalus(outTalus, (a.x + d.x) / 2, (a.z + d.z) / 2, patch.step)
    }
  }
}

function geoFrom(positions: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geo
}

function buildReliefGeometry() {
  const contours: number[] = []
  const talus: number[] = []
  for (const patch of PATCHES) buildPatch(contours, talus, patch)
  return { contours: geoFrom(contours), talus: geoFrom(talus) }
}

export default function CentreVilleRelief() {
  const { contours, talus } = useMemo(buildReliefGeometry, [])

  useEffect(
    () => () => {
      contours.dispose()
      talus.dispose()
    },
    [contours, talus],
  )

  return (
    <>
      <lineSegments geometry={contours} renderOrder={2}>
        <lineBasicMaterial color={CONTOUR_COLOR} transparent opacity={0.42} depthTest />
      </lineSegments>
      <lineSegments geometry={talus} renderOrder={3}>
        <lineBasicMaterial color={TALUS_COLOR} transparent opacity={0.34} depthTest />
      </lineSegments>
    </>
  )
}
