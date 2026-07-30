import type { DevTuningPresetSet } from '../devTuningTypes'
import { helpStyle, selectStyle } from './devPanelStyles'

/**
 * Menu deroulant de prereglages : un choix comprehensible qui pose plusieurs
 * valeurs techniques d un coup.
 *
 * Des qu une valeur est retouchee a la main, le menu repasse sur
 * « Personnalise » : l interface ne ment jamais sur l etat reel des reglages.
 */
export default function PresetSelect({
  presetSet,
  pathPrefix,
  getValue,
  onApply,
  disabled,
}: {
  presetSet: DevTuningPresetSet
  pathPrefix: string
  getValue: (path: string) => number | undefined
  onApply: (values: Record<string, number>) => void
  disabled: boolean
}) {
  const active = presetSet.presets.find((preset) =>
    Object.entries(preset.values).every((entry) => {
      const current = getValue(`${pathPrefix}${entry[0]}`)
      return current !== undefined && Math.abs(current - entry[1]) < 1e-3
    }),
  )

  const description = active ? active.description : 'Reglages retouches a la main : aucun prereglage ne correspond.'

  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 750 }}>{presetSet.label}</span>
      <select
        style={selectStyle}
        disabled={disabled}
        value={active?.id ?? ''}
        onChange={(event) => {
          const preset = presetSet.presets.find((entry) => entry.id === event.target.value)
          if (!preset) return
          const values: Record<string, number> = {}
          for (const [key, value] of Object.entries(preset.values)) values[`${pathPrefix}${key}`] = value
          onApply(values)
        }}
      >
        {!active && <option value="">Personnalise</option>}
        {presetSet.presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
      <small style={helpStyle}>
        {description} — {presetSet.help}
      </small>
    </label>
  )
}
