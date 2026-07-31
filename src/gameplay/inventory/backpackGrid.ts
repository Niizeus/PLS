import { ITEMS_BY_ID, getItemSize, type ItemSize } from '../../data/items'

/**
 * 🎒 LA GRILLE DU SAC — rien que des maths, aucun React, aucun store.
 *
 * Ce fichier ne connaît ni l'interface ni la sauvegarde : il répond à trois
 * questions, et c'est tout.
 *  • « est-ce que ça rentre ici ? »   → `canPlace`
 *  • « où est-ce que ça rentre ? »    → `findFreeSpot`
 *  • « qu'est-ce qu'il y a sur cette case ? » → `buildOccupancy`
 *
 * C'est volontaire : le jour où on ajoutera d'autres contenants (sac de sport,
 * coffre de voiture, planque), ils réutiliseront ces fonctions telles quelles
 * avec d'autres dimensions. D'où `cols`/`rows` en paramètres partout plutôt
 * qu'en constantes câblées dans le code.
 */

/** Le sac à dos de départ : 8 cases de large, 5 de haut (voir `docs/05`). */
export const BACKPACK_COLS = 8
export const BACKPACK_ROWS = 5

export interface GridSize {
  cols: number
  rows: number
}

export const BACKPACK_SIZE: GridSize = { cols: BACKPACK_COLS, rows: BACKPACK_ROWS }

/** Une pile d'objets POSÉE dans la grille. */
export interface PlacedStack {
  /**
   * Identifiant de la pile, unique dans le sac.
   *
   * ⚠️ Pas l'`itemId` : on peut très bien avoir deux piles de cendriers à deux
   * endroits différents. C'est ce `uid` qu'on déplace, pas l'objet.
   */
  uid: string
  itemId: string
  quantity: number
  /** Case du coin haut-gauche. */
  x: number
  y: number
  /** Pivoté d'un quart de tour ? (largeur et hauteur échangées) */
  rotated: boolean
}

/** Taille réellement occupée, rotation comprise. */
export function getFootprint(itemId: string, rotated: boolean): ItemSize {
  const size = getItemSize(itemId)
  return rotated ? { w: size.h, h: size.w } : size
}

/**
 * Carte d'occupation : pour chaque case, le `uid` de la pile qui l'occupe (ou
 * `null`). C'est la structure que l'interface utilise pour dessiner, et que les
 * tests de placement consultent — construite une fois, lue plein de fois.
 */
export function buildOccupancy(stacks: PlacedStack[], size: GridSize = BACKPACK_SIZE): (string | null)[][] {
  const cells: (string | null)[][] = Array.from({ length: size.rows }, () =>
    Array.from({ length: size.cols }, () => null),
  )

  for (const stack of stacks) {
    const footprint = getFootprint(stack.itemId, stack.rotated)
    for (let dy = 0; dy < footprint.h; dy++) {
      for (let dx = 0; dx < footprint.w; dx++) {
        const y = stack.y + dy
        const x = stack.x + dx
        // Une sauvegarde abîmée pourrait déborder : on ignore, on ne plante pas.
        if (y < 0 || y >= size.rows || x < 0 || x >= size.cols) continue
        cells[y][x] = stack.uid
      }
    }
  }

  return cells
}

/**
 * Est-ce qu'on peut poser cette pile ici ?
 *
 * `ignoreUid` sert au **déplacement** : quand on fait glisser une pile, elle
 * doit pouvoir se chevaucher elle-même (sinon un objet de 2×2 ne pourrait
 * jamais bouger d'une seule case).
 */
export function canPlace(
  stacks: PlacedStack[],
  itemId: string,
  x: number,
  y: number,
  rotated: boolean,
  options: { ignoreUid?: string; size?: GridSize } = {},
): boolean {
  const size = options.size ?? BACKPACK_SIZE
  const footprint = getFootprint(itemId, rotated)

  if (x < 0 || y < 0 || x + footprint.w > size.cols || y + footprint.h > size.rows) return false

  const occupancy = buildOccupancy(
    options.ignoreUid ? stacks.filter((stack) => stack.uid !== options.ignoreUid) : stacks,
    size,
  )

  for (let dy = 0; dy < footprint.h; dy++) {
    for (let dx = 0; dx < footprint.w; dx++) {
      if (occupancy[y + dy][x + dx]) return false
    }
  }

  return true
}

/**
 * Première place libre, en balayant de gauche à droite puis de haut en bas.
 *
 * Sert au rangement automatique (migration d'une sauvegarde, objet rendu par un
 * déséquipement). ⚠️ **Pas au ramassage** : ramasser demande au joueur de
 * placer lui-même, c'est tout l'intérêt du sac (voir `docs/05`).
 *
 * On tente d'abord dans le sens normal, puis pivoté si l'objet l'autorise.
 */
export function findFreeSpot(
  stacks: PlacedStack[],
  itemId: string,
  size: GridSize = BACKPACK_SIZE,
): { x: number; y: number; rotated: boolean } | null {
  const orientations = [false, true]

  for (const rotated of orientations) {
    const footprint = getFootprint(itemId, rotated)
    if (rotated && footprint.w === footprint.h) continue // inutile de retester un carré

    for (let y = 0; y <= size.rows - footprint.h; y++) {
      for (let x = 0; x <= size.cols - footprint.w; x++) {
        if (canPlace(stacks, itemId, x, y, rotated, { size })) return { x, y, rotated }
      }
    }
  }

  return null
}

/**
 * La pile posée sur cette case peut-elle **absorber** `quantity` unités de
 * `itemId` ? Sert à fusionner deux piles quand on lâche l'une sur l'autre —
 * sinon on se retrouverait vite avec quatre tas de cendriers éparpillés.
 *
 * Renvoie la pile cible, ou `null` s'il n'y a rien à fusionner ici.
 */
export function findMergeTarget(
  stacks: PlacedStack[],
  itemId: string,
  x: number,
  y: number,
  quantity: number,
  options: { ignoreUid?: string; size?: GridSize } = {},
): PlacedStack | null {
  const size = options.size ?? BACKPACK_SIZE
  if (x < 0 || y < 0 || x >= size.cols || y >= size.rows) return null

  const item = ITEMS_BY_ID[itemId]
  if (!item?.stackable) return null

  const occupancy = buildOccupancy(stacks, size)
  const uid = occupancy[y][x]
  if (!uid || uid === options.ignoreUid) return null

  const target = stacks.find((stack) => stack.uid === uid)
  if (!target || target.itemId !== itemId) return null
  if (target.quantity + quantity > (item.maxStack ?? 99)) return null

  return target
}

/** Nombre de cases occupées / disponibles, pour l'affichage. */
export function countUsedCells(stacks: PlacedStack[]): number {
  return stacks.reduce((total, stack) => {
    const footprint = getFootprint(stack.itemId, stack.rotated)
    return total + footprint.w * footprint.h
  }, 0)
}

/** Génère un identifiant de pile. Court, lisible dans les sauvegardes. */
export function createStackUid(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
