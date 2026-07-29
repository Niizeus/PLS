import * as THREE from 'three'
import type { RapierContext } from '@react-three/rapier'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import { PHYSICS_GROUPS } from '../../gameplay/physics/physicsConfig'
import {
  sampleVehicleGrounding,
  sampleVehicleGroundingFallback,
  type VehicleGroundingPose,
  type VehicleGroundingOptions,
} from '../../gameplay/physics/vehicleGrounding'
import { moveBox } from '../movementCollision'
import { createGearboxState, driveTrain, type EngineConfig, type GearboxState } from './vehicleEngine'

/**
 * 🚙 PHYSIQUE COMMUNE AUX VÉHICULES.
 *
 * ## Ce qui a changé, et pourquoi
 *
 * L'ancien modèle n'avait **pas de vecteur vitesse** : juste un nombre `speed`
 * le long de l'axe du véhicule, et un `rotation.y` qu'on incrémentait. Tout
 * découlait de là :
 *
 *  - aucune inertie latérale → pas de dérapage, et la voiture pivotait sur
 *    place comme une tourelle ;
 *  - impossible d'être poussé DE CÔTÉ par un mur : à l'impact, on ne pouvait
 *    que réduire un nombre ;
 *  - frotter un mur en biais coûtait 65 % de la vitesse **par image** (et pas
 *    par seconde !) : trois images et on était à l'arrêt. C'était l'effet
 *    « mur invisible », et il changeait avec le nombre d'images/s.
 *
 * Le véhicule a maintenant une vraie vitesse en 2D, décomposée à chaque image
 * dans son propre repère :
 *
 *  - la part **longitudinale** est celle que les roues poussent ou freinent ;
 *  - la part **latérale** est la dérive ; l'adhérence la mange progressivement.
 *    C'est elle qui donne la sensation de masse, et le petit glissement quand
 *    on braque fort.
 *
 * Le braquage suit le **modèle bicyclette** : la vitesse de rotation dépend de
 * la vitesse d'avance et de l'empattement. Deux conséquences voulues : on ne
 * tourne plus à l'arrêt, et le rayon de braquage est celui d'un vrai véhicule.
 * Une limite d'adhérence latérale plafonne la rotation à haute vitesse — c'est
 * du sous-virage, et il apparaît tout seul.
 *
 * L'impact contre un mur utilise la **normale** rendue par la collision : la
 * part de vitesse qui rentre dans le mur est renvoyée avec un petit rebond, la
 * part qui longe le mur est presque entièrement conservée. Autrement dit,
 * frôler une façade ne coûte presque rien et la percuter coûte tout — sans
 * aucun cas particulier à écrire. Un choc décentré fait en plus pivoter la
 * caisse (bras de levier).
 */

export interface VehicleDriveConfig {
  /** Masse en ordre de marche (kg), conducteur compris. */
  MASS: number
  /** Rayon des roues (m) — doit coller au visuel, c'est lui qui donne le régime. */
  WHEEL_RADIUS: number
  /** Empattement : distance entre essieux (m). Donne le rayon de braquage. */
  WHEELBASE: number
  /** Braquage maxi des roues avant (rad). */
  MAX_STEER_ANGLE: number
  /** Clamp purement visuel du braquage des roues (rad), sans impact sur la physique. */
  VISUAL_STEER_MAX: number
  /** Vitesse à laquelle le braquage rejoint l'intention du joueur. */
  STEER_RESPONSE: number
  /**
   * Adhérence latérale maxi, en g. Plafonne la rotation à haute vitesse :
   * au-delà, le véhicule sous-vire au lieu de pivoter comme une toupie.
   */
  MAX_LATERAL_G: number
  /** Bonus d'adherence de jeu a haute vitesse : moins simulateur, plus conduisible. */
  STEER_ASSIST_G: number
  /** Vitesse à laquelle la dérive latérale est mangée (plus haut = plus « sur rails »). */
  GRIP: number
  /** Force de freinage aux roues (N). */
  BRAKE_FORCE: number
  /** Poussée en marche arrière (N). */
  REVERSE_FORCE: number
  /** Vitesse maxi en marche arrière (m/s). */
  REVERSE_SPEED: number
  /** Traînée aéro : 0,5 × ρ × Cx × S, en N par (m/s)². C'est ELLE qui fixe la vitesse maxi. */
  DRAG: number
  /** Coefficient de résistance au roulement (sans unité, ~0,013 sur bitume). */
  ROLL_RESIST: number
  /** Frein moteur quand on ne touche à rien (N). */
  ENGINE_BRAKE: number
  /** Garde-fou : vitesse qu'on ne dépassera jamais (m/s). */
  MAX_SPEED: number
  /** Le moteur et sa transmission. */
  ENGINE: EngineConfig

