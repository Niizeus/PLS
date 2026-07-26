import { isBlocked } from '../world/beauvais/collision'

const MAX_STEP = 0.35
const SQRT1_2 = Math.SQRT1_2

export interface MoveCollisionResult {
  x: number
  z: number
  movedX: boolean
  movedZ: boolean
  hit: boolean
}

export interface CollisionOffset {
  x: number
  z: number
}

/**
 * Deplacement 2D robuste contre les batiments.
 *
 * On decoupe les grands mouvements en petits pas : a vitesse voiture, un simple
 * test position finale peut traverser une facade entre deux frames. Le rayon
 * approxime le volume au sol du joueur ou du vehicule.
 */
export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
  offsets: CollisionOffset[] = [],
): MoveCollisionResult {
  const distance = Math.hypot(dx, dz)
  const steps = Math.max(1, Math.ceil(distance / MAX_STEP))
  const sx = dx / steps
  const sz = dz / steps

  let px = x
  let pz = z
  let movedX = false
  let movedZ = false
  let hit = false

  for (let i = 0; i < steps; i++) {
    const nx = px + sx
    if (canOccupy(nx, pz, radius, offsets)) {
      px = nx
      movedX ||= Math.abs(sx) > 0.0001
    } else if (Math.abs(sx) > 0.0001) {
      hit = true
    }

    const nz = pz + sz
    if (canOccupy(px, nz, radius, offsets)) {
      pz = nz
      movedZ ||= Math.abs(sz) > 0.0001
    } else if (Math.abs(sz) > 0.0001) {
      hit = true
    }

    if (hit && !movedX && !movedZ) break
  }

  return { x: px, z: pz, movedX, movedZ, hit }
}

export function canOccupy(
  x: number,
  z: number,
  radius: number,
  offsets: CollisionOffset[] = [],
): boolean {
  if (!canOccupyPoint(x, z, radius)) return false
  for (const offset of offsets) {
    if (!canOccupyPoint(x + offset.x, z + offset.z, radius)) return false
  }
  return true
}

function canOccupyPoint(x: number, z: number, radius: number): boolean {
  if (radius <= 0) return !isBlocked(x, z)
  return (
    !isBlocked(x, z) &&
    !isBlocked(x + radius, z) &&
    !isBlocked(x - radius, z) &&
    !isBlocked(x, z + radius) &&
    !isBlocked(x, z - radius) &&
    !isBlocked(x + radius * SQRT1_2, z + radius * SQRT1_2) &&
    !isBlocked(x - radius * SQRT1_2, z + radius * SQRT1_2) &&
    !isBlocked(x + radius * SQRT1_2, z - radius * SQRT1_2) &&
    !isBlocked(x - radius * SQRT1_2, z - radius * SQRT1_2)
  )
}
