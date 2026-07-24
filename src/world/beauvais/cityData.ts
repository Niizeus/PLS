import rawData from './data/beauvais-buildings.json'

/**
 * 🗃️  Source unique des données de Beauvais (chargée une seule fois).
 *
 * Ce module lit le fichier compact et le rend exploitable partout :
 *  - la ville 3D (Beauvais.tsx) l'extrude,
 *  - le sol (CityGround.tsx) se dimensionne dessus,
 *  - la minimap et la carte (ui/) dessinent les empreintes vues du dessus.
 * Tout le monde importe d'ICI → pas de duplication, pas de divergence.
 */

/** Un bâtiment : hauteur (m), contour projeté en mètres [x, z], et son centre. */
export interface Building {
  h: number
  pts: number[][]
  cx: number // centre X (sert à la minimap : on ne dessine que ce qui est proche)
  cz: number // centre Z
}

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

interface RawCity {
  origin: { lat: number; lon: number }
  bounds: Bounds
  buildings: { h: number; pts: number[][] }[]
}

const data = rawData as unknown as RawCity

export const ORIGIN = data.origin
export const BOUNDS: Bounds = data.bounds

// On calcule le centre de chaque bâtiment une fois pour toutes.
export const BUILDINGS: Building[] = data.buildings.map((b) => {
  let sx = 0
  let sz = 0
  for (const [x, z] of b.pts) {
    sx += x
    sz += z
  }
  const n = b.pts.length || 1
  return { h: b.h, pts: b.pts, cx: sx / n, cz: sz / n }
})

/** Test "le point (x,z) est-il à l'intérieur de ce contour ?" (lancer de rayon). */
function pointInFootprint(x: number, z: number, pts: number[][]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]
    const [xj, zj] = pts[j]
    const crosses = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** Distance² au centre du bâtiment le plus proche (rapide, pour jauger le dégagement). */
function nearestCentroidDist2(x: number, z: number): number {
  let best = Infinity
  for (const b of BUILDINGS) {
    const dx = x - b.cx
    const dz = z - b.cz
    const d2 = dx * dx + dz * dz
    if (d2 < best) best = d2
  }
  return best
}

/**
 * Cherche un point de spawn DÉGAGÉ près du centre (la cathédrale) : le joueur ne
 * doit pas apparaître à l'intérieur d'un bâtiment. On teste des points sur une
 * spirale qui s'éloigne de l'origine et on garde le premier qui est hors des
 * bâtiments et un peu à l'écart.
 */
function findSpawn(): { x: number; z: number } {
  const CLEARANCE = 7 // mètres de dégagement souhaités autour du spawn
  const clearance2 = CLEARANCE * CLEARANCE
  for (let r = 0; r <= 160; r += 4) {
    // plus le rayon est grand, plus on teste d'angles
    const steps = Math.max(1, Math.round((2 * Math.PI * r) / 5))
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (nearestCentroidDist2(x, z) < clearance2) continue
      let insideAny = false
      for (const b of BUILDINGS) {
        // pré-filtre : inutile de tester les bâtiments lointains
        if ((x - b.cx) ** 2 + (z - b.cz) ** 2 > 2500) continue
        if (pointInFootprint(x, z, b.pts)) {
          insideAny = true
          break
        }
      }
      if (!insideAny) return { x, z }
    }
  }
  return { x: 0, z: 0 } // repli (ne devrait pas arriver)
}

/** Point où faire apparaître le joueur, hors des bâtiments. */
export const SPAWN = findSpawn()