  /**
   * Frottement de carrosserie quand on rase un mur, **par seconde**.
   * ⚠️ Par seconde, pas par image : sinon le comportement changerait avec le
   * nombre d'images/s — c'était précisément le défaut de l'ancien modèle.
   */
  SCRAPE_FRICTION: number
  /** Rebond : part de la vitesse « dans le mur » renvoyée. */
  IMPACT_RESTITUTION: number
  /** Combien un choc décentré fait pivoter la caisse. */
  IMPACT_SPIN: number
  /** Amortissement de ce pivotement (par seconde). */
  SPIN_DAMP: number
  /** Course verticale disponible avant que les roues perdent le contact (m). */
  SUSPENSION_TRAVEL: number
  /** Vitesse horizontale minimale pour decoller sur une rupture de pente (m/s). */
  TAKEOFF_MIN_SPEED: number
  /** Vitesse verticale minimale transmise par le sol pour decoller (m/s). */
  TAKEOFF_MIN_VELOCITY: number
  /** Angle minimal du nez quand les roues perdent le sol pour declencher un saut. */
  TAKEOFF_MIN_PITCH: number
  /** Gravite appliquee au vehicule en l'air (m/s2). */
  AIR_GRAVITY: number
  /** Controle de tangage en l'air avec avant/arriere. */
  AIR_PITCH_CONTROL: number
  /** Controle de roulis en l'air avec gauche/droite. */
  AIR_ROLL_CONTROL: number
  /** Amortissement des rotations aeriennes. */
  AIR_ROTATION_DAMP: number
  /** Impulsion de rotation donnee par l'assiette au moment du decollage. */
  TAKEOFF_ROTATION_IMPULSE: number
  /** Part de vitesse verticale conservee a l'atterrissage. */
  LANDING_BOUNCE: number

  SEAT_HEIGHT: number
  /** Demi-longueur de la caisse de collision (m). */
  COLLISION_HALF_LENGTH: number
  /** Demi-largeur de la caisse de collision (m). */
  COLLISION_HALF_WIDTH: number
}

export interface VehicleDriveState {
  /** Vitesse dans le repère MONDE (m/s). C'est la vérité, tout le reste en découle. */
  vx: number
  vz: number
  /** Vitesse longitudinale signée (m/s) : positive vers l'avant. Lue par le HUD. */
  speed: number
  /** Braquage lissé des roues avant, de -1 (droite) à 1 (gauche). */
  steer: number
  /** Rotation résiduelle après un choc décentré (rad/s). */
  spin: number
  /** Régime moteur (tr/min) et rapport engagé, pour le tableau de bord. */
  rpm: number
  gear: number
  /** Boîte de vitesses. */
  box: GearboxState
  groundY: number | null
  lastSupportY: number | null
  verticalVelocity: number
  airborne: boolean
  pitch: number
  roll: number
  pitchVelocity: number
  rollVelocity: number
  wheelSpin: number
  frontSuspension: number
  rearSuspension: number
}

export const createVehicleDriveState = (): VehicleDriveState => ({
  vx: 0,
  vz: 0,
  speed: 0,
  steer: 0,
  spin: 0,
  rpm: 0,
  gear: 1,
  box: createGearboxState(),
  groundY: null,
  lastSupportY: null,
  verticalVelocity: 0,
  airborne: false,
  pitch: 0,
  roll: 0,
  pitchVelocity: 0,
  rollVelocity: 0,
  wheelSpin: 0,
  frontSuspension: 0,
  rearSuspension: 0,
})

export function stopVehicle(state: VehicleDriveState) {
  state.vx = 0
  state.vz = 0
  state.speed = 0
  state.steer = 0
  state.spin = 0
  state.rpm = 0
  state.gear = 1
  state.box.gear = 0
  state.box.shiftTimer = 0
  state.groundY = null
  state.lastSupportY = null
  state.verticalVelocity = 0
  state.airborne = false
  state.pitch = 0
  state.roll = 0
  state.pitchVelocity = 0
  state.rollVelocity = 0
  state.wheelSpin = 0
  state.frontSuspension = 0
  state.rearSuspension = 0
}

