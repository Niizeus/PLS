import { forwardRef } from 'react'
import type { DevTuningField, DevTuningGroup, DevTuningPresetSet } from '../devTuningTypes'
import {
  badgeStyle,
  fieldGridStyle,
  groupBodyStyle,
  groupCardStyle,
  groupHeaderStyle,
  groupHighlightStyle,
  iconButtonStyle,
  noticeStyle,
  warnBadgeStyle,
} from './devPanelStyles'
import PresetSelect from './PresetSelect'
import TuningFieldRow from './TuningFieldRow'

/** Une categorie de reglages : en-tete pliable, prereglages, puis les curseurs. */
const TuningGroupSection = forwardRef<
  HTMLDivElement,
  {
    group: DevTuningGroup
    fields: DevTuningField[]
    presetSets: DevTuningPresetSet[]
    pathPrefix: string
    isOpen: boolean
    isHighlighted: boolean
    disabled: boolean
    getValue: (path: string) => number | undefined
    getBase: (path: string) => number | undefined
    onToggle: () => void
    onChange: (path: string, value: number) => void
    onResetField: (path: string) => void
    onApplyPreset: (values: Record<string, number>) => void
    onResetGroup: () => void
    onSelectField: (field: DevTuningField) => void
  }
>(function TuningGroupSection(
  {
    group,
    fields,
    presetSets,
    pathPrefix,
    isOpen,
    isHighlighted,
    disabled,
    getValue,
    getBase,
    onToggle,
    onChange,
    onResetField,
    onApplyPreset,
    onResetGroup,
    onSelectField,
  },
  ref,
) {
  const modifiedCount = fields.filter((field) => {
    const value = getValue(field.id)
    const base = getBase(field.id)
    return value !== undefined && base !== undefined && Math.abs(value - base) > 1e-9
  }).length

  return (
    <section ref={ref} style={groupCardStyle}>
      <button type="button" style={isHighlighted ? groupHighlightStyle : groupHeaderStyle} onClick={onToggle}>
        <span style={{ fontSize: 16 }}>{group.icon}</span>
        <span style={{ display: 'grid', gap: 2, flex: 1 }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{group.label}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{group.summary}</span>
        </span>
        {modifiedCount > 0 && <span style={warnBadgeStyle}>{modifiedCount} modifie(s)</span>}
        <span style={badgeStyle}>{fields.length}</span>
        <span style={{ color: '#94a3b8', width: 14, textAlign: 'center' }}>{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen && (
        <div style={groupBodyStyle}>
          {group.warning && <div style={noticeStyle}>⚠ {group.warning}</div>}

          {presetSets.length > 0 && (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {presetSets.map((presetSet) => (
                <PresetSelect
                  key={presetSet.id}
                  presetSet={presetSet}
                  pathPrefix={pathPrefix}
                  getValue={getValue}
                  onApply={onApplyPreset}
                  disabled={disabled}
                />
              ))}
            </div>
          )}

          {modifiedCount > 0 && (
            <div>
              <button type="button" style={iconButtonStyle} onClick={onResetGroup} disabled={disabled}>
                ↺ Tout remettre a l origine dans cette categorie
              </button>
            </div>
          )}

          <div style={fieldGridStyle}>
            {fields.map((field) => (
              <TuningFieldRow
                key={field.id}
                field={field}
                value={getValue(field.id) ?? field.min}
                baseValue={getBase(field.id)}
                disabled={disabled}
                onChange={(value) => onChange(field.id, value)}
                onReset={() => onResetField(field.id)}
                onSelect={() => onSelectField(field)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
})

export default TuningGroupSection
