import { useEffect, useRef } from 'react'
import { useGameTimeStore } from '../time/gameTimeStore'
import { useCharacterStatsStore } from './characterStatsStore'

const NEED_DECAY_GAME_MINUTES = 30

export default function NeedsTicker() {
  const lastNeedsBucket = useRef(Math.floor(useGameTimeStore.getState().totalMinutes / NEED_DECAY_GAME_MINUTES))

  useEffect(() => {
    const tick = () => {
      const stats = useCharacterStatsStore.getState()
      stats.purgeExpiredEffects()
      const currentBucket = Math.floor(useGameTimeStore.getState().totalMinutes / NEED_DECAY_GAME_MINUTES)
      const missedTicks = currentBucket - lastNeedsBucket.current
      if (missedTicks <= 0) return
      for (let i = 0; i < missedTicks; i++) stats.decayNeeds()
      lastNeedsBucket.current = currentBucket
    }
    const effectId = window.setInterval(tick, 1000)
    return () => window.clearInterval(effectId)
  }, [])

  return null
}
