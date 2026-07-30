import type { PhoneApp } from '../apps'
import { PHONE, appScroll, card } from '../phoneStyle'

/**
 * 🚧 Écran affiché pour les applications prévues mais pas encore développées.
 *
 * Il existe pour une raison précise : le téléphone ne doit JAMAIS faire semblant.
 * Une icône grisée qui ouvre un écran honnête vaut mieux qu'une app qui affiche
 * des valeurs inventées (règle du backlog § 2.1).
 */
export default function ComingSoonApp({ app }: { app: PhoneApp }) {
  return (
    <div style={{ ...appScroll, alignContent: 'center', justifyItems: 'center', textAlign: 'center', gap: 14 }}>
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 18,
          display: 'grid',
          placeItems: 'center',
          fontSize: 30,
          background: app.color,
          filter: 'saturate(0.35)',
          opacity: 0.75,
        }}
      >
        {app.icon}
      </div>

      <div style={{ font: `900 15px ${PHONE.font}` }}>{app.label}</div>

      <div
        style={{
          padding: '3px 10px',
          borderRadius: 999,
          border: '1px dashed rgba(148, 163, 184, 0.4)',
          font: `800 10px ${PHONE.font}`,
          color: PHONE.muted,
        }}
      >
        Pas encore branché
      </div>

      {app.soon && (
        <div style={{ ...card, font: `11px ${PHONE.font}`, color: PHONE.textDim, lineHeight: 1.5 }}>{app.soon}</div>
      )}
    </div>
  )
}
