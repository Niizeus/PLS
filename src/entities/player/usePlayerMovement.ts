import { useFrame } from '@react-three/fiber'
import { useRapier, type RapierContext, type RapierRigidBody } from '@react-three/rapier'
import { useRef, type MutableRefObject, type RefObject } from 'react'
import * as THREE from 'three'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import type { MouseState } from '../../gameplay/input/useMouse'
import { useInventoryStore } from '../../gameplay/inventory/inventoryStore'
import { useCharacterStatsStore } from '../../gameplay/stats/characterStatsStore'
import { getEffectiveStats, getMovementSpeedMultiplier } from '../../gameplay/stats/effectiveStats'
import {
  usePlayerStore,
  type AttackMove,
  type PlayerAction,
  type PlayerLocomotionAction,
  type PlayerPhysicsDebug,
  type PlayerPhysicsMode,
  type PlayerPose,
} from '../../gameplay/stats/playerStore'
import { getCombatStyle } from './combatStyle'
import { useCameraStore } from '../../core/cameraStore'
import { FRAME } from '../../core/framePriority'
import { useScooterStore } from '../vehicles/scooterStore'
import { useCarStore } from '../vehicles/carStore'
import {
  createVehicleDriveState,
  driveVehicle,
  stopVehicle,
  type VehicleDriveConfig,
  type VehicleDriveState,
} from '../vehicles/vehicleDriving'
import { useVehicleTelemetryStore, type VehicleKind } from '../vehicles/vehicleTelemetryStore'
import { useRadioStore } from '../../audio/radioStore'
import { groundHeight } from '../../world/beauvais/roadway'
import { moveCircle } from '../movementCollision'
import { zoneAt } from '../../world/beauvais/zones'
import { getPlayerTuning, getVehicleTuning } from '../../devtools/devTuningStore'
import { isFlatTestLevelEnabled } from '../../gameplay/testLevel/testLevelMode'
import { PHYSICS_GROUPS } from '../../gameplay/physics/physicsConfig'
import { useCollisionDebugStore } from '../../devtools/collisionDebugStore'

const SCOOTER_RADIO_ID = 'vehicle:scooter:prototype'
const CAR_RADIO_ID = 'vehicle:car:prototype'
const PLAYER_SWEEP_SKIN = 0.035
const PLAYER_SLIDE_DAMPING = 0.86
const PLAYER_CLIMBABLE_NORMAL_Y = 0.42
const PLAYER_STEP_UP_HEIGHT = 0.42
const PLAYER_SNAP_DOWN_DISTANCE = 0.55
const PLAYER_GROUND_PROBE_EXTRA = 2.4
const PLAYER_SUPPORT_NORMAL_Y = 0.52
const PLAYER_MAX_FALL_SPEED = 9
const PLAYER_SUPPORT_PENETRATION_RECOVERY = 0.5
const PLAYER_HEAD_CLEARANCE = 0.08
const PLAYER_HEAD_BLOCK_NORMAL_Y = -0.35
const PLAYER_COYOTE_TIME = 0.12
const PLAYER_JUMP_BUFFER_TIME = 0.16
const PLAYER_UNSTUCK_TOI = 0.001
const PLAYER_UNSTUCK_PUSH = 0.075
const PLAYER_LAST_SAFE_MIN_TIME = 0.2

interface PlayerGroundSample {
  y: number
  rayHit: boolean
  normalY: number
  source: 'procedural' | 'rapier'
}

interface PlayerHorizontalResult {
  mode: PlayerPhysicsMode
  hitPoint: PlayerPhysicsDebug['hitPoint']
  hitNormal: PlayerPhysicsDebug['hitNormal']
}

/**
 * Ce que la logique produit pour le visuel (lu par Player pour animer les bras).
 */
export interface PlayerMotion {
  action: PlayerAction
  /** Avancement de l'attaque en cours, de 0 (début) à 1 (fin). */
  attackProgress: number
  /** Avancement du geste d'interaction, 0 → 1. */
  interactProgress: number
  /** Intensité du déplacement, 0 (arrêt) → 1 (course), pour le balancement. */
  moveIntensity: number
}

/**
 * Cœur du déplacement + combat du joueur.
 *
 * On fait tout dans un seul useFrame (hors React = pas de re-render) :
 *  - lit le clavier/souris (via des réfs),
 *  - déplace et oriente le perso,
 *  - gère les minuteurs d'attaque / interaction,
 *  - met à jour le store (pour le HUD) et renvoie l'état visuel.
 *
 * Le mouvement est "vue-relatif" : la caméra étant fixe derrière le perso,
 * ZQSD correspond à l'écran (Z = tout droit vers le fond).
 */
