import rawData from './data/beauvais-buildings.json'
import { lidarHeight } from './lidarTerrain'

/**
 * 🗃️  Source unique des données de Beauvais (chargée une seule fois).
 *
 * Ce module lit le fichier compact et le rend exploitable partout :
 *  - la ville 3D (Beauvais.tsx) l'extrude,
 *  - les routes (Roads.tsx) tracent les voies,
 *  - le sol (CityGround.tsx) se dimensionne dessus,
 *  - les collisions (collision.ts) empêchent d'entrer dans les bâtiments,
 *  - la minimap et la carte (ui/) dessinent tout ça vu du dessus.
 * Tout le monde importe d'ICI → pas de duplication, pas de divergence.
 */

/** Un bâtiment : hauteur (m), contour projeté en mètres [x, z], et son centre. */
export interface Building {
  h: number
  pts: number[][]
  /** Cours intérieures (trous) éventuelles, pour les bâtiments à patio. */
  holes?: number[][][]
  /** Monument (cathedral / church / chapel) → look distinct. */
  kind?: string
  cx: number
  cz: number
}

/** Un espace vert : contour [x, z] ; `wood` = boisé (on y sème des arbres). */
export interface Green {
  pts: number[][]
  wood?: number
}

/** Un mur / une clôture : polyligne [x, z]. */
export interface Wall {
  pts: number[][]
}

/** Une route : largeur (m) et polyligne de points [x, z]. */
export interface Road {
  w: number
  pts: number[][]
}

/** Un plan d'eau : contour [x, z]. */
export interface Water {
  pts: number[][]
}

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Grille d'altitudes (relief), en mètres relatifs à l'origine. */
interface Terrain {
  cols: number
  x0: number
  z0: number
  dx: number
  dz: number
  h: number[]
}

interface RawCity {
  origin: { lat: number; lon: number }
  bounds: Bounds
  terrain: Terrain | null
  buildings: { h: number; pts: number[][]; holes?: number[][][]; kind?: string }[]
  roads: { w: number; pts: number[][] }[]
  waters: { pts: number[][] }[]
  greens: { pts: number[][]; wood?: number }[]
  walls: { pts: number[][] }[]
  trees: number[][]
  lamps: number[][]
}

const data = rawData as unknown as RawCity

export const ORIGIN = data.origin
export const BOUNDS: Bounds = data.bounds
export const TERRAIN = data.terrain ?? null
export const ROADS: Road[] = data.roads ?? []
export const WATERS: Water[] = data.waters ?? []
export const GREENS: Green[] = data.greens ?? []
export const WALLS: Wall[] = data.walls ?? []
export const TREES: number[][] = data.trees ?? []
export const LAMPS: number[][] = data.lamps ?? []

// On calcule le centre de chaque bâtiment une fois pour toutes.
export const BUILDINGS: Building[] = data.buildings.map((b) => {
  let sx = 0
  let sz = 0
  for (const [x, z] of b.pts) {
    sx += x
    sz += z
  }
  const n = b.pts.length || 1
  return { h: b.h, pts: b.pts, holes: b.holes, kind: b.kind, cx: sx / n, cz: sz / n }
})

/**
 * Altitude du terrain au point monde (x, z), en mètres (0 si pas de relief).
 *
 * ⚠️ IMPORTANT : cette fonction doit renvoyer EXACTEMENT la même surface que le
 * sol affiché (Terrain.tsx). Or ce sol est fait de TRIANGLES plats (chaque case
 * de la grille est coupée en deux). On échantillonne donc le BON triangle
 * (interpolation barycentrique), et surtout PAS une interpolation bilinéaire
 * (surface courbée) qui, elle, passe au-dessus/en dessous des triangles → c'est
 * ce qui faisait "plonger" les routes et le joueur SOUS le sol dans les pentes.
 *
 * Découpage identique à Terrain.tsx : triangles (a,c,b) puis (b,c,d), avec
 *   a = (i0,j0)  b = (i1,j0)  c = (i0,j1)  d = (i1,j1)
 * La diagonale partagée relie b et c → tx+tz ≤ 1 : triangle a,b,c ; sinon b,c,d.
 *
 * TOUT se pose là-dessus : bâtiments, routes, joueur, arbres, lampadaires...
 */
export function terrainHeight(x: number, z: number): number {
  // Priorité au terrain LiDAR HD s'il est chargé et couvre le point (repère commun).
  const lh = lidarHeight(x, z)
  if (lh !== undefined) return lh
  const t = TERRAIN
  if (!t) return 0
  const last = t.cols - 1
  let fi = (x - t.x0) / t.dx
  let fj = (z - t.z0) / t.dz
  fi = Math.min(last, Math.max(0, fi))
  fj = Math.min(last, Math.max(0, fj))
  const i0 = Math.floor(fi)
  const j0 = Math.floor(fj)
  const i1 = Math.min(i0 + 1, last)
  const j1 = Math.min(j0 + 1, last)
  const tx = fi - i0 // position dans la case, sens X (0 → i0, 1 → i1)
  const tz = fj - j0 // position dans la case, sens Z (0 → j0, 1 → j1)
  const h = t.h
  const hA = h[j0 * t.cols + i0] // coin (i0, j0)
  const hB = h[j0 * t.cols + i1] // coin (i1, j0)
  const hC = h[j1 * t.cols + i0] // coin (i0, j1)
  const hD = h[j1 * t.cols + i1] // coin (i1, j1)
  // Plan du triangle qui contient (tx, tz) — même diagonale que le sol affiché.
  if (tx + tz <= 1) return hA + (hB - hA) * tx + (hC - hA) * tz
  return hD + (hB - hD) * (1 - tz) + (hC - hD) * (1 - tx)
}

