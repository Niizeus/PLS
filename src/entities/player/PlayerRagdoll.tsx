import { useMemo, useRef, type RefObject } from 'react'
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  useSphericalJoint,
  type RapierRigidBody,
} from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { useFBX } from '@react-three/drei'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { PHYSICS_LAYER } from '../../gameplay/physics/physicsConfig'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { groundHeight } from '../../world/beauvais/roadway'
import { getPlayerTuning } from '../../devtools/devTuningStore'
import { toonFromImported } from '../../shaders/toonMaterial'

const MODEL_URL = '/models/pierrot/idle.fbx'
const TARGET_HEIGHT = 1.75
const RAGDOLL_GROUP = interactionGroups(PHYSICS_LAYER.PROP, [
  PHYSICS_LAYER.WORLD,
  PHYSICS_LAYER.VEHICLE,
])
const DIAGNOSTIC_FIXED_BODIES = false
const DIAGNOSTIC_SHOW_COLLIDERS = true

type RagdollBodyKey =
  | 'pelvis'
  | 'torso'
  | 'head'
  | 'leftArm'
  | 'rightArm'
  | 'leftForearm'
  | 'rightForearm'
  | 'leftThigh'
  | 'rightThigh'
  | 'leftCalf'
  | 'rightCalf'

type RagdollBodies = Record<RagdollBodyKey, RefObject<RapierRigidBody>>

interface BodyRig {
  center: THREE.Vector3
  rotation: THREE.Quaternion
  halfLength: number
  radius: number
  mass: number
  muscleStiffness: number
  muscleDamping: number
  maxMuscleVelocity: number
}

interface JointRig {
  childAnchor: [number, number, number]
  parentAnchor: [number, number, number]
}

interface BoneBinding {
  boneName: string
  bodyKey: RagdollBodyKey
  offset: THREE.Quaternion
}

interface RagdollRig {
  scale: number
  visualOffsetY: number
  bodies: Record<RagdollBodyKey, BodyRig>
  joints: {
    spine: JointRig
    neck: JointRig
    leftShoulder: JointRig
    rightShoulder: JointRig
    leftElbow: JointRig
    rightElbow: JointRig
    leftHip: JointRig
    rightHip: JointRig
    leftKnee: JointRig
    rightKnee: JointRig
  }
  bindings: BoneBinding[]
}

