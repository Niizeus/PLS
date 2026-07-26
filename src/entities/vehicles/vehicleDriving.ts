import * as THREE from 'three'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import { vehicleGroundHeight } from '../../world/beauvais/roadway'
import { moveBox } from '../movementCollision'
import type { GroundSampleOffset } from '../../world/beauvais/roadway'

export interface VehicleDriveConfig {
  ACCEL: number
  BRAKE: number
  MAX_SPEED: number
  REVERSE_SPEED: number
  FRICTION: number
  STEER: number
  STEER_RESPONSE: number
  MIN_STEER_FACTOR: number
  SEAT_HEIGHT: number
  /** Demi-longueur de la caisse de collision (m). */
  COLLISION_HALF_LENGTH: number
  /** Demi-largeur de la caisse de collision (m). */
  COLLISION_HALF_WIDTH: number
  /** Part de vitesse perdue dans un choc parfaitement frontal (0 → 1). */
  IMPACT_LOSS: number
  /** Frottement continu quand on rase un mur (part de vitesse perdue par seconde). */
  SCRAPE_DRAG: number
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
  const result = moveBox(
    group.position.x,
    group.position.z,
    dx,
    dz,
    group.rotation.y,
    config.COLLISION_HALF_LENGTH,
    config.COLLISION_HALF_WIDTH,
  )
  group.position.x = result.x
  group.position.z = result.z

  if (result.hit) {
    // Frôler un mur ne doit presque rien coûter, le taper de face doit tout
    // coûter. On mesure donc à quel point le choc était FRONTAL : c'est la part
    // de la trajectoire qui pointait dans le mur (1 = pleine face, 0 = rasant).
    const distance = Math.hypot(dx, dz)
    const frontal =
      distance > 1e-6 ? Math.max(0, -((dx / distance) * result.normalX + (dz / distance) * result.normalZ)) : 0
    state.speed *= 1 - frontal * config.IMPACT_LOSS
    // Le reste, c'est du frottement de carrosserie : léger, et proportionnel au
    // temps écoulé (sinon le comportement changerait avec le nombre d'images/s).
    state.speed *= Math.max(0, 1 - config.SCRAPE_DRAG * delta)
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

/**
 * Les 4 points de CONTACT AU SOL (les roues), pour calculer l'assiette.
 *
 * ⚠️ Ce ne sont plus des points de collision : les murs sont gérés par la caisse
 * orientée (`moveBox`). Ici on ne cherche que la hauteur du sol, et les roues
 * sont un peu rentrées dans l'emprise — comme sur un vrai véhicule.
 */
function vehicleCollisionOffsets(rotationY: number, config: VehicleDriveConfig): GroundSampleOffset[] {
  const halfLength = config.COLLISION_HALF_LENGTH * 0.68
  const halfWidth = config.COLLISION_HALF_WIDTH * 0.8

  const forwardX = Math.sin(rotationY)
  const forwardZ = Math.cos(rotationY)
  const rightX = Math.cos(rotationY)
  const rightZ = -Math.sin(rotationY)
  return [
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
