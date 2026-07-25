import { useEffect } from 'react'
import { useGameTimeStore } from './gameTimeStore'

export default function GameTimeTicker() {
  useEffect(() => {
    let frameId = 0
    let previousTime = performance.now()

    const tick = (currentTime: number) => {
      const deltaSeconds = Math.min((currentTime - previousTime) / 1000, 0.25)
      previousTime = currentTime
      useGameTimeStore.getState().advance(deltaSeconds)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return null
}