export function usePlayerMovement(
  groupRef: RefObject<THREE.Group>,
  bodyRef: RefObject<RapierRigidBody>,
  keys: RefObject<KeyboardState>,
  mouse: RefObject<MouseState>,
) {
  const setAction = usePlayerStore((s) => s.setAction)
  const setLocomotionAction = usePlayerStore((s) => s.setLocomotionAction)
  const rapierContext = useRapier()
  const setDefending = usePlayerStore((s) => s.setDefending)
  const setZoneName = usePlayerStore((s) => s.setZoneName)
  const strike = usePlayerStore((s) => s.strike)
  const endStrike = usePlayerStore((s) => s.endStrike)
  const setRagdoll = usePlayerStore((s) => s.setRagdoll)
  const setPhysicsDebug = usePlayerStore((s) => s.setPhysicsDebug)

  // Dernier quartier détecté : on ne met à jour le store que quand il CHANGE.
  const lastZoneId = useRef<string | null>('__init__')

  // Minuteurs internes (en secondes restantes).
  const attackTimer = useRef(0)
  const interactTimer = useRef(0)
  const hurtTimer = useRef(0)

  // --- Enchaînement de coups (combo) ---
  /** Durée totale du coup en cours (sert à calculer attackProgress). */
  const attackDuration = useRef(0)
  /** Numéro du coup en cours dans l'enchaînement : 0 = aucun, 1..3 = poing 1/2/3. */
  const comboStep = useRef(0)
  /** Temps restant pour enchaîner sur le coup suivant (0 = l'enchaînement retombe). */
  const comboWindow = useRef(0)
  /** Dernier `hurtToken` vu : s'il change, c'est qu'on vient de prendre un coup. */
  const lastHurtToken = useRef(usePlayerStore.getState().hurtToken)

  // État visuel renvoyé au composant Player.
  const motion = useRef<PlayerMotion>({
    action: 'idle',
    attackProgress: 0,
    interactProgress: 0,
    moveIntensity: 0,
  })

  // Vecteurs réutilisés chaque frame (on évite d'en allouer dans la boucle).
  const moveDir = useRef(new THREE.Vector3())
  const sweepFrom = useRef(new THREE.Vector3())
  // Etats de conduite conserves hors React pour eviter les re-render par frame.
  const scooterDrive = useRef(createVehicleDriveState())
  // Hauteur de sol lissee pour eviter les secousses camera sur routes/bordures.
  const groundY = useRef<number | null>(null)
  // Mouvement vertical independant des sweeps horizontaux Rapier.
  const vy = useRef(0)
  const groundedRef = useRef(true)
  const coyoteTimer = useRef(PLAYER_COYOTE_TIME)
  const jumpBufferTimer = useRef(0)
  const lastSafePose = useRef<PlayerPose | null>(null)
  const lastSafeTimer = useRef(0)
  const physicsMode = useRef<PlayerPhysicsMode>('grounded')
  const previousVelocityPose = useRef<PlayerPose | null>(null)
  const currentVelocity = useRef({ x: 0, y: 0, z: 0 })

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    const body = bodyRef.current
    const k = keys.current
    const m = mouse.current
    if (!group || !body || !k || !m) return

    const delta = Math.min(rawDelta, 0.1)
    const playerTuning = getPlayerTuning()

    const playerStore = usePlayerStore.getState()
    if (playerStore.isRagdoll) {
      if (k.ragdollQueued) {
        k.ragdollQueued = false
        const recovery = recoveryPose(playerStore.ragdollPose, group, playerTuning.BODY_HEIGHT)
        teleportKinematicPlayer(body, group, recovery)
        resetVelocitySample(group, previousVelocityPose, currentVelocity)
        setRagdoll(false, recovery)
        setAction('idle')
        setLocomotionAction('idle')
      } else {
        body.setEnabled(false)
        if (playerStore.ragdollPose) {
          group.position.set(playerStore.ragdollPose.x, playerStore.ragdollPose.y, playerStore.ragdollPose.z)
          group.rotation.y = playerStore.ragdollPose.rot
        }
        if (playerStore.action !== 'hurt') setAction('hurt')
        if (playerStore.locomotionAction !== 'idle') setLocomotionAction('idle')
        if (playerStore.isDefending) setDefending(false)
      }
      return
    }

    if (!body.isEnabled()) {
      teleportKinematicPlayer(body, group, poseFromObject(group))
      resetVelocitySample(group, previousVelocityPose, currentVelocity)
    }

    if (k.ragdollQueued) {
      k.ragdollQueued = false
      const pose = poseWithVelocity(group, currentVelocity.current, vy.current)
      body.setEnabled(false)
      setRagdoll(true, pose)
      if (usePlayerStore.getState().attackMove) endStrike()
      setAction('hurt')
      setLocomotionAction('idle')
      setDefending(false)
      return
    }

    if (k.unstuckQueued) {
      k.unstuckQueued = false
      const pose = lastSafePose.current ?? recoveryPose(null, group, playerTuning.BODY_HEIGHT)
      teleportKinematicPlayer(body, group, pose)
      resetVelocitySample(group, previousVelocityPose, currentVelocity)
      groundY.current = pose.y
      vy.current = 0
      groundedRef.current = true
      coyoteTimer.current = PLAYER_COYOTE_TIME
      physicsMode.current = 'unstucking'
    }

    // Quartier courant (marche ou scooter) : ne pousse au store que si ça change.
    const zone = zoneAt(group.position.x, group.position.z)
    const zoneId = zone ? zone.id : null
    if (zoneId !== lastZoneId.current) {
      lastZoneId.current = zoneId
      setZoneName(zone ? zone.name : null)
    }

    // On borne le delta : si l'onglet a "laggé", on évite un saut géant.
    const scooterTuning = getVehicleTuning('scooter')
    const carTuning = getVehicleTuning('car')

    // --- 0. Vehicules : monter / descendre (E), puis conduire si on roule ---
    const scooter = useScooterStore.getState()
    const car = useCarStore.getState()
    const flatTestLevel = isFlatTestLevelEnabled()
    const ridingScooter = flatTestLevel && scooter.riding
    const ridingCar = car.riding
    let riding = ridingScooter || ridingCar

    if (k.interactQueued) {
      if (!riding) {
        let nearest: 'scooter' | 'car' | null = null
        let nearestD2 = Infinity

        if (flatTestLevel) {
          const scooterDx = group.position.x - scooter.parkedX
          const scooterDz = group.position.z - scooter.parkedZ
          const scooterD2 = scooterDx * scooterDx + scooterDz * scooterDz
          if (scooterD2 <= scooterTuning.MOUNT_RANGE * scooterTuning.MOUNT_RANGE && scooterD2 < nearestD2) {
            nearest = 'scooter'
            nearestD2 = scooterD2
          }
        }

        const carDx = group.position.x - car.parkedX
        const carDz = group.position.z - car.parkedZ
        const carD2 = carDx * carDx + carDz * carDz
        if (carD2 <= carTuning.MOUNT_RANGE * carTuning.MOUNT_RANGE && carD2 < nearestD2) {
          nearest = 'car'
          nearestD2 = carD2
        }

        if (nearest === 'scooter') {
          k.interactQueued = false
          teleportKinematicPlayer(body, group, {
            x: scooter.parkedX,
            y: groundHeight(scooter.parkedX, scooter.parkedZ) + scooterTuning.SEAT_HEIGHT,
            z: scooter.parkedZ,
            rot: scooter.parkedRot,
          })
          stopVehicle(scooterDrive.current)
          scooter.mount()
          useRadioStore.getState().startVehicleRadio(SCOOTER_RADIO_ID)
          riding = true
        } else if (nearest === 'car') {
          k.interactQueued = false
          teleportKinematicPlayer(body, group, { x: car.driverX, y: car.driverY, z: car.driverZ, rot: car.physicsRot })
          car.mount()
          useRadioStore.getState().startVehicleRadio(CAR_RADIO_ID)
          riding = true
        }
      } else if (ridingScooter) {
        k.interactQueued = false
        const rot = group.rotation.y
        scooter.parkAt(group.position.x, group.position.z, rot)
        teleportKinematicPlayer(body, group, {
          x: group.position.x + Math.cos(rot) * 1.2,
          y: group.position.y,
          z: group.position.z + -Math.sin(rot) * 1.2,
          rot,
        })
        stopVehicle(scooterDrive.current)
        useRadioStore.getState().stopRadio(SCOOTER_RADIO_ID)
        riding = false
      } else if (ridingCar) {
        k.interactQueued = false
        const carState = useCarStore.getState()
        const rot = carState.physicsRot
        const exitPose = findSafeVehicleExitPose(
          carState.physicsX,
          carState.physicsZ,
          carState.driverY,
          rot,
          carTuning.COLLISION_HALF_LENGTH,
          carTuning.COLLISION_HALF_WIDTH,
          playerTuning.BODY_RADIUS,
          playerTuning.BODY_HEIGHT,
          rapierContext,
          body,
        )
        const exitGroundY = exitPose.groundY
        const exitY = Math.max(carState.driverY, exitPose.y)
        carState.parkAt(carState.physicsX, carState.physicsZ, rot)
        teleportKinematicPlayer(body, group, { x: exitPose.x, y: exitY, z: exitPose.z, rot })
        groundY.current = exitGroundY
        groundedRef.current = exitY <= exitGroundY + 0.05
        coyoteTimer.current = groundedRef.current ? PLAYER_COYOTE_TIME : 0
        vy.current = carState.velocityY
        useRadioStore.getState().stopRadio(CAR_RADIO_ID)
        riding = false
      }
    }

    const activeScooter = flatTestLevel && useScooterStore.getState().riding
    const activeCar = useCarStore.getState().riding
    riding = activeScooter || activeCar

    if (riding) {
      // Au volant, Espace est le FREIN À MAIN. Sans ce nettoyage, le saut resterait
      // en file d'attente et se déclencherait au moment où on descend du véhicule.
      k.jumpQueued = false
    }

    // Bascules véhicule : on les consomme TOUJOURS, même à pied. Sinon un appui
    // sur A ou L hors véhicule resterait en file et se déclencherait tout seul
    // en montant dans la voiture.
    const limiterPressed = k.limiterQueued
    const lightsPressed = k.lightsQueued
    k.limiterQueued = false
    k.lightsQueued = false

    if (activeScooter) {
      const scooterState = useScooterStore.getState()
      driveVehicle(
        group,
        scooterState.fuelLiters > 0 ? k : withoutThrottle(k),
        scooterDrive.current,
        scooterTuning,
        delta,
        rapierContext,
      )
      syncKinematicPlayer(body, group, group.position.x, group.position.y, group.position.z, group.rotation.y)
      if (Math.abs(scooterDrive.current.speed) > 0.2) {
        scooterState.consumeFuel((Math.abs(scooterDrive.current.speed) * 0.000009 + (k.forward ? 0.000015 : 0)) * delta)
      }
      scooterState.setVisualAttitude(scooterDrive.current.pitch, scooterDrive.current.roll)
      publishTelemetry('scooter', scooterDrive.current, scooterTuning, scooterState)
    } else if (activeCar) {
      const carState = useCarStore.getState()
      // 🚦 Limiteur (A) et 💡 phares (L) : des BASCULES, donc consommées ici et
      // uniquement au volant. Le klaxon (F), lui, est un maintien : il passe par
      // `controls.horn` comme les autres commandes de conduite.
      if (limiterPressed) carState.toggleLimiter(carTuning.LIMITER_MIN_SPEED)
      if (lightsPressed) carState.toggleHeadlights()
      carState.setControlsFromKeyboard(carState.fuelLiters > 0 ? k : withoutThrottle(k))
      group.position.set(carState.driverX, carState.driverY, carState.driverZ)
      group.rotation.y = carState.physicsRot
      syncKinematicPlayer(body, group, carState.driverX, carState.driverY, carState.driverZ, carState.physicsRot)
      if (Math.abs(carState.speed) > 0.2) {
        carState.consumeFuel((Math.abs(carState.speed) * 0.000018 + (k.forward ? 0.00003 : 0)) * delta)
      }
      publishCarTelemetry(carState, carTuning)
    } else {
      useVehicleTelemetryStore.getState().clearTelemetry()
    }

    if (riding) {
      const speed = activeScooter ? scooterDrive.current.speed : useCarStore.getState().speed
      const vis = motion.current
      vis.action = Math.abs(speed) > 0.2 ? 'run' : 'idle'
      vis.attackProgress = 0
      vis.interactProgress = 0
      vis.moveIntensity = 0
      // On ne se bat pas au volant : on remet le combat à zéro.
      attackTimer.current = 0
      hurtTimer.current = 0
      comboStep.current = 0
      comboWindow.current = 0
      lastHurtToken.current = usePlayerStore.getState().hurtToken
      if (usePlayerStore.getState().attackMove) endStrike()
      if (usePlayerStore.getState().action !== vis.action) setAction(vis.action)
      if (usePlayerStore.getState().locomotionAction !== vis.action) setLocomotionAction(vis.action)
      if (usePlayerStore.getState().isDefending) setDefending(false)
      return
    }

    sweepFrom.current.copy(group.position)

    // --- 1a. On encaisse un coup ? (n'importe qui peut appeler takeHit()) ---
    const hurtToken = usePlayerStore.getState().hurtToken
    if (hurtToken !== lastHurtToken.current) {
      lastHurtToken.current = hurtToken
      hurtTimer.current = playerTuning.HURT_DURATION
      // Se prendre un coup casse l'enchaînement en cours.
      attackTimer.current = 0
      comboStep.current = 0
      comboWindow.current = 0
      if (usePlayerStore.getState().attackMove) endStrike()
    }

    // --- 1b. Déclencheurs consommés (attaque / interaction) ---
    if (m.attackQueued) {
      m.attackQueued = false
      // Sonné par un coup : on ne peut pas frapper (l'anim Hurt a la priorité).
      if (hurtTimer.current <= 0) {
        let move: AttackMove
        if (getCombatStyle() === 'weapon') {
          // Avec une arme : une seule animation pour l'instant (pas d'enchaînement).
          move = 'weapon'
          comboStep.current = 0
          attackDuration.current = playerTuning.WEAPON_ATTACK_DURATION
        } else {
          // Mains nues : 3 coups qui s'enchaînent tant qu'on reclique assez vite.
          const canChain = comboWindow.current > 0 && comboStep.current > 0 && comboStep.current < playerTuning.COMBO_DURATIONS.length
          comboStep.current = canChain ? comboStep.current + 1 : 1
          move = `punch${comboStep.current}` as AttackMove
          attackDuration.current = playerTuning.COMBO_DURATIONS[comboStep.current - 1]
        }
        attackTimer.current = attackDuration.current
        // La fenêtre d'enchaînement court pendant le coup + un petit délai après.
        comboWindow.current = attackDuration.current + playerTuning.COMBO_WINDOW
        strike(move)
      }
    }
    if (k.interactQueued) {
      k.interactQueued = false
      interactTimer.current = playerTuning.INTERACT_DURATION
    }
    if (attackTimer.current > 0) attackTimer.current -= delta
    if (interactTimer.current > 0) interactTimer.current -= delta
    if (hurtTimer.current > 0) hurtTimer.current -= delta
    if (comboWindow.current > 0) {
      comboWindow.current -= delta
      // Fenêtre écoulée : le prochain clic repartira au coup n°1.
      if (comboWindow.current <= 0) comboStep.current = 0
    }
    // Coup terminé : on efface le coup affiché (le modèle 3D revient à idle/marche).
    if (attackTimer.current <= 0 && usePlayerStore.getState().attackMove) endStrike()

    // --- 2. Intentions de déplacement depuis ZQSD ---
    // fwd    : avant(+) / arrière(-)
    // strafe : droite(+) / gauche(-)
    const fwd = (k.forward ? 1 : 0) - (k.backward ? 1 : 0)
    const strafe = (k.right ? 1 : 0) - (k.left ? 1 : 0)

    const isMoving = fwd !== 0 || strafe !== 0
    const isDefending = m.defending
    const crouching = k.crouch

    const inventory = useInventoryStore.getState()
    const characterStats = useCharacterStatsStore.getState()
    const effectiveStats = getEffectiveStats(characterStats, inventory.equipped, characterStats.activeEffects)
    const needsSadWalk = shouldUseSadWalk(effectiveStats)
    const running = k.run && isMoving && !crouching && !needsSadWalk

    jumpBufferTimer.current = Math.max(0, jumpBufferTimer.current - delta)
    if (k.jumpQueued) {
      k.jumpQueued = false
      jumpBufferTimer.current = PLAYER_JUMP_BUFFER_TIME
    }

    let jumpedThisFrame = false
    if (jumpBufferTimer.current > 0 && coyoteTimer.current > 0 && !crouching && !isDefending && hurtTimer.current <= 0) {
      jumpBufferTimer.current = 0
      coyoteTimer.current = 0
      groundedRef.current = false
      vy.current = playerTuning.JUMP_SPEED
      jumpedThisFrame = true
    }

    // --- 3. Déplacement RELATIF À LA CAMÉRA ---
    // Le déplacement suit l'orientation de la caméra : "avant" = là où la caméra
    // regarde, quel que soit l'angle choisi à la souris.
    let moveIntensity = 0
    if (isMoving && !isDefending && hurtTimer.current <= 0) {
      // En défense on reste planté (garde levée) : plus lisible, plus tactique.
      // Idem quand on est sonné par un coup (animation Hurt) : on subit.
      const yaw = useCameraStore.getState().yaw
      const sin = Math.sin(yaw)
      const cos = Math.cos(yaw)
      // avant = à l'opposé de la caméra (qui est derrière) ; droite = perpendiculaire.
      const dirX = -sin * fwd + cos * strafe
      const dirZ = -cos * fwd - sin * strafe
      moveDir.current.set(dirX, 0, dirZ)
      if (moveDir.current.lengthSq() > 0) moveDir.current.normalize()

      const speedMultiplier = getMovementSpeedMultiplier(effectiveStats, inventory.stacks)
      const speed =
        (crouching ? playerTuning.CROUCH_SPEED : running ? playerTuning.RUN_SPEED : playerTuning.WALK_SPEED) *
        speedMultiplier
      // Collision cercle contre murs : glisse le long des façades en biais au
      // lieu d'avancer en escalier (voir `movementCollision.ts`).
      const move = moveCircle(
        group.position.x,
        group.position.z,
        moveDir.current.x * speed * delta,
        moveDir.current.z * speed * delta,
        playerTuning.BODY_RADIUS,
      )
      group.position.x = move.x
      group.position.z = move.z

      // Oriente le perso vers sa direction de marche (rotation douce).
      const targetAngle = Math.atan2(moveDir.current.x, moveDir.current.z)
      group.rotation.y = dampAngle(group.rotation.y, targetAngle, playerTuning.TURN_SPEED, delta)

      moveIntensity = running ? 1 : 0.5
    }

    const horizontal = resolvePlayerHorizontalMovement(
      sweepFrom.current,
      group,
      body,
      rapierContext,
      playerTuning.BODY_RADIUS,
      playerTuning.BODY_HEIGHT,
    )
    const movedHorizontally =
      (group.position.x - sweepFrom.current.x) * (group.position.x - sweepFrom.current.x) +
      (group.position.z - sweepFrom.current.z) * (group.position.z - sweepFrom.current.z) >
      0.000001
    if (
      movedHorizontally &&
      groundedRef.current &&
      isHeadBlockedAt(group.position.x, group.position.y, group.position.z, rapierContext, body, playerTuning.BODY_HEIGHT)
    ) {
      group.position.x = sweepFrom.current.x
      group.position.z = sweepFrom.current.z
      horizontal.mode = 'sliding'
      horizontal.hitPoint = { x: group.position.x, y: group.position.y + playerTuning.BODY_HEIGHT, z: group.position.z }
      horizontal.hitNormal = { x: 0, y: -1, z: 0 }
    }

    const ground = samplePlayerGround(
      group.position.x,
      group.position.z,
      group.position.y,
      rapierContext,
      body,
      playerTuning.BODY_HEIGHT,
    )
    const groundDelta = ground.y - group.position.y
    const canStepUp =
      !jumpedThisFrame &&
      groundedRef.current &&
      groundDelta > 0 &&
      groundDelta <= PLAYER_STEP_UP_HEIGHT
    const canSnapDown =
      !jumpedThisFrame &&
      groundedRef.current &&
      vy.current <= 0 &&
      groundDelta <= 0 &&
      Math.abs(groundDelta) <= PLAYER_SNAP_DOWN_DISTANCE
    const canRecoverPenetration =
      !jumpedThisFrame &&
      vy.current <= 0 &&
      groundDelta > PLAYER_STEP_UP_HEIGHT &&
      (ground.source === 'procedural' || groundDelta <= PLAYER_SUPPORT_PENETRATION_RECOVERY)

    if (canStepUp || canSnapDown || canRecoverPenetration) {
      groundY.current = canRecoverPenetration ? ground.y : smoothGroundY(groundY.current, ground.y, delta)
      group.position.y = groundY.current
      vy.current = 0
      groundedRef.current = true
      coyoteTimer.current = PLAYER_COYOTE_TIME
    } else {
      groundedRef.current = false
      coyoteTimer.current = Math.max(0, coyoteTimer.current - delta)
      const previousY = group.position.y
      vy.current = Math.max(vy.current - playerTuning.GRAVITY * delta, -PLAYER_MAX_FALL_SPEED)
      group.position.y += vy.current * delta
      if (vy.current > 0) {
        const ceilingY = samplePlayerCeilingY(
          group.position.x,
          group.position.z,
          previousY,
          group.position.y,
          rapierContext,
          body,
          playerTuning.BODY_HEIGHT,
        )
        if (ceilingY !== null) {
          group.position.y = ceilingY
          vy.current = 0
        }
      }
      if (vy.current <= 0 && previousY >= ground.y - 0.05 && group.position.y <= ground.y) {
        group.position.y = ground.y
        groundY.current = ground.y
        vy.current = 0
        groundedRef.current = true
        coyoteTimer.current = PLAYER_COYOTE_TIME
      }
    }

    const airborne = !groundedRef.current || jumpedThisFrame
    physicsMode.current = horizontal.mode !== 'grounded' ? horizontal.mode : airborne ? 'airborne' : 'grounded'

    lastSafeTimer.current += delta
    if (groundedRef.current && physicsMode.current === 'grounded' && lastSafeTimer.current >= PLAYER_LAST_SAFE_MIN_TIME) {
      lastSafeTimer.current = 0
      lastSafePose.current = poseFromObject(group)
    }

    // --- 4. Détermine l'action affichée (priorité : dégâts > attaque > saut > ...) ---
    let action: PlayerAction
    if (hurtTimer.current > 0) action = 'hurt'
    else if (attackTimer.current > 0) action = 'attack'
    else if (airborne) action = 'jump'
    else if (interactTimer.current > 0) action = 'interact'
    else if (crouching) action = 'crouch'
    else if (isDefending) action = 'defense'
    else if (isMoving && needsSadWalk) action = 'sadWalk'
    else if (running) action = 'run'
    else if (isMoving) action = 'walk'
    else action = 'idle'

    let locomotionAction: PlayerLocomotionAction
    if (airborne) locomotionAction = 'jump'
    else if (interactTimer.current > 0) locomotionAction = 'interact'
    else if (crouching) locomotionAction = 'crouch'
    else if (isDefending) locomotionAction = 'defense'
    else if (isMoving && needsSadWalk) locomotionAction = 'sadWalk'
    else if (running) locomotionAction = 'run'
    else if (isMoving) locomotionAction = 'walk'
    else locomotionAction = 'idle'

    // --- 5. Publie l'état visuel + le store (uniquement si ça change, pour le HUD) ---
    const vis = motion.current
    vis.action = action
    vis.attackProgress =
      attackTimer.current > 0 && attackDuration.current > 0
        ? 1 - attackTimer.current / attackDuration.current
        : 0
    vis.interactProgress =
      interactTimer.current > 0 ? 1 - interactTimer.current / playerTuning.INTERACT_DURATION : 0
    vis.moveIntensity = moveIntensity

    if (usePlayerStore.getState().action !== action) setAction(action)
    if (usePlayerStore.getState().locomotionAction !== locomotionAction) setLocomotionAction(locomotionAction)
    if (usePlayerStore.getState().isDefending !== isDefending) setDefending(isDefending)
    if (useCollisionDebugStore.getState().enabled) {
      setPhysicsDebug({
        mode: physicsMode.current,
        grounded: groundedRef.current,
        position: { x: group.position.x, y: group.position.y, z: group.position.z },
        groundY: ground.y,
        hitPoint: horizontal.hitPoint,
        hitNormal: horizontal.hitNormal,
      })
    }
    syncKinematicPlayer(body, group, group.position.x, group.position.y, group.position.z, group.rotation.y)
    rememberPlayerVelocity(group, delta, previousVelocityPose, currentVelocity, vy.current)
  }, FRAME.LOGIC)

  return motion
}

