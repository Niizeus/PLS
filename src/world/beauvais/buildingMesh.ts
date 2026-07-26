import * as THREE from 'three'
import { terrainHeight, type Building } from './cityData'

/**
 * 🧱 buildingMesh.ts — transforme UN bâtiment (contour + hauteurs) en triangles.
 *
 * Avant, chaque bâtiment était une simple boîte : contour extrudé jusqu'à sa
 * hauteur, dessus plat. D'où la ville « en Lego ». Maintenant on construit un
 * vrai volume : des MURS qui montent jusqu'à la gouttière, puis un TOIT en pente.
 *
 * ── Comment on fabrique le toit ──────────────────────────────────────────────
 * On ne connaît que deux choses (voir `bdtopo.mjs` et `roofs.mjs`) : la hauteur du
 * toit `rh` et l'orientation de son faîtage `ra`. Ça suffit, grâce à une astuce :
 *
 *   la hauteur du toit en un point ne dépend QUE de sa distance au faîtage.
 *
 * On mesure donc chaque point du contour le long de l'axe PERPENDICULAIRE au
 * faîtage. Le faîtage passe au milieu, à la hauteur `rh` ; les deux bords
 * retombent à zéro. Entre les deux, c'est linéaire — donc chaque versant est un
 * plan parfait, quelle que soit la forme du bâtiment (même en L, même tordu).
 *
 * Deux conséquences agréables :
 *  - les murs n'ont plus tous la même hauteur : ceux des extrémités montent en
 *    biais et forment tout seuls les PIGNONS, exactement comme en vrai ;
 *  - il n'y a aucune géométrie à stocker dans le JSON, juste deux nombres.
 *
 * La seule précaution : un triangle du toit ne doit jamais ENJAMBER le faîtage,
 * sinon il coupe la crête en biseau. On découpe donc ceux qui traversent.
 */

/** Hauteur mini d'un mur (m). L'IGN descend à 1 m sur de petits abris ; en dessous
 *  le bâtiment devient une galette qui ne se lit plus. */
const MIN_HEIGHT = 2

/**
 * Hauteur enterrée sous le sol. Un bâtiment est un bloc à fond plat posé sur un
 * terrain en pente : sans cette jupe, le coin aval décollerait du sol. On
 * l'enfonce donc franchement — c'est invisible et ça marche sur toutes les pentes.
 */
const SKIRT = 8

// Palette sobre : quelques tons de façade, choisis de façon déterministe.
const FACADES = ['#d8cdb8', '#cdbfa6', '#c8c4b9', '#d3c3a4', '#bfb4a0', '#c9b79a']
const MONUMENT = '#b9b3a4' // cathédrale, églises, chapelles : pierre claire

/**
 * Couleur de toit par matériau réel (BD TOPO). À Beauvais c'est très majoritairement
 * de la tuile, avec de l'ardoise en centre ancien : c'est ce contraste tuile/ardoise
 * qui fait qu'on reconnaît la ville vue d'en haut.
 */
const ROOF_COLORS: Record<string, string> = {
  t: '#a8553f', // tuile (terre cuite)
  a: '#4f555f', // ardoise
  z: '#8b9096', // zinc / aluminium
  b: '#9b9890', // béton
}
const ROOF_TILE = ROOF_COLORS.t // matériau inconnu → tuile, largement majoritaire ici
const ROOF_SLATE = ROOF_COLORS.a // monuments : ardoise / plomb
const ROOF_FLAT = '#8a8781' // toiture-terrasse (gravier, bitume)

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function facadeColor(b: Building): THREE.Color {
  if (b.kind) return new THREE.Color(MONUMENT)
  return new THREE.Color(FACADES[Math.floor(hash01(b.cx, b.cz) * FACADES.length)])
}

function roofColor(b: Building): THREE.Color {
  if (!(b.rh! > 0)) return new THREE.Color(ROOF_FLAT)
  if (b.rm) return new THREE.Color(ROOF_COLORS[b.rm] ?? ROOF_TILE)
  return new THREE.Color(b.kind ? ROOF_SLATE : ROOF_TILE)
}

/**
 * Renvoie le contour dans le sens qui donne des murs tournés vers l'EXTÉRIEUR.
 * Les contours OSM arrivent dans les deux sens ; sans ça, un bâtiment sur deux
 * serait retourné (on verrait à travers).
 */
function orientRing(pts: number[][]): number[][] {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    area += x1 * z2 - x2 * z1
  }
  return area < 0 ? pts.slice().reverse() : pts
}

type Tri = number[][] // 3 points [x, z]

/**
 * Coupe un triangle du toit en deux si le faîtage le traverse, pour qu'aucune
 * facette n'enjambe la crête. `d` donne la distance signée d'un point au faîtage.
 */
