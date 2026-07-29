/**
 * 🚶 Deplacement du joueur dans un interieur : sols, murs, ouvertures et ESCALIERS.
 *
 * Ce module ne connait ni React ni Three.js, comme `interiorGeometry.ts` : le mode test de
 * l'editeur s'en sert aujourd'hui, le jeu s'en servira demain. C'est la meme regle que pour la
 * geometrie — si l'affichage et le deplacement calculaient chacun leur verite, on obtiendrait des
 * murs qu'on traverse et des escaliers qui ne montent pas.
 *
 * Le point delicat, c'est l'escalier : il traverse une **tremie**, donc un endroit ou l'etage du
 * dessus n'a justement pas de plancher. La regle « il faut etre au-dessus d'un sol » doit donc
 * ceder devant « je suis sur une volee ».
 */

import {
  openingSpan,
  pointInPolygon,
  projectOnWall,
  stairsHeightAt,
  stairsProgress,
  type Point2,
} from './interiorGeometry'
import type { InteriorDefinition, InteriorFloor, InteriorStairs } from './interiors'

/** Rayon du joueur : il doit tenir dans une ouverture, pas seulement la toucher du bord. */
export const PLAYER_RADIUS = 0.34

/**
 * Une volee resolue : la donnee brute ne connait qu'un `targetFloorId`, ici on a les deux etages
 * et leurs altitudes, donc de quoi calculer la hauteur du joueur pendant la montee.
 */
export interface StairsRun {
  stairs: InteriorStairs
  lowerIndex: number
  upperIndex: number
  lowerElevation: number
  upperElevation: number
}

/**
 * Resout les `targetFloorId` en volees utilisables, en ignorant celles qui ne menent nulle part.
 *
 * Une volee n'est stockee que sur UN etage (celui du bas, par convention du generateur), mais elle
 * relie deux niveaux : on garde le bas et le haut pour qu'elle se monte et se descende.
 */
export function collectStairsRuns(interior: InteriorDefinition): StairsRun[] {
  const runs: StairsRun[] = []
  interior.floors.forEach((floor, floorIndex) => {
    for (const stairs of floor.stairs) {
      const targetIndex = interior.floors.findIndex((item) => item.id === stairs.targetFloorId)
      if (targetIndex < 0 || targetIndex === floorIndex) continue
      const target = interior.floors[targetIndex]
      const goingUp = target.elevation >= floor.elevation
      runs.push({
        stairs,
        lowerIndex: goingUp ? floorIndex : targetIndex,
        upperIndex: goingUp ? targetIndex : floorIndex,
        lowerElevation: Math.min(floor.elevation, target.elevation),
        upperElevation: Math.max(floor.elevation, target.elevation),
      })
    }
  })
  return runs
}

/** Sur quelle volee est-on, et a quelle hauteur ? `null` = les deux pieds sur un plancher. */
export function findStairsAt(point: Point2, runs: StairsRun[], floorIndex: number) {
  for (const run of runs) {
    // Une volee ne se prend que depuis l'un de ses deux etages : sinon on grimperait l'escalier du
    // voisin en passant au-dessus.
    if (run.lowerIndex !== floorIndex && run.upperIndex !== floorIndex) continue
    const progress = stairsProgress(run.stairs, point, PLAYER_RADIUS * 0.5)
    if (progress === null) continue
    return { run, progress, y: stairsHeightAt(progress, run.lowerElevation, run.upperElevation) }
  }
  return null
}

/**
 * Peut-on se tenir la ?
 *
 * Trois conditions :
 *  1. etre au-dessus d'un sol — **ou** sur une volee, qui traverse la tremie sans plancher ;
 *  2. ne pas etre dans l'epaisseur d'un mur, sauf en face d'une ouverture qui touche le sol
 *     (un passage ou une porte se franchissent, une fenetre non) ;
 *  3. ne tenir compte que des murs de l'etage ou l'on se trouve : ceux du dessus n'existent pas.
 */
export function isWalkable(point: Point2, floor: InteriorFloor, onStairs: boolean) {
  // Un etage sans sol n'est pas une prison : on laisse circuler pour pouvoir tester tot.
  if (!onStairs && floor.surfaces.length > 0) {
    if (!floor.surfaces.some((surface) => pointInPolygon(point, surface.pts))) return false
  }

  for (const wall of floor.walls) {
    const projection = projectOnWall(wall, point)
    if (projection.distance > wall.thickness / 2 + PLAYER_RADIUS) continue

    const throughOpening = wall.openings.some((opening) => {
      if (opening.sillHeight > 0.01) return false
      const span = openingSpan(wall, opening)
      return (
        projection.distanceAlong >= span.start + PLAYER_RADIUS && projection.distanceAlong <= span.end - PLAYER_RADIUS
      )
    })
    if (!throughOpening) return false
  }
  return true
}

/** Etage dont le plancher est le plus proche de cette hauteur. */
export function floorIndexAtHeight(interior: InteriorDefinition, y: number) {
  let best = 0
  interior.floors.forEach((floor, index) => {
    if (Math.abs(floor.elevation - y) < Math.abs(interior.floors[best].elevation - y)) best = index
  })
  return best
}

/** Position du joueur : ou il est, a quelle hauteur, et a quel etage il appartient. */
export interface WalkState {
  x: number
  z: number
  y: number
  floorIndex: number
}

/**
 * Tente un pas sur UN seul axe.
 *
 * Les axes sont traites separement par l'appelant : c'est ce qui permet de glisser le long d'un mur
 * au lieu de s'y coller. Renvoie le nouvel etat, ou `null` si le pas est bloque.
 */
export function tryStep(interior: InteriorDefinition, runs: StairsRun[], state: WalkState, next: Point2): WalkState | null {
  const stairs = findStairsAt(next, runs, state.floorIndex)
  // Sur une volee, c'est la hauteur de la marche qui decide de l'etage dont les murs comptent.
  const y = stairs ? stairs.y : (interior.floors[state.floorIndex]?.elevation ?? 0)
  const floorIndex = stairs ? floorIndexAtHeight(interior, y) : state.floorIndex
  const floor = interior.floors[floorIndex]
  if (!floor || !isWalkable(next, floor, stairs !== null)) return null
  return { x: next.x, z: next.z, y, floorIndex }
}

/** Un pas complet : l'axe X puis l'axe Z, chacun accepte ou refuse separement. */
export function walkStep(interior: InteriorDefinition, runs: StairsRun[], state: WalkState, move: Point2): WalkState {
  let current = state
  const onX = tryStep(interior, runs, current, { x: current.x + move.x, z: current.z })
  if (onX) current = onX
  const onZ = tryStep(interior, runs, current, { x: current.x, z: current.z + move.z })
  if (onZ) current = onZ
  return current
}
