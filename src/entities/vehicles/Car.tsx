import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Outlines, useFBX } from '@react-three/drei'
import { CuboidCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { toonFromImported } from '../../shaders/toonMaterial'
import { PHYSICS_GROUPS, PHYSICS_MATERIAL } from '../../gameplay/physics/physicsConfig'
import { getVehicleTuning } from '../../devtools/devTuningStore'
import { driveSurfaceHeightAt } from '../../gameplay/physics/physicsSurface'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { CAR, CAR_COLORS } from './carConfig'
import { useCarStore, type VehicleControlInput } from './carStore'
import CarHeadlights from './CarHeadlights'
import TireEffects from './TireEffects'
import { resetTireContacts } from './tireContactStore'
import { moveHorn, playHorn, setHornListener, stopHorn, updateHorn } from './vehicleHorn'
import { FRAME } from '../../core/framePriority'
import {
  applyRapierCarForces,
  CAR_CHASSIS_CENTER_HEIGHT,
  CAR_STATIC_SUSPENSION_RATIO,
  createRapierCarRuntime,
  parkRapierCar,
  type RapierCarSnapshot,
  snapshotRapierCar,
  syncCarVisualFromBody,
} from './carRapierController'

const CAR_MODEL_URL = '/models/Vehicule/Voiture/Chevrolet.fbx'
const CAR_MODEL_SCALE = 0.01
const RAW_UNITS_PER_METER = 1 / CAR_MODEL_SCALE
const CAR_MODEL_GROUND_LIFT = 0.635
/**
 * 🚘 LES MAILLAGES DU FBX. Le modèle est découpé par l'artiste en caisse, vitrage
 * et deux trains de roues — c'est ce découpage qui donne les pivots du braquage,
 * de la rotation des roues et de la suspension visuelle.
 *
 * ⚠️ Ces noms viennent du fichier : si tu remplaces le FBX par un autre export,
 * ils changent et le jeu ne démarre plus (`Mesh FBX voiture introuvable`). Vérifie
 * les noms du nouveau modèle avant de le déposer, ou renomme-les dans ton logiciel
 * 3D pour qu'ils collent à ceux-ci.
 */
const BODY_NAME = 'Carcasse'
const GLASS_NAME = 'Glass001'
/** Les deux trains de roues. Lequel est devant ? On le déduit de leur position. */
const WHEEL_PREFIX = 'Roue'
const CHASSIS_COLLIDER_HALF_HEIGHT = 0.38
const VISUAL_SUSPENSION_SCALE = 0.65
const VISUAL_REBOUND_LIMIT = 0.11
const VISUAL_BUMP_LIMIT = 0.11

/**
 * 🎨 Les matériaux du FBX, repeints aux couleurs du jeu.
 *
 * Le modèle porte enfin de VRAIS matériaux nommés, un par zone. On garde donc son
 * découpage (c'est le travail de l'artiste) mais on impose notre palette : la
 * direction artistique du jeu reste pilotée depuis `carConfig.ts`, en un seul
 * endroit. Un matériau absent de cette table garde la couleur du FBX.
 *
 * ⚠️ L'orthographe est celle du fichier, coquille comprise (`Carroserie01` avec
 * deux R, `Carosserie02` avec un seul) : ce sont des clés, pas du texte.
 */
const CAR_MATERIAL_COLORS: Record<string, string> = {
  Carroserie01: CAR_COLORS.body,
  Carosserie02: CAR_COLORS.bumper, // chromes, pare-chocs, entourages
  Glass: CAR_COLORS.glass,
  Roue: CAR_COLORS.wheel, // la gomme
  Jante: CAR_COLORS.tireHub,
}

interface ModelPart {
  geometry: THREE.BufferGeometry
  /** Un tableau quand le maillage est découpé en groupes de matériaux. */
  material: THREE.Material | THREE.Material[]
  center: THREE.Vector3
}

/** Voiture garée : personne au volant, aucune commande. */
const PARKED_CONTROLS: VehicleControlInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  horn: false,
}
const INACTIVE_LIMITER = { active: false, speed: 0 } as const

