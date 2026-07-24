import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { BUILDINGS, type Building } from './cityData'

/**
 * 🏙️  Beauvais généré depuis OpenStreetMap (le "Temps 3" du pipeline, voir docs/04).
 *
 * On extrude chaque contour à sa hauteur estimée, on colore FAÇADES et TOITS de
 * teintes variées (couleurs par sommet), puis on FUSIONNE les bâtiments.
 *
 * ⚠️ Toute la ville = ~34 000 bâtiments. Un seul mesh géant saturerait la mémoire,
 * alors on découpe en TUILES : les bâtiments sont regroupés par carré de TILE mètres,
 * et chaque tuile devient un mesh. Bonus : Three.js masque tout seul (frustum culling)
 * les tuiles hors de l'écran → gros gain de perf. C'est la base de l'optimisation.
 */

const TILE = 400 // côté d'une tuile, en mètres

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

/** Aire signée d'un contour → uniformise le sens de parcours (façades bien orientées). */
function signedArea(pts: number[][]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return a / 2
}

/** Construit la géométrie extrudée + colorée d'un bâtiment. */
function buildOne(b: Building, facadeColor: THREE.Color, roofColor: THREE.Color): THREE.BufferGeometry | null {
  const pts = b.pts
  if (pts.length < 3) return null
  const ring = signedArea(pts) < 0 ? [...pts].reverse() : pts

  const shape = new THREE.Shape()
  shape.moveTo(ring[0][0], -ring[0][1])
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], -ring[i][1])
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)

  facadeColor.set(FACADES[Math.floor(hash01(b.cx, b.cz) * FACADES.length)])
  roofColor.set(ROOFS[Math.floor(hash01(b.cz, b.cx) * ROOFS.length)])

  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let v = 0; v < pos.count; v++) {
    const c = pos.getY(v) >= b.h - 0.05 ? roofColor : facadeColor
    colors[v * 3] = c.r
    colors[v * 3 + 1] = c.g
    colors[v * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

/** Construit une géométrie fusionnée par tuile (mémoire maîtrisée : une tuile à la fois). */
function buildTiles(): THREE.BufferGeometry[] {
  // 1) Regrouper les bâtiments par tuile (selon leur centre).
  const groups = new Map<string, Building[]>()
  for (const b of BUILDINGS) {
    const key = Math.floor(b.cx / TILE) + ':' + Math.floor(b.cz / TILE)
    let g = groups.get(key)
    if (!g) groups.set(key, (g = []))
    g.push(b)
  }

  // 2) Fusionner chaque tuile, puis libérer les géométries intermédiaires.
  const tiles: THREE.BufferGeometry[] = []
  const facadeColor = new THREE.Color()
  const roofColor = new THREE.Color()
  for (const group of groups.values()) {
    const geos: THREE.BufferGeometry[] = []
    for (const b of group) {
      const geo = buildOne(b, facadeColor, roofColor)
      if (geo) geos.push(geo)
    }
    if (geos.length === 0) continue
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    tiles.push(merged)
  }
  return tiles
}

export default function Beauvais() {
  const tiles = useMemo(buildTiles, [])
  // Un seul matériau partagé par toutes les tuiles (couleurs par sommet).
  const material = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap: toonGradient,
        side: THREE.DoubleSide,
      }),
    [],
  )

  return (
    <>
      {tiles.map((geo, i) => (
        <mesh key={i} geometry={geo} material={material} castShadow receiveShadow />
      ))}
    </>
  )
}
