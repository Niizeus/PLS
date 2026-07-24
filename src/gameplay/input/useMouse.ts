import { useEffect, useRef } from 'react'
import { MOUSE } from './keyMap'

/**
 * État souris pour le combat.
 * - `attackQueued` : déclencheur (clic gauche), consommé par le Player.
 * - `defending` : vrai tant que le clic droit est maintenu.
 */
export interface MouseState {
  attackQueued: boolean
  defending: boolean
}

export function useMouse() {
  const mouse = useRef<MouseState>({ attackQueued: false, defending: false })

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button === MOUSE.ATTACK) mouse.current.attackQueued = true
      if (e.button === MOUSE.DEFENSE) mouse.current.defending = true
    }
    const onUp = (e: MouseEvent) => {
      if (e.button === MOUSE.DEFENSE) mouse.current.defending = false
    }
    // On bloque le menu contextuel du clic droit : sinon il s'ouvre à chaque défense.
    const onContext = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('contextmenu', onContext)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('contextmenu', onContext)
    }
  }, [])

  return mouse
}
