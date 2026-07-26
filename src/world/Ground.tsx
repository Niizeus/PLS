import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { toonGradient } from '../shaders/toonGradient'
import { BOUNDS, SPAWN } from './beauvais/cityData'
import { getHeightMap } from './beauvais/terrain'
import { usePlayerStore } from '../gameplay/stats/playerStore'

/**
 * 🏔️  Le sol de Beauvais, avec son VRAI relief (LiDAR HD de l'IGN).
 *
 * ⚠️ Ce fichier et `sampleHeight()` (beauvais/terrain.ts) décrivent LA MÊME
 * surface, et doivent le rester :
 *  - les sommets sont pris directement dans la grille d'altitudes, sans retouche ;
 *  - les triangles sont découpés (a, c, b) puis (b, c, d), exactement comme la
 *    formule barycentrique de `sampleHeight`.
 * Si tu changes le découpage ici, change-le là-bas dans le même commit — sinon
 * routes, bâtiments et joueur se décalent par rapport au sol qu'on voit.
 *
 * La grille fait 1751×1626 nœuds (2,8 millions) : impossible d'en faire un seul
 * maillage. On n'affiche donc que les DALLES autour du joueur, comme pour les
 * bâtiments. Le brouillard masque déjà tout au-delà de 150 m, et une dalle fait
 * 256 m → on ne voit jamais le bord.
 *
 * Repli : si la carte de relief n'a pas pu être chargée, on affiche un grand plan
 * plat (et `terrainHeight()` renvoie 0) → le jeu reste jouable.
 */

const GROUND_COLOR = '#8a9470'
const CHUNK_CELLS = 32 // côté d'une dalle, en cases de grille (32 × 8 m = 256 m)
const REACH = 1 // anneaux de dalles autour du joueur (1 = 3×3)
const MARGIN = 400 // marge du plan de repli, pour ne pas voir le bord du monde

/**
 * Construit une dalle de terrain à partir de la grille d'altitudes.
 * (ci, cj) = indices de la dalle ; une dalle couvre CHUNK_CELLS cases.
 */
function buildChunk(ci: number, cj: number): THREE.BufferGeometry | null {
  const m = getHeightMap()
  if (!m) return null

  const i0 = ci * CHUNK_CELLS
  const j0 = cj * CHUNK_CELLS
  // Nombre de cases réellement disponibles (la dalle est rognée au bord de la carte).
  const cellsX = Math.min(CHUNK_CELLS, m.w - 1 - i0)
  const cellsZ = Math.min(CHUNK_CELLS, m.h - 1 - j0)
  if (cellsX < 1 || cellsZ < 1) return null

  const nx = cellsX + 1
  const nz = cellsZ + 1
  const positions = new Float32Array(nx * nz * 3)

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3
      positions[k] = m.x0 + (i0 + i) * m.res
      positions[k + 1] = m.heights[(j0 + j) * m.w + (i0 + i)] // altitude brute, non retouchée
      positions[k + 2] = m.z0 + (j0 + j) * m.res
    }
  }

  // Découpage en triangles : DOIT rester identique à `sampleHeight`.
  const indices: number[] = []
  for (let j = 0; j < cellsZ; j++) {
    for (let i = 0; i < cellsX; i++) {
      const a = j * nx + i
      const b = a + 1
      const c = a + nx
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals() // le relief a besoin de vraies normales pour être lisible
  return geo
}

function TerrainChunk({ ci, cj }: { ci: number; cj: number }) {
  const geometry = useMemo(() => buildChunk(ci, cj), [ci, cj])
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial color={GROUND_COLOR} gradientMap={toonGradient} />
    </mesh>
  )
}

/** Repli quand la carte de relief est absente : un grand plan plat à y = 0. */
function FlatGround() {
  const geometry = useMemo(() => {
    const w = BOUNDS.maxX - BOUNDS.minX + MARGIN * 2
    const d = BOUNDS.maxZ - BOUNDS.minZ + MARGIN * 2
    const g = new THREE.PlaneGeometry(w, d)
    g.rotateX(-Math.PI / 2)
    g.translate((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2)
    return g
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial color={GROUND_COLOR} gradientMap={toonGradient} />
    </mesh>
  )
}

export default function Ground() {
  const map = getHeightMap()
  const chunkSize = map ? CHUNK_CELLS * map.res : 1

  // Dalle courante du joueur : on ne recalcule la liste que quand elle CHANGE.
  const [center, setCenter] = useState(() => ({
    ci: map ? Math.floor((SPAWN.x - map.x0) / chunkSize) : 0,
    cj: map ? Math.floor((SPAWN.z - map.z0) / chunkSize) : 0,
  }))
  const frame = useRef(0)

  useFrame(() => {
    if (!map) return
    frame.current = (frame.current + 1) % 12
    if (frame.current !== 0) return

    const p = usePlayerStore.getState().playerObject
    const px = p ? p.position.x : SPAWN.x
    const pz = p ? p.position.z : SPAWN.z
    const ci = Math.floor((px - map.x0) / chunkSize)
    const cj = Math.floor((pz - map.z0) / chunkSize)
    setCenter((c) => (c.ci === ci && c.cj === cj ? c : { ci, cj }))
  })

  if (!map) return <FlatGround />

  const chunks: { ci: number; cj: number }[] = []
  const maxCi = Math.floor((map.w - 2) / CHUNK_CELLS)
  const maxCj = Math.floor((map.h - 2) / CHUNK_CELLS)
  for (let di = -REACH; di <= REACH; di++) {
    for (let dj = -REACH; dj <= REACH; dj++) {
      const ci = center.ci + di
      const cj = center.cj + dj
      if (ci < 0 || cj < 0 || ci > maxCi || cj > maxCj) continue
      chunks.push({ ci, cj })
    }
  }

  return (
    <>
      {chunks.map(({ ci, cj }) => (
        <TerrainChunk key={ci + ':' + cj} ci={ci} cj={cj} />
      ))}
    </>
  )
}
