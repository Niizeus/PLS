import * as THREE from 'three'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import { vehicleGroundHeight } from '../../world/beauvais/roadway'
import { moveWithCollision, type CollisionOffset } from '../movementCollision'

export interface VehicleDriveConfig {
  ACCEL: number
  BRAKE: number
  MAX_SPEED: number
  REVERSE_SPEED: number
  FRICTION: number
  STEER: number
  STEER_RESPONSE: number
  MIN_STEER_FACTOR: number
  COLLISION_BRAKE: number
  SEAT_HEIGHT: number
  COLLISION_RADIUS: number
  COLLISION_HALF_LENGTH?: number
  COLLISION_HALF_WIDTH?: number
}

export interface VehicleDriveState {
  speed: number
  steer: number
  groundY: number | null
}

export const createVehicleDriveState = (): VehicleDriveState => ({
  speed: 0,
  steer: 0,
  groundY: null,
})

export function stopVehicle(state: VehicleDriveState) {
  state.speed = 0
  state.steer = 0
  state.groundY = null
}

/**
 * Conduite arcade commune aux vehicules.
 *
 * Le vehicule garde un peu d'inertie, le braquage est lisse, et la rotation
 * depend de la vitesse pour eviter le comportement "tourelle" a l'arret.
 */
export function driveVehicle(
  group: THREE.Group,
  k: KeyboardState,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  delta: number,
) {
  updateSpeed(k, state, config, delta)
  updateSteer(k, state, config, delta)

  const speedRatio = Math.min(1, Math.abs(state.speed) / config.MAX_SPEED)
  const steerPower = config.MIN_STEER_FACTOR + (1 - config.MIN_STEER_FACTOR) * speedRatio
  const reverse = state.speed < 0 ? -1 : 1
  group.rotation.y += state.steer * config.STEER * steerPower * reverse * delta

  const dx = Math.sin(group.rotation.y) * state.speed * delta
  const dz = Math.cos(group.rotation.y) * state.speed * delta
  const offsets = vehicleCollisionOffsets(group.rotation.y, config)
  const result = moveWithCollision(group.position.x, group.position.z, dx, dz, config.COLLISION_RADIUS, offsets)
  group.position.x = result.x
  group.position.z = result.z

  if (result.hit && Math.abs(state.speed) > 0.05) {
    state.speed *= result.movedX || result.movedZ ? 0.35 : -config.COLLISION_BRAKE
  }

  const targetY = vehicleGroundHeight(group.position.x, group.position.z, offsets) + config.SEAT_HEIGHT
  state.groundY = smoothGroundY(state.groundY, targetY, delta)
  group.position.y = state.groundY
}

function updateSpeed(
  k: KeyboardState,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  delta: number,
) {
  if (k.forward) {
    const accel = state.speed < 0 ? config.BRAKE : config.ACCEL
    state.speed += accel * delta
  } else if (k.backward) {
    const brake = state.speed > 0 ? config.BRAKE : config.ACCEL * 0.65
    state.speed -= brake * delta
  } else {
    state.speed = approach(state.speed, 0, config.FRICTION * delta)
  }

  state.speed = THREE.MathUtils.clamp(state.speed, -config.REVERSE_SPEED, config.MAX_SPEED)
}

function updateSteer(
  k: KeyboardState,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  delta: number,
) {
  const target = (k.left ? 1 : 0) - (k.right ? 1 : 0)
  const t = 1 - Math.exp(-config.STEER_RESPONSE * delta)
  state.steer += (target - state.steer) * t
}

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step)
  if (value > target) return Math.max(target, value - step)
  return target
}

function vehicleCollisionOffsets(rotationY: number, config: VehicleDriveConfig): CollisionOffset[] {
  const halfLength = config.COLLISION_HALF_LENGTH ?? 0
  const halfWidth = config.COLLISION_HALF_WIDTH ?? 0
  if (halfLength <= 0 && halfWidth <= 0) return []

  const forwardX = Math.sin(rotationY)
  const forwardZ = Math.cos(rotationY)
  const rightX = Math.cos(rotationY)
  const rightZ = -Math.sin(rotationY)
  return [
    { x: forwardX * halfLength, z: forwardZ * halfLength },
    { x: -forwardX * halfLength, z: -forwardZ * halfLength },
    { x: rightX * halfWidth, z: rightZ * halfWidth },
    { x: -rightX * halfWidth, z: -rightZ * halfWidth },
    { x: forwardX * halfLength + rightX * halfWidth, z: forwardZ * halfLength + rightZ * halfWidth },
    { x: forwardX * halfLength - rightX * halfWidth, z: forwardZ * halfLength - rightZ * halfWidth },
    { x: -forwardX * halfLength + rightX * halfWidth, z: -forwardZ * halfLength + rightZ * halfWidth },
    { x: -forwardX * halfLength - rightX * halfWidth, z: -forwardZ * halfLength - rightZ * halfWidth },
  ]
}

function smoothGroundY(current: number | null, target: number, delta: number): number {
  if (current === null || Math.abs(target - current) > 2.5) return target
  const t = 1 - Math.exp(-10 * delta)
  const next = current + (target - current) * t
  const maxStep = 5 * delta
  return THREE.MathUtils.clamp(next, current - maxStep, current + maxStep)
}
