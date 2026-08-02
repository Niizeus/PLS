import { useEffect } from 'react'
import { useGameTimeStore } from '../time/gameTimeStore'
import { processRunTimelineEvents } from './runEvents'
import { useRunStore } from './runStore'

export default function RunTicker() {
  useEffect(() => {
    let frameId = 0
    let previousTime = performance.now()

    const syncGameTimeFacade = () => {
      const run = useRunStore.getState()
      useGameTimeStore.getState().syncFromRunClock(run.worldTotalMinutes, run.timeScale, run.isPaused)
    }

    const tick = (currentTime: number) => {
      const deltaSeconds = Math.min((currentTime - previousTime) / 1000, 0.25)
      previousTime = currentTime

      useRunStore.getState().advance(deltaSeconds)
      processRunTimelineEvents()
      syncGameTimeFacade()

      frameId = window.requestAnimationFrame(tick)
    }

    syncGameTimeFacade()
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return null
}