export default function PlayerRagdoll() {
  const source = useFBX(MODEL_URL)
  const rig = useMemo(() => createRagdollRig(source), [source])

  const pose = usePlayerStore.getState().ragdollPose
  const playerObject = usePlayerStore.getState().playerObject
  const x = pose?.x ?? playerObject?.position.x ?? 0
  const y = pose?.y ?? playerObject?.position.y ?? 1
  const z = pose?.z ?? playerObject?.position.z ?? 0
  const rot = pose?.rot ?? playerObject?.rotation.y ?? 0
  const inheritedVelocity = useMemo(() => new THREE.Vector3(pose?.vx ?? 0, pose?.vy ?? 0, pose?.vz ?? 0), [pose?.vx, pose?.vy, pose?.vz])
  const initialVelocityApplied = useRef(false)

  const pelvis = useRef<RapierRigidBody>(null)
  const torso = useRef<RapierRigidBody>(null)
  const head = useRef<RapierRigidBody>(null)
  const leftArm = useRef<RapierRigidBody>(null)
  const rightArm = useRef<RapierRigidBody>(null)
  const leftForearm = useRef<RapierRigidBody>(null)
  const rightForearm = useRef<RapierRigidBody>(null)
  const leftThigh = useRef<RapierRigidBody>(null)
  const rightThigh = useRef<RapierRigidBody>(null)
  const leftCalf = useRef<RapierRigidBody>(null)
  const rightCalf = useRef<RapierRigidBody>(null)
  const bodies: RagdollBodies = {
    pelvis,
    torso,
    head,
    leftArm,
    rightArm,
    leftForearm,
    rightForearm,
    leftThigh,
    rightThigh,
    leftCalf,
    rightCalf,
  }

  useSphericalJoint(torso, pelvis, [rig.joints.spine.childAnchor, rig.joints.spine.parentAnchor])
  useSphericalJoint(head, torso, [rig.joints.neck.childAnchor, rig.joints.neck.parentAnchor])
  useSphericalJoint(leftArm, torso, [rig.joints.leftShoulder.childAnchor, rig.joints.leftShoulder.parentAnchor])
  useSphericalJoint(rightArm, torso, [rig.joints.rightShoulder.childAnchor, rig.joints.rightShoulder.parentAnchor])
  useSphericalJoint(leftForearm, leftArm, [rig.joints.leftElbow.childAnchor, rig.joints.leftElbow.parentAnchor])
  useSphericalJoint(rightForearm, rightArm, [rig.joints.rightElbow.childAnchor, rig.joints.rightElbow.parentAnchor])
  useSphericalJoint(leftThigh, pelvis, [rig.joints.leftHip.childAnchor, rig.joints.leftHip.parentAnchor])
  useSphericalJoint(rightThigh, pelvis, [rig.joints.rightHip.childAnchor, rig.joints.rightHip.parentAnchor])
  useSphericalJoint(leftCalf, leftThigh, [rig.joints.leftKnee.childAnchor, rig.joints.leftKnee.parentAnchor])
  useSphericalJoint(rightCalf, rightThigh, [rig.joints.rightKnee.childAnchor, rig.joints.rightKnee.parentAnchor])

  useFrame(() => {
    if (!initialVelocityApplied.current && areBodiesReady(bodies)) {
      applyInitialRagdollVelocity(bodies, inheritedVelocity)
      initialVelocityApplied.current = true
    }
    const body = pelvis.current
    if (!body) return
    stabilizeRagdoll(bodies, rig, yaw)
    const t = body.translation()
    const recoveryY = groundHeight(t.x, t.z) + getPlayerTuning().BODY_HEIGHT
    usePlayerStore.getState().setRagdollPose({ x: t.x, y: recoveryY, z: t.z, rot })
  })

  const yaw = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), [rot])
  const origin = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z])

  return (
    <group>
      <RagdollPierrot source={source} rig={rig} bodies={bodies} origin={origin} yaw={yaw} />
      <Part refBody={pelvis} rig={rig.bodies.pelvis} origin={origin} yaw={yaw} />
      <Part refBody={torso} rig={rig.bodies.torso} origin={origin} yaw={yaw} />
      <Part refBody={head} rig={rig.bodies.head} origin={origin} yaw={yaw} />
      <Part refBody={leftArm} rig={rig.bodies.leftArm} origin={origin} yaw={yaw} />
      <Part refBody={rightArm} rig={rig.bodies.rightArm} origin={origin} yaw={yaw} />
      <Part refBody={leftForearm} rig={rig.bodies.leftForearm} origin={origin} yaw={yaw} />
      <Part refBody={rightForearm} rig={rig.bodies.rightForearm} origin={origin} yaw={yaw} />
      <Part refBody={leftThigh} rig={rig.bodies.leftThigh} origin={origin} yaw={yaw} />
      <Part refBody={rightThigh} rig={rig.bodies.rightThigh} origin={origin} yaw={yaw} />
      <Part refBody={leftCalf} rig={rig.bodies.leftCalf} origin={origin} yaw={yaw} />
      <Part refBody={rightCalf} rig={rig.bodies.rightCalf} origin={origin} yaw={yaw} />
    </group>
  )
}

function RagdollPierrot({
  source,
  rig,
  bodies,
  origin,
  yaw,
}: {
  source: THREE.Group
  rig: RagdollRig
  bodies: RagdollBodies
  origin: THREE.Vector3
  yaw: THREE.Quaternion
}) {
  const root = useRef<THREE.Group>(null)

  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(source) as THREE.Group
    clone.updateMatrixWorld(true)
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => toonFromImported(material))
        : toonFromImported(mesh.material)
    })
    return clone
  }, [source])

  const bones = useMemo(() => {
    const byName = new Map<string, THREE.Bone>()
    model.traverse((object) => {
      const bone = object as THREE.Bone
      if (bone.isBone) byName.set(bone.name, bone)
    })
    return byName
  }, [model])

  useFrame(() => {
    const visualRoot = root.current
    if (!visualRoot) return

    if (DIAGNOSTIC_FIXED_BODIES) {
      visualRoot.position.copy(origin)
      visualRoot.quaternion.copy(yaw)
      visualRoot.updateMatrixWorld(true)
      return
    }

    const pelvis = bodies.pelvis.current
    if (!pelvis || !areBodiesReady(bodies)) return

    const pelvisBody = rig.bodies.pelvis
    const pelvisRotation = rapierRotationToQuaternion(pelvis.rotation())
    const rootRotation = pelvisRotation.clone().multiply(pelvisBody.rotation.clone().invert())
    const pelvisTranslation = rapierTranslationToVector(pelvis.translation())
    const rootPosition = pelvisTranslation.sub(pelvisBody.center.clone().applyQuaternion(rootRotation))

    visualRoot.position.copy(rootPosition)
    visualRoot.quaternion.copy(rootRotation)
    visualRoot.updateMatrixWorld(true)

    for (const binding of rig.bindings) {
      const bone = bones.get(binding.boneName)
      const body = bodies[binding.bodyKey].current
      if (!bone || !body) continue

      const targetWorld = rapierRotationToQuaternion(body.rotation()).multiply(binding.offset)
      const parentWorld = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion()
      bone.quaternion.copy(parentWorld.invert().multiply(targetWorld))
      bone.updateMatrixWorld(true)
    }
  })

  return (
    <group ref={root} position={vectorToTuple(origin)} quaternion={yaw}>
      <group position={[0, rig.visualOffsetY, 0]} scale={rig.scale}>
        <primitive object={model} />
      </group>
    </group>
  )
}

