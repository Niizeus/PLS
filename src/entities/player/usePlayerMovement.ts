import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { KeyboardState } from '../../gameplay/input/useKeyboard'
import type { MouseState } from '../../gameplay/input/useMouse'
import { usePlayerStore, type PlayerAction } from '../../gameplay/stats/playerStore'
import { useCameraStore } from '../../core/cameraStore'
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

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    const k = keys.current
    const m = mouse.current
    if (!group || !k || !m) return

    // On borne le delta : si l'onglet a "laggé", on évite un saut géant.
    const delta = Math.min(rawDelta, 0.1)

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
    const running = k.run && isMoving

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

      const speed = running ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED
      group.position.x += moveDir.current.x * speed * delta
      group.position.z += moveDir.current.z * speed * delta

      // Oriente le perso vers sa direction de marche (rotation douce).
      const targetAngle = Math.atan2(moveDir.current.x, moveDir.current.z)
      group.rotation.y = dampAngle(group.rotation.y, targetAngle, PLAYER.TURN_SPEED, delta)

      moveIntensity = running ? 1 : 0.5
    }

    // Le perso reste collé au sol (pas de saut pour l'instant).
    group.position.y = PLAYER.BODY_HEIGHT

    // --- 4. Détermine l'action affichée (priorité : attaque > défense > mouvement) ---
    let action: PlayerAction
    if (attackTimer.current > 0) action = 'attack'
    else if (interactTimer.current > 0) action = 'interact'
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
