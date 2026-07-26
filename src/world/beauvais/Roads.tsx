import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { ROADS } from './cityData'

/**
 * 🛣️  Les routes de Beauvais (OpenStreetMap), en rubans plats.
 *
 * Chaque route est une polyligne qu'on élargit en un ruban de sa largeur réelle,
 * posé à plat juste au-dessus du sol. Une seule couleur, aucune texture, aucune
 * bordure : c'est la base saine. Le tracé, lui, est le vrai tracé de la ville.
 *
 * Tout est fusionné en UNE géométrie (1 draw call). Comme le monde est plat et
 * que les routes ne bougent jamais, on la construit une seule fois au montage.
 */

const ASPHALT = '#454b52'
const MIN_WIDTH = 3 // largeur mini d'une voie (m) : OSM laisse parfois 0
const Y_ROAD = 0.03 // à peine au-dessus du sol, pour ne pas "clignoter" avec lui

/**
 * Élargit une polyligne en ruban et pousse les triangles dans `out`.
 *
 * À chaque point on calcule une normale (perpendiculaire au tracé) : la moyenne
 * des directions des deux segments voisins, pour que les virages restent lisses
 * au lieu de faire des marches.
 */
function addRibbon(pts: number[][], half: number, out: number[]) {
  const n = pts.length
  if (n < 2) return

  // Bords gauche et droit du ruban, point par point.
  const left: [number, number][] = []
  const right: [number, number][] = []

  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)]
    const next = pts[Math.min(n - 1, i + 1)]
    let dx = next[0] - prev[0]
    let dz = next[1] - prev[1]
    const len = Math.hypot(dx, dz) || 1
    dx /= len
    dz /= len
    // Perpendiculaire au tracé, dans le plan du sol.
    const nx = -dz * half
    const nz = dx * half
    left.push([pts[i][0] + nx, pts[i][1] + nz])
    right.push([pts[i][0] - nx, pts[i][1] - nz])
  }

  // Deux triangles par segment (quad gauche/droite).
  for (let i = 0; i < n - 1; i++) {
    const [lx0, lz0] = left[i]
    const [rx0, rz0] = right[i]
    const [lx1, lz1] = left[i + 1]
    const [rx1, rz1] = right[i + 1]
    out.push(lx0, Y_ROAD, lz0, rx0, Y_ROAD, rz0, rx1, Y_ROAD, rz1)
    out.push(lx0, Y_ROAD, lz0, rx1, Y_ROAD, rz1, lx1, Y_ROAD, lz1)
  }
}

function buildRoadsGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  for (const road of ROADS) {
    addRibbon(road.pts, Math.max(MIN_WIDTH, road.w) / 2, positions)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))

  // Tout est à plat : la normale est "vers le haut" partout, pas besoin de la calculer.
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))

  return geo
}

export default function Roads() {
  const geometry = useMemo(buildRoadsGeometry, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} receiveShadow>
      {/* DoubleSide : on ne se pose pas de question sur le sens des triangles. */}
      <meshToonMaterial color={ASPHALT} gradientMap={toonGradient} side={THREE.DoubleSide} />
    </mesh>
  )
}
