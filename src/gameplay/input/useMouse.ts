import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MOUSE } from './keyMap'
import { isCursorUiOpen } from './pointerLock'
import { useCameraStore } from '../../core/cameraStore'
import { FRAME } from '../../core/framePriority'

/**
 * Entrées souris du jeu :
 *  - `attackQueued` : déclencheur (clic gauche), consommé par le Player.
 *  - `defending`    : vrai tant que le clic droit est maintenu.
 *  - la CAMÉRA : quand le curseur est "capturé" (pointer lock), les mouvements de
 *    souris font tourner la caméra autour du perso (via le cameraStore).
 *
 * Fonctionnement du pointer lock : un premier clic sur la scène capture le curseur
 * (il disparaît et la souris pilote la caméra). Touche Échap = on libère le curseur.
 * Ce premier clic de capture ne déclenche PAS d'attaque (sinon on frappe sans le vouloir).
 */
export interface MouseState {
  attackQueued: boolean
  defending: boolean
}

export function useMouse() {
  const mouse = useRef<MouseState>({ attackQueued: false, defending: false })

  // Les mouvements souris sont accumulés à l'arrivée et appliqués ICI, une fois
  // par image, AVANT tout le reste (voir cameraStore.ts pour le pourquoi).
  useFrame(() => useCameraStore.getState().flushRotation(), FRAME.INPUT)

  useEffect(() => {
    const canvas = () => document.querySelector('canvas')
    const isLocked = () => document.pointerLockElement === canvas()

    const onDown = (e: MouseEvent) => {
      // On ne réagit QUE si le clic vise le canvas du jeu (le 1er). Sinon (carte
      // ouverte, HUD...) on laisse le curseur tranquille — il ne doit pas disparaître.
      if (e.target !== canvas()) return
      // Pas encore capturé : ce clic sert juste à capturer le curseur... sauf si
      // une interface cliquable est ouverte (téléphone, panneau dev). Sinon un
      // clic à côté du téléphone ferait disparaître le curseur alors qu'on est
      // en train de s'en servir.
      if (!isLocked()) {
        if (!isCursorUiOpen()) canvas()?.requestPointerLock?.()
        return
      }
      if (e.button === MOUSE.ATTACK) mouse.current.attackQueued = true
      if (e.button === MOUSE.DEFENSE) mouse.current.defending = true
    }
    const onUp = (e: MouseEvent) => {
      if (e.button === MOUSE.DEFENSE) mouse.current.defending = false
    }
    const onMove = (e: MouseEvent) => {
      // On ne tourne la caméra que curseur capturé (sinon la souris fait autre chose).
      if (isLocked()) useCameraStore.getState().queueRotation(e.movementX, e.movementY)
    }
    // On bloque le menu contextuel du clic droit : sinon il s'ouvre à chaque défense.
    const onContext = (e: MouseEvent) => e.preventDefault()
    // Si on perd la capture (Échap, alt-tab...), on relâche la défense pour éviter un état bloqué.
    const onLockChange = () => {
      if (!isLocked()) mouse.current.defending = false
    }

    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('contextmenu', onContext)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('contextmenu', onContext)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [])

  return mouse
}
