import * as THREE from 'three'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import { vehicleGroundHeight, type GroundSampleOffset } from '../../world/beauvais/roadway'
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
  /** Vitesse à laquelle le braquage rejoint l'intention du joueur. */
  STEER_RESPONSE: number
  /**
   * Adhérence latérale maxi, en g. Plafonne la rotation à haute vitesse :
   * au-delà, le véhicule sous-vire au lieu de pivoter comme une toupie.
   */
  MAX_LATERAL_G: number
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
}

const GRAVITY = 9.81

export function driveVehicle(
  group: THREE.Group,
  k: KeyboardState,
  state: VehicleDriveState,
  config: VehicleDriveConfig,
  delta: number,
) {
  // --- Repère du véhicule : avant (u) et droite (r) ---
  const ux = Math.sin(group.rotation.y)
  const uz = Math.cos(group.rotation.y)
  const rx = Math.cos(group.rotation.y)
  const rz = -Math.sin(group.rotation.y)

  // On décompose la vitesse : ce qui avance, et ce qui dérive sur le côté.
  let forward = state.vx * ux + state.vz * uz
  let lateral = state.vx * rx + state.vz * rz

  forward = applyLongitudinalForces(k, state, config, forward, delta)
  // L'adhérence mange la dérive. En exponentielle, pour que le comportement ne
  // dépende pas du nombre d'images par seconde.
  lateral *= Math.exp(-config.GRIP * delta)

  updateSteer(k, state, config, delta)
  const heading = turn(group, state, config, forward, delta)

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

  // --- Assiette : on suit la chaussée sous les 4 roues ---
  const offsets = wheelOffsets(group.rotation.y, config)
  const targetY = vehicleGroundHeight(group.position.x, group.position.z, offsets) + config.SEAT_HEIGHT
  state.groundY = smoothGroundY(state.groundY, targetY, delta)
  group.position.y = state.groundY
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
): number {
  const speed = Math.abs(forward)
  let force = 0

  if (k.forward) {
    if (forward < -0.5) {
      force = config.BRAKE_FORCE // on roulait en arrière : c'est un freinage
      state.rpm = 0
      state.gear = 1
    } else {
      const out = driveTrain(config.ENGINE, state.box, forward, config.WHEEL_RADIUS, true, delta)
      force = out.force
      state.rpm = out.rpm
      state.gear = out.gear
    }
  } else if (k.backward) {
    if (forward > 0.5) {
      force = -config.BRAKE_FORCE // on roulait en avant : c'est un freinage
    } else {
      force = -forward > config.REVERSE_SPEED ? 0 : -config.REVERSE_FORCE
    }
    state.rpm = 0
    state.gear = 1
  } else {
    // Pied levé : frein moteur, et la boîte continue de tourner à vide.
    const out = driveTrain(config.ENGINE, state.box, forward, config.WHEEL_RADIUS, false, delta)
    state.rpm = out.rpm
    state.gear = out.gear
    force = -Math.sign(forward) * config.ENGINE_BRAKE
  }

  // Résistances : l'air (en v²) et le roulement (constant). C'est leur équilibre
  // avec la poussée du dernier rapport qui FIXE la vitesse maxi — voir vehicleEngine.ts.
  force -= Math.sign(forward) * (config.DRAG * speed * speed + config.ROLL_RESIST * config.MASS * GRAVITY)

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
): number {
  const angle = state.steer * config.MAX_STEER_ANGLE
  let yawRate = (forward / config.WHEELBASE) * Math.tan(angle)

  const maxYawRate = (config.MAX_LATERAL_G * GRAVITY) / Math.max(Math.abs(forward), 1)
  yawRate = THREE.MathUtils.clamp(yawRate, -maxYawRate, maxYawRate)

  // Rotation résiduelle d'un choc, qui s'amortit toute seule.
  group.rotation.y += (yawRate + state.spin) * delta
  state.spin *= Math.exp(-config.SPIN_DAMP * delta)

  return group.rotation.y
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

/**
 * Les 4 points de CONTACT AU SOL (les roues), pour calculer l'assiette.
 *
 * ⚠️ Ce ne sont pas des points de collision : les murs sont gérés par la caisse
 * orientée (`moveBox`). Les roues sont un peu rentrées dans l'emprise, comme sur
 * un vrai véhicule.
 */
function wheelOffsets(rotationY: number, config: VehicleDriveConfig): GroundSampleOffset[] {
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