const GRAVITY = 9.81

export function driveVehicle(
  group: THREE.Group,
  k: KeyboardState,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  delta: number,
  rapierContext?: Pick<RapierContext, 'rapier' | 'world'>,
) {
  // --- Repère du véhicule : avant (u) et droite (r) ---
  const sweepFrom = group.position.clone()

  const ux = Math.sin(group.rotation.y)
  const uz = Math.cos(group.rotation.y)
  const rx = Math.cos(group.rotation.y)
  const rz = -Math.sin(group.rotation.y)

  // On décompose la vitesse : ce qui avance, et ce qui dérive sur le côté.
  let forward = state.vx * ux + state.vz * uz
  let lateral = state.vx * rx + state.vz * rz
  const tireContact = state.airborne ? 0.08 : 1

  forward = applyLongitudinalForces(k, state, config, forward, delta, tireContact)
  // L'adhérence mange la dérive. En exponentielle, pour que le comportement ne
  // dépende pas du nombre d'images par seconde.
  lateral *= Math.exp(-config.GRIP * tireContact * delta)

  updateSteer(k, state, config, delta)
  const heading = turn(group, state, config, forward, delta, tireContact)

  // On recompose la vitesse dans le NOUVEAU repère : la caisse a tourné, mais
  // l'inertie, elle, ne tourne pas avec — c'est ça, la dérive.
  state.vx = Math.sin(heading) * forward + Math.cos(heading) * lateral
  state.vz = Math.cos(heading) * forward - Math.sin(heading) * lateral
  state.speed = forward

  // --- Déplacement + murs ---
  const result = moveBox(
    group.position.x,
    group.position.z,
    state.vx * delta,
    state.vz * delta,
    heading,
    config.COLLISION_HALF_LENGTH,
    config.COLLISION_HALF_WIDTH,
  )
  group.position.x = result.x
  group.position.z = result.z

  if (result.hit) resolveImpact(group, state, config, result, delta)

  // --- Assiette : les roues lisent le sol, la caisse suit hauteur + tangage/roulis ---
  const grounding = sampleVehicleGrounding(
    group.position.x,
    group.position.z,
    group.rotation.y,
    config,
    createRapierWheelGrounding(group, state, config, rapierContext),
  )
  const targetY = grounding.groundY + config.SEAT_HEIGHT
  updateVerticalMotion(k, state, config, targetY, grounding.pitch, grounding.roll, delta)
  updateWheelVisuals(state, config, grounding, forward, delta)
  group.position.y = state.groundY ?? targetY
  applyRapierChassisSweep(sweepFrom, group, state, config, rapierContext)
}

/**
 * Poussée du moteur, freinage, marche arrière et résistances.
 * Tout est en NEWTONS, divisé par la masse : c'est ce qui rend les réglages
 * lisibles (un couple, une masse, une traînée) au lieu de nombres magiques.
 */
function applyLongitudinalForces(
  k: KeyboardState,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  forward: number,
  delta: number,
  tireContact: number,
): number {
  const speed = Math.abs(forward)
  let force = 0

  if (k.forward) {
    if (forward < -0.5) {
      force = config.BRAKE_FORCE * tireContact // on roulait en arrière : c'est un freinage
      state.rpm = 0
      state.gear = 1
    } else {
      const out = driveTrain(config.ENGINE, state.box, forward, config.WHEEL_RADIUS, true, delta)
      force = out.force * tireContact
      state.rpm = out.rpm
      state.gear = out.gear
    }
  } else if (k.backward) {
    if (forward > 0.5) {
      force = -config.BRAKE_FORCE * tireContact // on roulait en avant : c'est un freinage
    } else {
      force = -forward > config.REVERSE_SPEED ? 0 : -config.REVERSE_FORCE * tireContact
    }
    state.rpm = 0
    state.gear = 1
  } else {
    // Pied levé : frein moteur, et la boîte continue de tourner à vide.
    const out = driveTrain(config.ENGINE, state.box, forward, config.WHEEL_RADIUS, false, delta)
    state.rpm = out.rpm
    state.gear = out.gear
    force = -Math.sign(forward) * config.ENGINE_BRAKE * tireContact
  }

  // Résistances : l'air (en v²) et le roulement (constant). C'est leur équilibre
  // avec la poussée du dernier rapport qui FIXE la vitesse maxi — voir vehicleEngine.ts.
  force -= Math.sign(forward) * (
    config.DRAG * speed * speed + config.ROLL_RESIST * config.MASS * GRAVITY * tireContact
  )

  let next = forward + (force / config.MASS) * delta
  // Sans ça, les résistances feraient repartir le véhicule en arrière à l'arrêt.
  if (!k.forward && !k.backward && Math.sign(next) !== Math.sign(forward)) next = 0

  return THREE.MathUtils.clamp(next, -config.REVERSE_SPEED, config.MAX_SPEED)
}

