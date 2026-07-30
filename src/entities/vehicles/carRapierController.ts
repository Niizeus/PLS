import type { RapierContext, RapierRigidBody } from '@react-three/rapier'
import type { World } from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { PHYSICS_GROUPS, PHYSICS_WORLD } from '../../gameplay/physics/physicsConfig'
import { drivableRoadHeightAt } from '../../world/beauvais/roadway'
import type { VehicleDriveConfig } from './vehicleDriving'
import { createGearboxState, driveTrain, type GearboxState } from './vehicleEngine'
import type { VehicleControlInput } from './carStore'
import { CAR_TIRE_CONTACTS, tireEffectsState } from './tireContactStore'

export const CAR_CHASSIS_CENTER_HEIGHT = 0.88
export const CAR_STATIC_SUSPENSION_RATIO = 0.42
const HALF_TRACK = 0.78
const SUSPENSION_MOUNT_Y = -0.31
const RAY_START_CLEARANCE = 0.22
const MAX_SPRING_FORCE_G = 4.2
const MAX_YAW_TORQUE = 34000
const LOW_SPEED_STEER_ASSIST_SPEED = 8
const LOW_SPEED_STEER_MIN_SPEED = 4.2
const PARKED_LINEAR_DAMPING = 14
const PARKED_ANGULAR_DAMPING = 18
const DRIVING_LINEAR_DAMPING = 0.015
const DRIVING_ANGULAR_DAMPING = 1.8
/** Glissement (m/s) au-delà duquel un pneu est considéré comme totalement décroché. */
const FULL_SLIP_SPEED = 6.5
/** Au-delà de ce roulis, la caisse est sur le flanc ou sur le toit. */
const FLIPPED_UP_DOT = 0.25
/** Vitesse en dessous de laquelle on autorise la remise sur les roues. */
const FLIP_RECOVERY_MAX_SPEED = 2.5
/** Plafond de rotation pendant un retournement manuel (rad/s). */
const FLIP_MAX_RATE = 2.4

interface WheelRay {
  localX: number
  localZ: number
  front: boolean
  compression: number
  hit: boolean
}

export interface RapierCarRuntime {
  box: GearboxState
  steer: number
  wheelSpin: number
  rpm: number
  gear: number
  speed: number
  frontSuspension: number
  rearSuspension: number
  /** Temps d'appui cumulé sur le frein à main, roues en l'air (s). */
  flipHold: number
  /** Adhérence arrière courante, 0-1. Sert au HUD et aux effets de pneus. */
  rearGrip: number
  /** Vrai quand aucune roue ne touche : le joueur pilote alors en l'air. */
  airborne: boolean
}

export interface RapierCarSnapshot {
  x: number
  y: number
  z: number
  rot: number
  driverX: number
  driverY: number
  driverZ: number
  pitch: number
  roll: number
  steer: number
  wheelSpin: number
  frontSuspension: number
  rearSuspension: number
  speed: number
  velocityX: number
  velocityY: number
  velocityZ: number
  rpm: number
  gear: number
}

const tmpPos = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const forward = new THREE.Vector3()
const right = new THREE.Vector3()
const up = new THREE.Vector3()
const anchor = new THREE.Vector3()
const rayOrigin = new THREE.Vector3()
const rayDir = new THREE.Vector3()
const force = new THREE.Vector3()
const rel = new THREE.Vector3()
const pointVelocity = new THREE.Vector3()
const angularVelocity = new THREE.Vector3()
const linearVelocity = new THREE.Vector3()
const driver = new THREE.Vector3()
const axlePoint = new THREE.Vector3()
const scratch = new THREE.Vector3()
const WORLD_UP = new THREE.Vector3(0, 1, 0)

export function createRapierCarRuntime(): RapierCarRuntime {
  return {
    box: createGearboxState(),
    steer: 0,
    wheelSpin: 0,
    rpm: 800,
    gear: 1,
    speed: 0,
    frontSuspension: 0,
    rearSuspension: 0,
    flipHold: 0,
    rearGrip: 1,
    airborne: false,
  }
}

export function resetRapierCarRuntime(state: RapierCarRuntime) {
  state.box.gear = 0
  state.box.shiftTimer = 0
  state.steer = 0
  state.wheelSpin = 0
  state.rpm = 800
  state.gear = 1
  state.speed = 0
  state.frontSuspension = 0
  state.rearSuspension = 0
  state.flipHold = 0
  state.rearGrip = 1
  state.airborne = false
}