/**
 * Interpolation d'angle (radians) qui prend le plus court chemin et reste
 * stable quel que soit le frame-rate. Sert à tourner le perso en douceur.
 */
function withoutThrottle(k: KeyboardState): KeyboardState {
  return { ...k, forward: false }
}

function shouldUseSadWalk(stats: { hunger: number; mental: number }): boolean {
  return stats.hunger < 20 || stats.mental < 15
}

/** Pousse l'etat du vehicule vers le tableau de bord (vitesse, regime, rapport, essence). */
function publishTelemetry(
  kind: VehicleKind,
  drive: VehicleDriveState,
  config: VehicleDriveConfig,
  tank: { fuelLiters: number; fuelCapacityLiters: number },
) {
  useVehicleTelemetryStore.getState().setTelemetry(kind, {
    speed: drive.speed,
    rpm: drive.rpm,
    gear: drive.gear,
    maxRpm: config.ENGINE.MAX_RPM,
    maxSpeed: config.MAX_SPEED,
    fuelRatio: tank.fuelCapacityLiters > 0 ? tank.fuelLiters / tank.fuelCapacityLiters : 0,
  })
}

function publishCarTelemetry(
  car: ReturnType<typeof useCarStore.getState>,
  config: VehicleDriveConfig,
) {
  useVehicleTelemetryStore.getState().setTelemetry('car', {
    speed: car.speed,
    rpm: car.rpm,
    gear: car.gear,
    maxRpm: config.ENGINE.MAX_RPM,
    maxSpeed: config.MAX_SPEED,
    fuelRatio: car.fuelCapacityLiters > 0 ? car.fuelLiters / car.fuelCapacityLiters : 0,
  })
}

