import { useEffect, useRef } from 'react'
import { KEY } from './keyMap'

/**
 * État clavier lu chaque frame par le personnage.
 * - Les booléens de direction restent vrais tant que la touche est enfoncée.
 * - `interactQueued` est un "déclencheur" : mis à true au moment de l'appui sur E,
 *   à remettre à false par celui qui le consomme (le Player).
 */
export interface KeyboardState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  run: boolean
  interactQueued: boolean
  jumpQueued: boolean
  crouch: boolean
  /** Frein à main MAINTENU (Espace en véhicule). */
  handbrake: boolean
  /** Klaxon MAINTENU (F en véhicule). */
  horn: boolean
  /** Déclencheurs véhicule : à remettre à false par celui qui les consomme. */
  limiterQueued: boolean
  lightsQueued: boolean
}

const createEmptyState = (): KeyboardState => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false,
  interactQueued: false,
  jumpQueued: false,
  crouch: false,
  handbrake: false,
  horn: false,
  limiterQueued: false,
  lightsQueued: false,
})

/**
 * Branche les écouteurs clavier une seule fois et renvoie une réf mutable.
 * On passe par une réf (pas un state React) pour NE PAS re-render à chaque
 * touche : la logique de jeu lit cette réf dans useFrame, hors de React.
 */
export function useKeyboard() {
  const keys = useRef<KeyboardState>(createEmptyState())

  useEffect(() => {
    const setKey = (code: string, pressed: boolean) => {
      const k = keys.current
      switch (code) {
        case KEY.FORWARD:
          k.forward = pressed
          break
        case KEY.BACKWARD:
          k.backward = pressed
          break
        case KEY.LEFT:
          k.left = pressed
          break
        case KEY.RIGHT:
          k.right = pressed
          break
        case KEY.RUN:
          k.run = pressed
          break
        case KEY.INTERACT:
          // On ne déclenche l'action que sur l'appui (pas en maintenant E).
          if (pressed) k.interactQueued = true
          break
        case KEY.JUMP:
          // Déclencheur : au moment de l'appui sur Espace.
          if (pressed) k.jumpQueued = true
          // La MÊME touche sert de frein à main en véhicule, mais en maintien.
          // Les deux cohabitent : à pied on ignore `handbrake`, au volant on
          // ignore `jumpQueued` (voir usePlayerMovement).
          k.handbrake = pressed
          break
        case KEY.CROUCH:
          k.crouch = pressed
          break
        case KEY.VEHICLE_HORN:
          k.horn = pressed
          break
        case KEY.VEHICLE_LIMITER:
          if (pressed) k.limiterQueued = true
          break
        case KEY.VEHICLE_LIGHTS:
          if (pressed) k.lightsQueued = true
          break
      }
    }

    const onDown = (e: KeyboardEvent) => setKey(e.code, true)
    const onUp = (e: KeyboardEvent) => setKey(e.code, false)
    // Si l'onglet perd le focus, on relâche tout pour éviter un perso "bloqué".
    const onBlur = () => {
      keys.current = createEmptyState()
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return keys
}