export function parkRapierCar(
  body: RapierRigidBody,
  x: number,
  z: number,
  rot: number,
  groundY: number,
  runtime: RapierCarRuntime,
) {
  tmpQuat.setFromEuler(tmpEuler.set(0, rot, 0))
  body.setTranslation({ x, y: groundY + CAR_CHASSIS_CENTER_HEIGHT, z }, true)
  body.setRotation({ x: tmpQuat.x, y: tmpQuat.y, z: tmpQuat.z, w: tmpQuat.w }, true)
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  body.setLinearDamping(PARKED_LINEAR_DAMPING)
  body.setAngularDamping(PARKED_ANGULAR_DAMPING)
  body.resetForces(true)
  body.resetTorques(true)
  resetRapierCarRuntime(runtime)
}

/**
 * Un pas de conduite complet.
 *
 * L'ordre compte : suspensions (elles disent quelles roues touchent) → moteur et
 * freins → adhérence par essieu → rappel de trajectoire → contrôle aérien.
 */
export function applyRapierCarForces(
  body: RapierRigidBody,
  world: World,
  rapier: RapierContext['rapier'],
  controls: VehicleControlInput,
  config: VehicleDriveConfig,
  runtime: RapierCarRuntime,
  dt: number,
  limiter: { active: boolean; speed: number },
) {
  body.setLinearDamping(DRIVING_LINEAR_DAMPING)
  body.setAngularDamping(DRIVING_ANGULAR_DAMPING)
  body.resetForces(true)
  body.resetTorques(true)

  readBodyFrame(body)
  const speedForward = linearVelocity.dot(forward)
  const speedSide = linearVelocity.dot(right)
  const grounded = applySuspension(body, world, rapier, config, runtime)
  const contactRatio = grounded / 4
  const driveContactRatio = grounded > 0 ? Math.max(0.6, contactRatio) : 0
  const airborne = grounded === 0

  runtime.steer = THREE.MathUtils.damp(
    runtime.steer,
    (controls.left ? 1 : 0) - (controls.right ? 1 : 0),
    config.STEER_RESPONSE,
    dt,
  )

  // Frein à main : l'arrière perd la majeure partie de son adhérence, ce qui
  // suffit à faire naître le survirage tout seul (voir applyAxleGrip).
  const handbrake = controls.handbrake && !airborne
  const surfaceGrip = averageSurfaceGrip(config)
  // ⚠️ `rearGrip` est un ÉQUILIBRE avant/arrière, pas une adhérence absolue :
  // l'effet du sol est déjà appliqué une fois dans `applyAxleGrip`. Le remettre
  // ici le compterait deux fois (et la terre deviendrait une patinoire).
  runtime.rearGrip = handbrake ? config.HANDBRAKE_REAR_GRIP : 1

  if (driveContactRatio > 0) {
    applyDriveForces(body, controls, config, runtime, speedForward, driveContactRatio, dt, limiter)
    if (handbrake) applyHandbrake(body, config, speedForward, contactRatio)
  }
  if (contactRatio > 0) {
    applyAxleGrip(body, config, speedForward, speedSide, contactRatio, runtime.rearGrip, surfaceGrip)
    applySteeringTorque(
      body,
      config,
      runtime.steer * config.MAX_STEER_ANGLE,
      speedForward,
      contactRatio,
      handbrake ? config.DRIFT_STEER_AUTHORITY : 1,
    )
  }

  runtime.airborne = airborne
  // ⚠️ Sur le toit, AUCUN rayon de suspension ne touche (ils partent vers le
  // ciel) : la voiture est donc « en l'air » au sens du code alors qu'elle est
  // posée. Le rétablissement doit donc être testé AVANT le contrôle aérien,
  // sinon on ne pourrait jamais se remettre sur ses roues.
  const upsideDown = up.y < FLIPPED_UP_DOT
  const nearlyStopped = linearVelocity.lengthSq() < FLIP_RECOVERY_MAX_SPEED * FLIP_RECOVERY_MAX_SPEED
  if (upsideDown && nearlyStopped) {
    // Deux façons de s'en sortir, qui cohabitent : les flèches font ROULER la
    // caisse (on se débat, c'est plus vivant), le frein à main maintenu la
    // repose d'aplomb (dépannage garanti si on est coincé contre un mur).
    applyFlipTorque(body, controls, config)
    applyFlipRecovery(body, controls, config, runtime, dt)
  } else {
    runtime.flipHold = 0
    if (airborne) applyAirControl(body, controls, config)
  }

  publishTireContacts(controls, speedForward)

  runtime.speed = speedForward
  runtime.wheelSpin += (speedForward / Math.max(config.WHEEL_RADIUS, 0.01)) * dt
}