function smoothGroundY(current: number | null, target: number, delta: number): number {
  if (current === null || Math.abs(target - current) > 2.5) return target
  const t = 1 - Math.exp(-14 * delta)
  const next = current + (target - current) * t
  const maxStep = 6 * delta
  return THREE.MathUtils.clamp(next, current - maxStep, current + maxStep)
}

function resolvePlayerHorizontalMovement(
  from: THREE.Vector3,
  group: THREE.Object3D,
  body: RapierRigidBody,
  context: Pick<RapierContext, 'rapier' | 'world'>,
  radius: number,
  bodyHeight: number,
): PlayerHorizontalResult {
  const motion = {
    x: group.position.x - from.x,
    y: 0,
    z: group.position.z - from.z,
  }
  const distanceSq = motion.x * motion.x + motion.y * motion.y + motion.z * motion.z
  if (distanceSq < 0.000001) return { mode: 'grounded', hitPoint: null, hitNormal: null }

  const halfHeight = Math.max(0.25, bodyHeight * 0.42)
  const shape = new context.rapier.Capsule(halfHeight, radius)
  const filterFlags = context.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  context.world.updateSceneQueries()

  const hit = context.world.castShape(
    { x: from.x, y: from.y, z: from.z },
    yawToQuaternion(group.rotation.y),
    motion,
    shape,
    PLAYER_SWEEP_SKIN,
    1,
    true,
    filterFlags,
    PHYSICS_GROUPS.playerObstacles,
    undefined,
    body,
  )
  if (!hit) return { mode: 'grounded', hitPoint: null, hitNormal: null }

  if (isClimbableSurfaceHit(hit)) return { mode: 'grounded', hitPoint: null, hitNormal: null }

  const keep = Math.max(0, hit.time_of_impact - PLAYER_SWEEP_SKIN)
  const normal = horizontalCollisionNormal(hit, motion)
  const hitPoint = {
    x: from.x + motion.x * hit.time_of_impact,
    y: from.y + motion.y * hit.time_of_impact,
    z: from.z + motion.z * hit.time_of_impact,
  }
  const hitNormal = normal ? { x: normal.x, y: 0, z: normal.z } : null

  const contact = {
    x: from.x + motion.x * keep,
    y: from.y + motion.y * keep,
    z: from.z + motion.z * keep,
  }
  if (hit.time_of_impact <= PLAYER_UNSTUCK_TOI && normal) {
    contact.x += normal.x * PLAYER_UNSTUCK_PUSH
    contact.z += normal.z * PLAYER_UNSTUCK_PUSH
  }

  const slide = computeSlideMotion(hit, motion, keep)
  if (!slide) {
    group.position.set(contact.x, contact.y, contact.z)
    return {
      mode: hit.time_of_impact <= PLAYER_UNSTUCK_TOI ? 'unstucking' : 'sliding',
      hitPoint,
      hitNormal,
    }
  }

  const slideHit = context.world.castShape(
    contact,
    yawToQuaternion(group.rotation.y),
    slide,
    shape,
    PLAYER_SWEEP_SKIN,
    1,
    true,
    filterFlags,
    PHYSICS_GROUPS.playerObstacles,
    undefined,
    body,
  )

  if (slideHit && !isClimbableSurfaceHit(slideHit)) {
    const slideKeep = Math.max(0, slideHit.time_of_impact - PLAYER_SWEEP_SKIN)
    group.position.set(contact.x + slide.x * slideKeep, contact.y + slide.y * slideKeep, contact.z + slide.z * slideKeep)
    return {
      mode: slideHit.time_of_impact <= PLAYER_UNSTUCK_TOI ? 'unstucking' : 'sliding',
      hitPoint,
      hitNormal,
    }
  }

  group.position.set(contact.x + slide.x, contact.y + slide.y, contact.z + slide.z)
  return {
    mode: hit.time_of_impact <= PLAYER_UNSTUCK_TOI ? 'unstucking' : 'sliding',
    hitPoint,
    hitNormal,
  }
}