function createRagdollRig(source: THREE.Group): RagdollRig {
  // `idle.fbx` is also mounted by PlayerModel. Work on a detached clone so bone
  // world matrices stay in the FBX local space instead of inheriting the live player.
  const rigSource = SkeletonUtils.clone(source) as THREE.Group
  rigSource.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(rigSource)
  const height = Math.max(0.001, box.max.y - box.min.y)
  const scale = TARGET_HEIGHT / height
  const visualOffsetY = -getPlayerTuning().BODY_HEIGHT - box.min.y * scale

  const bone = (name: string) => {
    const found = rigSource.getObjectByName(name) as THREE.Bone | undefined
    if (!found?.isBone) throw new Error(`[PlayerRagdoll] Bone introuvable: ${name}`)
    return found
  }
  const point = (name: string) => bone(name).getWorldPosition(new THREE.Vector3()).multiplyScalar(scale).add(new THREE.Vector3(0, visualOffsetY, 0))
  const quat = (name: string) => bone(name).getWorldQuaternion(new THREE.Quaternion())

  const bodies = {
    pelvis: makeBody(point('mixamorigHips'), point('mixamorigSpine'), quat('mixamorigHips'), 0.18, 4.5, 4.2, 0.72, 4.5),
    torso: makeBody(point('mixamorigSpine'), point('mixamorigNeck'), quat('mixamorigSpine2'), 0.2, 7, 5.8, 0.78, 5.2),
    head: makeBody(point('mixamorigHead'), point('mixamorigHeadTop_End'), quat('mixamorigHead'), 0.13, 2.2, 4.8, 0.76, 4.2),
    leftArm: makeBody(point('mixamorigLeftArm'), point('mixamorigLeftForeArm'), quat('mixamorigLeftArm'), 0.07, 1.4, 1.6, 0.62, 3.4),
    rightArm: makeBody(point('mixamorigRightArm'), point('mixamorigRightForeArm'), quat('mixamorigRightArm'), 0.07, 1.4, 1.6, 0.62, 3.4),
    leftForearm: makeBody(point('mixamorigLeftForeArm'), point('mixamorigLeftHand'), quat('mixamorigLeftForeArm'), 0.06, 1.1, 1.15, 0.58, 3.2),
    rightForearm: makeBody(point('mixamorigRightForeArm'), point('mixamorigRightHand'), quat('mixamorigRightForeArm'), 0.06, 1.1, 1.15, 0.58, 3.2),
    leftThigh: makeBody(point('mixamorigLeftUpLeg'), point('mixamorigLeftLeg'), quat('mixamorigLeftUpLeg'), 0.085, 2.2, 2.3, 0.66, 3.8),
    rightThigh: makeBody(point('mixamorigRightUpLeg'), point('mixamorigRightLeg'), quat('mixamorigRightUpLeg'), 0.085, 2.2, 2.3, 0.66, 3.8),
    leftCalf: makeBody(point('mixamorigLeftLeg'), point('mixamorigLeftFoot'), quat('mixamorigLeftLeg'), 0.075, 1.7, 1.65, 0.62, 3.5),
    rightCalf: makeBody(point('mixamorigRightLeg'), point('mixamorigRightFoot'), quat('mixamorigRightLeg'), 0.075, 1.7, 1.65, 0.62, 3.5),
  } satisfies Record<RagdollBodyKey, BodyRig>

  const joints = {
    spine: sphericalJoint(bodies.torso, bodies.pelvis, point('mixamorigSpine')),
    neck: sphericalJoint(bodies.head, bodies.torso, point('mixamorigNeck')),
    leftShoulder: sphericalJoint(bodies.leftArm, bodies.torso, point('mixamorigLeftArm')),
    rightShoulder: sphericalJoint(bodies.rightArm, bodies.torso, point('mixamorigRightArm')),
    leftElbow: sphericalJoint(bodies.leftForearm, bodies.leftArm, point('mixamorigLeftForeArm')),
    rightElbow: sphericalJoint(bodies.rightForearm, bodies.rightArm, point('mixamorigRightForeArm')),
    leftHip: sphericalJoint(bodies.leftThigh, bodies.pelvis, point('mixamorigLeftUpLeg')),
    rightHip: sphericalJoint(bodies.rightThigh, bodies.pelvis, point('mixamorigRightUpLeg')),
    leftKnee: sphericalJoint(bodies.leftCalf, bodies.leftThigh, point('mixamorigLeftLeg')),
    rightKnee: sphericalJoint(bodies.rightCalf, bodies.rightThigh, point('mixamorigRightLeg')),
  }

  return {
    scale,
    visualOffsetY,
    bodies,
    joints,
    bindings: makeBindings(rigSource, bodies),
  }
}

