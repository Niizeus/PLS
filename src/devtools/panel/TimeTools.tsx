import {
  MINUTES_PER_DAY,
  formatGameTime,
  getDayNumber,
} from '../../gameplay/time/gameTimeStore'
import { useRunStore } from '../../gameplay/run/runStore'
import {
  actionRowStyle,
  buttonStyle,
  fieldGridStyle,
  fieldStyle,
  fieldTopStyle,
  helpStyle,
  numberInputStyle,
  readoutStyle,
} from './devPanelStyles'

/** Onglet Temps : avancer l'horloge du jeu pour tester une heure precise. */
export default function TimeTools({
  totalMinutes,
  timeScale,
  isPaused,
}: {
  totalMinutes: number
  timeScale: number
  isPaused: boolean
}) {
  const setHour = (hour: number) => {
    const store = useRunStore.getState()
    const dayStart = Math.floor(store.worldTotalMinutes / MINUTES_PER_DAY) * MINUTES_PER_DAY
    let target = dayStart + hour * 60
    if (target < store.worldTotalMinutes && hour < store.gameHour) target += MINUTES_PER_DAY
    store.setWorldTotalMinutes(target)
  }

  return (
    <div style={fieldGridStyle}>
      <div style={readoutStyle}>
        Jour {getDayNumber(totalMinutes)} - {formatGameTime(totalMinutes)} - temps x{timeScale}
      </div>
      <div style={actionRowStyle}>
        <button style={buttonStyle} onClick={() => useRunStore.getState().setPaused(!isPaused)}>
          {isPaused ? 'Reprendre le temps' : 'Figer le temps'}
        </button>
        {[1, 12, 60, 240, 720].map((scale) => (
          <button key={scale} style={buttonStyle} onClick={() => useRunStore.getState().setTimeScale(scale)}>
            x{scale}
          </button>
        ))}
      </div>
      <div style={actionRowStyle}>
        <button style={buttonStyle} onClick={() => setHour(5.5)}>Aube</button>
        <button style={buttonStyle} onClick={() => setHour(12)}>Midi</button>
        <button style={buttonStyle} onClick={() => setHour(22)}>Nuit</button>
      </div>
      <label style={fieldStyle}>
        <span style={fieldTopStyle}>
          <span>Heure de la journee</span>
          <input
            style={numberInputStyle}
            type="number"
            min={0}
            max={23.75}
            step={0.25}
            value={Math.round(((totalMinutes % MINUTES_PER_DAY) / 60) * 4) / 4}
            onChange={(event) => setHour(Number(event.target.value))}
          />
        </span>
        <input
          type="range"
          min={0}
          max={23.75}
          step={0.25}
          value={(totalMinutes % MINUTES_PER_DAY) / 60}
          onChange={(event) => setHour(Number(event.target.value))}
        />
        <small style={helpStyle}>
          Change l heure du jour : le ciel, la lumiere et le fog suivent immediatement.
        </small>
      </label>
    </div>
  )
}
