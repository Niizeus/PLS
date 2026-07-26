import * as THREE from 'three'
import { BUILDINGS, terrainHeight, type Building } from './cityData'
import {
  boundsOf,
  buildDistanceField,
  marchingSquares,
  orientRing,
  sampleField,
  simplifyRing,
  smoothField,
} from './footprintField'
import { MeshBuilder, type P2 } from './meshBuilder'

/**
 * ⛪ La cathédrale Saint-Pierre de Beauvais — le repère central du jeu.
 *
 * C'est le seul bâtiment de la ville qui a droit à son propre modèle. Les 34 000
 * autres sont des murs + un toit (`buildingMesh.ts`) : appliqué au plus haut chœur
 * gothique du monde, ça donnait un gros bloc de béton de 45 m posé au milieu de
 * Beauvais. Ici on reconstruit ce qui fait qu'on la reconnaît :
 *
 *   des masses ÉTAGÉES (chapelles → bas-côtés → vaisseau), un toit très pentu,
 *   une forêt de contreforts à pinacles reliés par des ARCS-BOUTANTS, des
 *   verrières hautes, et deux façades de transept à rosace.
 *
 * ── Ce qui reste vrai (rien n'est inventé) ───────────────────────────────────
 *  - L'EMPRISE est celle d'OpenStreetMap, au mètre près : c'est le même contour
 *    qui bloque le joueur (`collision.ts`), donc aucun « mur invisible ».
 *  - Les masses intérieures sont obtenues en RÉTRÉCISSANT cette emprise
 *    (`footprintField.ts`), pas en la redessinant : le chevet reste arrondi et
 *    les chapelles rayonnantes restent à leur place.
 *  - Le plan en croix (chœur + transept) est croisé avec l'emprise pour décider
 *    ce qui monte haut. Les deux bras du transept gardent donc leur pignon et
 *    leur rosace, comme en vrai.
 *  - Pas de flèche : celle de 153 m s'est effondrée en 1573 et n'a jamais été
 *    reconstruite. La silhouette « inachevée » est le vrai visage du monument.
 *  - Pas de nef non plus (elle n'a jamais été bâtie) : à l'ouest, la masse
 *    s'arrête net sur un mur droit — c'est exactement ce qu'on voit sur place.
 *
 * Repères de taille : voûtes du chœur à 48 m, rosaces de 11 m de diamètre.
 */

/** Le bâtiment « cathédrale » de la donnée OSM (identité utilisée par `Beauvais.tsx`). */
export const CATHEDRAL: Building | undefined = BUILDINGS.find((b) => b.kind === 'cathedral')

// ─────────────────────────────────────────────────────────────────────────────
// 1. Le repère local du monument
//
// La cathédrale n'est pas alignée sur les axes du monde : son axe (ouest → chevet)
// pointe vers l'est-sud-est. On travaille donc en (u, v) :
//   u = le long de l'axe, vers le chevet ;  v = en travers (v négatif = nord).
// Ces trois nombres viennent d'une analyse en composantes principales de l'emprise
// réelle (centre de gravité + direction d'allongement) — voir docs/04.
// ─────────────────────────────────────────────────────────────────────────────

const AXIS = 0.1787 // orientation de l'axe, en radians (≈ 10,2° au sud de l'est)
const CENTER_X = 37.7
const CENTER_Z = 3.1
const UX = Math.cos(AXIS)
const UZ = Math.sin(AXIS)

const toU = (x: number, z: number) => (x - CENTER_X) * UX + (z - CENTER_Z) * UZ
const toV = (x: number, z: number) => -(x - CENTER_X) * UZ + (z - CENTER_Z) * UX
const toWorld = (u: number, v: number): P2 => [
  CENTER_X + u * UX - v * UZ,
  CENTER_Z + u * UZ + v * UX,
]

// ─────────────────────────────────────────────────────────────────────────────
// 2. Le plan : qui monte, et jusqu'où
// ─────────────────────────────────────────────────────────────────────────────

/** Retrait du vaisseau haut par rapport au mur extérieur, là où il l'atteint (m). */
const SETBACK = 2.5

/** Le vaisseau du chœur : une bande le long de l'axe, du transept au chevet. */
const CHOIR = { u0: -27, u1: 60, v0: -8.5, v1: 10.5 }
/** Le transept : une bande en travers ; l'emprise en découpe les deux bras. */
const TRANSEPT = { u0: -27, u1: -1, v0: -60, v1: 60 }

