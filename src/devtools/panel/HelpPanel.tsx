import type { CSSProperties } from 'react'
import type { DevTuningField, DevTuningGroup } from '../devTuningTypes'
import { helpPanelStyle } from './devPanelStyles'
import { formatNumber } from './TuningFieldRow'

/**
 * Panneau d'aide contextuelle : suit le reglage survole et repond aux quatre
 * questions utiles (ce que ca change, plus bas, plus haut, quand s'en servir).
 */
export default function HelpPanel({
  field,
  group,
  value,
  baseValue,
}: {
  field: DevTuningField | null
  group: DevTuningGroup | null
  value?: number
  baseValue?: number
}) {
  if (!field) {
    return (
      <aside style={helpPanelStyle}>
        <div style={titleStyle}>Aide</div>
        <p style={{ color: '#94a3b8' }}>
          Survole un reglage : son effet s affiche ici, avec ce que produit une valeur plus basse ou
          plus haute.
        </p>
        {group && (
          <>
            <div style={sectionTitleStyle}>
              {group.icon} {group.label}
            </div>
            <p>{group.summary}</p>
          </>
        )}
        <div style={sectionTitleStyle}>Reperes</div>
        <ul style={listStyle}>
          <li>
            <b>Mode simple</b> : les reglages qui changent vraiment le feeling.
          </li>
          <li>
            <b>Mode avance</b> : tout, y compris les valeurs techniques.
          </li>
          <li>
            <b>↺</b> remet un reglage a sa valeur d origine.
          </li>
          <li>
            <b>Avant / apres</b> rejoue les valeurs d avant l ouverture du panneau, sans rien perdre.
          </li>
        </ul>
      </aside>
    )
  }

  return (
    <aside style={helpPanelStyle}>
      <div style={titleStyle}>{field.label}</div>
      {group && (
        <div style={{ color: '#94a3b8', marginBottom: 8 }}>
          {group.icon} {group.label}
        </div>
      )}

      <div style={sectionTitleStyle}>Ce que ca change</div>
      <p>{field.help}</p>

      {field.lower && (
        <>
          <div style={sectionTitleStyle}>Valeur plus basse</div>
          <p>{field.lower}</p>
        </>
      )}
      {field.higher && (
        <>
          <div style={sectionTitleStyle}>Valeur plus haute</div>
          <p>{field.higher}</p>
        </>
      )}
      {field.useCase && (
        <>
          <div style={sectionTitleStyle}>Quand s en servir</div>
          <p>{field.useCase}</p>
        </>
      )}
      {field.warning && (
        <>
          <div style={{ ...sectionTitleStyle, color: '#fbbf24' }}>A savoir</div>
          <p style={{ color: '#fde68a' }}>{field.warning}</p>
        </>
      )}

      <div style={sectionTitleStyle}>Valeurs</div>
      <p style={monoStyle}>
        actuelle : {value !== undefined ? formatNumber(value) : '-'} {field.unit ?? ''}
        <br />
        origine : {baseValue !== undefined ? formatNumber(baseValue) : '-'} {field.unit ?? ''}
        <br />
        plage : {formatNumber(field.min)} a {formatNumber(field.max)}
      </p>

      <div style={{ ...sectionTitleStyle, color: '#64748b' }}>Nom interne</div>
      <p style={{ ...monoStyle, color: '#64748b' }}>{field.id}</p>
    </aside>
  )
}

const titleStyle: CSSProperties = { fontSize: 15, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }
const sectionTitleStyle: CSSProperties = {
  marginTop: 12,
  marginBottom: 3,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: '#eab308',
}
const monoStyle: CSSProperties = { font: '11px ui-monospace, monospace', color: '#cbd5e1' }
const listStyle: CSSProperties = { margin: '4px 0 0 16px', padding: 0, display: 'grid', gap: 4 }
