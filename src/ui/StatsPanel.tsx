import { useMemo, type CSSProperties } from 'react'
import type { ItemEffectKey } from '../data/items'
import { useInventoryStore } from '../gameplay/inventory/inventoryStore'
import { useCharacterStatsStore } from '../gameplay/stats/characterStatsStore'
import { getEquipmentBonuses, getStatusEffectBonuses } from '../gameplay/stats/effectiveStats'
import { HUD, hardShadowSmall, outline, outlineThin, panel } from './hudStyle'

/**
 * ❤️ Les vitaux — le SEUL bloc d'information permanent du jeu.
 *
 * ── Ce qui a été enlevé, et pourquoi ────────────────────────────────────────
 * Ce panneau affichait aussi les six caractéristiques RPG (ATQ, DEF, AGI, CHC,
 * VIT, CHAOS) en permanence. Elles bougent très rarement, on ne les consulte
 * qu'au moment de s'équiper... et elles sont désormais lisibles à tout moment
 * dans l'app **Santé du téléphone** (touche P). Les garder à l'écran, c'était
 * six chiffres immobiles qui volaient l'attention des quatre jauges qui, elles,
 * changent vraiment.
 *
 * Elles ne réapparaissent donc que lorsqu'un **bonus ou un malus est actif** —
 * c'est-à-dire précisément quand l'information devient une nouvelle.
 */

const VITALS: { key: ItemEffectKey; label: string; icon: string; color: string }[] = [
  { key: 'health', label: 'Santé', icon: '❤', color: HUD.vitals.health },
  { key: 'hunger', label: 'Faim', icon: '🍗', color: HUD.vitals.hunger },
  { key: 'thirst', label: 'Soif', icon: '💧', color: HUD.vitals.thirst },
  { key: 'mental', label: 'Mental', icon: '🧠', color: HUD.vitals.mental },
]

const STAT_LABEL: Partial<Record<ItemEffectKey, string>> = {
  attack: 'ATQ',
  defense: 'DEF',
  agility: 'AGI',
  chance: 'CHC',
  speed: 'VIT',
  chaos: 'CHAOS',
}

/** En dessous, la jauge clignote : c'est le moment de manger/boire/se soigner. */
const CRITICAL = 20

export default function StatsPanel() {
  const stats = useCharacterStatsStore()
  const equipped = useInventoryStore((s) => s.equipped)

  // On ne montre les caractéristiques que si l'équipement ou un effet les modifie.
  const bonuses = useMemo(() => {
    const fromGear = getEquipmentBonuses(equipped)
    const fromEffects = getStatusEffectBonuses(stats.activeEffects)
    const merged = new Map<ItemEffectKey, number>()
    for (const source of [fromGear, fromEffects]) {
      for (const [key, value] of Object.entries(source) as [ItemEffectKey, number][]) {
        if (!STAT_LABEL[key] || !value) continue
        merged.set(key, (merged.get(key) ?? 0) + value)
      }
    }
    return [...merged.entries()].filter(([, value]) => value !== 0)
  }, [equipped, stats.activeEffects])

  return (
    <div style={{ ...panel, width: 236, padding: '11px 12px' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {VITALS.map((vital) => {
          const value = stats[vital.key]
          const critical = value <= CRITICAL
          return (
            <div key={vital.key} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, textAlign: 'center' }} title={vital.label}>
                {vital.icon}
              </span>
              {/* La jauge : un rail d'encre, un remplissage en aplat franc. */}
              <span style={{ position: 'relative', height: 14, borderRadius: 999, background: HUD.paperShade, border: outlineThin, overflow: 'hidden', display: 'block' }}>
                <span
                  style={{
                    display: 'block',
                    width: `${value}%`,
                    height: '100%',
                    background: vital.color,
                    transition: 'width 260ms ease',
                    // Quand ça devient critique, la jauge respire. Un chiffre qui
                    // baisse, on ne le voit pas ; une jauge qui bat, si.
                    animation: critical ? 'pls-pulse 900ms ease-in-out infinite' : undefined,
                  }}
                />
                <span style={valueStyle}>{value}</span>
              </span>
            </div>
          )
        })}
      </div>

      {bonuses.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
          {bonuses.map(([key, value]) => (
            <span key={key} style={{ ...chipStyle, background: value > 0 ? '#5aa832' : '#c4453b' }}>
              {STAT_LABEL[key]} {value > 0 ? '+' : ''}
              {value}
            </span>
          ))}
        </div>
      )}

      {stats.activeEffects.length > 0 && (
        <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          {stats.activeEffects.map((effect) => (
            <div key={effect.id} style={effectStyle}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{effect.label}</span>
              <span style={{ font: `800 11px ${HUD.mono}` }}>
                {Math.max(0, Math.ceil((effect.expiresAt - Date.now()) / 1000))}s
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Le chiffre, posé sur la jauge, en petit et contrasté. */
const valueStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  font: `800 10px ${HUD.font}`,
  color: HUD.ink,
  // Un liseré clair : le chiffre reste lisible sur la partie remplie ET sur la vide.
  textShadow: '0 1px 0 rgba(255,255,255,0.55)',
}

const chipStyle: CSSProperties = {
  padding: '2px 7px',
  borderRadius: 999,
  border: outlineThin,
  boxShadow: hardShadowSmall,
  font: `800 10px ${HUD.font}`,
  color: HUD.paper,
}

const effectStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  padding: '4px 8px',
  borderRadius: 8,
  background: HUD.ink,
  border: outline,
  color: HUD.paper,
  font: `800 11px ${HUD.font}`,
}