function splitAtRidge(tri: Tri, d: (p: number[]) => number): Tri[] {
  const dv = tri.map(d)
  const eps = 1e-4
  const sign = dv.map((v) => (v > eps ? 1 : v < -eps ? -1 : 0))
  if (!sign.includes(1) || !sign.includes(-1)) return [tri] // ne traverse pas

  // Point où l'arête (a → b) croise le faîtage.
  const cut = (a: number, b: number): number[] => {
    const t = dv[a] / (dv[a] - dv[b])
    return [tri[a][0] + (tri[b][0] - tri[a][0]) * t, tri[a][1] + (tri[b][1] - tri[a][1]) * t]
  }

  const zero = sign.indexOf(0)
  if (zero >= 0) {
    // Un sommet est PILE sur le faîtage : une seule coupe suffit.
    const p = sign.findIndex((s) => s === 1)
    const n = sign.findIndex((s) => s === -1)
    const x = cut(p, n)
    return [
      [tri[zero], tri[p], x],
      [tri[zero], x, tri[n]],
    ]
  }

  // Deux sommets d'un côté, un seul de l'autre : deux coupes, trois triangles.
  const lone = sign.findIndex((s, i) => s !== sign[(i + 1) % 3] && s !== sign[(i + 2) % 3])
  const o1 = (lone + 1) % 3
  const o2 = (lone + 2) % 3
  const x1 = cut(lone, o1)
  const x2 = cut(lone, o2)
  return [
    [tri[lone], x1, x2],
    [x1, tri[o1], tri[o2]],
    [x1, tri[o2], x2],
  ]
}

/** Construit le volume complet d'un bâtiment : murs + toit, en un seul maillage. */
export function buildBuilding(b: Building): THREE.BufferGeometry | null {
  if (b.pts.length < 3) return null
  const ring = orientRing(b.pts)

  const ground = terrainHeight(b.cx, b.cz)
  const bottom = ground - SKIRT
  const eave = ground + Math.max(MIN_HEIGHT, b.h) // haut des murs = gouttière

  // --- Le profil du toit : hauteur en fonction de la distance au faîtage.
  const rh = b.rh ?? 0
  let nx = 0
  let nz = 0
  let mid = 0
  let invHalfDepth = 0
  if (rh > 0 && b.ra !== undefined) {
    // Axe perpendiculaire au faîtage : c'est le long de CET axe que le toit descend.
    nx = -Math.sin(b.ra)
    nz = Math.cos(b.ra)
    let min = Infinity
    let max = -Infinity
    for (const [x, z] of ring) {
      const s = x * nx + z * nz
      if (s < min) min = s
      if (s > max) max = s
    }
    const halfDepth = (max - min) / 2
    if (halfDepth > 0.25) {
      mid = (min + max) / 2
      invHalfDepth = 1 / halfDepth
    }
  }
  /** Distance signée au faîtage (0 = sur la crête). */
  const distToRidge = (p: number[]) => p[0] * nx + p[1] * nz - mid
  /** Hauteur du toit au-dessus de la gouttière, en un point du contour. */
  const roofRise = (p: number[]) =>
    invHalfDepth ? rh * (1 - Math.abs(distToRidge(p)) * invHalfDepth) : 0

  const positions: number[] = []
  const colors: number[] = []
  const wall = facadeColor(b)
  const roof = roofColor(b)

  const push = (x: number, y: number, z: number, c: THREE.Color) => {
    positions.push(x, y, z)
    colors.push(c.r, c.g, c.b)
  }

  // --- MURS. Le haut de chaque mur suit le toit : les murs d'extrémité montent
  // donc en biais et dessinent les pignons sans qu'on ait rien à faire de plus.
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const c = ring[(i + 1) % ring.length]
    const topA = eave + roofRise(a)
    const topC = eave + roofRise(c)
    // Deux triangles, orientés vers l'extérieur (le contour est déjà remis d'aplomb).
    push(a[0], bottom, a[1], wall)
    push(a[0], topA, a[1], wall)
    push(c[0], topC, c[1], wall)

    push(a[0], bottom, a[1], wall)
    push(c[0], topC, c[1], wall)
    push(c[0], bottom, c[1], wall)
  }

  // --- TOIT. On découpe l'emprise en triangles, on coupe ceux qui traversent le
  // faîtage, puis on relève chaque sommet à sa hauteur.
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z))
  let faces: number[][]
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, [])
  } catch {
    return null // contour dégénéré (auto-intersecté) : on laisse tomber ce bâtiment
  }

  for (const [i0, i1, i2] of faces) {
    const tri: Tri = [ring[i0], ring[i1], ring[i2]]
    for (const t of invHalfDepth ? splitAtRidge(tri, distToRidge) : [tri]) {
      const y = t.map((p) => eave + roofRise(p))
      // On veut la face tournée vers le CIEL : si la normale pointe vers le bas,
      // on inverse deux sommets.
      const ax = t[1][0] - t[0][0]
      const az = t[1][1] - t[0][1]
      const bx = t[2][0] - t[0][0]
      const bz = t[2][1] - t[0][1]
      const order = ax * bz - az * bx > 0 ? [0, 2, 1] : [0, 1, 2]
      for (const k of order) push(t[k][0], y[k], t[k][1], roof)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals() // maillage non indexé → facettes bien nettes (cartoon)
  return geo
}
