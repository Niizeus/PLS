import { interactionGroups, type Vector3Tuple } from '@react-three/rapier'

/**
 * Constantes globales du monde physique.
 *
 * Le jeu reste en metres / kilos / secondes. Les valeurs specifiques
 * (masse d'une caisse, grip d'un pneu, amortissement d'un ragdoll) vivent dans
 * les configs de chaque famille, mais la gravite et le pas de simulation sont
 * communs a tout le sandbox.
 */
export const PHYSICS_WORLD = {
  GRAVITY: [0, -9.81, 0] as Vector3Tuple,
  TIME_STEP: 1 / 60,
  LENGTH_UNIT: 1,
  SOLVER_ITERATIONS: 7,
  FRICTION_ITERATIONS: 4,
  CCD_SUBSTEPS: 2,
  UPDATE_PRIORITY: 1.5,
  DEBUG: false,
} as const

export const PHYSICS_LAYER = {
  WORLD: 0,
  PLAYER: 1,
  VEHICLE: 2,
  PROP: 3,
  SENSOR: 4,
} as const

export const PHYSICS_GROUPS = {
  world: interactionGroups(PHYSICS_LAYER.WORLD, [
    PHYSICS_LAYER.PLAYER,
    PHYSICS_LAYER.VEHICLE,
    PHYSICS_LAYER.PROP,
  ]),
  player: interactionGroups(PHYSICS_LAYER.PLAYER, [
    PHYSICS_LAYER.WORLD,
    PHYSICS_LAYER.PROP,
    PHYSICS_LAYER.SENSOR,
  ]),
  vehicle: interactionGroups(PHYSICS_LAYER.VEHICLE, [
    PHYSICS_LAYER.WORLD,
    PHYSICS_LAYER.PROP,
    PHYSICS_LAYER.SENSOR,
  ]),
  prop: interactionGroups(PHYSICS_LAYER.PROP, [
    PHYSICS_LAYER.WORLD,
    PHYSICS_LAYER.PLAYER,
    PHYSICS_LAYER.VEHICLE,
    PHYSICS_LAYER.PROP,
  ]),
  sensor: interactionGroups(PHYSICS_LAYER.SENSOR, [
    PHYSICS_LAYER.PLAYER,
    PHYSICS_LAYER.VEHICLE,
    PHYSICS_LAYER.PROP,
  ]),
} as const

export const PHYSICS_MATERIAL = {
  asphalt: {
    friction: 1.2,
    restitution: 0.03,
  },
  propWood: {
    friction: 0.85,
    restitution: 0.12,
    linearDamping: 0.08,
    angularDamping: 0.18,
  },
  propMetal: {
    friction: 0.65,
    restitution: 0.2,
    linearDamping: 0.05,
    angularDamping: 0.12,
  },
} as const
