import { usePhoneStore } from '../../gameplay/phone/phoneStore'
import { PHONE_APPS } from './apps'
import { PHONE } from './phoneStyle'

/**
 * 🏠 Écran d'accueil : la grille d'icônes.
 *
 * Il ne connaît PAS la liste des applications : il affiche `PHONE_APPS`
 * (`apps.tsx`). Ajouter une app n'oblige donc jamais à revenir ici.
 *
 * `selected` vient du parent (`PhoneOverlay`) parce que c'est lui qui écoute le
 * clavier : les flèches doivent marcher même quand aucune icône n'a le focus du
 * navigateur (on joue avec la souris capturée par la 3D, on ne « tabule » pas).
 */
export default function PhoneHome({ selected, onHover }: { selected: number; onHover: (index: number) => void }) {
  const openApp = usePhoneStore((s) => s.openApp)

  return (
    <div style={{ display: 'grid', alignContent: 'start', gap: 14, padding: '14px 14px 4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 8px' }}>
        {PHONE_APPS.map((app, index) => {
          const isSelected = index === selected
          const isReady = Boolean(app.Screen)
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => openApp(app.id)}
              onMouseEnter={() => onHover(index)}
              style={{
                display: 'grid',
                justifyItems: 'center',
                gap: 5,
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <span
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 15,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 24,
                  background: app.color,
                  // Les apps pas encore développées sont désaturées : on voit
                  // d'un coup d'œil ce qui marche vraiment.
                  filter: isReady ? 'none' : 'saturate(0.25)',
                  opacity: isReady ? 1 : 0.62,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${PHONE.accent}, 0 6px 16px rgba(0, 0, 0, 0.45)`
                    : '0 4px 12px rgba(0, 0, 0, 0.4)',
                  transform: isSelected ? 'translateY(-2px)' : 'none',
                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                }}
              >
                {app.icon}
              </span>
              <span
                style={{
                  font: `700 10px ${PHONE.font}`,
                  color: isReady ? PHONE.text : PHONE.muted,
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)',
                }}
              >
                {app.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
