import {
  formatGameTime,
  getDayName,
  getDayNumber,
  getDayPhase,
  getDayPhaseLabel,
  useGameTimeStore,
} from '../gameplay/time/gameTimeStore'
import { useRunStore } from '../gameplay/run/runStore'
import { formatRunCountdown } from '../gameplay/run/runTime'
import { HUD, hardShadow, outline } from './hudStyle'

export default function GameClock() {
  const displayMinute = useGameTimeStore((state) => Math.floor(state.totalMinutes))
  const timeScale = useGameTimeStore((state) => state.timeScale)
  const isPaused = useGameTimeStore((state) => state.isPaused)
  const runStatus = useRunStore((state) => state.status)
  const runRemainingSeconds = useRunStore((state) => state.realRemainingSeconds)

  return (
    <div
      style={{
        marginTop: -3,
        padding: '4px 12px 5px',
        borderRadius: `0 0 ${HUD.radius}px ${HUD.radius}px`,
        background: HUD.paper,
        border: outline,
        boxShadow: hardShadow,
        color: HUD.ink,
        display: 'flex',
        alignItems: 'baseline',
        gap: 7,
      }}
    >
      <strong style={{ font: `900 20px ${HUD.font}`, lineHeight: 1 }}>{formatGameTime(displayMinute)}</strong>
      <span style={{ font: `800 11px ${HUD.font}`, color: HUD.textDim }}>
        {getDayName(displayMinute)} {getDayNumber(displayMinute)} - {getDayPhaseLabel(getDayPhase(displayMinute))} -{' '}
        {runStatus === 'active' ? formatRunCountdown(runRemainingSeconds) : runStatus}
        {import.meta.env.DEV && (isPaused || timeScale !== 1) ? ` x${isPaused ? 0 : timeScale}` : ''}
      </span>
    </div>
  )
}
