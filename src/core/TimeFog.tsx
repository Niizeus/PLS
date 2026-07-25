import { useMemo } from 'react'
import { getSkyColors, useGameTimeStore } from '../gameplay/time/gameTimeStore'

export default function TimeFog() {
  const displayMinute = useGameTimeStore((state) => Math.floor(state.totalMinutes))
  const colors = useMemo(() => getSkyColors(displayMinute), [displayMinute])

  return <fog key={colors.fog} attach="fog" args={[colors.fog, 65, 150]} />
}
