import { useEffect } from 'react'
import { MINUTES_PER_DAY, useGameTimeStore } from './gameTimeStore'

const DEV_TIME_SCALES = [1, 12, 60, 240, 720]

declare global {
  interface Window {
    PLSDevTime?: {
      speed: (timeScale: number) => void
      hour: (hour: number) => void
      day: (dayNumber: number, hour?: number) => void
      pause: () => void
      play: () => void
    }
  }
}

function setDayHour(dayNumber: number, hour = 22) {
  const dayIndex = Math.max(0, Math.floor(dayNumber) - 1)
  useGameTimeStore.getState().setTotalMinutes(dayIndex * MINUTES_PER_DAY + hour * 60)
}

function setHour(hour: number) {
  const store = useGameTimeStore.getState()
  const currentDayStart = Math.floor(store.totalMinutes / MINUTES_PER_DAY) * MINUTES_PER_DAY
  store.setTotalMinutes(currentDayStart + hour * 60)
}

function setNextNight() {
  const store = useGameTimeStore.getState()
  const nextDayStart = (Math.floor(store.totalMinutes / MINUTES_PER_DAY) + 1) * MINUTES_PER_DAY
  store.setTotalMinutes(nextDayStart + 22 * 60)
}

export default function TimeDevControls() {
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined

    window.PLSDevTime = {
      speed: (timeScale) => useGameTimeStore.getState().setTimeScale(timeScale),
      hour: setHour,
      day: setDayHour,
      pause: () => useGameTimeStore.getState().setPaused(true),
      play: () => useGameTimeStore.getState().setPaused(false),
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'F6') {
        event.preventDefault()
        const store = useGameTimeStore.getState()
        const currentIndex = DEV_TIME_SCALES.findIndex((scale) => scale === store.timeScale)
        const nextScale = DEV_TIME_SCALES[(currentIndex + 1) % DEV_TIME_SCALES.length]
        store.setPaused(false)
        store.setTimeScale(nextScale)
      }
      if (event.code === 'F2') {
        event.preventDefault()
        setNextNight()
      }
      if (event.code === 'F7') {
        event.preventDefault()
        setHour(12)
      }
      if (event.code === 'F8') {
        event.preventDefault()
        setHour(22)
      }
      if (event.code === 'F9') {
        event.preventDefault()
        const store = useGameTimeStore.getState()
        store.setPaused(!store.isPaused)
      }
      if (event.code === 'F10') {
        event.preventDefault()
        setHour(5.5)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      delete window.PLSDevTime
    }
  }, [])

  return null
}
