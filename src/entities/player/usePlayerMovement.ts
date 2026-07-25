import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import type { MouseState } from '../../gameplay/input/useMouse'
import { useInventoryStore } from '../../gameplay/inventory/inventoryStore'
import { useCharacterStatsStore } from '../../gameplay/stats/characterStatsStore'
import { getEffectiveStats, getMovementSpeedMultiplier } from '../../gameplay/stats/effectiveStats'
import { usePlayerStore, type PlayerAction } from '../../gameplay/stats/playerStore'
import { useCameraStore } from '../../core/cameraStore'
import { useScooterStore } from '../vehicles/scooterStore'
import { SCOOTER } from '../vehicles/scooterConfig'
import { isBlocked } from '../../world/beauvais/collision'
import { terrainHeight } from '../../world/beauvais/cityData'
import { zoneAt } from '../../world/beauvais/zones'
import { PLAYER } from './playerConfig'

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
  const setDefending = usePlayerStore((s) => s.setDefending)
  const setZoneName = usePlayerStore((s) => s.setZoneName)

  // Dernier quartier détecté : on ne met à jour le store que quand il CHANGE.
  const lastZoneId = useRef<string | null>('__init__')

  // Minuteurs internes (en secondes restantes).
  const attackTimer = useRef(0)
  const interactTimer = useRef(0)

  // État visuel renvoyé au composant Player.
  const motion = useRef<PlayerMotion>({
    action: 'idle',
    attackProgress: 0,
    interactProgress: 0,
    moveIntensity: 0,
  })

  // Vecteurs réutilisés chaque frame (on évite d'en allouer dans la boucle).
  const moveDir = useRef(new THREE.Vector3())
  // Vitesse courante du scooter (scalaire, le long de son orientation).
  const rideSpeed = useRef(0)
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

    // --- 0. Scooter : monter / descendre (E), puis conduire si on roule ---
    const scooter = useScooterStore.getState()
    let riding = scooter.riding

    if (k.interactQueued) {
      if (!riding) {
        // Monter si on est assez près du scooter garé.
        const dx = group.position.x - scooter.parkedX
        const dz = group.position.z - scooter.parkedZ
        if (dx * dx + dz * dz <= SCOOTER.MOUNT_RANGE * SCOOTER.MOUNT_RANGE) {
          k.interactQueued = false
          group.position.set(
            scooter.parkedX,
            terrainHeight(scooter.parkedX, scooter.parkedZ) + SCOOTER.SEAT_HEIGHT,
            scooter.parkedZ,
          )
          group.rotation.y = scooter.parkedRot
          rideSpeed.current = 0
          scooter.mount()
          riding = true
        }
      } else {
        // Descendre : garer le scooter ici, et poser le joueur juste à côté.
        k.interactQueued = false
        const rot = group.rotation.y
        scooter.parkAt(group.position.x, group.position.z, rot)
        group.position.x += Math.cos(rot) * 1.2
        group.position.z += -Math.sin(rot) * 1.2
        rideSpeed.current = 0
        riding = false
      }
    }

    if (riding) {
      driveScooter(group, k, rideSpeed, delta)
      const vis = motion.current
      vis.action = Math.abs(rideSpeed.current) > 0.2 ? 'run' : 'idle'
      vis.attackProgress = 0
      vis.interactProgress = 0
      vis.moveIntensity = 0 // pas d'animation de marche quand on roule
      if (usePlayerStore.getState().action !== vis.action) setAction(vis.action)
      if (usePlayerStore.getState().isDefending) setDefending(false)
      return
    }

    // --- 1. Déclencheurs consommés (attaque / interaction) ---
    if (m.attackQueued) {
      m.attackQueued = false
      // On (re)lance l'attaque même si on en faisait déjà une (enchaînement).
      attackTimer.current = PLAYER.ATTACK_DURATION
    }
    if (k.interactQueued) {
      k.interactQueued = false
      interactTimer.current = PLAYER.INTERACT_DURATION
    }
    if (attackTimer.current > 0) attackTimer.current -= delta
    if (interactTimer.current > 0) interactTimer.current -= delta

    // --- 2. Intentions de déplacement depuis ZQSD ---
    // fwd    : avant(+) / arrière(-)
    // strafe : droite(+) / gauche(-)
    const fwd = (k.forward ? 1 : 0) - (k.backward ? 1 : 0)
    const strafe = (k.right ? 1 : 0) - (k.left ? 1 : 0)

    const isMoving = fwd !== 0 || strafe !== 0
    const isDefending = m.defending
    const crouching = k.crouch
    const running = k.run && isMoving && !crouching

    // --- Saut (physique verticale) ---
    const grounded = jumpY.current <= 0.001
    if (k.jumpQueued) {
      k.jumpQueued = false
      if (grounded && !crouching && !isDefending) vy.current = PLAYER.JUMP_SPEED
    }
    vy.current -= PLAYER.GRAVITY * delta
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
    if (isMoving && !isDefending) {
      // En défense on reste planté (bouclier levé) : plus lisible, plus tactique.
      const yaw = useCameraStore.getState().yaw
      const sin = Math.sin(yaw)
      const cos = Math.cos(yaw)
      // avant = à l'opposé de la caméra (qui est derrière) ; droite = perpendiculaire.
      const dirX = -sin * fwd + cos * strafe
      const dirZ = -cos * fwd - sin * strafe
      moveDir.current.set(dirX, 0, dirZ)
      if (moveDir.current.lengthSq() > 0) moveDir.current.normalize()

      const inventory = useInventoryStore.getState()
      const characterStats = useCharacterStatsStore.getState()
      const effectiveStats = getEffectiveStats(characterStats, inventory.equipped, characterStats.activeEffects)
      const speedMultiplier = getMovementSpeedMultiplier(effectiveStats, inventory.items)
      const speed = (crouching ? PLAYER.CROUCH_SPEED : running ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED) * speedMultiplier
      // Collisions : on teste chaque axe séparément → on glisse le long des murs.
      const nx = group.position.x + moveDir.current.x * speed * delta
      if (!isBlocked(nx, group.position.z)) group.position.x = nx
      const nz = group.position.z + moveDir.current.z * speed * delta
      if (!isBlocked(group.position.x, nz)) group.position.z = nz

      // Oriente le perso vers sa direction de marche (rotation douce).
      const targetAngle = Math.atan2(moveDir.current.x, moveDir.current.z)
      group.rotation.y = dampAngle(group.rotation.y, targetAngle, PLAYER.TURN_SPEED, delta)

      moveIntensity = running ? 1 : 0.5
    }

    // Colle le perso au relief, + la hauteur de saut éventuelle.
    group.position.y =
      terrainHeight(group.position.x, group.position.z) + PLAYER.BODY_HEIGHT + jumpY.current

    // --- 4. Détermine l'action affichée (priorité : attaque > saut > accroupi > ...) ---
    let action: PlayerAction
    if (attackTimer.current > 0) action = 'attack'
    else if (airborne) action = 'jump'
    else if (interactTimer.current > 0) action = 'interact'
    else if (crouching) action = 'crouch'
    else if (isDefending) action = 'defense'
    else if (running) action = 'run'
    else if (isMoving) action = 'walk'
    else action = 'idle'

    // --- 5. Publie l'état visuel + le store (uniquement si ça change, pour le HUD) ---
    const vis = motion.current
    vis.action = action
    vis.attackProgress =
      attackTimer.current > 0 ? 1 - attackTimer.current / PLAYER.ATTACK_DURATION : 0
    vis.interactProgress =
      interactTimer.current > 0 ? 1 - interactTimer.current / PLAYER.INTERACT_DURATION : 0
    vis.moveIntensity = moveIntensity

    if (usePlayerStore.getState().action !== action) setAction(action)
    if (usePlayerStore.getState().isDefending !== isDefending) setDefending(isDefending)
  })

  return motion
}

