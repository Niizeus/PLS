import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import type { MouseState } from '../../gameplay/input/useMouse'
import { useInventoryStore } from '../../gameplay/inventory/inventoryStore'
import { useCharacterStatsStore } from '../../gameplay/stats/characterStatsStore'
import { getEffectiveStats, getMovementSpeedMultiplier } from '../../gameplay/stats/effectiveStats'
import { usePlayerStore, type AttackMove, type PlayerAction } from '../../gameplay/stats/playerStore'
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

const SCOOTER_RADIO_ID = 'vehicle:scooter:prototype'
const CAR_RADIO_ID = 'vehicle:car:prototype'

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
  keys: RefObject<KeyboardState>,
  mouse: RefObject<MouseState>,
) {
  const setAction = usePlayerStore((s) => s.setAction)
  const rapierContext = useRapier()
  const setDefending = usePlayerStore((s) => s.setDefending)
  const setZoneName = usePlayerStore((s) => s.setZoneName)
  const strike = usePlayerStore((s) => s.strike)
  const endStrike = usePlayerStore((s) => s.endStrike)

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
  // Etats de conduite conserves hors React pour eviter les re-render par frame.
  const scooterDrive = useRef(createVehicleDriveState())
  // Hauteur de sol lissee pour eviter les secousses camera sur routes/bordures.
  const groundY = useRef<number | null>(null)
  // Saut : hauteur au-dessus du sol + vitesse verticale.
  const jumpY = useRef(0)
  const vy = useRef(0)

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    const k = keys.current
    const m = mouse.current
    if (!group || !k || !m) return

    // Quartier courant (marche ou scooter) : ne pousse au store que si ça change.
    const zone = zoneAt(group.position.x, group.position.z)
    const zoneId = zone ? zone.id : null
    if (zoneId !== lastZoneId.current) {
      lastZoneId.current = zoneId
      setZoneName(zone ? zone.name : null)
    }

    // On borne le delta : si l'onglet a "laggé", on évite un saut géant.
    const delta = Math.min(rawDelta, 0.1)
    const playerTuning = getPlayerTuning()
    const scooterTuning = getVehicleTuning('scooter')
    const carTuning = getVehicleTuning('car')

    // --- 0. Vehicules : monter / descendre (E), puis conduire si on roule ---
    const scooter = useScooterStore.getState()
    const car = useCarStore.getState()
    const ridingScooter = scooter.riding
    const ridingCar = car.riding
    let riding = ridingScooter || ridingCar

    if (k.interactQueued) {
      if (!riding) {
        let nearest: 'scooter' | 'car' | null = null
        let nearestD2 = Infinity

        const scooterDx = group.position.x - scooter.parkedX
        const scooterDz = group.position.z - scooter.parkedZ
        const scooterD2 = scooterDx * scooterDx + scooterDz * scooterDz
        if (scooterD2 <= scooterTuning.MOUNT_RANGE * scooterTuning.MOUNT_RANGE && scooterD2 < nearestD2) {
          nearest = 'scooter'
          nearestD2 = scooterD2
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
          group.position.set(
            scooter.parkedX,
            groundHeight(scooter.parkedX, scooter.parkedZ) + scooterTuning.SEAT_HEIGHT,
            scooter.parkedZ,
          )
          group.rotation.y = scooter.parkedRot
          stopVehicle(scooterDrive.current)
          scooter.mount()
          useRadioStore.getState().startVehicleRadio(SCOOTER_RADIO_ID)
          riding = true
        } else if (nearest === 'car') {
          k.interactQueued = false
          group.position.set(car.driverX, car.driverY, car.driverZ)
          group.rotation.y = car.physicsRot
          car.mount()
          useRadioStore.getState().startVehicleRadio(CAR_RADIO_ID)
          riding = true
        }
      } else if (ridingScooter) {
        k.interactQueued = false
        const rot = group.rotation.y
        scooter.parkAt(group.position.x, group.position.z, rot)
        group.position.x += Math.cos(rot) * 1.2
        group.position.z += -Math.sin(rot) * 1.2
        stopVehicle(scooterDrive.current)
        useRadioStore.getState().stopRadio(SCOOTER_RADIO_ID)
        riding = false
      } else if (ridingCar) {
        k.interactQueued = false
        const carState = useCarStore.getState()
        const rot = carState.physicsRot
        const exitX = carState.physicsX + Math.cos(rot) * 1.9
        const exitZ = carState.physicsZ + -Math.sin(rot) * 1.9
        const exitGroundY = groundHeight(exitX, exitZ) + playerTuning.BODY_HEIGHT
        const exitY = Math.max(carState.driverY, exitGroundY)
        carState.parkAt(carState.physicsX, carState.physicsZ, rot)
        group.position.set(exitX, exitY, exitZ)
        group.rotation.y = rot
        groundY.current = exitGroundY
        jumpY.current = Math.max(0, exitY - exitGroundY)
        vy.current = carState.velocityY
        useRadioStore.getState().stopRadio(CAR_RADIO_ID)
        riding = false
      }
    }

    const activeScooter = useScooterStore.getState().riding
    const activeCar = useCarStore.getState().riding
    riding = activeScooter || activeCar

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
      if (Math.abs(scooterDrive.current.speed) > 0.2) {
        scooterState.consumeFuel((Math.abs(scooterDrive.current.speed) * 0.000009 + (k.forward ? 0.000015 : 0)) * delta)
      }
      scooterState.setVisualAttitude(scooterDrive.current.pitch, scooterDrive.current.roll)
      publishTelemetry('scooter', scooterDrive.current, scooterTuning, scooterState)
    } else if (activeCar) {
      const carState = useCarStore.getState()
      carState.setControlsFromKeyboard(carState.fuelLiters > 0 ? k : withoutThrottle(k))
      group.position.set(carState.driverX, carState.driverY, carState.driverZ)
      group.rotation.y = carState.physicsRot
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
      if (usePlayerStore.getState().isDefending) setDefending(false)
      return
    }

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

    // --- Saut (physique verticale) ---
    const grounded = jumpY.current <= 0.001
    if (k.jumpQueued) {
      k.jumpQueued = false
      if (grounded && !crouching && !isDefending && hurtTimer.current <= 0) vy.current = playerTuning.JUMP_SPEED
    }
    vy.current -= playerTuning.GRAVITY * delta
    jumpY.current += vy.current * delta
    if (jumpY.current < 0) {
      jumpY.current = 0
      vy.current = 0
    }
    const airborne = jumpY.current > 0.05

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

      const speedMultiplier = getMovementSpeedMultiplier(effectiveStats, inventory.items)
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

    // Colle le perso au relief, + la hauteur de saut éventuelle.
    const targetGroundY = groundHeight(group.position.x, group.position.z) + playerTuning.BODY_HEIGHT
    groundY.current = smoothGroundY(groundY.current, targetGroundY, delta)
    group.position.y = groundY.current + jumpY.current

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
    if (usePlayerStore.getState().isDefending !== isDefending) setDefending(isDefending)
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
