import type { DevTuningField } from '../devTuningTypes'
import {
  fieldStyle,
  fieldTopStyle,
  helpStyle,
  iconButtonStyle,
  metaRowStyle,
  modifiedFieldStyle,
  numberInputStyle,
  warnBadgeStyle,
} from './devPanelStyles'

/** Un reglage : nom clair, curseur, valeur, unite, valeur d'origine, retour arriere. */
export default function TuningFieldRow({
  field,
  value,
  baseValue,
  disabled,
  onChange,
  onReset,
  onSelect,
}: {
  field: DevTuningField
  value: number
  baseValue: number | undefined
  disabled: boolean
  onChange: (value: number) => void
  onReset: () => void
  onSelect: () => void
}) {
  const isModified = baseValue !== undefined && Math.abs(value - baseValue) > 1e-9

  return (
    <div
      style={isModified ? modifiedFieldStyle : fieldStyle}
      onMouseEnter={onSelect}
      onFocusCapture={onSelect}
      title={field.help}
    >
      <div style={fieldTopStyle}>
        <span>
          {field.label}
          {field.warning ? <span style={{ color: '#fbbf24' }} title={field.warning}> ⚠</span> : null}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isModified && (
            <button
              type="button"
              style={iconButtonStyle}
              title={`Revenir a la valeur d'origine (${formatNumber(baseValue)})`}
              onClick={onReset}
            >
              ↺
            </button>
          )}
          <input
            style={numberInputStyle}
            type="number"
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={field.step}
            value={roundForInput(value)}
            onChange={(event) => onChange(toFinite(Number(event.target.value), field.min))}
          />
        </span>
      </div>

      <input
        type="range"
        disabled={disabled}
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />

      <div style={metaRowStyle}>
        {field.unit && <span>{field.unit}</span>}
        {field.readout && (
          <span>
            = {formatNumber(value * field.readout.factor)} {field.readout.unit}
          </span>
        )}
        {baseValue !== undefined && <span>origine {formatNumber(baseValue)}</span>}
        {isModified && <span style={warnBadgeStyle}>modifie</span>}
      </div>

      <small style={helpStyle}>{field.help}</small>
    </div>
  )
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-'
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 1) return trim(value.toFixed(2))
  return trim(value.toFixed(4))
}

function trim(text: string): string {
  return text.replace(/\.?0+$/, '')
}

function roundForInput(value: number): number {
  return Number(value.toFixed(4))
}

/**
 * On ne bride PAS la saisie clavier aux bornes du curseur : pouvoir depasser
 * volontairement une borne est utile en dev. Seules les valeurs invalides sont
 * rattrapees.
 */
function toFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}
