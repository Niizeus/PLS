import { useEffect } from 'react'
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

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return null
}
