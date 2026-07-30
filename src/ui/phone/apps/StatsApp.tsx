import { useMemo } from 'react'
import type { ItemEffectKey } from '../../../data/items'
import { useInventoryStore } from '../../../gameplay/inventory/inventoryStore'
import { useCharacterStatsStore } from '../../../gameplay/stats/characterStatsStore'
import { getEffectiveStats, getEquipmentBonuses, getStatusEffectBonuses } from '../../../gameplay/stats/effectiveStats'
import { usePlayerStore } from '../../../gameplay/stats/playerStore'
import { PHONE, appScroll, appSectionLabel, card } from '../phoneStyle'

/**
 * ❤️ Application « Santé » — la démonstration de la règle du téléphone :
 * elle LIT les stores existants (`characterStatsStore`, `inventoryStore`,
 * `playerStore`) et n'en garde aucune copie. Si une valeur bouge dans le jeu,
 * elle bouge ici, sans une ligne de synchronisation.
 *
 * C'est le même contenu que `StatsPanel.tsx` du HUD, mis en page pour un petit
 * écran vertical. Les deux affichent la même source de vérité.
 */

const VITALS: { key: ItemEffectKey; label: string; color: string }[] = [
  { key: 'health', label: 'Santé', color: '#f43f5e' },
  { key: 'hunger', label: 'Faim', color: '#fb923c' },
  { key: 'thirst', label: 'Soif', color: '#38bdf8' },
  { key: 'mental', label: 'Mental', color: '#c084fc' },
]

const RPG_STATS: { key: ItemEffectKey; label: string }[] = [
  { key: 'attack', label: 'ATQ' },
  { key: 'defense', label: 'DEF' },
  { key: 'agility', label: 'AGI' },
  { key: 'chance', label: 'CHC' },
  { key: 'speed', label: 'VIT' },
  { key: 'chaos', label: 'CHAOS' },
]

/**
 * Ce que le téléphone AIMERAIT afficher mais qui n'existe pas encore comme
 * système de jeu. On l'écrit noir sur blanc plutôt que d'inventer des chiffres
 * (règle du backlog § 2.1).
 */
const NOT_WIRED = ['Argent', 'Réputation', 'Missions', 'Besoins avancés']

export default function StatsApp() {
  const stats = useCharacterStatsStore()
  const equipped = useInventoryStore((s) => s.equipped)
  const zoneName = usePlayerStore((s) => s.zoneName)

  const equipmentBonuses = useMemo(() => getEquipmentBonuses(equipped), [equipped])
  const statusBonuses = useMemo(() => getStatusEffectBonuses(stats.activeEffects), [stats.activeEffects])
  const effectiveStats = useMemo(
    () => getEffectiveStats(stats, equipped, stats.activeEffects),
    [equipped, stats],
  )

  return (
    <div style={appScroll}>
      <div style={{ ...card, display: 'grid', gap: 9 }}>
        {VITALS.map((vital) => (
          <div key={vital.key} style={{ display: 'grid', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: `800 11px ${PHONE.font}` }}>
              <span>{vital.label}</span>
              <span style={{ color: vital.color }}>{stats[vital.key]}</span>
            </div>
            <span style={{ height: 7, borderRadius: 999, background: 'rgba(148,163,184,0.22)', overflow: 'hidden' }}>
              <span
                style={{
                  display: 'block',
                  width: `${stats[vital.key]}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: vital.color,
                  transition: 'width 240ms ease',
                }}
              />
            </span>
          </div>
        ))}
      </div>

      <div style={appSectionLabel}>Caractéristiques</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {RPG_STATS.map((stat) => {
          const bonus = (equipmentBonuses[stat.key] ?? 0) + (statusBonuses[stat.key] ?? 0)
          return (
            <div key={stat.key} style={{ ...card, padding: '6px 7px', textAlign: 'center' }}>
              <span style={{ display: 'block', font: `800 9px ${PHONE.font}`, color: PHONE.textDim }}>
                {stat.label}
              </span>
              <strong style={{ font: `900 15px ${PHONE.font}` }}>{effectiveStats[stat.key]}</strong>
              {bonus !== 0 && (
                <span style={{ display: 'block', font: `800 9px ${PHONE.font}`, color: bonus > 0 ? '#86efac' : '#fca5a5' }}>
                  {bonus > 0 ? '+' : ''}
                  {bonus}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {stats.activeEffects.length > 0 && (
        <>
          <div style={appSectionLabel}>En ce moment</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {stats.activeEffects.map((effect) => (
              <div
                key={effect.id}
                style={{
                  ...card,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: 'rgba(56, 189, 248, 0.14)',
                  borderColor: 'rgba(56, 189, 248, 0.3)',
                  font: `800 11px ${PHONE.font}`,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {effect.label}
                </span>
                <span style={{ color: PHONE.accent }}>
                  {Math.max(0, Math.ceil((effect.expiresAt - Date.now()) / 1000))}s
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={appSectionLabel}>Position</div>
      <div style={{ ...card, font: `12px ${PHONE.font}` }}>📍 {zoneName ?? 'Beauvais'}</div>

      <div style={appSectionLabel}>Pas encore branché</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {NOT_WIRED.map((label) => (
          <span
            key={label}
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px dashed rgba(148, 163, 184, 0.35)',
              font: `800 10px ${PHONE.font}`,
              color: PHONE.muted,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <div style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
        Ces systèmes n’existent pas encore dans le jeu. Le téléphone préfère le dire plutôt
        qu’afficher des chiffres inventés.
      </div>
    </div>
  )
}