export function snapshotRapierCar(body: RapierRigidBody, runtime: RapierCarRuntime, config: VehicleDriveConfig) {
  readBodyFrame(body)
  tmpEuler.setFromQuaternion(tmpQuat, 'YXZ')
  driver.copy(tmpPos).addScaledVector(up, config.SEAT_HEIGHT - CAR_CHASSIS_CENTER_HEIGHT)

  return {
    x: tmpPos.x,
    y: tmpPos.y,
    z: tmpPos.z,
    rot: tmpEuler.y,
    driverX: driver.x,
    driverY: driver.y,
    driverZ: driver.z,
    pitch: tmpEuler.x,
    roll: tmpEuler.z,
    steer: runtime.steer * config.MAX_STEER_ANGLE,
    wheelSpin: runtime.wheelSpin,
    frontSuspension: runtime.frontSuspension,
    rearSuspension: runtime.rearSuspension,
    speed: runtime.speed,
    velocityX: linearVelocity.x,
    velocityY: linearVelocity.y,
    velocityZ: linearVelocity.z,
    rpm: runtime.rpm,
    gear: runtime.gear,
  } satisfies RapierCarSnapshot
}

export function syncCarVisualFromBody(visual: THREE.Group, body: RapierRigidBody) {
  readBodyFrame(body)
  visual.position.copy(tmpPos).addScaledVector(up, -CAR_CHASSIS_CENTER_HEIGHT)
  visual.quaternion.copy(tmpQuat)
}

function readBodyFrame(body: RapierRigidBody) {
  const pos = body.translation()
  const rot = body.rotation()
  const linvel = body.linvel()
  const angvel = body.angvel()
  tmpPos.set(pos.x, pos.y, pos.z)
  tmpQuat.set(rot.x, rot.y, rot.z, rot.w)
  forward.set(0, 0, 1).applyQuaternion(tmpQuat).normalize()
  right.set(1, 0, 0).applyQuaternion(tmpQuat).normalize()
  up.set(0, 1, 0).applyQuaternion(tmpQuat).normalize()
  linearVelocity.set(linvel.x, linvel.y, linvel.z)
  angularVelocity.set(angvel.x, angvel.y, angvel.z)
}