function updateSteer(
  k: KeyboardState,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  delta: number,
) {
  const target = (k.left ? 1 : 0) - (k.right ? 1 : 0)
  state.steer += (target - state.steer) * (1 - Math.exp(-config.STEER_RESPONSE * delta))
}

/**
 * Rotation de la caisse — modèle bicyclette.
 *
 * `yawRate = (vitesse / empattement) × tan(angle de braquage)`. À l'arrêt, la
 * vitesse est nulle donc la caisse ne tourne pas : fini l'effet tourelle.
 *
 * Le plafond d'adhérence est le deuxième ingrédient : une voiture ne peut pas
 * encaisser plus d'environ 1 g en virage. Au-delà, elle ne tourne pas plus —
 * elle sous-vire. On plafonne donc la rotation à `a_max / v`, ce qui rend
 * naturellement les virages larges à haute vitesse.
 */
function turn(
  group: THREE.Group,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  forward: number,
  delta: number,
  tireContact: number,
): number {
  const angle = state.steer * config.MAX_STEER_ANGLE
  let yawRate = (forward / config.WHEELBASE) * Math.tan(angle) * tireContact

  const speed = Math.abs(forward)
  const assist = THREE.MathUtils.smoothstep(speed, 12, 34) * config.STEER_ASSIST_G
  const maxYawRate = ((config.MAX_LATERAL_G + assist) * GRAVITY) / Math.max(speed, 1)
  yawRate = THREE.MathUtils.clamp(yawRate, -maxYawRate, maxYawRate)

  // Rotation résiduelle d'un choc, qui s'amortit toute seule.
  group.rotation.y += (yawRate + state.spin) * delta
  state.spin *= Math.exp(-config.SPIN_DAMP * delta)

  return group.rotation.y
}

function createRapierWheelGrounding(
  group: THREE.Group,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  context?: Pick<RapierContext, 'rapier' | 'world'>,
): VehicleGroundingOptions {
  if (!context) return {}

  const fallback = sampleVehicleGroundingFallback(group.position.x, group.position.z, group.rotation.y, config)
  const originY =
    Math.max(state.groundY ?? -Infinity, group.position.y, fallback.groundY + config.SEAT_HEIGHT) +
    config.SUSPENSION_TRAVEL +
    config.WHEEL_RADIUS +
    1.2
  const maxDistance = config.SEAT_HEIGHT + config.SUSPENSION_TRAVEL + config.WHEEL_RADIUS + 5
  const filterFlags = context.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  context.world.updateSceneQueries()

  return {
    raycastWheel: (x, z) => {
      const ray = new context.rapier.Ray({ x, y: originY, z }, { x: 0, y: -1, z: 0 })
      const hit = context.world.castRay(ray, maxDistance, true, filterFlags, PHYSICS_GROUPS.vehicle)
      return hit ? { y: originY - hit.timeOfImpact } : null
    },
  }
}

/**
 * Réponse à un mur.
 *
 * On décompose la vitesse par rapport à la NORMALE du mur :
 *  - la part qui rentre dedans est renvoyée (petit rebond amorti) ;
 *  - la part qui longe le mur est presque intégralement gardée.
 *
 * C'est tout : frôler coûte quelques pour cent, percuter de face coûte tout.
 * Aucun cas particulier, aucun seuil arbitraire — juste de la géométrie.
 */
