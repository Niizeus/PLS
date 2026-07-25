import {
  formatGameTime,
  getDayName,
  getDayNumber,
  getDayPhase,
  getDayPhaseLabel,
  useGameTimeStore,
} from '../gameplay/time/gameTimeStore'

export default function GameClock() {
  const displayMinute = useGameTimeStore((state) => Math.floor(state.totalMinutes))
  const dayName = getDayName(displayMinute)
  const dayNumber = getDayNumber(displayMinute)
  const phase = getDayPhaseLabel(getDayPhase(displayMinute))

  return (
    <div
      style={{
        position: 'fixed',
        top: 224,
        right: 12,
        minWidth: 138,
        padding: '9px 12px',
        borderRadius: 8,
        background: 'rgba(15, 20, 34, 0.72)',
        color: '#e6ecf5',
        textAlign: 'right',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
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
