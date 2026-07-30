import { useEffect } from 'react'
import { setCursorUiOpen } from '../gameplay/input/pointerLock'
import { useDevTuningStore } from './devTuningStore'

export default function DevToolsControls() {
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined

    useDevTuningStore.getState().loadProjectTuning()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'F2') {
        event.preventDefault()
        useDevTuningStore.getState().toggleOpen()
      }
      if (event.code === 'Escape' && useDevTuningStore.getState().isOpen) {
        event.preventDefault()
        useDevTuningStore.getState().setOpen(false)
      }
    }

    // Panneau ouvert = curseur rendu au joueur. On s'abonne au store plutôt que
    // de le faire dans le raccourci F2 : le panneau se ferme aussi par son propre
    // bouton, et le curseur doit suivre dans tous les cas.
    const unsubscribe = useDevTuningStore.subscribe((state) =>
      setCursorUiOpen('devtools', state.isOpen),
    )

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      unsubscribe()
      setCursorUiOpen('devtools', false)
    }
  }, [])

  return null
}