/** Voiture FBX jouable : caisse + essieux separes pour braquage, rotation et suspension visuelle. */
export default function Car() {
  const group = useRef<THREE.Group>(null)
  const chassisBody = useRef<RapierRigidBody>(null)
  const frontSuspension = useRef<THREE.Group>(null)
  const rearSuspension = useRef<THREE.Group>(null)
  const frontSteer = useRef<THREE.Group>(null)
  const frontWheel = useRef<THREE.Mesh>(null)
  const rearWheel = useRef<THREE.Mesh>(null)
  const rapierContext = useRapier()
  const camera = useThree((state) => state.camera)
  const runtime = useRef(createRapierCarRuntime())
  const hornPosition = useMemo(() => new THREE.Vector3(), [])
  const fbx = useFBX(CAR_MODEL_URL) as THREE.Group
  const model = useMemo(() => prepareCarModel(fbx), [fbx])
  const initialPose = useMemo(() => {
    const state = useCarStore.getState()
    return {
      x: state.parkedX,
      y: driveSurfaceHeightAt(state.parkedX, state.parkedZ) + CAR_CHASSIS_CENTER_HEIGHT,
      z: state.parkedZ,
      rot: state.parkedRot,
    }
  }, [])

  useBeforePhysicsStep((world) => {
    const body = chassisBody.current
    if (!body) return
    const state = useCarStore.getState()
    const tuning = getVehicleTuning('car')
    if (!state.riding && !state.physicsReleased) {
      parkRapierCar(
        body,
        state.parkedX,
        state.parkedZ,
        state.parkedRot,
        driveSurfaceHeightAt(state.parkedX, state.parkedZ),
        runtime.current,
      )
      resetTireContacts()
      return
    }
    applyRapierCarForces(
      body,
      world,
      rapierContext.rapier,
      state.riding ? state.controls : PARKED_CONTROLS,
      tuning,
      runtime.current,
      world.timestep || 1 / 60,
      // Le limiteur ne s'applique évidemment que quand quelqu'un conduit.
      state.riding && state.limiterActive
        ? { active: true, speed: state.limiterSpeed }
        : INACTIVE_LIMITER,
    )
  })

  // 📯 Klaxon : l'oreille suit la caméra, la source suit la caisse.
  useFrame(() => {
    const state = useCarStore.getState()
    setHornListener(camera)
    hornPosition.set(state.physicsX, state.physicsY, state.physicsZ)
    if (state.riding && state.controls.horn) playHorn('car', hornPosition, true)
    else moveHorn(hornPosition)
    updateHorn()
  }, FRAME.ATTACHED)

  // Onglet quitté ou voiture démontée : on ne laisse pas un klaxon coincé.
  useEffect(() => stopHorn, [])

  useAfterPhysicsStep(() => {
    const g = group.current
    const body = chassisBody.current
    if (!g || !body) return
    const tuning = getVehicleTuning('car')
    syncCarVisualFromBody(g, body)
    const snapshot = snapshotRapierCar(body, runtime.current, tuning)
    const carState = useCarStore.getState()
    carState.setPhysicsState(snapshot)
    if (carState.riding) syncDriverAnchor(snapshot)

    if (frontSuspension.current) frontSuspension.current.position.y = visualSuspensionLocal(snapshot.frontSuspension, tuning)
    if (rearSuspension.current) rearSuspension.current.position.y = visualSuspensionLocal(snapshot.rearSuspension, tuning)
    if (frontSteer.current) frontSteer.current.rotation.y = THREE.MathUtils.clamp(snapshot.steer, -tuning.VISUAL_STEER_MAX, tuning.VISUAL_STEER_MAX)
    if (frontWheel.current) frontWheel.current.rotation.x = snapshot.wheelSpin
    if (rearWheel.current) rearWheel.current.rotation.x = snapshot.wheelSpin
  })

  return (
    <>
      <RigidBody
        ref={chassisBody}
        type="dynamic"
        colliders={false}
        ccd
        canSleep={false}
        position={[initialPose.x, initialPose.y, initialPose.z]}
        rotation={[0, initialPose.rot, 0]}
        linearDamping={0.015}
        angularDamping={1.8}
        additionalSolverIterations={4}
      >
        <CuboidCollider
          args={[CAR.COLLISION_HALF_WIDTH, CHASSIS_COLLIDER_HALF_HEIGHT, CAR.COLLISION_HALF_LENGTH]}
          mass={CAR.MASS}
          friction={PHYSICS_MATERIAL.asphalt.friction}
          restitution={PHYSICS_MATERIAL.asphalt.restitution}
          collisionGroups={PHYSICS_GROUPS.vehicle}
          solverGroups={PHYSICS_GROUPS.vehicle}
        />
      </RigidBody>
      {/* Fumée et traces vivent dans le repère MONDE (elles restent au sol
          quand la voiture s'en va) : surtout pas dans le groupe visuel. */}
      <TireEffects />
      <group ref={group}>
        {/* Les phares, eux, sont solidaires de la caisse. */}
        <CarHeadlights />
        <group scale={CAR_MODEL_SCALE} position={[0, CAR_MODEL_GROUND_LIFT, 0]}>
          <mesh
            position={model.body.center}
            geometry={model.body.geometry}
            material={model.body.material}
            castShadow
            receiveShadow
          >
            <Outlines thickness={0.035} color="#17171d" />
          </mesh>
          {/* Vitres : pas de contour (un trait noir autour d'une vitre fait
              autocollant) et pas d'ombre portée, le verre laisse passer la lumière. */}
          <mesh
            position={model.glass.center}
            geometry={model.glass.geometry}
            material={model.glass.material}
          />
          <group ref={frontSuspension}>
            <group ref={frontSteer} position={model.frontWheel.center}>
              <mesh
                ref={frontWheel}
                geometry={model.frontWheel.geometry}
                material={model.frontWheel.material}
                castShadow
              >
                <Outlines thickness={0.026} color="#111116" />
              </mesh>
            </group>
          </group>
          <group ref={rearSuspension}>
            <group position={model.rearWheel.center}>
              <mesh ref={rearWheel} geometry={model.rearWheel.geometry} material={model.rearWheel.material} castShadow>
                <Outlines thickness={0.026} color="#111116" />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </>
  )
}

