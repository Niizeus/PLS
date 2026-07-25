import { useMemo, type CSSProperties } from 'react'
import type { ItemEffectKey } from '../data/items'
import { useInventoryStore } from '../gameplay/inventory/inventoryStore'
import { useCharacterStatsStore } from '../gameplay/stats/characterStatsStore'
import { getEffectiveStats, getEquipmentBonuses, getStatusEffectBonuses } from '../gameplay/stats/effectiveStats'

const VITALS: { key: ItemEffectKey; label: string; color: string }[] = [
  { key: 'health', label: 'Sante', color: '#ef4444' },
  { key: 'hunger', label: 'Faim', color: '#f97316' },
  { key: 'thirst', label: 'Soif', color: '#38bdf8' },
  { key: 'mental', label: 'Mental', color: '#a855f7' },
]

const RPG_STATS: { key: ItemEffectKey; label: string }[] = [
  { key: 'attack', label: 'ATQ' },
  { key: 'defense', label: 'DEF' },
  { key: 'agility', label: 'AGI' },
  { key: 'chance', label: 'CHC' },
  { key: 'speed', label: 'VIT' },
  { key: 'chaos', label: 'CHAOS' },
]

const EFFECT_LABEL: Record<ItemEffectKey, string> = {
  health: 'Sante',
  hunger: 'Faim',
  thirst: 'Soif',
  mental: 'Mental',
  attack: 'ATQ',
  defense: 'DEF',
  agility: 'AGI',
  chance: 'CHC',
  speed: 'VIT',
  chaos: 'Chaos',
}

export default function StatsPanel() {
  const stats = useCharacterStatsStore()
  const equipped = useInventoryStore((s) => s.equipped)

  const equipmentBonuses = useMemo(() => getEquipmentBonuses(equipped), [equipped])
  const statusBonuses = useMemo(() => getStatusEffectBonuses(stats.activeEffects), [stats.activeEffects])
  const effectiveStats = useMemo(() => getEffectiveStats(stats, equipped, stats.activeEffects), [equipped, stats])

  return (
    <div
      style={{
        position: 'fixed',
        top: 88,
        left: 12,
        width: 260,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(15, 20, 34, 0.72)',
        color: '#e6ecf5',
        font: '12px system-ui, sans-serif',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        {VITALS.map((vital) => (
          <div key={vital.key} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 30px', alignItems: 'center', gap: 7 }}>
            <span style={{ fontWeight: 800 }}>{vital.label}</span>
            <span style={{ height: 8, borderRadius: 999, background: 'rgba(148, 163, 184, 0.24)', overflow: 'hidden' }}>
              <span
                style={{
                  display: 'block',
                  width: `${stats[vital.key]}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: vital.color,
                }}
              />
            </span>
            <span style={{ textAlign: 'right', color: '#cbd5e1', fontWeight: 800 }}>{stats[vital.key]}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10 }}>
        {RPG_STATS.map((stat) => {
          const bonus = equipmentBonuses[stat.key] ?? 0
          const timedBonus = statusBonuses[stat.key] ?? 0
          const totalBonus = bonus + timedBonus
          return (
            <div key={stat.key} style={{ padding: '5px 6px', borderRadius: 6, background: 'rgba(43, 53, 80, 0.72)' }}>
              <span style={{ display: 'block', color: '#aeb8c8', fontWeight: 800 }}>{stat.label}</span>
              <strong style={{ fontSize: 14 }}>
                {effectiveStats[stat.key]}
                {totalBonus !== 0 ? <span style={{ color: totalBonus > 0 ? '#86efac' : '#fca5a5' }}> ({totalBonus > 0 ? '+' : ''}{totalBonus})</span> : null}
              </strong>
            </div>
          )
        })}
      </div>

      {stats.activeEffects.length > 0 && (
        <div style={{ display: 'grid', gap: 5, marginTop: 10 }}>
          {stats.activeEffects.map((effect) => (
            <div key={effect.id} style={activeEffectStyle}>
              <span style={activeEffectNameStyle}>{effect.label}</span>
              <span style={activeEffectMetaStyle}>
                {formatEffectList(effect.effects)} / {Math.max(0, Math.ceil((effect.expiresAt - Date.now()) / 1000))}s
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatEffectList(effects: Partial<Record<ItemEffectKey, number>>) {
  return Object.entries(effects)
    .map(([key, value]) => `${EFFECT_LABEL[key as ItemEffectKey]} ${value && value > 0 ? '+' : ''}${value}`)
    .join(', ')
}

const activeEffectStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  padding: '5px 7px',
  borderRadius: 6,
  background: 'rgba(30, 64, 175, 0.28)',
  color: '#bfdbfe',
  fontWeight: 800,
}

const activeEffectNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const activeEffectMetaStyle: CSSProperties = {
  color: '#dbeafe',
  font: '750 11px system-ui',
}