const RIDGE_U = (TRANSEPT.u0 + TRANSEPT.u1) / 2 // faîtage du transept
const RIDGE_V = (CHOIR.v0 + CHOIR.v1) / 2 // faîtage du chœur
const HALF_C = (CHOIR.v1 - CHOIR.v0) / 2
const HALF_T = (TRANSEPT.u1 - TRANSEPT.u0) / 2

// Altitudes, en mètres au-dessus du parvis.
const CHAPEL_TOP = 12 // chapelles rayonnantes : le premier niveau, tout autour
const CHAPEL_CAP = 3
const AISLE_IN = 7 // les bas-côtés commencent à 7 m à l'intérieur du mur
const AISLE_TOP = 25
const AISLE_CAP = 4
const EAVE = 43 // gouttière du vaisseau (voûtes à 48 m à l'intérieur)
const RISE = 15 // du chéneau au faîtage : toit très pentu, comme en vrai
const APSE_HIP_END = 41 // u où la croupe du chevet retombe à zéro
const APSE_HIP = 9

const PIER_TOP = 33 // contrefort qui porte un arc-boutant
const PIER_LOW = 17 // contrefort simple (là où il n'y a pas de vaisseau derrière)
const PIER_SPACING = 10.5 // entraxe des contreforts, en mètres de mur parcourus
const PIER_HALF = 1.15 // demi-largeur d'un contrefort (le long du mur)
const PIER_OUT = 2.6 // de combien il déborde du mur
const SKIRT = 14 // fondation enterrée : le parvis est en pente, on enfonce large

// Palette pierre / plomb / vitrail. La pierre s'éclaircit en montant : c'est ce qui
// fait « respirer » la masse en cell-shading, où tout est aplat.
const STONE_LOW = new THREE.Color('#c3b9a2')
const STONE_MID = new THREE.Color('#cbc1ab')
const STONE_HIGH = new THREE.Color('#d4cbb7')
const STONE_PIER = new THREE.Color('#bdb39b')
const ROOF = new THREE.Color('#5d6773')
const ROOF_RIDGE = new THREE.Color('#3f4750')
const GLASS = new THREE.Color('#31435e')
// Verre des rosaces : dominante bleue (le bleu de Chartres), deux accents chauds.
const GLASS_ROSE = [
  new THREE.Color('#3a5687'),
  new THREE.Color('#2c3f66'),
  new THREE.Color('#7a4a44'),
  new THREE.Color('#42607e'),
  new THREE.Color('#2c3f66'),
  new THREE.Color('#8a6a3c'),
]
const PORTAL = new THREE.Color('#4b463c')

// ─────────────────────────────────────────────────────────────────────────────
// 3. Les champs : « suis-je dans l'emprise ? » et « suis-je dans le vaisseau ? »
// ─────────────────────────────────────────────────────────────────────────────

/** Profondeur à l'intérieur d'une bande (u0..u1, v0..v1) ; négatif = dehors. */
function inBand(u: number, v: number, b: typeof CHOIR): number {
  return Math.min(u - b.u0, b.u1 - u, v - b.v0, b.v1 - v)
}

/**
 * Hauteur du toit au-dessus de la gouttière, en un point du vaisseau.
 *
 * Deux toits à deux pentes qui se croisent : celui du chœur (faîtage le long de
 * l'axe) et celui du transept (faîtage en travers). On garde le plus haut des
 * deux — c'est ce `max` qui dessine tout seul les noues de la croisée et les
 * pignons au bout des bras. Le chevet, lui, retombe en croupe.
 */
