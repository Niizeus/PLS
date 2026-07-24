import { useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../shaders/toonGradient'
import { BOUNDS, TERRAIN } from './beauvais/cityData'

/**
 * 🏔️  Le sol de Beauvais AVEC SON RELIEF.
 *
 * On construit un maillage à partir de la grille d'altitudes réelle (cityData.TERRAIN,
 * récupérée depuis un modèle d'élévation). La couleur va du vert (bas, vallée du
 * Thérain) au brun clair (hauteurs, coteaux). Si le relief n'a pas pu être récupéré,
 * on retombe sur un grand plan plat.
 */

const LOW = '#79a05a' // vallée (vert)
const HIGH = '#a89a72' // coteaux (brun clair)

function buildGeometry(): THREE.BufferGeometry {
  const t = TERRAIN

  // Repli : pas de relief → grand plan plat couvrant la ville.
  if (!t) {
    const w = BOUNDS.maxX - BOUNDS.minX + 120
    const d = BOUNDS.maxZ - BOUNDS.minZ + 120
    const g = new THREE.PlaneGeometry(w, d)
    g.rotateX(-Math.PI / 2)
    g.translate((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2)
    return g
  }

  const { cols, x0, z0, dx, dz, h } = t
  const positions = new Float32Array(cols * cols * 3)
  const colors = new Float32Array(cols * cols * 3)
  const low = Math.min(...h)
  const high = Math.max(...h)
  const cLow = new THREE.Color(LOW)
  const cHigh = new THREE.Color(HIGH)
  const tmp = new THREE.Color()

  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i
      const y = h[idx]
      positions[idx * 3] = x0 + i * dx
      positions[idx * 3 + 1] = y
      positions[idx * 3 + 2] = z0 + j * dz
      const f = (y - low) / (high - low || 1)
      tmp.copy(cLow).lerp(cHigh, Math.min(1, f * 0.85))
      colors[idx * 3] = tmp.r
      colors[idx * 3 + 1] = tmp.g
      colors[idx * 3 + 2] = tmp.b
    }
  }

  const indices: number[] = []
  for (let j = 0; j < cols - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i
      const b = a + 1
      const c = a + cols
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

export default function Terrain() {
  const geometry = useMemo(buildGeometry, [])
  const flat = !TERRAIN

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial
        color={flat ? '#8f9581' : '#ffffff'}
        vertexColors={!flat}
        gradientMap={toonGradient}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