function computeSlideMotion(
  hit: { normal1: { x: number; y: number; z: number }; normal2: { x: number; y: number; z: number } },
  motion: { x: number; y: number; z: number },
  keep: number,
): { x: number; y: number; z: number } | null {
  const normal = horizontalCollisionNormal(hit, motion)
  if (!normal) return null

  let slideX = motion.x * Math.max(0, 1 - keep)
  let slideZ = motion.z * Math.max(0, 1 - keep)
  const into = slideX * normal.x + slideZ * normal.z
  if (into < 0) {
    slideX -= normal.x * into
    slideZ -= normal.z * into
  }

  slideX *= PLAYER_SLIDE_DAMPING
  slideZ *= PLAYER_SLIDE_DAMPING
  if (slideX * slideX + slideZ * slideZ < 0.000004) return null
  return { x: slideX, y: 0, z: slideZ }
}

function horizontalCollisionNormal(
  hit: { normal1: { x: number; y: number; z: number }; normal2: { x: number; y: number; z: number } },
  motion: { x: number; z: number },
): { x: number; z: number } | null {
  const candidates = [hit.normal1, hit.normal2]
    .map((normal) => {
      const len = Math.hypot(normal.x, normal.z)
      return len > 0.001 ? { x: normal.x / len, z: normal.z / len, len } : null
    })
    .filter((normal): normal is { x: number; z: number; len: number } => normal !== null)
    .sort((a, b) => b.len - a.len)

  const best = candidates[0]
  if (!best) return null

  if (motion.x * best.x + motion.z * best.z > 0) {
    best.x *= -1
    best.z *= -1
  }
  return best
}

