import { usePlayerStore, type PlayerAction } from '../gameplay/stats/playerStore'
import ControlsHint from './ControlsHint'
import FpsCounter from './FpsCounter'
import GameClock from './GameClock'
import InventoryPanel from './InventoryPanel'
import MapMarkerPrompt from './MapMarkerPrompt'
import Minimap from './Minimap'
import PickupPrompt from './PickupPrompt'
import QuickBar from './QuickBar'
import StatsPanel from './StatsPanel'
import VehicleDashboard from './VehicleDashboard'
import WorldMap from './WorldMap'
import { HUD, column, panel } from './hudStyle'

// Libellés lisibles pour l'état affiché en haut à gauche.
const ACTION_LABEL: Record<PlayerAction, string> = {
  idle: 'À l’arrêt',
  walk: 'Marche',
  sadWalk: 'Marche triste',
  run: 'Course',
  attack: 'Attaque !',
  defense: 'Défense',
  interact: 'Interaction',
  jump: 'Saut',
  crouch: 'Accroupi',
  hurt: 'Touché !',
}

/**
 * Interface 2D superposée à la 3D.
 * Elle N'INTERCEPTE PAS les clics (pointerEvents none) pour que le clic
 * gauche/droit aille bien au jeu (attaque/défense).
 *
 * ── Mise en page ────────────────────────────────────────────────────────────
 * L'écran est organisé en QUATRE zones, et c'est ce fichier qui décide de tout :
 *
 *   ┌─ colonne gauche ──────────────── colonne droite ─┐
 *   │  identité + stats                minimap, heure  │
 *   │                                  FPS             │
 *   │                                                  │
 *   │  touches (F1)      raccourcis      tableau bord  │
 *   └──────────────────────────────────────────────────┘
 *
 * Les deux colonnes s'empilent toutes seules (`display: grid`). Avant, chaque
 * bloc portait son propre `position: fixed` avec un `top` écrit en dur (88, 184,
 * 224...) : ajouter une ligne quelque part obligeait à recalculer les suivants à
 * la main, et le moindre oubli faisait se chevaucher deux panneaux.
 * Les composants ne connaissent plus leur position — seulement leur contenu.
 */
export default function Hud() {
  const action = usePlayerStore((s) => s.action)
  const zoneName = usePlayerStore((s) => s.zoneName)

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      <div style={column('left')}>
        {/* Carte d'identité : qui on est, ce qu'on fait, où on est. */}
        <div style={{ ...panel, padding: '10px 14px' }}>
          <div style={{ font: `700 15px ${HUD.font}`, letterSpacing: 0.4 }}>
            PLS — Prototype jouable
          </div>
          <div style={{ marginTop: 4, font: `13px ${HUD.font}`, color: HUD.text, opacity: 0.9 }}>
            Chibrux : <strong>{ACTION_LABEL[action]}</strong>
          </div>
          <div style={{ marginTop: 2, font: `12px ${HUD.font}`, color: HUD.textDim }}>
            📍 {zoneName ?? 'Beauvais'}
          </div>
        </div>
        <StatsPanel />
      </div>

      <div style={column('right')}>
        <Minimap />
        <GameClock />
        <FpsCounter />
      </div>

      <ControlsHint />
      <PickupPrompt />
      <MapMarkerPrompt />
      <InventoryPanel />
      <QuickBar />
      <VehicleDashboard />

      {/* Grande carte (touche M) : gère elle-même son ouverture/fermeture. */}
      <WorldMap />
    </div>
  )
}
