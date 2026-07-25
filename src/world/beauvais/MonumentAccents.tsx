import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, terrainHeight, type Building } from './cityData'

const STONE = '#d9d1bd'
const STONE_SHADOW = '#b9ad96'
const ROOF_LINE = '#263238'

function signedArea(pts: number[][]): number {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    area += x1 * z2 - x2 * z1
  }
  return area / 2
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

function addButtress(
  geos: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  z: number,
  nx: number,
  nz: number,
  height: number,
  width: number,
  depth: number,
  baseY: number,
) {
  const angle = Math.atan2(nz, nx)
  const geo = new THREE.BoxGeometry(depth, height, width)
  tintGeometry(geo, color)
  geo.rotateY(-angle)
  geo.translate(x + nx * depth * 0.5, baseY + height / 2, z + nz * depth * 0.5)
  geos.push(geo)
}

function addMonumentButtresses(geos: THREE.BufferGeometry[], b: Building) {
  const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts
  const color = new THREE.Color(b.kind === 'cathedral' ? STONE : STONE_SHADOW)
  const baseY = terrainHeight(b.cx, b.cz)
  const maxHeight = b.kind === 'cathedral' ? Math.min(24, b.h * 0.55) : Math.min(12, b.h * 0.48)
  const minLen = b.kind === 'cathedral' ? 14 : 10

  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    const dx = bx - ax
    const dz = bz - az
    const len = Math.hypot(dx, dz)
    if (len < minLen || len > 85) continue

    const ux = dx / len
    const uz = dz / len
    const nx = dz / len
    const nz = -dx / len
    const count = Math.max(1, Math.min(6, Math.floor(len / (b.kind === 'cathedral' ? 16 : 18))))
    for (let s = 0; s < count; s++) {
      const t = (s + 0.5) / count
      const x = ax + ux * len * t
      const z = az + uz * len * t
      const height = maxHeight * (0.82 + t * 0.12)
      addButtress(geos, color, x, z, nx, nz, height, b.kind === 'cathedral' ? 1.4 : 1, b.kind === 'cathedral' ? 2.2 : 1.5, baseY)
    }
  }
}

function addCrossLines(lines: number[], x: number, y: number, z: number, size: number) {
  lines.push(x, y, z, x, y + size, z)
  lines.push(x - size * 0.32, y + size * 0.62, z, x + size * 0.32, y + size * 0.62, z)
}

function buildMonumentAccents() {
  const geos: THREE.BufferGeometry[] = []
  const lines: number[] = []

  for (const b of BUILDINGS) {
    if (!b.kind) continue
    addMonumentButtresses(geos, b)

    const y = terrainHeight(b.cx, b.cz) + b.h + 0.35
    if (b.kind === 'cathedral') {
      addCrossLines(lines, b.cx - 9, y, b.cz - 5, 5.2)
      addCrossLines(lines, b.cx + 11, y - 1.2, b.cz + 7, 4.2)
    } else if (b.h >= 14) {
      addCrossLines(lines, b.cx, y, b.cz, 3.2)
    }
  }

  const solid = geos.length > 0 ? mergeGeometries(geos, false) : null
  geos.forEach((g) => g.dispose())

  const crosses = new THREE.BufferGeometry()
  crosses.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3))

  return { solid, crosses }
}

export default function MonumentAccents() {
  const { solid, crosses } = useMemo(buildMonumentAccents, [])

  useEffect(
    () => () => {
      solid?.dispose()
      crosses.dispose()
    },
    [solid, crosses],
  )

  return (
    <>
      {solid ? (
        <mesh geometry={solid} castShadow receiveShadow>
          <meshToonMaterial vertexColors gradientMap={toonGradient} />
        </mesh>
      ) : null}
      <lineSegments geometry={crosses} renderOrder={6}>
        <lineBasicMaterial color={ROOF_LINE} transparent opacity={0.9} depthTest />
      </lineSegments>
    </>
  )
}
