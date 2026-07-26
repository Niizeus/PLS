import {
  formatGameTime,
  getDayName,
  getDayNumber,
  getDayPhase,
  getDayPhaseLabel,
  useGameTimeStore,
} from '../gameplay/time/gameTimeStore'
import { panel } from './hudStyle'

export default function GameClock() {
  const displayMinute = useGameTimeStore((state) => Math.floor(state.totalMinutes))
  const dayName = getDayName(displayMinute)
  const dayNumber = getDayNumber(displayMinute)
  const phase = getDayPhaseLabel(getDayPhase(displayMinute))

  return (
    // Position gérée par la colonne droite du HUD (`Hud.tsx`).
    <div style={{ ...panel, minWidth: 138, padding: '9px 12px', textAlign: 'right' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#b8c5d8' }}>
        {dayName} - Jour {dayNumber}
      </div>
      <div style={{ marginTop: 1, fontSize: 24, lineHeight: 1, fontWeight: 900 }}>
        {formatGameTime(displayMinute)}
      </div>
      <div style={{ marginTop: 3, fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>{phase}</div>
    </div>
  )
}