function applySuspension(
  body: RapierRigidBody,
  world: World,
  rapier: RapierContext['rapier'],
  config: VehicleDriveConfig,
  runtime: RapierCarRuntime,
) {
  world.updateSceneQueries()
  const wheels: WheelRay[] = [
    { localX: -HALF_TRACK, localZ: config.WHEELBASE * 0.5, front: true, compression: 0, hit: false },
    { localX: HALF_TRACK, localZ: config.WHEELBASE * 0.5, front: true, compression: 0, hit: false },
    { localX: -HALF_TRACK, localZ: -config.WHEELBASE * 0.5, front: false, compression: 0, hit: false },
    { localX: HALF_TRACK, localZ: -config.WHEELBASE * 0.5, front: false, compression: 0, hit: false },
  ]

  const restDistance = RAY_START_CLEARANCE + config.SUSPENSION_TRAVEL + config.WHEEL_RADIUS
  const spring =
    (config.MASS * Math.abs(PHYSICS_WORLD.GRAVITY[1])) /
    (4 * config.SUSPENSION_TRAVEL * CAR_STATIC_SUSPENSION_RATIO)
  const damper = spring * 0.18
  const maxSpringForce = config.MASS * Math.abs(PHYSICS_WORLD.GRAVITY[1]) * MAX_SPRING_FORCE_G
  let grounded = 0
  let frontCompression = 0
  let frontHits = 0
  let rearCompression = 0
  let rearHits = 0

  for (let i = 0; i < wheels.length; i++) {
    const wheel = wheels[i]
    const contact = CAR_TIRE_CONTACTS[i]
    contact.grounded = false

    anchor
      .copy(tmpPos)
      .addScaledVector(right, wheel.localX)
      .addScaledVector(forward, wheel.localZ)
      .addScaledVector(up, SUSPENSION_MOUNT_Y)
    rayOrigin.copy(anchor).addScaledVector(up, RAY_START_CLEARANCE)
    rayDir.copy(up).multiplyScalar(-1)

    const ray = new rapier.Ray(rayOrigin, rayDir)
    const hit = world.castRay(ray, restDistance, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, PHYSICS_GROUPS.vehicle)
    if (!hit) continue

    const compression = Math.max(0, restDistance - hit.timeOfImpact)
    if (compression <= 0) continue

    rel.copy(anchor).sub(tmpPos)
    pointVelocity.copy(linearVelocity).add(crossInto(angularVelocity, rel, force))
    const verticalVelocity = pointVelocity.dot(up)
    const springForce = THREE.MathUtils.clamp(compression * spring - verticalVelocity * damper, 0, maxSpringForce)
    force.copy(up).multiplyScalar(springForce)
    body.addForceAtPoint(force, anchor, true)

    // Point de contact réel : c'est là que partiront fumée et traces.
    contact.grounded = true
    contact.point.copy(rayOrigin).addScaledVector(rayDir, hit.timeOfImpact)
    contact.normal.copy(up)
    // Vitesse de la gomme, décomposée dans le repère du véhicule. C'est la VRAIE
    // information de contact demandée par les effets : pas une estimation.
    contact.slipSide = pointVelocity.dot(right)
    contact.slipForward = pointVelocity.dot(forward)
    contact.surface = surfaceAt(contact.point.x, contact.point.z)

    wheel.hit = true
    wheel.compression = compression
    grounded++
    if (wheel.front) {
      frontCompression += compression
      frontHits++
    } else {
      rearCompression += compression
      rearHits++
    }
  }

  runtime.frontSuspension = frontHits > 0 ? frontCompression / frontHits : 0
  runtime.rearSuspension = rearHits > 0 ? rearCompression / rearHits : 0
  return grounded
}

/** Bitume ou pas : décide de l'adhérence ET de la couleur des particules. */
function surfaceAt(x: number, z: number): 'road' | 'offroad' {
  return drivableRoadHeightAt(x, z) === -Infinity ? 'offroad' : 'road'
}

/** Adhérence moyenne sous les roues qui touchent (1 = bitume). */
function averageSurfaceGrip(config: VehicleDriveConfig): number {
  let total = 0
  let count = 0
  for (const contact of CAR_TIRE_CONTACTS) {
    if (!contact.grounded) continue
    total += contact.surface === 'road' ? config.SURFACE_GRIP_ROAD : config.SURFACE_GRIP_OFFROAD
    count++
  }
  return count > 0 ? total / count : config.SURFACE_GRIP_ROAD
}

function applyDriveForces(
  body: RapierRigidBody,
  controls: VehicleControlInput,
  config: VehicleDriveConfig,
  runtime: RapierCarRuntime,
  speedForward: number,
  contactRatio: number,
  dt: number,
  limiter: { active: boolean; speed: number },
) {
  const engine = driveTrain(config.ENGINE, runtime.box, speedForward, config.WHEEL_RADIUS, controls.forward, dt)
  runtime.rpm = engine.rpm
  runtime.gear = engine.gear

  // 🚦 LIMITEUR (touche A) : on referme les gaz sur une bande, on ne coupe pas
  // net. À `limiterSpeed - LIMITER_FADE_SPEED` la poussée est encore pleine, à
  // `limiterSpeed` elle est nulle — d'où une arrivée en douceur sur le plafond.
  // ⚠️ Le limiteur ne touche QUE la poussée moteur : freins, marche arrière et
  // frein moteur restent entiers, sinon on ne pourrait plus ralentir.
  let driveForce = engine.force
  if (limiter.active && driveForce > 0 && speedForward > 0) {
    driveForce *= 1 - THREE.MathUtils.smoothstep(
      speedForward,
      limiter.speed - Math.max(0.1, config.LIMITER_FADE_SPEED),
      limiter.speed,
    )
  }

  if (controls.backward) {
    if (speedForward > 0.8) driveForce -= config.BRAKE_FORCE
    else driveForce -= config.REVERSE_FORCE * (1 - Math.min(Math.abs(speedForward) / config.REVERSE_SPEED, 1))
  } else if (!controls.forward && Math.abs(speedForward) > 0.5) {
    driveForce -= Math.sign(speedForward) * config.ENGINE_BRAKE
  }

  const drag = -Math.sign(speedForward) * config.DRAG * speedForward * speedForward
  const rolling =
    Math.abs(speedForward) > 0.15
      ? -Math.sign(speedForward) * config.ROLL_RESIST * config.MASS * Math.abs(PHYSICS_WORLD.GRAVITY[1])
      : 0
  const total = THREE.MathUtils.clamp((driveForce + drag + rolling) * contactRatio, -config.BRAKE_FORCE, config.MASS * 12)
  force.copy(forward).multiplyScalar(total)
  body.addForce(force, true)
}

