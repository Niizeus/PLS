import { useEffect } from 'react'
import { useCharacterStatsStore } from './characterStatsStore'

const TICK_MS = 8000

export default function NeedsTicker() {
  useEffect(() => {
    const tick = () => {
      const stats = useCharacterStatsStore.getState()
      stats.purgeExpiredEffects()
    }
    const effectId = window.setInterval(tick, 1000)
    const needsId = window.setInterval(() => useCharacterStatsStore.getState().decayNeeds(), TICK_MS)
    return () => {
      window.clearInterval(effectId)
      window.clearInterval(needsId)
    }
  }, [])

  return null
}
