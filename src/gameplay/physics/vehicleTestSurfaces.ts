import { driveSurfaceHeightAt } from './physicsSurface'

export interface VehicleRampSurface {
  centerX: number
  centerZ: number
  startX: number
  startZ: number
  endX: number
  endZ: number
  dirX: number
  dirZ: number
  rightX: number
  rightZ: number
  yaw: number
  length: number
  width: number
  height: number
}

const TEST_RAMP_LENGTH = 10.5
const TEST_RAMP_HEIGHT = 2.4
const ROAD_APPROACH_START = { x: -45.7, z: 25.1 }
const ROAD_APPROACH_END = { x: 51.6, z: 78.8 }
const RAMP_DISTANCE_FROM_APPROACH_START = 64

/**
 * Tremplin de reglage au bout de la Rue Saint-Pierre, avec une vraie ligne
 * d'approche pour laisser la voiture prendre de la vitesse.
 *
 * Ce n'est pas un element definitif de Beauvais : c'est un banc d'essai pour
 * regler decollage, gravite, rotations aeriennes et atterrissage.
 */
export const VEHICLE_TEST_RAMP: VehicleRampSurface = (() => {
  const roadDx = ROAD_APPROACH_END.x - ROAD_APPROACH_START.x
  const roadDz = ROAD_APPROACH_END.z - ROAD_APPROACH_START.z
  const roadLength = Math.hypot(roadDx, roadDz) || 1
  const dirX = roadDx / roadLength
  const dirZ = roadDz / roadLength
  const startX = ROAD_APPROACH_START.x + dirX * RAMP_DISTANCE_FROM_APPROACH_START
  const startZ = ROAD_APPROACH_START.z + dirZ * RAMP_DISTANCE_FROM_APPROACH_START
  const endX = startX + dirX * TEST_RAMP_LENGTH
  const endZ = startZ + dirZ * TEST_RAMP_LENGTH
  return {
    centerX: (startX + endX) * 0.5,
    centerZ: (startZ + endZ) * 0.5,
    startX,
    startZ,
    endX,
    endZ,
    dirX,
    dirZ,
    rightX: dirZ,
    rightZ: -dirX,
    yaw: Math.atan2(-dirZ, dirX),
    length: TEST_RAMP_LENGTH,
    width: 4.4,
    height: TEST_RAMP_HEIGHT,
  }
})()

export function vehicleTestRampBaseY(): number {
  return testSurfaceBaseY(VEHICLE_TEST_RAMP.startX, VEHICLE_TEST_RAMP.startZ)
}

export function vehicleTestSurfaceHeightAt(x: number, z: number): number {
  const ramp = VEHICLE_TEST_RAMP
  const localX = (x - ramp.startX) * ramp.dirX + (z - ramp.startZ) * ramp.dirZ
  const localZ = (x - ramp.startX) * ramp.rightX + (z - ramp.startZ) * ramp.rightZ
  if (localX < 0 || localX > ramp.length) return -Infinity
  if (Math.abs(localZ) > ramp.width * 0.5) return -Infinity

  const t = localX / ramp.length
  return vehicleTestRampBaseY() + t * ramp.height
}

export function vehicleTestPropArea() {
  const ramp = VEHICLE_TEST_RAMP
  return {
    centerX: ramp.startX - ramp.dirX * 5 + ramp.rightX * 7,
    centerZ: ramp.startZ - ramp.dirZ * 5 + ramp.rightZ * 7,
  }
}

export function testSurfaceBaseY(x: number, z: number): number {
  return driveSurfaceHeightAt(x, z)
}