/**
 * 🚘 Prépare le modèle : caisse, vitrage et deux trains de roues.
 *
 * On garde le découpage en matériaux du FBX tel quel — chaque maillage conserve
 * ses groupes et son tableau de matériaux, simplement repassés au toon. C'est ce
 * qui donne la tôle, les chromes, le verre, la gomme et les jantes sans qu'on ait
 * à deviner quoi que ce soit dans la géométrie.
 */
function prepareCarModel(source: THREE.Group) {
  source.updateMatrixWorld(true)
  const { front, rear } = findWheels(source)
  return {
    body: bakeMesh(findMesh(source, BODY_NAME)),
    glass: bakeMesh(findMesh(source, GLASS_NAME)),
    frontWheel: bakeMesh(front),
    rearWheel: bakeMesh(rear),
  }
}

function findMesh(source: THREE.Group, name: string): THREE.Mesh {
  const object = source.getObjectByName(name)
  if (!object || !('geometry' in object)) {
    throw new Error(`Mesh FBX voiture introuvable: ${name}`)
  }
  return object as THREE.Mesh
}

/**
 * Les deux trains de roues, triés par position plutôt que par nom.
 *
 * Un ré-export renomme volontiers `Roue` en `Roue002` et inverse les suffixes ;
 * la POSITION, elle, ne ment pas. L'avant du modèle est vers +Z (même convention
 * que la physique, cf. `carRapierController`).
 */
function findWheels(source: THREE.Group): { front: THREE.Mesh; rear: THREE.Mesh } {
  const wheels: { mesh: THREE.Mesh; z: number }[] = []
  source.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.name.startsWith(WHEEL_PREFIX)) return
    wheels.push({ mesh, z: partCenter(mesh).z })
  })
  if (wheels.length < 2) {
    throw new Error(`Roues FBX introuvables (préfixe "${WHEEL_PREFIX}") : ${wheels.length} trouvée(s)`)
  }
  wheels.sort((a, b) => b.z - a.z)
  return { front: wheels[0].mesh, rear: wheels[wheels.length - 1].mesh }
}

/** Centre du maillage, une fois posé dans le repère du modèle. */
function partCenter(mesh: THREE.Mesh): THREE.Vector3 {
  const geometry = mesh.geometry.clone()
  geometry.applyMatrix4(mesh.matrixWorld)
  geometry.computeBoundingBox()
  const center = (geometry.boundingBox ?? new THREE.Box3()).getCenter(new THREE.Vector3())
  geometry.dispose()
  return center
}

/**
 * Pose un maillage dans le repère du modèle, centré sur lui-même (le centre est
 * rendu au composant, qui s'en sert comme position du pivot).
 */
function bakeMesh(mesh: THREE.Mesh): ModelPart {
  const geometry = mesh.geometry.clone()
  geometry.applyMatrix4(mesh.matrixWorld)
  const center = partCenter(mesh)
  geometry.translate(-center.x, -center.y, -center.z)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  // ⚠️ On conserve le TABLEAU de matériaux quand il y en a un : les `groups` de la
  // géométrie pointent dedans par indice. N'en garder qu'un seul repeindrait toute
  // la voiture d'une seule couleur (et perdrait vitres, chromes et jantes).
  const material = Array.isArray(mesh.material)
    ? mesh.material.map(carMaterial)
    : carMaterial(mesh.material)
  return { geometry, material, center }
}

/** Un matériau du FBX, repassé au toon et repeint à la palette du jeu. */
function carMaterial(source: THREE.Material): THREE.Material {
  return toonFromImported(source, CAR_MATERIAL_COLORS[source.name])
}

function visualSuspensionLocal(compression: number, tuning: ReturnType<typeof getVehicleTuning>) {
  const staticCompression = tuning.SUSPENSION_TRAVEL * CAR_STATIC_SUSPENSION_RATIO
  const visualMeters = THREE.MathUtils.clamp(
    (compression - staticCompression) * VISUAL_SUSPENSION_SCALE,
    -VISUAL_REBOUND_LIMIT,
    VISUAL_BUMP_LIMIT,
  )
  return visualMeters * RAW_UNITS_PER_METER
}

function syncDriverAnchor(snapshot: RapierCarSnapshot) {
  const player = usePlayerStore.getState().playerObject
  if (!player) return
  player.position.set(snapshot.driverX, snapshot.driverY, snapshot.driverZ)
  player.rotation.y = snapshot.rot
}

useFBX.preload(CAR_MODEL_URL)
