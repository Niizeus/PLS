import {
  formatGameTime,
  getDayName,
  getDayNumber,
  getDayPhase,
  getDayPhaseLabel,
  useGameTimeStore,
} from '../gameplay/time/gameTimeStore'
import { HUD, hardShadow, outline } from './hudStyle'

/**
 * 🕒 L'heure du jeu, en **étiquette accrochée sous la minimap**.
 *
 * Elle était présentée comme un panneau autonome, de la même taille et de la
 * même couleur que tout le reste — trois lignes pour dire l'heure. Elle fait
 * maintenant corps avec la minimap (coins hauts droits, pas d'écart entre les
 * deux) : une seule chose à regarder en haut à droite au lieu de deux.
 */
export default function GameClock() {
  const displayMinute = useGameTimeStore((state) => Math.floor(state.totalMinutes))
  const timeScale = useGameTimeStore((state) => state.timeScale)
  const isPaused = useGameTimeStore((state) => state.isPaused)

  return (
    <div
      style={{
        // Collée sous la minimap : coins du haut carrés, marge négative pour
        // recouvrir son contour et n'avoir qu'un seul trait d'encre entre les deux.
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
        {getDayName(displayMinute)} {getDayNumber(displayMinute)} · {getDayPhaseLabel(getDayPhase(displayMinute))}
        {import.meta.env.DEV && (isPaused || timeScale !== 1) ? ` ×${isPaused ? 0 : timeScale}` : ''}
      </span>
    </div>
  )
}
