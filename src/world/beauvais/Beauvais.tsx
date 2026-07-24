import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS } from './cityData'

/**
 * 🏙️  Beauvais généré depuis OpenStreetMap (le "Temps 3" du pipeline, voir docs/04).
 *
 * On extrude chaque contour à sa hauteur estimée, on colore les FAÇADES et les
 * TOITS de teintes variées (couleurs par sommet) pour un rendu bien plus détaillé
 * qu'un aplat unique, puis — POINT CLÉ PERF — on FUSIONNE tout en une seule
 * géométrie : la ville entière tient en UN SEUL draw call.
 */

// Palettes réalistes mais cartoon. Chaque bâtiment pioche une façade + un toit
// de façon déterministe (selon sa position) → varié mais stable d'une fois sur l'autre.
const FACADES = [
  '#d8cdb8', '#cdbfa6', '#c8c4b9', '#d3c3a4', '#bfb4a0',
  '#c9b79a', '#baa98f', '#d6cbb0', '#c2a98c', '#cfc7bd',
]
const ROOFS = ['#8a7f72', '#7f7d79', '#9a6b57', '#6f6b64', '#8b6f5e', '#767c7a']

/** Pseudo-aléatoire déterministe à partir d'une position. */
function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Aire signée d'un contour → sert à mettre tous les bâtiments dans le même sens
 * de parcours, sinon certaines façades regarderaient vers l'intérieur (sombres).
 */
function signedArea(pts: number[][]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return a / 2
}

/** Construit la géométrie fusionnée de toute la ville (opération lourde → une seule fois). */
function buildCityGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = []
  const facadeColor = new THREE.Color()
  const roofColor = new THREE.Color()

  for (const b of BUILDINGS) {
    const pts = b.pts
    if (pts.length < 3) continue

    const ring = signedArea(pts) < 0 ? [...pts].reverse() : pts

    // Forme 2D en repère (x, -z). Après extrusion + bascule, on retombe sur (x, y, z).
    const shape = new THREE.Shape()
    shape.moveTo(ring[0][0], -ring[0][1])
    for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], -ring[i][1])
    shape.closePath()

    const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2) // l'épaisseur d'extrusion devient la hauteur (Y)

    // Couleurs déterministes pour ce bâtiment (façade + toit).
    facadeColor.set(FACADES[Math.floor(hash01(b.cx, b.cz) * FACADES.length)])
    roofColor.set(ROOFS[Math.floor(hash01(b.cz, b.cx) * ROOFS.length)])

    // Sommets près du haut = toit ; le reste = façade.
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    for (let v = 0; v < pos.count; v++) {
      const c = pos.getY(v) >= b.h - 0.05 ? roofColor : facadeColor
      colors[v * 3] = c.r
      colors[v * 3 + 1] = c.g
      colors[v * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    geometries.push(geo)
  }

  const merged = mergeGeometries(geometries, false)
  geometries.forEach((g) => g.dispose())
  return merged
}

export default function Beauvais() {
  const geometry = useMemo(buildCityGeometry, [])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {/* vertexColors = on utilise les couleurs par sommet (façades + toits). */}
      <meshToonMaterial vertexColors gradientMap={toonGradient} side={THREE.DoubleSide} />
    </mesh>
  )
}
