import { ITEMS_BY_ID, type ItemEffectKey } from '../../data/items'
import type { EquippedItems, InventoryEntry } from '../inventory/inventoryStore'
import { getInventoryWeight, MAX_CARRY_WEIGHT } from '../inventory/inventoryWeight'
import type { ActiveStatusEffect, CharacterStats } from './characterStatsStore'

export const STAT_KEYS: ItemEffectKey[] = [
  'health',
  'hunger',
  'thirst',
  'mental',
  'attack',
  'defense',
  'agility',
  'chance',
  'speed',
  'chaos',
]

export type StatBonuses = Partial<Record<ItemEffectKey, number>>

export function getEquipmentBonuses(equipped: EquippedItems): StatBonuses {
  const bonuses: StatBonuses = {}

  for (const itemId of Object.values(equipped)) {
    if (!itemId) continue
    const item = ITEMS_BY_ID[itemId]
    if (!item?.effects) continue

    for (const [key, value] of Object.entries(item.effects) as [ItemEffectKey, number][]) {
      bonuses[key] = (bonuses[key] ?? 0) + value
    }
  }

  return bonuses
}

export function getStatusEffectBonuses(activeEffects: ActiveStatusEffect[]): StatBonuses {
  const bonuses: StatBonuses = {}
  const now = Date.now()

  for (const effect of activeEffects) {
    if (effect.expiresAt <= now) continue
    for (const [key, value] of Object.entries(effect.effects) as [ItemEffectKey, number][]) {
      bonuses[key] = (bonuses[key] ?? 0) + value
    }
  }

  return bonuses
}

export function getEffectiveStats(
  baseStats: CharacterStats,
  equipped: EquippedItems,
  activeEffects: ActiveStatusEffect[] = [],
): CharacterStats {
  const bonuses = getEquipmentBonuses(equipped)
  const statusBonuses = getStatusEffectBonuses(activeEffects)

  return Object.fromEntries(
    STAT_KEYS.map((key) => [key, Math.max(0, baseStats[key] + (bonuses[key] ?? 0) + (statusBonuses[key] ?? 0))]),
  ) as CharacterStats
}

export function getMovementSpeedMultiplier(effectiveStats: CharacterStats, inventoryItems: InventoryEntry[] = []) {
  const statBonus = 1 + (effectiveStats.speed - 1) * 0.06
  const healthPenalty = effectiveStats.health < 25 ? 0.78 : effectiveStats.health < 45 ? 0.9 : 1
  const hungerPenalty = effectiveStats.hunger < 20 ? 0.86 : 1
  const thirstPenalty = effectiveStats.thirst < 20 ? 0.82 : 1
  const mentalPenalty = effectiveStats.mental < 15 ? 0.9 : 1
  const carriedRatio = getInventoryWeight(inventoryItems) / MAX_CARRY_WEIGHT
  const weightPenalty = carriedRatio > 0.72 ? 1 - (carriedRatio - 0.72) * 0.45 : 1

  return Math.min(1.45, Math.max(0.55, statBonus * healthPenalty * hungerPenalty * thirstPenalty * mentalPenalty * weightPenalty))
}