/** Test "le point (x,z) est-il à l'intérieur de ce contour ?" (lancer de rayon). */
export function pointInFootprint(x: number, z: number, pts: number[][]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]
    const [xj, zj] = pts[j]
    const crosses = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/**
 * 💧 Creusement des plans d'eau.
 *
 * Avant, l'eau était un polygone plat POSÉ sur le sol → un lac « peint ». Ici on
 * CREUSE réellement le bassin : on abaisse les sommets de la grille de relief
 * situés à l'intérieur d'un plan d'eau. Comme on modifie la grille PARTAGÉE
 * (TERRAIN.h), le sol affiché (Terrain.tsx) ET `terrainHeight()` restent d'accord
 * → pas de nouveau décalage « sous le sol ». La surface d'eau (Water.tsx) est
 * ensuite posée un peu SOUS la berge grâce à `WATER_INFO`.
 *
 * Note : à la résolution de la grille, seuls les GRANDS plans d'eau (plan d'eau
 * du Canada) contiennent des sommets → eux sont vraiment creusés ; les fins
 * cours d'eau restent posés (bassin trop étroit pour la grille).
 */
export interface WaterInfo {
  /** Altitude (m) de la surface d'eau de ce plan d'eau. */
  surfaceY: number
  /** true si le bassin a réellement été creusé dans la grille. */
  carved: boolean
}
export const WATER_INFO: WaterInfo[] = []
const WATER_DEPTH = 4 // profondeur du bassin sous la berge (m)
const WATER_DROP = 0.4 // la surface d'eau se pose un peu sous la berge (m)

;(function carveWater() {
  if (!TERRAIN || WATERS.length === 0) {
    for (let i = 0; i < WATERS.length; i++) WATER_INFO.push({ surfaceY: 0, carved: false })
    return
  }
  const t = TERRAIN
  // 1) Boîte englobante + niveau de berge (médiane du contour, AVANT creusement).
  const boxes = WATERS.map((w) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    const hs: number[] = []
    for (const [x, z] of w.pts) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
      hs.push(terrainHeight(x, z))
    }
    hs.sort((a, b) => a - b)
    return { minX, maxX, minZ, maxZ, shore: hs[hs.length >> 1] ?? 0 }
  })
  // 2) Creuse chaque sommet de grille situé DANS un plan d'eau (avec pré-filtre bbox).
  const carved = new Array(WATERS.length).fill(false)
  for (let j = 0; j < t.cols; j++) {
    for (let i = 0; i < t.cols; i++) {
      const x = t.x0 + i * t.dx
      const z = t.z0 + j * t.dz
      for (let w = 0; w < WATERS.length; w++) {
        const b = boxes[w]
        if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue
        if (pointInFootprint(x, z, WATERS[w].pts)) {
          const idx = j * t.cols + i
          const floor = b.shore - WATER_DEPTH
          if (t.h[idx] > floor) t.h[idx] = floor
          carved[w] = true
        }
      }
    }
  }
  // 3) Niveau de surface : sous la berge si creusé, sinon juste au-dessus du sol.
  for (let w = 0; w < WATERS.length; w++) {
    WATER_INFO.push({
      surfaceY: carved[w] ? boxes[w].shore - WATER_DROP : boxes[w].shore + 0.05,
      carved: carved[w],
    })
  }
})()

/**
 * Cherche un point de spawn DÉGAGÉ devant la cathédrale (à l'origine 0,0).
 *
 * On teste des points sur des anneaux autour de la cathédrale, on écarte ceux qui
 * tombent dans un bâtiment, et on garde celui qui est le PLUS OUVERT (le plus loin
 * du bâtiment le plus proche) : c'est typiquement le parvis, donc "devant".
 */
function findSpawn(): { x: number; z: number } {
  let best = { x: 0, z: 0 }
  let bestOpenness = -1

  for (let r = 18; r <= 70; r += 3) {
    const steps = Math.round((2 * Math.PI * r) / 4)
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r

      // Distance au sommet de bâtiment le plus proche + test "dans un bâtiment ?".
      let nearest = Infinity
      let inside = false
      for (const b of BUILDINGS) {
        // Pré-filtre : on ignore les bâtiments lointains.
        if ((x - b.cx) ** 2 + (z - b.cz) ** 2 > 3600) continue
        if (pointInFootprint(x, z, b.pts)) {
          inside = true
          break
        }
        for (const [px, pz] of b.pts) {
          const d2 = (x - px) ** 2 + (z - pz) ** 2
          if (d2 < nearest) nearest = d2
        }
      }
      if (inside) continue
      if (nearest > bestOpenness) {
        bestOpenness = nearest
        best = { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }
      }
    }
  }
  return best
}

/** Point où faire apparaître le joueur : dégagé, devant la cathédrale. */
export const SPAWN = findSpawn()
