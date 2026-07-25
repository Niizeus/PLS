import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { terrainHeight } from './cityData'
import { getGlobalMap, loadLidarTerrain } from './lidarTerrain'

/**
 * 🏔️  Rendu du terrain LiDAR HD (carte globale) en cell-shading.
 *
 * On construit le maillage à partir de la carte de relief globale (lidarTerrain.ts),
 * décimé (STEP) pour tenir le budget de sommets, et découpé en CHUNKS pour que le
 * frustum culling élimine ce qui est hors écran. Couleur du bas (vert vallée) au haut
 * (brun coteau), comme l'ancien Terrain, mais avec le vrai relief. Voir docs/06.
 */

const STEP = 2 // 1 sommet tous les STEP nœuds (8 m × 2 = 16 m de maille)
const CHUNK = 200 // nœuds (décimés) par chunk → frustum culling
const LOW = '#79a05a'
const HIGH = '#a89a72'

function buildChunks(): THREE.BufferGeometry[] {
  const g = getGlobalMap()
  if (!g) return []
  const { w, h, res, Emin, Nmax, E0, N0, heights } = g

  // Bornes d'altitude globales (pour une couleur cohérente entre chunks).
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < heights.length; i++) {
    const v = heights[i]
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const cLow = new THREE.Color(LOW)
  const cHigh = new THREE.Color(HIGH)
  const tmp = new THREE.Color()

  // Nombre de nœuds décimés au total.
  const dw = Math.floor((w - 1) / STEP) + 1
  const dh = Math.floor((h - 1) / STEP) + 1
  const geoms: THREE.BufferGeometry[] = []

  for (let cz = 0; cz < dh - 1; cz += CHUNK) {
    for (let cx = 0; cx < dw - 1; cx += CHUNK) {
      const iEnd = Math.min(cx + CHUNK, dw - 1)
      const jEnd = Math.min(cz + CHUNK, dh - 1)
      const nx = iEnd - cx + 1
      const nz = jEnd - cz + 1
      const positions = new Float32Array(nx * nz * 3)
      const colors = new Float32Array(nx * nz * 3)
      for (let jj = 0; jj < nz; jj++) {
        for (let ii = 0; ii < nx; ii++) {
          const i = Math.min(w - 1, (cx + ii) * STEP)
          const j = Math.min(h - 1, (cz + jj) * STEP)
          const x = Emin + i * res - E0
          const z = N0 - (Nmax - j * res)
          const y = terrainHeight(x, z)
          const idx = (jj * nx + ii) * 3
          positions[idx] = x
          positions[idx + 1] = y
          positions[idx + 2] = z
          const f = (y - lo) / (hi - lo || 1)
          tmp.copy(cLow).lerp(cHigh, Math.min(1, f * 0.85))
          colors[idx] = tmp.r
          colors[idx + 1] = tmp.g
          colors[idx + 2] = tmp.b
        }
      }
      const indices: number[] = []
      for (let jj = 0; jj < nz - 1; jj++) {
        for (let ii = 0; ii < nx - 1; ii++) {
          const a = jj * nx + ii
          const b = a + 1
          const c = a + nx
          const d = c + 1
          indices.push(a, c, b, b, c, d)
        }
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geo.setIndex(indices)
      geo.computeVertexNormals()
      geoms.push(geo)
    }
  }
  return geoms
}

export default function TerrainLidar() {
  const [geoms, setGeoms] = useState<THREE.BufferGeometry[]>([])

  useEffect(() => {
    let alive = true
    loadLidarTerrain().then(() => {
      if (alive) setGeoms(buildChunks())
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      {geoms.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshToonMaterial vertexColors gradientMap={toonGradient} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}