/**
 * Physique simple du scooter : accélère/freine (Z/S), braque (Q/D) d'autant plus
 * qu'on va vite, et avance dans la direction où il pointe. La marche arrière
 * inverse le braquage, comme un vrai véhicule.
 */
function driveScooter(
  group: THREE.Group,
  k: KeyboardState,
  rideSpeed: { current: number },
  delta: number,
) {
  // Accélération / frein / frein moteur
  if (k.forward) rideSpeed.current += SCOOTER.ACCEL * delta
  else if (k.backward) rideSpeed.current -= SCOOTER.BRAKE * delta
  else {
    const f = SCOOTER.FRICTION * delta
    rideSpeed.current =
      rideSpeed.current > 0
        ? Math.max(0, rideSpeed.current - f)
        : Math.min(0, rideSpeed.current + f)
  }
  // Borne la vitesse (avant / arrière)
  rideSpeed.current = Math.max(
    -SCOOTER.REVERSE_SPEED,
    Math.min(SCOOTER.MAX_SPEED, rideSpeed.current),
  )

  // Braquage : proportionnel à la vitesse (on ne tourne pas à l'arrêt).
  const steer = (k.left ? 1 : 0) - (k.right ? 1 : 0)
  if (steer !== 0) {
    group.rotation.y += steer * SCOOTER.STEER * (rideSpeed.current / SCOOTER.MAX_SPEED) * delta
  }

  // Avance dans la direction où pointe le scooter, avec collisions (axe par axe).
  const nx = group.position.x + Math.sin(group.rotation.y) * rideSpeed.current * delta
  const nz = group.position.z + Math.cos(group.rotation.y) * rideSpeed.current * delta
  let moved = false
  if (!isBlocked(nx, group.position.z)) {
    group.position.x = nx
    moved = true
  }
  if (!isBlocked(group.position.x, nz)) {
    group.position.z = nz
    moved = true
  }
  if (!moved) rideSpeed.current = 0 // on a tapé un mur : on s'arrête
  group.position.y = terrainHeight(group.position.x, group.position.z) + SCOOTER.SEAT_HEIGHT
}

/**
 * Interpolation d'angle (radians) qui prend le plus court chemin et reste
 * stable quel que soit le frame-rate. Sert à tourner le perso en douceur.
 */
function dampAngle(current: number, target: number, speed: number, delta: number): number {
  let diff = target - current
  // Ramène l'écart dans [-PI, PI] pour ne pas tourner "à l'envers".
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  const t = 1 - Math.exp(-speed * delta)
  return current + diff * t
}