function roofRise(p: P2): number {
  const u = toU(p[0], p[1])
  const v = toV(p[0], p[1])
  const hip = Math.min(1, Math.max(0, (APSE_HIP_END - u) / APSE_HIP))
  const choir = RISE * (1 - Math.abs(v - RIDGE_V) / HALF_C) * hip
  const transept = RISE * (1 - Math.abs(u - RIDGE_U) / HALF_T)
  return Math.max(0, choir, transept)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Petits utilitaires de contour
// ─────────────────────────────────────────────────────────────────────────────

/** Permet de se promener le long d'un contour fermé « au mètre près ». */
function ringWalker(ring: P2[]) {
  const start: number[] = []
  let total = 0
  for (let i = 0; i < ring.length; i++) {
    start.push(total)
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    total += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  const at = (s: number): P2 => {
    const t = ((s % total) + total) % total
    let lo = 0
    let hi = ring.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (start[mid] <= t) lo = mid
      else hi = mid - 1
    }
    const a = ring[lo]
    const b = ring[(lo + 1) % ring.length]
    const len = (lo + 1 < ring.length ? start[lo + 1] : total) - start[lo]
    const k = len > 1e-6 ? (t - start[lo]) / len : 0
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  }
  return { total, at }
}

/** Un vitrail en arc brisé, décrit dans le plan du mur (du = le long du mur). */
function lancet(du0: number, du1: number, y0: number, y1: number, apex: number): number[][] {
  return [
    [du0, y0],
    [du1, y0],
    [du1, y1],
    [(du0 + du1) / 2, y1 + apex],
    [du0, y1],
  ]
}

/** Rectangle au sol de demi-largeur `hw` le long de `t`, de `back` à `front` selon la normale. */
function slab(c: P2, t: P2, hw: number, back: number, front: number): P2[] {
  const nx = t[1]
  const nz = -t[0]
  return [
    [c[0] - t[0] * hw - nx * back, c[1] - t[1] * hw - nz * back],
    [c[0] + t[0] * hw - nx * back, c[1] + t[1] * hw - nz * back],
    [c[0] + t[0] * hw + nx * front, c[1] + t[1] * hw + nz * front],
    [c[0] - t[0] * hw + nx * front, c[1] - t[1] * hw + nz * front],
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fabrique le maillage complet de la cathédrale (un seul objet, une seule
 * couleur par sommet). Renvoie `null` si la donnée OSM ne contient pas le
 * monument — le jeu tourne quand même, avec un trou à la place.
 */
export function buildCathedral(): THREE.BufferGeometry | null {
  if (!CATHEDRAL) return null

  const outer = orientRing(CATHEDRAL.pts)
  const ground = terrainHeight(CATHEDRAL.cx, CATHEDRAL.cz)
  const box = boundsOf(outer, 6)

  // Distance au mur extérieur, positive à l'intérieur. Tout le reste en découle.
  // On la lisse : les masses hautes doivent suivre la FORME du monument, pas les
  // décrochements d'un mètre de son emprise (voir `smoothField`).
  const field = buildDistanceField(outer, 0.8, 6)
  smoothField(field, 4)
  const depth = (x: number, z: number) => sampleField(field, x, z)

  /** Le vaisseau haut = l'emprise (moins un retrait) croisée avec le plan en croix. */
  const vessel = (x: number, z: number) => {
    const u = toU(x, z)
    const v = toV(x, z)
    return Math.min(depth(x, z) - SETBACK, Math.max(inBand(u, v, CHOIR), inBand(u, v, TRANSEPT)))
  }

  const rings = (at: (x: number, z: number) => number) =>
    marchingSquares(box, 0.8, at).map((r) => orientRing(simplifyRing(r, 0.25)))

  const aisleRings = rings((x, z) => depth(x, z) - AISLE_IN)
  // Un niveau peut se retrouver en plusieurs morceaux (une emprise en croix mince
  // se coupe en deux quand on la rétrécit) : on les bâtit tous, ça se recolle.
  const vesselRings = rings(vessel)
  if (vesselRings.length === 0) return null

  const b = new MeshBuilder()

  // --- 5.0 Les trois grandes façades ---------------------------------------
  // On part du centre et on marche jusqu'à sortir : le mur est trouvé tout seul,
  // quelle que soit la forme exacte de l'emprise. Ça donne le bout des bras du
  // transept (pour les faîtières et les rosaces) et le mur ouest.
  const hit = (
    u0: number,
    v0: number,
    du: number,
    dv: number,
    at: (x: number, z: number) => number,
  ) => {
    let last = toWorld(u0, v0)
    for (let d = 0; d < 70; d += 0.4) {
      const p = toWorld(u0 + du * d, v0 + dv * d)
      if (at(p[0], p[1]) < 0) return { p: last, d }
      last = p
    }
    return null
  }

  const facades = [
    { from: [RIDGE_U, 0], dir: [0, -1], t: [UX, UZ] }, // bras nord
    { from: [RIDGE_U, 0], dir: [0, 1], t: [-UX, -UZ] }, // bras sud
    { from: [TRANSEPT.u0 + 6, RIDGE_V], dir: [-1, 0], t: [UZ, -UX] }, // mur ouest (nef jamais bâtie)
  ].map((f) => ({
    ...f,
    // Le mur du vaisseau (où va la rosace) et le mur extérieur (où va le portail).
    wall: hit(f.from[0], f.from[1], f.dir[0], f.dir[1], vessel),
    face: hit(f.from[0], f.from[1], f.dir[0], f.dir[1], depth),
  }))

  // --- 5.1 Les trois masses emboîtées -------------------------------------
  // Chapelles : l'emprise réelle, celle qui bloque le joueur.
  const chapelTop = (p: P2) =>
    ground + CHAPEL_TOP + Math.min(CHAPEL_CAP, Math.max(0, depth(p[0], p[1])) * 0.5)
  b.walls(outer, ground - SKIRT, ground + CHAPEL_TOP, STONE_LOW)
  b.surface(outer, chapelTop, STONE_LOW, 3.5)

  // Bas-côtés et déambulatoire.
  //
  // ⚠️ Les masses du dessus repartent du SOL (et pas du haut de la précédente) :
  // elles ne sont pas toujours en retrait — au bout des bras du transept, le
  // vaisseau ressort devant les bas-côtés. Partir du sol garantit qu'il n'y a
  // jamais de trou entre deux étages ; le bas est de toute façon caché.
  for (const ring of aisleRings) {
    const top = (p: P2) =>
      ground + AISLE_TOP + Math.min(AISLE_CAP, Math.max(0, depth(p[0], p[1]) - AISLE_IN) * 0.5)
    b.walls(ring, ground - 2, ground + AISLE_TOP, STONE_MID)
    b.surface(ring, top, STONE_MID, 3.5)
  }

  // Le vaisseau : murs jusqu'à la gouttière + toit à deux pentes. Le haut des murs
  // SUIT le toit, donc les pignons du transept se dessinent tout seuls.
  const roofTop = (p: P2) => ground + EAVE + roofRise(p)
  for (const ring of vesselRings) {
    b.walls(ring, ground - 2, roofTop, STONE_HIGH)
    b.surface(ring, roofTop, ROOF, 2.5)
  }

  // --- 5.2 Faîtières de plomb ---------------------------------------------
  // Une arête sombre au sommet : c'est ce qui « pose » le toit contre le ciel.
  const ridgeY = ground + EAVE + RISE
  const crest = (a: P2, c: P2) => {
    const dx = c[0] - a[0]
    const dz = c[1] - a[1]
    const l = Math.hypot(dx, dz) || 1
    const t: P2 = [dx / l, dz / l]
    const mid: P2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]
    // La faîtière descend un peu DANS le toit : la crête du toit est facettée
    // (elle est approchée par subdivision), et sans cette marge elle réapparaîtrait
    // en dents de scie de part et d'autre.
    b.prism(slab(mid, t, l / 2, 0.3, 0.3), ridgeY - 1.8, ridgeY + 0.7, ROOF_RIDGE)
  }
  crest(toWorld(TRANSEPT.u0 + 1, RIDGE_V), toWorld(APSE_HIP_END - APSE_HIP, RIDGE_V))
  const armN = facades[0].wall
  const armS = facades[1].wall
  if (armN && armS) {
    crest(toWorld(RIDGE_U, -armN.d + 1), toWorld(RIDGE_U, armS.d - 1))
  }

  // --- 5.3 Contreforts, pinacles et arcs-boutants --------------------------
  // On avance le long du mur extérieur ; à chaque station on plante un contrefort,
  // puis on cherche le vaisseau derrière lui pour y lancer deux volées d'arcs.
  //
  // Note : les contreforts débordent de l'emprise, donc ils ne bloquent PAS le
  // joueur (les collisions suivent l'emprise OSM). Le sens de l'erreur est le bon :
  // on peut frôler un contrefort de trop près, mais le mur derrière arrête bien.
  const walk = ringWalker(outer)
  const stations = Math.max(8, Math.round(walk.total / PIER_SPACING))
  const stride = walk.total / stations

  for (let i = 0; i < stations; i++) {
    const s = i * stride
    const a = walk.at(s - 1.5)
    const c = walk.at(s + 1.5)
    const dx = c[0] - a[0]
    const dz = c[1] - a[1]
    const l = Math.hypot(dx, dz)
    if (l < 2.2) continue // angle rentrant : pas de place pour un contrefort
    const t: P2 = [dx / l, dz / l]
    const n: P2 = [t[1], -t[0]] // normale sortante
    const p = walk.at(s)

    // Le contrefort déborde-t-il dans un autre bout du bâtiment ? Alors on saute.
    if (depth(p[0] + n[0] * PIER_OUT, p[1] + n[1] * PIER_OUT) > 0.4) continue
    // Pas de contrefort planté devant un portail : on dégage les trois façades.
    if (facades.some((f) => f.face && Math.hypot(f.face.p[0] - p[0], f.face.p[1] - p[1]) < 8)) continue

    // À quelle distance est le vaisseau haut, droit derrière ?
    let reach = 0
    for (let d = 4; d <= 26; d += 0.75) {
      if (vessel(p[0] - n[0] * d, p[1] - n[1] * d) >= 0) {
        reach = d
        break
      }
    }
    const flying = reach >= 6
    const top = ground + (flying ? PIER_TOP : PIER_LOW)

    // Le contrefort s'affine en montant (fruit), comme une vraie culée.
    b.prism(
      slab(p, t, PIER_HALF, 1.2, PIER_OUT),
      ground - SKIRT,
      top - 1.4,
      STONE_PIER,
      slab(p, t, PIER_HALF * 0.78, 1.0, PIER_OUT * 0.62),
    )
    // Larmier + pinacle : la petite couronne qui fait la dentelle du monument.
    b.prism(slab(p, t, PIER_HALF * 0.95, 1.2, PIER_OUT * 0.78), top - 1.4, top - 0.7, STONE_HIGH)
    b.prism(slab(p, t, PIER_HALF * 0.62, 0.7, PIER_OUT * 0.42), top - 0.7, top + 1.4, STONE_PIER)
    b.pyramid(
      slab(p, t, PIER_HALF * 0.62, 0.7, PIER_OUT * 0.42),
      top + 1.4,
      top + (flying ? 8.5 : 5),
      STONE_HIGH,
    )

    if (!flying) continue

    // Deux volées d'arcs-boutants, comme au chevet de Beauvais.
    for (const [fromY, toY] of [
      [PIER_TOP - 13, AISLE_TOP + 5],
      [PIER_TOP - 4, EAVE - 4],
    ]) {
      const from: P2 = [p[0] + n[0] * 1.2, p[1] + n[1] * 1.2]
      const to: P2 = [p[0] - n[0] * (reach + 0.8), p[1] - n[1] * (reach + 0.8)]
      const path = []
      for (let k = 0; k <= 8; k++) {
        const q = k / 8
        const cx = from[0] + (to[0] - from[0]) * q
        const cz = from[1] + (to[1] - from[1]) * q
        const yb = ground + fromY + (toY - fromY) * q + Math.sin(Math.PI * q) * 1.7
        path.push({ c: [cx, cz] as P2, yBottom: yb, yTop: ground + fromY + (toY - fromY) * q + 2.5 })
      }
      b.beam(path, 0.55, STONE_HIGH)
    }
  }

  // --- 5.4 Rosaces et portails ---------------------------------------------
  const roseCenters: P2[] = []
  for (const f of facades) {
    const { wall, face } = f
    if (!wall) continue

    // La rosace : 12 m de diamètre, remplage rayonnant, verre coloré.
    const R = 6
    const cy = ground + EAVE - 11
    roseCenters.push(wall.p)
    const disc: number[][] = []
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2
      disc.push([Math.cos(ang) * R, cy + Math.sin(ang) * R])
    }
    // Verre : quartiers de couleurs différentes, comme un vrai vitrail.
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2
      const a1 = ((k + 1) / 12) * Math.PI * 2
      b.wallPanel(
        wall.p,
        f.t,
        [
          [0, cy],
          [Math.cos(a0) * R, cy + Math.sin(a0) * R],
          [Math.cos((a0 + a1) / 2) * R, cy + Math.sin((a0 + a1) / 2) * R],
          [Math.cos(a1) * R, cy + Math.sin(a1) * R],
        ],
        0.1,
        GLASS_ROSE[k % GLASS_ROSE.length],
      )
    }
    // Meneaux rayonnants + moyeu + cerclage de pierre, posés par-dessus le verre.
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2
      const dx = Math.cos(ang)
      const dy = Math.sin(ang)
      b.wallPanel(
        wall.p,
        f.t,
        [
          [dx * 0.8 - dy * 0.22, cy + dy * 0.8 + dx * 0.22],
          [dx * R - dy * 0.22, cy + dy * R + dx * 0.22],
          [dx * R + dy * 0.22, cy + dy * R - dx * 0.22],
          [dx * 0.8 + dy * 0.22, cy + dy * 0.8 - dx * 0.22],
        ],
        0.2,
        STONE_HIGH,
      )
    }
    b.wallPanel(wall.p, f.t, disc.map(([a, c]) => [a * 0.22, cy + (c - cy) * 0.22]), 0.24, STONE_HIGH)
    for (let k = 0; k < 24; k++) {
      const a0 = disc[k]
      const a1 = disc[(k + 1) % 24]
      b.wallPanel(
        wall.p,
        f.t,
        [a0, a1, [a1[0] * 1.14, cy + (a1[1] - cy) * 1.14], [a0[0] * 1.14, cy + (a0[1] - cy) * 1.14]],
        0.18,
        STONE_HIGH,
      )
    }

    // Sous la rosace, la claire-voie : quatre hautes lancettes qui étirent la façade.
    for (const k of [-1.5, -0.5, 0.5, 1.5]) {
      b.wallPanel(
        wall.p,
        f.t,
        lancet(k * 4.3 - 1.6, k * 4.3 + 1.6, ground + 16.5, ground + 26, 1.8),
        0.1,
        GLASS,
      )
    }

    // Et dans le pignon, un oculus : le petit œil rond tout en haut.
    const oculus = (r: number, off: number, c: THREE.Color) => {
      const ring: number[][] = []
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2
        ring.push([Math.cos(a) * r, ground + EAVE + 5 + Math.sin(a) * r])
      }
      b.wallPanel(wall.p, f.t, ring, off, c)
    }
    oculus(2.3, 0.1, STONE_HIGH)
    oculus(1.7, 0.2, GLASS)

    // Le portail, en bas de la même façade (sur le mur extérieur, lui).
    if (face) {
      b.wallPanel(face.p, f.t, lancet(-4.6, 4.6, ground + 0.2, ground + 6.2, 3.4), 0.1, STONE_HIGH)
      b.wallPanel(face.p, f.t, lancet(-3.4, 3.4, ground + 0.2, ground + 5.4, 2.6), 0.22, PORTAL)
    }
  }

  // --- 5.5 Verrières ---------------------------------------------------------
  // Trois registres de fenêtres, un par masse. Les hautes verrières du chœur sont
  // ce qui donne son échelle au monument : 12 m de haut, séparées par un meneau.
  const glazing = (
    ring: P2[],
    spacing: number,
    width: number,
    y0: number,
    y1: number,
    apex: number,
    split: boolean,
    phase = 0,
  ) => {
    const w = ringWalker(ring)
    const count = Math.max(4, Math.round(w.total / spacing))
    for (let i = 0; i < count; i++) {
      const s = (i + phase) * (w.total / count)
      const a = w.at(s - width / 2)
      const c = w.at(s + width / 2)
      const dx = c[0] - a[0]
      const dz = c[1] - a[1]
      const l = Math.hypot(dx, dz)
      if (l < width * 0.88) continue // le mur tourne ici : la baie déborderait
      // Trop près d'une rosace : on ne va pas percer une fenêtre dedans.
      const mid = w.at(s)
      if (roseCenters.some((r) => Math.hypot(r[0] - mid[0], r[1] - mid[1]) < 11)) continue
      const t: P2 = [dx / l, dz / l]
      if (split) {
        b.wallPanel(a, t, lancet(0.1, l / 2 - 0.25, ground + y0, ground + y1, apex), 0.1, GLASS)
        b.wallPanel(a, t, lancet(l / 2 + 0.25, l - 0.1, ground + y0, ground + y1, apex), 0.1, GLASS)
      } else {
        b.wallPanel(a, t, lancet(0.1, l - 0.1, ground + y0, ground + y1, apex), 0.1, GLASS)
      }
    }
  }

  glazing(outer, PIER_SPACING, 3.0, 4, 9, 1.3, false, 0.5) // chapelles, entre les contreforts
  for (const ring of aisleRings) glazing(ring, 6.5, 3.4, 16, 23, 1.5, false)
  for (const ring of vesselRings) glazing(ring, 5.5, 4.0, 30, 40, 2.0, true)

  return b.geometry()
}
