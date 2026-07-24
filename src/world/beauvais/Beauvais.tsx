import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS } from './cityData'

/**
 * 🏙️  Beauvais généré depuis OpenStreetMap (le "Temps 3" du pipeline, voir docs/04).
 *
 * On lit les bâtiments (via cityData), on extrude chaque contour en volume 3D à sa
 * hauteur estimée, puis — POINT CLÉ PERF — on FUSIONNE tout en une seule géométrie :
 * la ville entière tient alors en UN SEUL draw call au lieu de ~1400.
 *
 * Les lieux emblématiques (cathédrale soignée, gare...) seront posés à la main
 * PAR-DESSUS cette base automatique plus tard.
 */

// Couleur unique des façades pour l'instant (look cartoon, cohérent avec le reste).
const BUILDING_COLOR = '#cfc3b0'

/**
 * Aire signée d'un contour. Le signe indique le sens de parcours (horaire/anti-horaire).
 * On s'en sert pour mettre TOUS les bâtiments dans le même sens, sinon certaines
 * façades regarderaient vers l'intérieur et paraîtraient sombres.
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

  for (const b of BUILDINGS) {
    const pts = b.pts
    if (pts.length < 3) continue

    // Uniformise le sens de parcours (anti-horaire) pour des façades bien orientées.
    const ring = signedArea(pts) < 0 ? [...pts].reverse() : pts

    // Forme 2D en repère (x, -z). Après extrusion puis bascule (rotateX), on
    // retombe exactement sur les coordonnées monde (x, hauteur en y, z).
    const shape = new THREE.Shape()
    shape.moveTo(ring[0][0], -ring[0][1])
    for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], -ring[i][1])
    shape.closePath()

    const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2) // couche la forme : l'épaisseur d'extrusion devient la hauteur (Y)
    geometries.push(geo)
  }

  const merged = mergeGeometries(geometries, false)
  // Les géométries intermédiaires ont été copiées dans "merged" : on les libère.
  geometries.forEach((g) => g.dispose())
  return merged
}

export default function Beauvais() {
  // La ville n'est construite qu'une fois, puis gardée en mémoire entre les rendus.
  const geometry = useMemo(buildCityGeometry, [])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {/* DoubleSide = pas de face sombre même si un contour OSM est mal orienté. */}
      <meshToonMaterial color={BUILDING_COLOR} gradientMap={toonGradient} side={THREE.DoubleSide} />
    </mesh>
  )
}
