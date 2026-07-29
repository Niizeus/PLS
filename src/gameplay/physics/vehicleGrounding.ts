import { driveSurfaceHeightAt } from './physicsSurface'
import { vehicleTestSurfaceHeightAt } from './vehicleTestSurfaces'

export interface VehicleGroundingConfig {
  COLLISION_HALF_LENGTH: number
  COLLISION_HALF_WIDTH: number
}

export interface VehicleGroundingPose {
  groundY: number
  frontY: number
  rearY: number
  leftY: number
  rightY: number
  pitch: number
  roll: number
  raycastHits: number
  wheelContacts: number
}

export interface VehicleWheelRaycastHit {
  y: number
}

export interface VehicleGroundingOptions {
  raycastWheel?: (x: number, z: number) => VehicleWheelRaycastHit | null
}

const MAX_PITCH = 0.32
const MAX_ROLL = 0.28

/**
 * Echantillonne le sol sous les roues comme une suspension raycast simplifiee.
 *
 * Rapier gerera ensuite les vrais raycasts/forces, mais cette fonction pose deja
 * la regle globale : un vehicule ne lit pas un seul point sous son centre, il lit
 * ses appuis et en deduit hauteur, tangage et roulis.
 */
export function sampleVehicleGrounding(
  x: number,
  z: number,
  rotationY: number,
  config: VehicleGroundingConfig,
  options: VehicleGroundingOptions = {},
): VehicleGroundingPose {
  const halfLength = config.COLLISION_HALF_LENGTH * 0.68
  const halfWidth = config.COLLISION_HALF_WIDTH * 0.8
  const forwardX = Math.sin(rotationY)
  const forwardZ = Math.cos(rotationY)
  const rightX = Math.cos(rotationY)
  const rightZ = -Math.sin(rotationY)

  const frontRight = sampleWheel(x, z, forwardX, forwardZ, rightX, rightZ, halfLength, halfWidth, options)
  const frontLeft = sampleWheel(x, z, forwardX, forwardZ, rightX, rightZ, halfLength, -halfWidth, options)
  const rearRight = sampleWheel(x, z, forwardX, forwardZ, rightX, rightZ, -halfLength, halfWidth, options)
  const rearLeft = sampleWheel(x, z, forwardX, forwardZ, rightX, rightZ, -halfLength, -halfWidth, options)

  const front = (frontRight.y + frontLeft.y) * 0.5
  const rear = (rearRight.y + rearLeft.y) * 0.5
  const right = (frontRight.y + rearRight.y) * 0.5
  const left = (frontLeft.y + rearLeft.y) * 0.5
  const raycastHits =
    Number(frontRight.raycast) + Number(frontLeft.raycast) + Number(rearRight.raycast) + Number(rearLeft.raycast)

  return {
    groundY: (frontRight.y + frontLeft.y + rearRight.y + rearLeft.y) * 0.25,
    frontY: front,
    rearY: rear,
    leftY: left,
    rightY: right,
    pitch: clamp(Math.atan2(rear - front, halfLength * 2), -MAX_PITCH, MAX_PITCH),
    roll: clamp(Math.atan2(right - left, halfWidth * 2), -MAX_ROLL, MAX_ROLL),
    raycastHits,
    wheelContacts: 4,
  }
}

export function sampleVehicleGroundingFallback(
  x: number,
  z: number,
  rotationY: number,
  config: VehicleGroundingConfig,
): VehicleGroundingPose {
  return sampleVehicleGrounding(x, z, rotationY, config)
}

function sampleWheel(
  x: number,
  z: number,
  forwardX: number,
  forwardZ: number,
  rightX: number,
  rightZ: number,
  front: number,
  side: number,
  options: VehicleGroundingOptions,
): { y: number; raycast: boolean } {
  const sx = x + forwardX * front + rightX * side
  const sz = z + forwardZ * front + rightZ * side
  const raycast = options.raycastWheel?.(sx, sz)
  if (raycast) return { y: raycast.y, raycast: true }

  const testSurface = vehicleTestSurfaceHeightAt(sx, sz)
  if (testSurface !== -Infinity) return { y: testSurface, raycast: false }

  return { y: driveSurfaceHeightAt(sx, sz), raycast: false }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
