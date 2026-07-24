import { useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { ROADS, terrainHeight } from './cityData'

/**
 * 🛣️  Les routes de Beauvais (depuis OpenStreetMap).
 *
 * Chaque route est une polyligne + une largeur. On construit un RUBAN CONTINU par
 * route (un seul bandeau qui suit tous les points), avec des raccords propres aux
 * angles (miter) → plus de trous ni de chevauchements moches comme avec des
 * rectangles séparés. Tout est fusionné en une seule géométrie (1 draw call).
 */

const ROAD_Y = 0.15 // au-dessus du terrain (évite le z-fighting avec le sol)
const ROAD_COLOR = '#5b5f66' // bitume

/** Ajoute au tableau les triangles du ruban d'une route. */
function addRibbon(pts: number[][], half: number, out: number[]) {
  const n = pts.length
  if (n < 2) return

  // Pour chaque sommet, on calcule un décalage perpendiculaire "miter" (moyenne des
  // perpendiculaires des segments voisins) qui garde une largeur constante.
  const left: [number, number][] = []
  const right: [number, number][] = []

  for (let i = 0; i < n; i++) {
    let d0x = 0, d0z = 0, d1x = 0, d1z = 0
    if (i > 0) {
      d0x = pts[i][0] - pts[i - 1][0]
      d0z = pts[i][1] - pts[i - 1][1]
      const l = Math.hypot(d0x, d0z) || 1
      d0x /= l
      d0z /= l
    }
    if (i < n - 1) {
      d1x = pts[i + 1][0] - pts[i][0]
      d1z = pts[i + 1][1] - pts[i][1]
      const l = Math.hypot(d1x, d1z) || 1
      d1x /= l
      d1z /= l
    }
    if (i === 0) { d0x = d1x; d0z = d1z } // extrémités : une seule direction
    if (i === n - 1) { d1x = d0x; d1z = d0z }

    // Perpendiculaires (côté gauche = (-dz, dx)).
    const n0x = -d0z, n0z = d0x
    const n1x = -d1z, n1z = d1x
    let mx = n0x + n1x
    let mz = n0z + n1z
    const ml = Math.hypot(mx, mz) || 1
    mx /= ml
    mz /= ml
    // Longueur du miter (bornée pour éviter les pointes dans les angles serrés).
    const cos = Math.max(0.35, mx * n1x + mz * n1z)
    const off = half / cos
    left.push([pts[i][0] + mx * off, pts[i][1] + mz * off])
    right.push([pts[i][0] - mx * off, pts[i][1] - mz * off])
  }

  const push = (p: [number, number]) => {
    out.push(p[0], terrainHeight(p[0], p[1]) + ROAD_Y, p[1])
  }
  for (let i = 0; i < n - 1; i++) {
    // 2 triangles entre les sommets i et i+1
    push(left[i]); push(right[i]); push(right[i + 1])
    push(left[i]); push(right[i + 1]); push(left[i + 1])
  }
}

function buildRoadsGeometry(): THREE.BufferGeometry {
  const out: number[] = []
  for (const road of ROADS) addRibbon(road.pts, road.w / 2, out)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3))
  geo.computeVertexNormals()
  return geo
}

export default function Roads() {
  const geometry = useMemo(buildRoadsGeometry, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial color={ROAD_COLOR} gradientMap={toonGradient} side={THREE.DoubleSide} />
    </mesh>
  )
}
