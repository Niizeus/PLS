import { useMemo, useRef, useState } from 'react'
import { getGroups } from '../devTuningGroups'
import { getPresetSets } from '../devTuningPresets'
import { getSectionFields } from '../devTuningSchema'
import type { DevFieldLevel, DevSectionId, DevTuningField } from '../devTuningTypes'
import { ghostButtonStyle, helpStyle, noticeStyle } from './devPanelStyles'
import TuningGroupSection from './TuningGroupSection'
import VehicleSchematic from './VehicleSchematic'

/**
 * Contenu d'un onglet de reglages : le schema du vehicule (pour la voiture et le
 * scooter), puis les categories pliables avec leurs prereglages.
 */
export default function TuningSection({
  section,
  level,
  search,
  disabled,
  getValue,
  getBase,
  onChange,
  onChangeMany,
  onResetField,
  onResetPaths,
  onSelectField,
  onSelectGroup,
  activeGroupId,
}: {
  section: DevSectionId
  level: DevFieldLevel
  search: string
  disabled: boolean
  getValue: (path: string) => number | undefined
  getBase: (path: string) => number | undefined
  onChange: (path: string, value: number) => void
  onChangeMany: (values: Record<string, number>) => void
  onResetField: (path: string) => void
  onResetPaths: (paths: string[]) => void
  onSelectField: (field: DevTuningField | null) => void
  onSelectGroup: (groupId: string) => void
  activeGroupId: string | null
}) {
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({})
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const groups = getGroups(section)
  const isVehicle = section === 'car' || section === 'scooter'
  const pathPrefix = isVehicle ? `vehicles.${section}.` : `${section}.`
  const presetSets = getPresetSets(section)

  const visibleFields = useMemo(() => {
    const query = normalize(search)
    return getSectionFields(section).filter((field) => {
      if (level === 'simple' && field.level !== 'simple') return false
      if (!query) return true
      return normalize(
        `${field.label} ${field.help} ${field.lower ?? ''} ${field.higher ?? ''} ${field.useCase ?? ''} ${field.id}`,
      ).includes(query)
    })
  }, [section, level, search])

  const visibleGroups = groups
    .map((group) => ({ group, fields: visibleFields.filter((field) => field.group === group.id) }))
    .filter((entry) => entry.fields.length > 0)

  const openGroup = (groupId: string) => {
    setClosedGroups((current) => ({ ...current, [groupId]: false }))
    onSelectGroup(groupId)
    // Laisse React ouvrir la categorie avant de la faire defiler a l'ecran.
    requestAnimationFrame(() => cardRefs.current.get(groupId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div>
      {isVehicle && <VehicleSchematic groups={groups} activeGroupId={activeGroupId} onPick={openGroup} />}

      {search && visibleGroups.length === 0 && (
        <div style={noticeStyle}>Aucun reglage ne correspond a « {search} » dans cet onglet.</div>
      )}

      {level === 'simple' && !search && (
        <p style={{ ...helpStyle, marginTop: 0, marginBottom: 10 }}>
          Mode simple : seuls les reglages qui changent vraiment le ressenti sont affiches. Passe en
          mode avance pour les valeurs techniques.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          style={ghostButtonStyle}
          onClick={() => setClosedGroups(Object.fromEntries(groups.map((group) => [group.id, true])))}
        >
          Tout replier
        </button>
        <button type="button" style={ghostButtonStyle} onClick={() => setClosedGroups({})}>
          Tout deplier
        </button>
      </div>

      {visibleGroups.map(({ group, fields }) => (
        <TuningGroupSection
          key={group.id}
          ref={(node) => {
            if (node) cardRefs.current.set(group.id, node)
            else cardRefs.current.delete(group.id)
          }}
          group={group}
          fields={fields}
          presetSets={presetSets.filter((entry) => entry.group === group.id)}
          pathPrefix={pathPrefix}
          isOpen={!closedGroups[group.id]}
          isHighlighted={activeGroupId === group.id}
          disabled={disabled}
          getValue={getValue}
          getBase={getBase}
          onToggle={() => {
            setClosedGroups((current) => ({ ...current, [group.id]: !current[group.id] }))
            onSelectGroup(group.id)
          }}
          onChange={onChange}
          onResetField={onResetField}
          onApplyPreset={onChangeMany}
          onResetGroup={() => onResetPaths(fields.map((field) => field.id))}
          onSelectField={onSelectField}
        />
      ))}
    </div>
  )
}

/** Comparaison tolerante aux accents et a la casse pour la recherche. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
