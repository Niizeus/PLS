import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { BUILDINGS, SPAWN, terrainHeight, type Building } from './cityData'

/**
 * 🏙️  Beauvais en BLOCS SIMPLES, généré depuis OpenStreetMap.
 *
 * Chaque bâtiment = son contour réel extrudé en un bloc d'une seule couleur.
 * Pas de texture, pas de fenêtres, pas de toit détaillé : c'est la base saine.
 * Le tracé des rues et des places reste juste, parce qu'il vient de la vraie
 * donnée OSM — seul le « décor » est volontairement minimal.
 *
 * ⚠️ La ville fait ~34 000 bâtiments : impossible de tout afficher d'un coup.
 * On fait donc du STREAMING par tuiles :
 *  - les bâtiments sont rangés par tuile de TILE mètres (calcul léger, sans 3D) ;
 *  - seules les tuiles autour du joueur sont montées ; la géométrie d'une tuile
 *    est construite à son montage et libérée à son démontage.
 *
 * ⚠️ Cohérence avec les collisions : on affiche TOUS les bâtiments de la donnée,
 * sans exception. `collision.ts` bloque exactement les mêmes contours → pas de
 * « mur invisible » (un bâtiment qui bloque mais qu'on ne voit pas). Si un jour
 * tu exclus un bâtiment de l'affichage, exclus-le AUSSI des collisions.
 */

const TILE = 180 // côté d'une tuile, en mètres
const REACH = 1 // anneaux de tuiles autour du joueur (1 = 3×3 tuiles)
const MIN_HEIGHT = 3 // hauteur mini d'un bloc (m), pour éviter les galettes
/**
 * Hauteur enterrée sous le sol. Un bâtiment est un bloc à fond plat posé sur un
 * terrain en pente : sans cette jupe, le coin aval décollerait du sol. On
 * l'enfonce donc franchement — c'est invisible et ça marche sur toutes les pentes.
 */
const SKIRT = 8

// Palette sobre : quelques tons de façade, choisis de façon déterministe.
const FACADES = ['#d8cdb8', '#cdbfa6', '#c8c4b9', '#d3c3a4', '#bfb4a0', '#c9b79a']
const MONUMENT = '#b9b3a4' // cathédrale, églises, chapelles : pierre claire

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function colorOf(b: Building): THREE.Color {
  if (b.kind) return new THREE.Color(MONUMENT)
  return new THREE.Color(FACADES[Math.floor(hash01(b.cx, b.cz) * FACADES.length)])
}

/** Extrude le contour d'un bâtiment en un bloc coloré, du sol (y=0) à sa hauteur. */
function buildOne(b: Building): THREE.BufferGeometry | null {
  if (b.pts.length < 3) return null

  // Le contour est en (x, z) monde. Une Shape vit dans le plan XY, et
  // ExtrudeGeometry pousse vers +Z. On dessine donc en (x, -z), puis on couche
  // le tout avec rotateX(-90°) : la profondeur d'extrusion devient la hauteur.
  const shape = new THREE.Shape()
  shape.moveTo(b.pts[0][0], -b.pts[0][1])
  for (let i = 1; i < b.pts.length; i++) shape.lineTo(b.pts[i][0], -b.pts[i][1])
  shape.closePath()

  // Le bloc part sous le sol (jupe) et monte jusqu'à sa hauteur au-dessus du
  // terrain, pris au CENTRE de l'emprise : un bâtiment a un sol horizontal.
  const height = Math.max(MIN_HEIGHT, b.h)
  const base = terrainHeight(b.cx, b.cz)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: SKIRT + height, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, base - SKIRT, 0)

  // Une seule couleur par bloc : on peint les sommets, ce qui permet de fusionner
  // toute la tuile en UN seul objet (1 draw call) au lieu d'un matériau par maison.
  const color = colorOf(b)
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// --- Rangement des bâtiments par tuile (une seule fois, au chargement) ---
const tiles = new Map<string, Building[]>()
const keyOf = (tx: number, tz: number) => tx + ':' + tz

for (const b of BUILDINGS) {
  const key = keyOf(Math.floor(b.cx / TILE), Math.floor(b.cz / TILE))
  let list = tiles.get(key)
  if (!list) tiles.set(key, (list = []))
  list.push(b)
}

/** Une tuile de ville : géométrie construite au montage, libérée au démontage. */
function CityTile({ tileKey }: { tileKey: string }) {
  const geometry = useMemo(() => {
    const list = tiles.get(tileKey)
    if (!list) return null
    const parts: THREE.BufferGeometry[] = []
    for (const b of list) {
      const geo = buildOne(b)
      if (geo) parts.push(geo)
    }
    if (parts.length === 0) return null
    const merged = mergeGeometries(parts, false)
    parts.forEach((p) => p.dispose())
    return merged
  }, [tileKey])

  // Libère la mémoire GPU quand la tuile s'éloigne du joueur.
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshToonMaterial vertexColors gradientMap={toonGradient} />
    </mesh>
  )
}

export default function Beauvais() {
  // Tuile courante du joueur : on ne recalcule la liste que quand elle CHANGE.
  const [center, setCenter] = useState(() => ({
    tx: Math.floor(SPAWN.x / TILE),
    tz: Math.floor(SPAWN.z / TILE),
  }))
  const frame = useRef(0)

  useFrame(() => {
    // Inutile de tester à chaque image : une fois toutes les ~12 images suffit.
    frame.current = (frame.current + 1) % 12
    if (frame.current !== 0) return

    const p = usePlayerStore.getState().playerObject
    const tx = Math.floor((p ? p.position.x : SPAWN.x) / TILE)
    const tz = Math.floor((p ? p.position.z : SPAWN.z) / TILE)
    setCenter((c) => (c.tx === tx && c.tz === tz ? c : { tx, tz }))
  })

  const keys: string[] = []
  for (let dx = -REACH; dx <= REACH; dx++) {
    for (let dz = -REACH; dz <= REACH; dz++) {
      const key = keyOf(center.tx + dx, center.tz + dz)
      if (tiles.has(key)) keys.push(key)
    }
  }

  return (
    <>
      {keys.map((key) => (
        <CityTile key={key} tileKey={key} />
      ))}
    </>
  )
}
