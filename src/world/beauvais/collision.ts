import { BUILDINGS, pointInFootprint, terrainHeight, type Building } from './cityData'

/**
 * 🧱 Collisions avec les bâtiments.
 *
 * Tester 6000 bâtiments à chaque frame serait trop lent. On range donc les
 * bâtiments dans une GRILLE spatiale : le monde est découpé en cases de CELL
 * mètres, et chaque bâtiment est référencé dans les cases qu'il touche.
 * Pour savoir si un point est bloqué, on ne teste que les bâtiments de SA case.
 */

const CELL = 16 // taille d'une case de la grille, en mètres

// clé de case → liste d'index de bâtiments présents dans cette case
const grid = new Map<string, number[]>()
const keyOf = (cx: number, cz: number) => cx + ':' + cz

// Construction de la grille (une seule fois, au chargement).
for (let i = 0; i < BUILDINGS.length; i++) {
  const pts = BUILDINGS[i].pts
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  const cx0 = Math.floor(minX / CELL)
  const cx1 = Math.floor(maxX / CELL)
  const cz0 = Math.floor(minZ / CELL)
  const cz1 = Math.floor(maxZ / CELL)
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const key = keyOf(cx, cz)
      let list = grid.get(key)
      if (!list) grid.set(key, (list = []))
      list.push(i)
    }
  }
}

/** Le point (x, z) est-il à l'intérieur d'un bâtiment ? (rapide grâce à la grille) */
export function isBlocked(x: number, z: number): boolean {
  const list = grid.get(keyOf(Math.floor(x / CELL), Math.floor(z / CELL)))
  if (!list) return false
  for (const i of list) {
    if (pointInFootprint(x, z, BUILDINGS[i].pts)) return true
  }
  return false
}

/**
 * Hauteur du bâtiment au point (x, z), ou 0 s'il n'y en a pas.
 * Sert à la caméra : elle ne se rapproche que si un bâtiment lui bouche vraiment
 * la vue (et pas quand elle passe au-dessus d'un petit toit).
 */
export function buildingHeightAt(x: number, z: number): number {
  const list = grid.get(keyOf(Math.floor(x / CELL), Math.floor(z / CELL)))
  if (!list) return 0
  for (const i of list) {
    // Altitude ABSOLUE du point le plus haut du bâtiment, pour la caméra.
    // ⚠️ `h` ne monte que jusqu'à la GOUTTIÈRE : il faut ajouter le toit (`rh`),
    // sinon la caméra passerait au travers des faîtages, qui montent jusqu'à
    // plusieurs mètres au-dessus. On prend le faîtage sur toute l'emprise : c'est
    // un poil prudent sur les bords, et c'est le bon sens de l'erreur.
    const b = BUILDINGS[i]
    if (pointInFootprint(x, z, b.pts)) return terrainHeight(x, z) + b.h + (b.rh ?? 0)
  }
  return 0
}

/**
 * Renvoie les bâtiments proches de (x, z) dans un rayon donné, via la grille.
 * Sert à la minimap pour ne PAS parcourir les ~34 000 bâtiments à chaque image.
 */
export function buildingsNear(x: number, z: number, radius: number): Building[] {
  const r = Math.ceil(radius / CELL)
  const cx = Math.floor(x / CELL)
  const cz = Math.floor(z / CELL)
  const seen = new Set<number>()
  const out: Building[] = []
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const list = grid.get(keyOf(cx + dx, cz + dz))
      if (!list) continue
      for (const i of list) {
        if (!seen.has(i)) {
          seen.add(i)
          out.push(BUILDINGS[i])
        }
      }
    }
  }
  return out
}
