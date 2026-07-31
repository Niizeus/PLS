import ControlsHint from './ControlsHint'
import FpsCounter from './FpsCounter'
import GameClock from './GameClock'
import InventoryPanel from './InventoryPanel'
import MapMarkerPrompt from './MapMarkerPrompt'
import Minimap from './Minimap'
import PickupPrompt from './PickupPrompt'
import QuickBar from './QuickBar'
import VehicleDashboard from './VehicleDashboard'
import WorldMap from './WorldMap'
import ZoneToast from './ZoneToast'
import PhoneOverlay from './phone/PhoneOverlay'
import { column } from './hudStyle'

/**
 * Interface 2D superposée à la 3D.
 * Elle N'INTERCEPTE PAS les clics (pointerEvents none) pour que le clic
 * gauche/droit aille bien au jeu (attaque/défense).
 *
 * ── Mise en page ────────────────────────────────────────────────────────────
 * L'écran est volontairement PRESQUE VIDE. Il ne reste que ce qui sert à jouer
 * dans l'instant :
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │                  [quartier]        minimap+heure │
 *   │                                                  │
 *   │                                                  │
 *   │  tableau bord      raccourcis        téléphone   │
 *   └──────────────────────────────────────────────────┘
 *
 * Les colonnes s'empilent toutes seules (`display: grid`) : les composants ne
 * connaissent pas leur position, seulement leur contenu. Avant, chaque bloc
 * portait son `top` écrit en dur et ajouter une ligne obligeait à recalculer
 * les suivants à la main.
 *
 * ── Ce qui a été RETIRÉ (et où c'est parti) ─────────────────────────────────
 * • Le titre « PLS — Prototype jouable » : il ira sur un écran-titre.
 * • L'action en cours (« Marche », « Course »...) : c'était du debug pur, ça se
 *   lit dans le panneau dev `F2`.
 * • **Les vitaux et les caractéristiques** (vie, faim, soif, mental, ATQ...) :
 *   ils vivent dans l'app **Santé du téléphone** (touche `P`). Le téléphone est
 *   le tableau de bord du personnage ; l'écran, lui, montre le monde.
 * • Le nom du quartier collé en permanence : il s'annonce maintenant à l'entrée
 *   dans le quartier (`ZoneToast`), puis s'efface.
 * • Le compteur FPS : visible uniquement en développement.
 * • La pastille « F1 Touches » : `F1` ouvre toujours le rappel des commandes, mais
 *   plus rien ne l'annonce en permanence — le coin bas gauche sert au compteur.
 *
 * Principe directeur : **si une information ne change pas, ou si elle est
 * consultable dans le téléphone, elle n'a rien à faire à l'écran en permanence.**
 *
 * ⚠️ Conséquence à garder en tête : plus rien ne prévient quand la vie ou la
 * faim devient critique. Si ça manque en jouant, la réponse n'est PAS de
 * remettre le panneau : c'est une alerte passagère (comme `ZoneToast`) qui
 * n'apparaît qu'au moment où ça devient grave.
 */
export default function Hud() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      <div style={column('right')}>
        {/* La minimap et l'heure forment un seul bloc (l'heure se colle dessous). */}
        <div style={{ display: 'grid', justifyItems: 'end' }}>
          <Minimap />
          <GameClock />
        </div>
        <FpsCounter />
      </div>

      <ZoneToast />
      <ControlsHint />
      <PickupPrompt />
      <MapMarkerPrompt />
      <InventoryPanel />
      <QuickBar />
      <VehicleDashboard />

      {/* Grande carte (touche M) : gère elle-même son ouverture/fermeture. */}
      <WorldMap />

      {/* Téléphone (touche P) : gère lui aussi son ouverture/fermeture. */}
      <PhoneOverlay />
    </div>
  )
}