/**
 * 🅿️ Frein à main : freinage appliqué AU POINT de l'essieu arrière.
 *
 * Le point d'application compte : freiner l'arrière seul crée un petit couple
 * qui aide la caisse à pivoter, exactement comme dans la vraie vie.
 */
function applyHandbrake(
  body: RapierRigidBody,
  config: VehicleDriveConfig,
  speedForward: number,
  contactRatio: number,
) {
  if (Math.abs(speedForward) < 0.2) return
  const brake = -Math.sign(speedForward) * config.HANDBRAKE_FORCE * contactRatio
  axlePoint.copy(tmpPos).addScaledVector(forward, -config.WHEELBASE * 0.5)
  force.copy(forward).multiplyScalar(brake)
  body.addForceAtPoint(force, axlePoint, true)
}

/**
 * 🛞 ADHÉRENCE LATÉRALE, ESSIEU PAR ESSIEU.
 *
 * ## Pourquoi ce n'est plus une seule force au centre de gravité
 *
 * Avant, toute l'adhérence était appliquée au centre : la voiture ne pouvait
 * donc PAS survirer, puisqu'une force au centre ne fait jamais tourner. Le
 * frein à main n'aurait été qu'un frein.
 *
 * Maintenant la même force totale est répartie moitié avant / moitié arrière et
 * appliquée AUX ESSIEUX. Sans frein à main, les deux moitiés se compensent : le
 * couple résultant est nul et le comportement est **identique à avant**. Dès que
 * l'arrière perd de l'adhérence (`rearGrip < 1`), le déséquilibre crée un couple
 * de lacet — le survirage apparaît tout seul, sans le scripter.
 */
function applyAxleGrip(
  body: RapierRigidBody,
  config: VehicleDriveConfig,
  speedForward: number,
  speedSide: number,
  contactRatio: number,
  rearBalance: number,
  surfaceGrip: number,
) {
  const speedKmh = Math.abs(speedForward) * 3.6
  const assist = THREE.MathUtils.smoothstep(speedKmh, 45, 150) * config.STEER_ASSIST_G
  // Le sol n'intervient QU'ICI : une seule fois, sur l'adhérence disponible.
  const maxLatForce =
    (config.MAX_LATERAL_G + assist) * config.MASS * Math.abs(PHYSICS_WORLD.GRAVITY[1]) * contactRatio * surfaceGrip
  const lateralForce = THREE.MathUtils.clamp(
    -speedSide * config.MASS * config.GRIP * contactRatio * surfaceGrip,
    -maxLatForce,
    maxLatForce,
  )

  // `rearBalance` vaut 1 hors frein à main : les deux moitiés sont alors
  // strictement égales, leurs couples s'annulent, et le comportement est
  // exactement celui d'avant la répartition par essieu.
  const halfBase = config.WHEELBASE * 0.5
  axlePoint.copy(tmpPos).addScaledVector(forward, halfBase)
  force.copy(right).multiplyScalar(lateralForce * 0.5)
  body.addForceAtPoint(force, axlePoint, true)

  axlePoint.copy(tmpPos).addScaledVector(forward, -halfBase)
  force.copy(right).multiplyScalar(lateralForce * 0.5 * rearBalance)
  body.addForceAtPoint(force, axlePoint, true)
}

