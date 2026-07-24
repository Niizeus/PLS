import rawData from './data/beauvais-buildings.json'

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
 * Interpolation bilinéaire sur la grille d'altitudes. TOUT se pose là-dessus :
 * bâtiments, routes, joueur, arbres, lampadaires...
 */
export function terrainHeight(x: number, z: number): number {
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
  const tx = fi - i0
  const tz = fj - j0
  const h = t.h
  const top = h[j0 * t.cols + i0] * (1 - tx) + h[j0 * t.cols + i1] * tx
  const bot = h[j1 * t.cols + i0] * (1 - tx) + h[j1 * t.cols + i1] * tx
  return top * (1 - tz) + bot * tz
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
