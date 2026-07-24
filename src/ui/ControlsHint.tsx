/** Rappel des touches, affiché en bas à gauche. Purement informatif. */
const CONTROLS: { keys: string; label: string }[] = [
  { keys: 'Souris', label: 'Tourner la caméra' },
  { keys: 'ZQSD', label: 'Se déplacer' },
  { keys: 'Maj', label: 'Courir' },
  { keys: 'E', label: 'Interagir / monter sur le scooter' },
  { keys: 'Clic G.', label: 'Attaquer' },
  { keys: 'Clic D.', label: 'Défendre' },
  { keys: 'M', label: 'Carte' },
  { keys: 'Échap', label: 'Libérer la souris' },
]

export default function ControlsHint() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(15, 20, 34, 0.7)',
        color: '#e6ecf5',
        font: '13px system-ui, sans-serif',
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        gap: '4px 10px',
        pointerEvents: 'none',
      }}
    >
      {CONTROLS.map((c) => (
        <div key={c.keys} style={{ display: 'contents' }}>
          <kbd
            style={{
              justifySelf: 'start',
              padding: '1px 7px',
              borderRadius: 5,
              background: '#2b3550',
              border: '1px solid #45557f',
              font: '600 12px ui-monospace, monospace',
            }}
          >
            {c.keys}
          </kbd>
          <span>{c.label}</span>
        </div>
      ))}
    </div>
  )
}