function makeBody(
  start: THREE.Vector3,
  end: THREE.Vector3,
  rotation: THREE.Quaternion,
  radius: number,
  massScale: number,
  muscleStiffness: number,
  muscleDamping: number,
  maxMuscleVelocity: number,
): BodyRig {
  const length = Math.max(0.08, start.distanceTo(end))
  return {
    center: start.clone().lerp(end, 0.5),
    rotation: rotation.clone().normalize(),
    halfLength: length * 0.5,
    radius,
    mass: Math.max(0.15, length * radius * massScale),
    muscleStiffness,
    muscleDamping,
    maxMuscleVelocity,
  }
}

function applyInitialRagdollVelocity(
  bodies: RagdollBodies,
  inheritedVelocity: THREE.Vector3,
) {
  const tumble = {
    x: THREE.MathUtils.clamp(-inheritedVelocity.z * 0.18, -2.2, 2.2),
    y: THREE.MathUtils.clamp(inheritedVelocity.x * 0.08, -1.2, 1.2),
    z: THREE.MathUtils.clamp(inheritedVelocity.x * 0.18, -2.2, 2.2),
  }

  for (const key of Object.keys(bodies) as RagdollBodyKey[]) {
    const body = bodies[key].current
    if (!body) continue

    const weight = key === 'pelvis' || key === 'torso' ? 1 : key === 'head' ? 0.72 : 0.86
    body.setLinvel({
      x: inheritedVelocity.x,
      y: inheritedVelocity.y,
      z: inheritedVelocity.z,
    }, true)
    body.setAngvel({
      x: tumble.x * weight,
      y: tumble.y * weight,
      z: tumble.z * weight,
    }, true)
  }
}

function stabilizeRagdoll(bodies: RagdollBodies, rig: RagdollRig, yaw: THREE.Quaternion) {
  if (DIAGNOSTIC_FIXED_BODIES || !areBodiesReady(bodies)) return

  for (const key of Object.keys(bodies) as RagdollBodyKey[]) {
    const body = bodies[key].current
    if (!body) continue

    const bodyRig = rig.bodies[key]
    const targetRotation = yaw.clone().multiply(bodyRig.rotation)
    const currentRotation = rapierRotationToQuaternion(body.rotation()).normalize()
    const correction = targetRotation.multiply(currentRotation.invert()).normalize()
    if (correction.w < 0) {
      correction.x *= -1
      correction.y *= -1
      correction.z *= -1
      correction.w *= -1
    }

    const sinHalfAngle = Math.hypot(correction.x, correction.y, correction.z)
    if (sinHalfAngle < 0.0001) {
      dampBodyAngularVelocity(body, bodyRig.muscleDamping)
      continue
    }

    const angle = 2 * Math.atan2(sinHalfAngle, correction.w)
    const axis = new THREE.Vector3(
      correction.x / sinHalfAngle,
      correction.y / sinHalfAngle,
      correction.z / sinHalfAngle,
    )
    const desired = Math.min(bodyRig.maxMuscleVelocity, angle * bodyRig.muscleStiffness)
    const current = body.angvel()
    body.setAngvel({
      x: current.x * bodyRig.muscleDamping + axis.x * desired,
      y: current.y * bodyRig.muscleDamping + axis.y * desired,
      z: current.z * bodyRig.muscleDamping + axis.z * desired,
    }, true)
  }
}

function dampBodyAngularVelocity(body: RapierRigidBody, damping: number) {
  const current = body.angvel()
  body.setAngvel({
    x: current.x * damping,
    y: current.y * damping,
    z: current.z * damping,
  }, true)
}