function samplePlayerGround(
  x: number,
  z: number,
  currentY: number,
  context: Pick<RapierContext, 'rapier' | 'world'>,
  body: RapierRigidBody,
  bodyHeight: number,
): PlayerGroundSample {
  const proceduralY = groundHeight(x, z) + bodyHeight
  const originY = Math.max(currentY, proceduralY) + bodyHeight + PLAYER_GROUND_PROBE_EXTRA
  const maxDistance = bodyHeight * 2 + PLAYER_GROUND_PROBE_EXTRA + PLAYER_SNAP_DOWN_DISTANCE + PLAYER_STEP_UP_HEIGHT
  const ray = new context.rapier.Ray({ x, y: originY, z }, { x: 0, y: -1, z: 0 })
  const filterFlags = context.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  context.world.updateSceneQueries()

  const hit = context.world.castRayAndGetNormal(
    ray,
    maxDistance,
    false,
    filterFlags,
    PHYSICS_GROUPS.playerGround,
    undefined,
    body,
  )
  if (!hit || hit.normal.y < PLAYER_SUPPORT_NORMAL_Y) {
    return { y: proceduralY, rayHit: false, normalY: 1, source: 'procedural' }
  }

  const rapierY = originY - hit.timeOfImpact + bodyHeight
  if (rapierY > currentY + PLAYER_SUPPORT_PENETRATION_RECOVERY) {
    return { y: proceduralY, rayHit: false, normalY: 1, source: 'procedural' }
  }
  if (rapierY < proceduralY - 0.2) {
    return { y: proceduralY, rayHit: false, normalY: 1, source: 'procedural' }
  }
  return { y: rapierY, rayHit: true, normalY: hit.normal.y, source: 'rapier' }
}

