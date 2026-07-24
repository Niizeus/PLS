import { useEffect, useRef } from 'react'
import { MOUSE } from './keyMap'
import { useCameraStore } from '../../core/cameraStore'

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

  useEffect(() => {
    const canvas = () => document.querySelector('canvas')
    const isLocked = () => document.pointerLockElement === canvas()

    const onDown = (e: MouseEvent) => {
      // Pas encore capturé : ce clic sert juste à capturer le curseur.
      if (!isLocked()) {
        canvas()?.requestPointerLock?.()
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
      if (isLocked()) useCameraStore.getState().rotate(e.movementX, e.movementY)
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