function applyRapierChassisSweep(
  from: THREE.Vector3,
  group: THREE.Group,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  context?: Pick<RapierContext, 'rapier' | 'world'>,
) {
  if (!context) return

  const motion = {
    x: group.position.x - from.x,
    y: group.position.y - from.y,
    z: group.position.z - from.z,
  }
  if (motion.x * motion.x + motion.y * motion.y + motion.z * motion.z < 0.000001) return

  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, group.rotation.y, 0))
  const shape = new context.rapier.Cuboid(config.COLLISION_HALF_WIDTH, 0.55, config.COLLISION_HALF_LENGTH)
  const filterFlags = context.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  context.world.updateSceneQueries()

  const hit = context.world.castShape(
    {
      x: from.x,
      y: from.y - config.SEAT_HEIGHT + 0.75,
      z: from.z,
    },
    { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
    motion,
    shape,
    0.03,
    1,
    true,
    filterFlags,
    PHYSICS_GROUPS.vehicle,
  )
  if (!hit) return

  // Une rampe / route inclinée est un sol praticable : les raycasts de roues
  // doivent la monter. Le sweep chassis sert surtout aux obstacles latéraux.
  if (isClimbableSurfaceHit(hit)) return

  const keep = Math.max(0, hit.time_of_impact - 0.03)
  group.position.set(from.x + motion.x * keep, from.y + motion.y * keep, from.z + motion.z * keep)
  state.groundY = group.position.y

  if (Math.abs(motion.x) + Math.abs(motion.z) > 0.001) {
    state.vx *= 0.18
    state.vz *= 0.18
    state.speed = state.vx * Math.sin(group.rotation.y) + state.vz * Math.cos(group.rotation.y)
  }
  if (motion.y < 0) {
    state.verticalVelocity = Math.max(0, state.verticalVelocity)
    state.airborne = false
  }
}

function isClimbableSurfaceHit(hit: { normal1: { y: number }; normal2: { y: number } }) {
  return Math.max(Math.abs(hit.normal1.y), Math.abs(hit.normal2.y)) > 0.45
}

function resolveImpact(
  group: THREE.Group,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  result: { normalX: number; normalZ: number; contactX: number; contactZ: number },
  delta: number,
) {
  const nx = result.normalX
  const nz = result.normalZ
  const into = state.vx * nx + state.vz * nz
  if (into >= 0) return // on s'éloignait déjà du mur : rien à corriger

  const tangentX = state.vx - nx * into
  const tangentZ = state.vz - nz * into
  // Le frottement est en exponentielle du TEMPS : raser un mur une demi-seconde
  // coûte pareil qu'on tourne à 30 ou à 144 images par seconde.
  const keep = Math.exp(-config.SCRAPE_FRICTION * delta)
  state.vx = tangentX * keep - nx * into * config.IMPACT_RESTITUTION
  state.vz = tangentZ * keep - nz * into * config.IMPACT_RESTITUTION

  // Couple d'impact : un choc pris sur une aile fait pivoter la caisse.
  // Le bras de levier va du centre du véhicule au point de mur touché.
  const leverX = result.contactX - group.position.x
  const leverZ = result.contactZ - group.position.z
  const impulseX = -nx * into
  const impulseZ = -nz * into
  state.spin += (impulseX * leverZ - impulseZ * leverX) * config.IMPACT_SPIN

  // La vitesse longitudinale affichée doit suivre la nouvelle vitesse réelle.
  state.speed = state.vx * Math.sin(group.rotation.y) + state.vz * Math.cos(group.rotation.y)
}