function samplePlayerCeilingY(
  x: number,
  z: number,
  previousY: number,
  currentY: number,
  context: Pick<RapierContext, 'rapier' | 'world'>,
  body: RapierRigidBody,
  bodyHeight: number,
): number | null {
  const headFrom = previousY + bodyHeight
  const headTo = currentY + bodyHeight
  const distance = headTo - headFrom
  if (distance <= 0) return null

  const ray = new context.rapier.Ray({ x, y: headFrom, z }, { x: 0, y: 1, z: 0 })
  const filterFlags = context.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  context.world.updateSceneQueries()
  const hit = context.world.castRayAndGetNormal(
    ray,
    distance + PLAYER_HEAD_CLEARANCE,
    false,
    filterFlags,
    PHYSICS_GROUPS.playerGround,
    undefined,
    body,
  )
  if (!hit || hit.normal.y > -PLAYER_SUPPORT_NORMAL_Y) return null

  return headFrom + hit.timeOfImpact - bodyHeight - PLAYER_HEAD_CLEARANCE
}

function isHeadBlockedAt(
  x: number,
  y: number,
  z: number,
  context: Pick<RapierContext, 'rapier' | 'world'>,
  body: RapierRigidBody,
  bodyHeight: number,
): boolean {
  const ray = new context.rapier.Ray({ x, y, z }, { x: 0, y: 1, z: 0 })
  const filterFlags = context.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  context.world.updateSceneQueries()
  const hit = context.world.castRayAndGetNormal(
    ray,
    bodyHeight + PLAYER_HEAD_CLEARANCE,
    false,
    filterFlags,
    PHYSICS_GROUPS.playerGround,
    undefined,
    body,
  )
  return !!hit && hit.normal.y < PLAYER_HEAD_BLOCK_NORMAL_Y
}

function isClimbableSurfaceHit(hit: { normal1: { y: number }; normal2: { y: number } }) {
  return Math.max(hit.normal1.y, hit.normal2.y) > PLAYER_CLIMBABLE_NORMAL_Y
}