function applySteeringTorque(
  body: RapierRigidBody,
  config: VehicleDriveConfig,
  steerAngle: number,
  speedForward: number,
  contactRatio: number,
  authority: number,
) {
  const speedAbs = Math.abs(speedForward)
  const lowSpeedBlend = 1 - THREE.MathUtils.smoothstep(speedAbs, 0.25, LOW_SPEED_STEER_ASSIST_SPEED)
  const assistedSpeed =
    speedAbs > 0.25
      ? Math.sign(speedForward) * Math.max(speedAbs, LOW_SPEED_STEER_MIN_SPEED * lowSpeedBlend)
      : 0
  const speedFactor = THREE.MathUtils.clamp(Math.abs(assistedSpeed) / 14, 0.35, 1)
  const targetYawRate = (assistedSpeed / config.WHEELBASE) * Math.tan(steerAngle) * speedFactor
  const currentYawRate = angularVelocity.y
  // `authority` < 1 pendant un drift : sans ça, cet asservissement remettrait la
  // voiture droite instantanément et le frein à main ne servirait à rien.
  const torqueY = THREE.MathUtils.clamp(
    (targetYawRate - currentYawRate) * config.MASS * config.WHEELBASE * 3.2 * contactRatio * authority,
    -MAX_YAW_TORQUE,
    MAX_YAW_TORQUE,
  )
  body.addTorque({ x: 0, y: torqueY, z: 0 }, true)
}

/**
 * ✈️ CONTRÔLE EN L'AIR.
 *
 * Roues décollées, ZQSD ne conduit plus : Z/S piquent ou cabrent, Q/D font
 * tourner la caisse sur son axe. On travaille en **vitesse de rotation cible**
 * plutôt qu'en couple libre : c'est ce qui rend le contrôle réactif tout en
 * gardant un plafond (`AIR_MAX_RATE`), donc pas de vrille infinie.
 *
 * Sans consigne, une aide douce ramène l'assiette à plat — assez pour rattraper
 * un saut mal négocié, pas assez pour annuler une figure voulue.
 */
function applyAirControl(body: RapierRigidBody, controls: VehicleControlInput, config: VehicleDriveConfig) {
  const pitchInput = airPitchInput(controls)
  const rollInput = airRollInput(controls)

  // Rotations actuelles projetées sur les axes PROPRES de la caisse : le joueur
  // doit cabrer par rapport à la voiture, pas par rapport au monde.
  const pitchRate = angularVelocity.dot(right)
  const rollRate = angularVelocity.dot(forward)

  applyRateTorque(body, right, pitchRate, pitchInput * config.AIR_MAX_RATE, config.AIR_PITCH_TORQUE, config)
  applyRateTorque(body, forward, rollRate, rollInput * config.AIR_MAX_RATE, config.AIR_ROLL_TORQUE, config)

  // Aide au rétablissement : uniquement quand le joueur ne demande rien, sinon
  // elle se battrait contre la figure qu'il est en train de faire.
  if (pitchInput === 0 && rollInput === 0) {
    // Axe le plus court pour ramener le toit de la caisse vers le ciel : up × Y.
    scratch.copy(up).cross(WORLD_UP)
    force.copy(scratch).multiplyScalar((1 - up.y) * config.AIR_LEVEL_ASSIST * config.MASS)
    body.addTorque({ x: force.x, y: force.y, z: force.z }, true)
  }
}

/**
 * Sens des commandes en l'air — UNE seule convention, partagée par le vol et par
 * le retournement sur le toit, pour ne pas avoir à réapprendre selon la situation.
 *
 * Avant/arrière : **avant pique du nez, arrière cabre** (comme un manche à
 * balai qu'on pousse). Gauche/droite : **la touche fait tomber la caisse de ce
 * côté-là** — on appuie sur le côté vers lequel on veut basculer.
 */
function airPitchInput(controls: VehicleControlInput): number {
  return (controls.backward ? 1 : 0) - (controls.forward ? 1 : 0)
}

function airRollInput(controls: VehicleControlInput): number {
  return (controls.right ? 1 : 0) - (controls.left ? 1 : 0)
}