function updateVerticalMotion(
  k: KeyboardState,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  supportY: number,
  supportPitch: number,
  supportRoll: number,
  delta: number,
) {
  if (state.groundY === null) {
    state.groundY = supportY
    state.lastSupportY = supportY
    state.verticalVelocity = 0
    state.airborne = false
  }

  const previousSupportY = state.lastSupportY ?? supportY
  const supportVelocity = (supportY - previousSupportY) / Math.max(delta, 1e-4)
  state.lastSupportY = supportY

  if (state.groundY < supportY) {
    state.groundY = supportY
    state.airborne = false
    state.verticalVelocity = Math.max(0, THREE.MathUtils.clamp(supportVelocity, -6, 10))
    state.pitch = smoothValue(state.pitch, supportPitch, 18, delta)
    state.roll = smoothValue(state.roll, supportRoll, 18, delta)
  }

  if (!state.airborne) {
    state.verticalVelocity = smoothValue(
      state.verticalVelocity,
      THREE.MathUtils.clamp(supportVelocity, -6, 8),
      14,
      delta,
    )

    const lostWheelContact = supportY + config.SUSPENSION_TRAVEL < state.groundY
    const fastEnough = Math.abs(state.speed) >= config.TAKEOFF_MIN_SPEED
    const launchedByRamp = state.verticalVelocity >= config.TAKEOFF_MIN_VELOCITY
    const rampLip = state.pitch <= -config.TAKEOFF_MIN_PITCH

    if (lostWheelContact && fastEnough && (launchedByRamp || rampLip)) {
      state.airborne = true
      state.verticalVelocity = Math.max(state.verticalVelocity, config.TAKEOFF_MIN_VELOCITY)
      state.pitchVelocity += supportPitch * config.TAKEOFF_ROTATION_IMPULSE
      state.rollVelocity += supportRoll * config.TAKEOFF_ROTATION_IMPULSE
    } else {
      state.groundY = supportY > state.groundY ? supportY : smoothGroundY(state.groundY, supportY, delta)
      state.pitch = smoothValue(state.pitch, supportPitch, 12, delta)
      state.roll = smoothValue(state.roll, supportRoll, 12, delta)
      state.pitchVelocity = smoothValue(state.pitchVelocity, 0, 10, delta)
      state.rollVelocity = smoothValue(state.rollVelocity, 0, 10, delta)
      return
    }
  }

  const pitchInput = (k.backward ? 1 : 0) - (k.forward ? 1 : 0)
  const rollInput = (k.left ? 1 : 0) - (k.right ? 1 : 0)
  state.pitchVelocity += pitchInput * config.AIR_PITCH_CONTROL * delta
  state.rollVelocity += rollInput * config.AIR_ROLL_CONTROL * delta
  state.pitchVelocity *= Math.exp(-config.AIR_ROTATION_DAMP * delta)
  state.rollVelocity *= Math.exp(-config.AIR_ROTATION_DAMP * delta)

  state.verticalVelocity -= config.AIR_GRAVITY * delta
  state.groundY += state.verticalVelocity * delta
  state.pitch += state.pitchVelocity * delta
  state.roll += state.rollVelocity * delta

  if (state.verticalVelocity <= 0 && state.groundY <= supportY + config.SUSPENSION_TRAVEL) {
    state.airborne = false
    state.groundY = supportY
    state.verticalVelocity = Math.max(0, -state.verticalVelocity * config.LANDING_BOUNCE)
    state.pitch = smoothValue(state.pitch, supportPitch, 18, delta)
    state.roll = smoothValue(state.roll, supportRoll, 18, delta)
    state.pitchVelocity *= config.LANDING_BOUNCE
    state.rollVelocity *= config.LANDING_BOUNCE
  }
}

function updateWheelVisuals(
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  grounding: VehicleGroundingPose,
  forward: number,
  delta: number,
) {
  state.wheelSpin = wrapAngle(state.wheelSpin + (forward / Math.max(config.WHEEL_RADIUS, 0.01)) * delta)

  const supportLift = state.airborne ? -config.SUSPENSION_TRAVEL * 0.45 : 0
  const bodyY = (state.groundY ?? grounding.groundY + config.SEAT_HEIGHT) - config.SEAT_HEIGHT
  const frontTarget = clampVisualSuspension(grounding.frontY - bodyY + supportLift, config)
  const rearTarget = clampVisualSuspension(grounding.rearY - bodyY + supportLift, config)
  state.frontSuspension = smoothValue(state.frontSuspension, frontTarget, 16, delta)
  state.rearSuspension = smoothValue(state.rearSuspension, rearTarget, 16, delta)
}

function clampVisualSuspension(value: number, config: VehicleDriveConfig): number {
  return THREE.MathUtils.clamp(value, -config.SUSPENSION_TRAVEL * 0.65, config.SUSPENSION_TRAVEL * 0.35)
}

function wrapAngle(value: number): number {
  if (Math.abs(value) < Math.PI * 128) return value
  return THREE.MathUtils.euclideanModulo(value + Math.PI, Math.PI * 2) - Math.PI
}

function smoothGroundY(current: number | null, target: number, delta: number): number {
  if (current === null || Math.abs(target - current) > 2.5) return target
  const t = 1 - Math.exp(-10 * delta)
  const next = current + (target - current) * t
  const maxStep = 5 * delta
  return THREE.MathUtils.clamp(next, current - maxStep, current + maxStep)
}

function smoothValue(current: number, target: number, speed: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-speed * delta))
}
