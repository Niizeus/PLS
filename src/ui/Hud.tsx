import { usePlayerStore, type PlayerAction } from '../gameplay/stats/playerStore'
import ControlsHint from './ControlsHint'
import FpsCounter from './FpsCounter'
import InventoryPanel from './InventoryPanel'
import Minimap from './Minimap'
import PickupPrompt from './PickupPrompt'
import QuickBar from './QuickBar'
import StatsPanel from './StatsPanel'
import WorldMap from './WorldMap'

// Libellés lisibles pour l'état affiché en haut à gauche.
const ACTION_LABEL: Record<PlayerAction, string> = {
  idle: 'À l’arrêt',
  walk: 'Marche',
  run: 'Course',
  attack: 'Attaque !',
  defense: 'Défense',
  interact: 'Interaction',
  jump: 'Saut',
  crouch: 'Accroupi',
}

/**
 * Interface 2D superposée à la 3D.
 * Elle N'INTERCEPTE PAS les clics (pointerEvents none) pour que le clic
 * gauche/droit aille bien au jeu (attaque/défense).
 */
export default function Hud() {
  const action = usePlayerStore((s) => s.action)

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      {/* Titre + état courant */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(15, 20, 34, 0.7)',
          color: '#e6ecf5',
        }}
      >
        <div style={{ font: '700 16px system-ui, sans-serif', letterSpacing: 0.5 }}>
          PLS — Prototype jouable
        </div>
        <div style={{ marginTop: 4, font: '13px system-ui, sans-serif', opacity: 0.85 }}>
          Chibrux : <strong>{ACTION_LABEL[action]}</strong>
        </div>
      </div>

      <Minimap />
      <StatsPanel />
      <FpsCounter />
      <ControlsHint />
      <PickupPrompt />
      <InventoryPanel />
      <QuickBar />

      {/* Grande carte (touche M) : gère elle-même son ouverture/fermeture. */}
      <WorldMap />
    </div>
  )
}