/** Pousse une vitesse de rotation vers sa cible autour d'un axe donné. */
function applyRateTorque(
  body: RapierRigidBody,
  axis: THREE.Vector3,
  currentRate: number,
  targetRate: number,
  gain: number,
  config: VehicleDriveConfig,
) {
  force.copy(axis).multiplyScalar((targetRate - currentRate) * gain * config.MASS)
  body.addTorque({ x: force.x, y: force.y, z: force.z }, true)
}

/**
 * 🤸 SE DÉBATTRE SUR LE TOIT.
 *
 * Sur le toit, les rayons de suspension partent vers le ciel : plus aucune roue
 * ne touche, donc ni le moteur ni la direction ne répondent — on restait planté
 * là. Les flèches appliquent maintenant un couple directement sur la caisse pour
 * la faire ROULER et la remettre à l'endroit.
 *
 * `FLIP_TORQUE` doit dépasser le couple de rappel de la gravité (≈ poids × demi-
 * largeur, soit ~11 000 N·m pour cette voiture), sinon la caisse se contente de
 * frémir. Même convention de touches qu'en vol (voir `airRollInput`).
 */
function applyFlipTorque(body: RapierRigidBody, controls: VehicleControlInput, config: VehicleDriveConfig) {
  const rollInput = airRollInput(controls)
  const pitchInput = airPitchInput(controls)
  if (rollInput === 0 && pitchInput === 0) return

  const rollRate = angularVelocity.dot(forward)
  const pitchRate = angularVelocity.dot(right)
  applyRateTorque(body, forward, rollRate, rollInput * FLIP_MAX_RATE, config.FLIP_TORQUE, config)
  // Le tangage aide surtout quand la voiture est calée nez ou cul en l'air ;
  // moitié moins fort, parce qu'une caisse bascule bien plus mal dans ce sens.
  applyRateTorque(body, right, pitchRate, pitchInput * FLIP_MAX_RATE, config.FLIP_TORQUE * 0.5, config)
}

/**
 * 🔄 REMISE SUR LES ROUES.
 *
 * Sur le toit ou sur le flanc, à l'arrêt : maintenir le frein à main pendant
 * `FLIP_RECOVERY_HOLD` secondes redresse la voiture. On la repose à plat au même
 * endroit plutôt que de la catapulter — c'est un dépannage, pas une cascade.
 */
function applyFlipRecovery(
  body: RapierRigidBody,
  controls: VehicleControlInput,
  config: VehicleDriveConfig,
  runtime: RapierCarRuntime,
  dt: number,
) {
  if (!controls.handbrake) {
    runtime.flipHold = 0
    return
  }

  runtime.flipHold += dt
  if (runtime.flipHold < config.FLIP_RECOVERY_HOLD) return

  runtime.flipHold = 0
  tmpEuler.setFromQuaternion(tmpQuat, 'YXZ')
  tmpQuat.setFromEuler(tmpEuler.set(0, tmpEuler.y, 0))
  body.setRotation({ x: tmpQuat.x, y: tmpQuat.y, z: tmpQuat.z, w: tmpQuat.w }, true)
  body.setTranslation({ x: tmpPos.x, y: tmpPos.y + 0.6, z: tmpPos.z }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
}

/** Normalise le glissement de chaque roue pour les effets visuels. */
function publishTireContacts(controls: VehicleControlInput, speedForward: number) {
  tireEffectsState.active = true
  tireEffectsState.speed = speedForward
  tireEffectsState.handbrake = controls.handbrake

  for (const contact of CAR_TIRE_CONTACTS) {
    if (!contact.grounded) {
      contact.slipAmount = 0
      continue
    }
    // Frein à main : les roues arrière sont bloquées, donc elles ripent de tout
    // ce que la voiture avance — la fumée doit le refléter même en ligne droite.
    const lockedSlip = controls.handbrake && !contact.front ? Math.abs(speedForward) : 0
    const slip = Math.hypot(contact.slipSide, lockedSlip)
    contact.slipAmount = THREE.MathUtils.clamp(slip / FULL_SLIP_SPEED, 0, 1)
  }
}

function crossInto(a: THREE.Vector3, b: THREE.Vector3, target: THREE.Vector3) {
  const x = a.y * b.z - a.z * b.y
  const y = a.z * b.x - a.x * b.z
  const z = a.x * b.y - a.y * b.x
  return target.set(x, y, z)
}