function sphericalJoint(child: BodyRig, parent: BodyRig, worldPoint: THREE.Vector3): JointRig {
  return {
    childAnchor: anchorInBody(child, worldPoint),
    parentAnchor: anchorInBody(parent, worldPoint),
  }
}

function makeBindings(source: THREE.Group, bodies: Record<RagdollBodyKey, BodyRig>): BoneBinding[] {
  const bindings: BoneBinding[] = []
  const bodyForBone = (name: string): RagdollBodyKey | null => {
    if (name === 'mixamorigHips') return 'pelvis'
    if (name === 'mixamorigSpine' || name === 'mixamorigSpine1' || name === 'mixamorigSpine2') return 'torso'
    if (name === 'mixamorigNeck' || name === 'mixamorigHead') return 'head'
    if (name === 'mixamorigLeftShoulder') return 'torso'
    if (name === 'mixamorigRightShoulder') return 'torso'
    if (name === 'mixamorigLeftArm') return 'leftArm'
    if (name === 'mixamorigRightArm') return 'rightArm'
    if (name === 'mixamorigLeftForeArm' || name === 'mixamorigLeftHand') return 'leftForearm'
    if (name === 'mixamorigRightForeArm' || name === 'mixamorigRightHand') return 'rightForearm'
    if (name === 'mixamorigLeftUpLeg') return 'leftThigh'
    if (name === 'mixamorigRightUpLeg') return 'rightThigh'
    if (name === 'mixamorigLeftLeg' || name === 'mixamorigLeftFoot') return 'leftCalf'
    if (name === 'mixamorigRightLeg' || name === 'mixamorigRightFoot') return 'rightCalf'
    return null
  }

  source.traverse((object) => {
    const bone = object as THREE.Bone
    if (!bone.isBone) return
    const bodyKey = bodyForBone(bone.name)
    if (!bodyKey) return
    const boneWorld = bone.getWorldQuaternion(new THREE.Quaternion())
    bindings.push({
      boneName: bone.name,
      bodyKey,
      offset: bodies[bodyKey].rotation.clone().invert().multiply(boneWorld),
    })
  })
  return bindings
}

function anchorInBody(body: BodyRig, worldPoint: THREE.Vector3): [number, number, number] {
  return vectorToTuple(worldPoint.clone().sub(body.center).applyQuaternion(body.rotation.clone().invert()))
}

function Part({
  refBody,
  rig,
  origin,
  yaw,
}: {
  refBody: RefObject<RapierRigidBody>
  rig: BodyRig
  origin: THREE.Vector3
  yaw: THREE.Quaternion
}) {
  const position = rig.center.clone().applyQuaternion(yaw).add(origin)
  const rotation = yaw.clone().multiply(rig.rotation)
  return (
    <RigidBody
      ref={refBody}
      type={DIAGNOSTIC_FIXED_BODIES ? 'fixed' : 'dynamic'}
      colliders={false}
      position={vectorToTuple(position)}
      rotation={quaternionToEulerTuple(rotation)}
      canSleep
      ccd
      linearDamping={1.2}
      angularDamping={3.8}
      additionalSolverIterations={8}
      collisionGroups={RAGDOLL_GROUP}
      solverGroups={RAGDOLL_GROUP}
    >
      <CapsuleCollider
        args={[Math.max(0.02, rig.halfLength - rig.radius), rig.radius]}
        mass={rig.mass}
        friction={0.9}
        restitution={0.04}
        collisionGroups={RAGDOLL_GROUP}
        solverGroups={RAGDOLL_GROUP}
      />
      {import.meta.env.DEV && DIAGNOSTIC_SHOW_COLLIDERS ? (
        <mesh>
          <capsuleGeometry args={[rig.radius, Math.max(0.02, rig.halfLength * 2 - rig.radius * 2), 6, 12]} />
          <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.65} />
        </mesh>
      ) : null}
    </RigidBody>
  )
}

function areBodiesReady(bodies: RagdollBodies) {
  return Object.values(bodies).every((body) => body.current)
}

function rapierTranslationToVector(translation: { x: number; y: number; z: number }) {
  return new THREE.Vector3(translation.x, translation.y, translation.z)
}

function rapierRotationToQuaternion(rotation: { x: number; y: number; z: number; w: number }) {
  return new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
}

function vectorToTuple(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z]
}

function quaternionToEulerTuple(quaternion: THREE.Quaternion): [number, number, number] {
  const euler = new THREE.Euler().setFromQuaternion(quaternion.normalize(), 'XYZ')
  return [euler.x, euler.y, euler.z]
}
