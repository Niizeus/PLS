import { useMemo } from 'react'
import { getSkyTuning, useDevTuningStore } from '../devtools/devTuningStore'
import { useGameTimeStore } from '../gameplay/time/gameTimeStore'
import { applySkyTuning, getSkyAtmosphere } from './sky/skyAtmosphere'

export default function TimeFog() {
  const displayMinute = useGameTimeStore((state) => Math.floor(state.totalMinutes))
  const skyOverrides = useDevTuningStore((state) => state.overrides.sky)
  const tuning = useMemo(() => getSkyTuning(), [skyOverrides])
  const atmosphere = useMemo(
    () => applySkyTuning(getSkyAtmosphere(displayMinute), tuning),
    [displayMinute, tuning],
  )
  const fogIntensity = Math.max(0.25, atmosphere.fogIntensity)
  const fogNear = Math.max(24, atmosphere.fogNear / fogIntensity)
  const fogFar = Math.max(fogNear + 42, atmosphere.fogFar / Math.sqrt(fogIntensity))

  return <fog key={`${atmosphere.fog}-${fogNear.toFixed(1)}-${fogFar.toFixed(1)}`} attach="fog" args={[atmosphere.fog, fogNear, fogFar]} />
}