function findSafeVehicleExitPose(
  vehicleX: number,
  vehicleZ: number,
  driverY: number,
  rot: number,
  halfLength: number,
  halfWidth: number,
  radius: number,
  bodyHeight: number,
  context: Pick<RapierContext, 'rapier' | 'world'>,
  body: RapierRigidBody,
): PlayerPose & { groundY: number } {
  const forward = { x: Math.sin(rot), z: Math.cos(rot) }
  const right = { x: Math.cos(rot), z: -Math.sin(rot) }
  const side = halfWidth + radius + 0.65
  const frontBack = halfLength + radius + 0.65
  const candidates = [
    { x: right.x * side, z: right.z * side },
    { x: -right.x * side, z: -right.z * side },
    { x: -forward.x * frontBack, z: -forward.z * frontBack },
    { x: forward.x * frontBack, z: forward.z * frontBack },
    { x: right.x * (side + 0.45) - forward.x * 0.8, z: right.z * (side + 0.45) - forward.z * 0.8 },
    { x: -right.x * (side + 0.45) - forward.x * 0.8, z: -right.z * (side + 0.45) - forward.z * 0.8 },
  ]

  for (const offset of candidates) {
    const x = vehicleX + offset.x
    const z = vehicleZ + offset.z
    const ground = samplePlayerGround(x, z, driverY, context, body, bodyHeight)
    const y = Math.max(driverY, ground.y)
    if (isPlayerPoseFree(x, y, z, rot, radius, bodyHeight, context, body)) {
      return { x, y, z, rot, groundY: ground.y }
    }
  }

  const x = vehicleX + right.x * (side + 1.2)
  const z = vehicleZ + right.z * (side + 1.2)
  const ground = samplePlayerGround(x, z, driverY, context, body, bodyHeight)
  return { x, y: Math.max(driverY, ground.y), z, rot, groundY: ground.y }
}

function isPlayerPoseFree(
  x: number,
  y: number,
  z: number,
  rot: number,
  radius: number,
  bodyHeight: number,
  context: Pick<RapierContext, 'rapier' | 'world'>,
  body: RapierRigidBody,
) {
  const halfHeight = Math.max(0.25, bodyHeight * 0.42)
  const shape = new context.rapier.Capsule(halfHeight, radius)
  const filterFlags = context.rapier.QueryFilterFlags.EXCLUDE_SENSORS
  context.world.updateSceneQueries()
  return !context.world.intersectionWithShape(
    { x, y, z },
    yawToQuaternion(rot),
    shape,
    filterFlags,
    PHYSICS_GROUPS.playerHardObstacles,
    undefined,
    body,
  )
}

function poseFromObject(object: THREE.Object3D): PlayerPose {
  return { x: object.position.x, y: object.position.y, z: object.position.z, rot: object.rotation.y }
}

function poseWithVelocity(object: THREE.Object3D, velocity: { x: number; y: number; z: number }, verticalVelocity: number): PlayerPose {
  const inherited = clampInheritedVelocity({
    x: velocity.x,
    y: Math.abs(verticalVelocity) > Math.abs(velocity.y) ? verticalVelocity : velocity.y,
    z: velocity.z,
  })
  return {
    ...poseFromObject(object),
    vx: inherited.x,
    vy: inherited.y,
    vz: inherited.z,
  }
}

function rememberPlayerVelocity(
  object: THREE.Object3D,
  delta: number,
  previousPose: MutableRefObject<PlayerPose | null>,
  velocity: MutableRefObject<{ x: number; y: number; z: number }>,
  verticalVelocity: number,
) {
  const previous = previousPose.current
  const current = poseFromObject(object)
  if (previous && delta > 0) {
    velocity.current = clampInheritedVelocity({
      x: (current.x - previous.x) / delta,
      y: Math.abs(verticalVelocity) > 0.01 ? verticalVelocity : (current.y - previous.y) / delta,
      z: (current.z - previous.z) / delta,
    })
  }
  previousPose.current = current
}

function resetVelocitySample(
  object: THREE.Object3D,
  previousPose: MutableRefObject<PlayerPose | null>,
  velocity: MutableRefObject<{ x: number; y: number; z: number }>,
) {
  previousPose.current = poseFromObject(object)
  velocity.current = { x: 0, y: 0, z: 0 }
}

function clampInheritedVelocity(velocity: { x: number; y: number; z: number }) {
  const horizontal = Math.hypot(velocity.x, velocity.z)
  const horizontalLimit = 12
  const scale = horizontal > horizontalLimit ? horizontalLimit / horizontal : 1
  return {
    x: velocity.x * scale,
    y: THREE.MathUtils.clamp(velocity.y, -14, 10),
    z: velocity.z * scale,
  }
}

function recoveryPose(pose: PlayerPose | null, fallback: THREE.Object3D, bodyHeight: number): PlayerPose {
  const x = pose?.x ?? fallback.position.x
  const z = pose?.z ?? fallback.position.z
  return {
    x,
    y: groundHeight(x, z) + bodyHeight,
    z,
    rot: pose?.rot ?? fallback.rotation.y,
  }
}

function teleportKinematicPlayer(body: RapierRigidBody, target: THREE.Object3D, pose: PlayerPose) {
  body.setEnabled(true)
  body.setTranslation({ x: pose.x, y: pose.y, z: pose.z }, true)
  body.setRotation(yawToQuaternion(pose.rot), true)
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  syncKinematicPlayer(body, target, pose.x, pose.y, pose.z, pose.rot)
}

function syncKinematicPlayer(
  body: RapierRigidBody,
  target: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rot: number,
) {
  target.position.set(x, y, z)
  target.rotation.y = rot
  body.setNextKinematicTranslation({ x, y, z })
  body.setNextKinematicRotation(yawToQuaternion(rot))
}

function yawToQuaternion(rot: number) {
  const half = rot * 0.5
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }
}

/**
 * Interpolation d'angle (radians) qui prend le plus court chemin et reste
 * stable quel que soit le frame-rate. Sert a tourner le perso en douceur.
 */
function dampAngle(current: number, target: number, speed: number, delta: number): number {
  let diff = target - current
  // Ramène l'écart dans [-PI, PI] pour ne pas tourner "à l'envers".
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  const t = 1 - Math.exp(-speed * delta)
  return current + diff * t
}
