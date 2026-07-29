import {
  distanceToWall,
  pointInPolygon,
  projectOnWall,
  stairsProgress,
  wallLength,
  wallPointAt,
  type Point2,
} from '../data/interiorGeometry'
import { type InteriorFloor, type InteriorWall } from '../data/interiors'
import { type InteriorSelection } from './interiorDraw'

/**
 * 🧰 Accrochage et designation pour l'editeur d'interieur.
 *
 * Deux besoins qui font la difference entre un outil agreable et un outil penible :
 *  - **le magnetisme** : quand on trace, la souris doit accrocher les points remarquables
 *    (extremites de murs, milieux, sommets de sol) avant de retomber sur la grille ;
 *  - **la designation** : savoir ce qu'on vise sous le curseur, dans un ordre de priorite qui
 *    corresponde a l'intuition (une poignee passe avant le mur, un mur passe avant le sol).
 */

export interface SnapResult {
  point: Point2
  /** Ce qui a ete accroche, affiche a l'ecran pour que l'accroche ne soit jamais une surprise. */
  label: string
  /** `false` quand on est juste retombe sur la grille. */
  magnetic: boolean
}

export interface SnapOptions {
  /** Rayon d'accroche en pixels ecran, converti en metres par l'appelant. */
  radiusMeters: number
  gridStep: number
  /** Murs a ignorer (celui qu'on est en train de deplacer, par exemple). */
  ignoreWallIds?: string[]
}

function snapToGrid(value: number, step: number) {
  return Math.round(value / step) * step
}

/**
 * Cherche le point remarquable le plus proche, sinon retombe sur la grille.
 * Ordre de preference : extremite de mur > sommet de sol > milieu de mur > grille.
 */
export function snapPoint(floor: InteriorFloor | null, point: Point2, options: SnapOptions): SnapResult {
  const { radiusMeters, gridStep, ignoreWallIds = [] } = options
  let best: { point: Point2; label: string; distance: number; priority: number } | null = null

  const consider = (candidate: Point2, label: string, priority: number) => {
    const distance = Math.hypot(candidate.x - point.x, candidate.z - point.z)
    if (distance > radiusMeters) return
    // A distance comparable, la priorite tranche : une extremite gagne sur un milieu.
    if (!best || priority < best.priority || (priority === best.priority && distance < best.distance)) {
      best = { point: candidate, label, distance, priority }
    }
  }

  if (floor) {
    for (const wall of floor.walls) {
      if (ignoreWallIds.includes(wall.id)) continue
      consider({ x: wall.ax, z: wall.az }, 'extremite', 0)
      consider({ x: wall.bx, z: wall.bz }, 'extremite', 0)
      consider(wallPointAt(wall, wallLength(wall) / 2), 'milieu', 2)
    }
    for (const surface of floor.surfaces) {
      for (const [x, z] of surface.pts) consider({ x, z }, 'sommet', 1)
    }
  }

  if (best) {
    const found = best as { point: Point2; label: string; distance: number; priority: number }
    return { point: found.point, label: found.label, magnetic: true }
  }
  return {
    point: { x: snapToGrid(point.x, gridStep), z: snapToGrid(point.z, gridStep) },
    label: 'grille',
    magnetic: false,
  }
}

/** Mur le plus proche du point, dans la limite donnee. */
export function findWallNear(floor: InteriorFloor, point: Point2, maxDistance: number) {
  let best: { wall: InteriorWall; distance: number } | null = null
  for (const wall of floor.walls) {
    const distance = distanceToWall(point, wall)
    const reach = maxDistance + wall.thickness / 2
    if (distance <= reach && (!best || distance < best.distance)) best = { wall, distance }
  }
  return best?.wall ?? null
}

/**
 * Que vise-t-on sous le curseur ?
 *
 * `tolerance` est en metres (convertie depuis des pixels par l'appelant, pour que la zone de
 * clic garde la meme taille a l'ecran quel que soit le zoom).
 */
export function hitTest(
  floor: InteriorFloor,
  point: Point2,
  tolerance: number,
  selected: InteriorSelection | null,
): InteriorSelection | null {
  // 1. Poignees de l'element deja selectionne : elles doivent primer sur tout le reste,
  //    sinon on ne pourrait jamais attraper l'extremite d'un mur posee sur un sol.
  if (selected?.kind === 'wall' || selected?.kind === 'wallEnd') {
    const wall = floor.walls.find((item) => item.id === selected.id)
    if (wall) {
      if (Math.hypot(wall.ax - point.x, wall.az - point.z) <= tolerance) {
        return { kind: 'wallEnd', id: wall.id, end: 'a' }
      }
      if (Math.hypot(wall.bx - point.x, wall.bz - point.z) <= tolerance) {
        return { kind: 'wallEnd', id: wall.id, end: 'b' }
      }
    }
  }
  if (selected?.kind === 'surface' || selected?.kind === 'surfaceVertex') {
    const surface = floor.surfaces.find((item) => item.id === selected.id)
    if (surface) {
      for (let index = 0; index < surface.pts.length; index += 1) {
        const [x, z] = surface.pts[index]
        if (Math.hypot(x - point.x, z - point.z) <= tolerance) {
          return { kind: 'surfaceVertex', id: surface.id, index }
        }
      }
    }
  }

  // 2. Reperes ponctuels.
  for (const spawn of floor.spawnPoints) {
    if (Math.hypot(spawn.x - point.x, spawn.z - point.z) <= tolerance) return { kind: 'spawn', id: spawn.id }
  }
  for (const exit of floor.exits) {
    if (Math.hypot(exit.x - point.x, exit.z - point.z) <= tolerance) return { kind: 'exit', id: exit.id }
  }
  for (const prop of floor.props) {
    if (Math.hypot(prop.x - point.x, prop.z - point.z) <= tolerance) return { kind: 'prop', id: prop.id }
  }

  // 3. Ouvertures, puis murs.
  for (const wall of floor.walls) {
    const projection = projectOnWall(wall, point)
    if (projection.distance > tolerance + wall.thickness / 2) continue
    for (const opening of wall.openings) {
      const half = opening.width / 2
      if (Math.abs(projection.distanceAlong - opening.offset) <= half) {
        return { kind: 'opening', wallId: wall.id, id: opening.id }
      }
    }
    return { kind: 'wall', id: wall.id }
  }

  // 4. Escaliers : une emprise, donc apres les murs, mais avant les sols.
  for (const stairs of floor.stairs) {
    if (stairsProgress(stairs, point, tolerance) !== null) return { kind: 'stairs', id: stairs.id }
  }

  // 5. Sols en dernier : ils occupent de grandes zones, ils ne doivent jamais voler un clic.
  for (let index = floor.surfaces.length - 1; index >= 0; index -= 1) {
    const surface = floor.surfaces[index]
    if (pointInPolygon(point, surface.pts)) return { kind: 'surface', id: surface.id }
  }
  return null
}
