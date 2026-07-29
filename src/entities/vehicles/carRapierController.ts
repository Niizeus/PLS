import type { RapierContext, RapierRigidBody } from '@react-three/rapier'
import type { World } from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { PHYSICS_GROUPS, PHYSICS_WORLD } from '../../gameplay/physics/physicsConfig'
import type { VehicleDriveConfig } from './vehicleDriving'
import { createGearboxState, driveTrain, type GearboxState } from './vehicleEngine'
import type { VehicleControlInput } from './carStore'

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

export function applyRapierCarForces(
  body: RapierRigidBody,
  world: World,
  rapier: RapierContext['rapier'],
  controls: VehicleControlInput,
  config: VehicleDriveConfig,
  runtime: RapierCarRuntime,
  dt: number,
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

  runtime.steer = THREE.MathUtils.damp(
    runtime.steer,
    (controls.left ? 1 : 0) - (controls.right ? 1 : 0),
    config.STEER_RESPONSE,
    dt,
  )

  if (driveContactRatio > 0) {
    applyDriveForces(body, controls, config, runtime, speedForward, driveContactRatio, dt)
  }
  if (contactRatio > 0) {
    applyGripForces(body, config, speedForward, speedSide, contactRatio)
    applySteeringTorque(body, config, runtime.steer * config.MAX_STEER_ANGLE, speedForward, contactRatio)
  }

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

  for (const wheel of wheels) {
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

function applyDriveForces(
  body: RapierRigidBody,
  controls: VehicleControlInput,
  config: VehicleDriveConfig,
  runtime: RapierCarRuntime,
  speedForward: number,
  contactRatio: number,
  dt: number,
) {
  const engine = driveTrain(config.ENGINE, runtime.box, speedForward, config.WHEEL_RADIUS, controls.forward, dt)
  runtime.rpm = engine.rpm
  runtime.gear = engine.gear

  let driveForce = engine.force
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

function applyGripForces(
  body: RapierRigidBody,
  config: VehicleDriveConfig,
  speedForward: number,
  speedSide: number,
  contactRatio: number,
) {
  const speedKmh = Math.abs(speedForward) * 3.6
  const assist = THREE.MathUtils.smoothstep(speedKmh, 45, 150) * config.STEER_ASSIST_G
  const maxLatForce = (config.MAX_LATERAL_G + assist) * config.MASS * Math.abs(PHYSICS_WORLD.GRAVITY[1]) * contactRatio
  const lateralForce = THREE.MathUtils.clamp(-speedSide * config.MASS * config.GRIP * contactRatio, -maxLatForce, maxLatForce)
  force.copy(right).multiplyScalar(lateralForce)
  body.addForce(force, true)
}

function applySteeringTorque(
  body: RapierRigidBody,
  config: VehicleDriveConfig,
  steerAngle: number,
  speedForward: number,
  contactRatio: number,
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
  const torqueY = THREE.MathUtils.clamp(
    (targetYawRate - currentYawRate) * config.MASS * config.WHEELBASE * 3.2 * contactRatio,
    -MAX_YAW_TORQUE,
    MAX_YAW_TORQUE,
  )
  body.addTorque({ x: 0, y: torqueY, z: 0 }, true)
}

function crossInto(a: THREE.Vector3, b: THREE.Vector3, target: THREE.Vector3) {
  const x = a.y * b.z - a.z * b.y
  const y = a.z * b.x - a.x * b.z
  const z = a.x * b.y - a.y * b.x
  return target.set(x, y, z)
}
