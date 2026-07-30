import { useEffect, useState, type CSSProperties } from 'react'
import { KEY } from '../gameplay/input/keyMap'
import { useVehicleTelemetryStore } from '../entities/vehicles/vehicleTelemetryStore'
import { HUD, kbd, panel, sectionLabel } from './hudStyle'

/**
 * ⌨️ Rappel des touches, en bas à gauche.
 *
 * Il occupait douze lignes en permanence : c'était le bloc qui mangeait le plus
 * d'écran, alors qu'on n'en a besoin que les premières minutes. Il est donc
 * REPLIÉ par défaut (une simple pastille) et se déplie avec F1.
 *
 * Il est aussi CONTEXTUEL : à pied on ne montre pas les commandes de conduite, et
 * en véhicule on ne montre pas "sauter" ou "s'accroupir". Moins de lignes à lire,
 * et uniquement celles qui servent à cet instant.
 */

interface Control {
  keys: string
  label: string
}

const MOVE: Control[] = [
  { keys: 'ZQSD', label: 'Se déplacer' },
  { keys: 'Souris', label: 'Tourner la caméra' },
  { keys: 'Maj', label: 'Courir' },
  { keys: 'Espace', label: 'Sauter' },
  { keys: 'Ctrl', label: "S'accroupir" },
]

const DRIVE: Control[] = [
  { keys: 'ZQSD', label: 'Conduire / piloter en l’air' },
  { keys: 'Souris', label: 'Tourner la caméra' },
  { keys: 'Espace', label: 'Frein à main (maintenir : se remettre sur les roues)' },
  { keys: 'A', label: 'Limiteur de vitesse' },
  { keys: 'F', label: 'Klaxon' },
  { keys: 'L', label: 'Phares' },
  { keys: 'R', label: 'Station de radio (dernier cran : éteinte)' },
]

const ACTIONS: Control[] = [
  { keys: 'E', label: 'Interagir / monter' },
  { keys: 'Clic G.', label: 'Attaquer' },
  { keys: 'Clic D.', label: 'Défendre' },
]

const INTERFACE: Control[] = [
  { keys: 'Tab', label: 'Inventaire' },
  { keys: '1-4', label: 'Raccourcis' },
  { keys: 'M', label: 'Carte' },
  { keys: 'Échap', label: 'Libérer la souris' },
]

export default function ControlsHint() {
  const [open, setOpen] = useState(false)
  const riding = useVehicleTelemetryStore((s) => s.riding)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== KEY.CONTROLS || event.repeat) return
      event.preventDefault() // F1 ouvre l'aide du navigateur sinon
      setOpen((current) => !current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!open) {
    return (
      <div style={{ ...panel, ...wrapStyle, ...collapsedStyle }}>
        <kbd style={kbd}>F1</kbd>
        <span style={{ color: HUD.textDim }}>Touches</span>
      </div>
    )
  }

  // Déplié, on répartit sur DEUX colonnes. En une seule, le panneau montait à
  // ~370 px et venait mordre sur les stats dès qu'on jouait en fenêtre basse.
  return (
    <div
      style={{
        ...panel,
        ...wrapStyle,
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        gap: '10px 20px',
        alignContent: 'start',
      }}
    >
      <Group title={riding ? 'Conduite' : 'Déplacement'} controls={riding ? DRIVE : MOVE} />
      <Group title="Interface" controls={INTERFACE} />
      <Group title="Actions" controls={ACTIONS} />
      <div style={{ ...sectionLabel, color: HUD.accent, alignSelf: 'end' }}>F1 pour replier</div>
    </div>
  )
}

function Group({ title, controls }: { title: string; controls: Control[] }) {
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <div style={sectionLabel}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', alignItems: 'center' }}>
        {controls.map((c) => (
          <div key={c.keys + c.label} style={{ display: 'contents' }}>
            <kbd style={kbd}>{c.keys}</kbd>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const wrapStyle: CSSProperties = {
  position: 'fixed',
  bottom: HUD.edge,
  left: HUD.edge,
  pointerEvents: 'none',
}

const collapsedStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
}
