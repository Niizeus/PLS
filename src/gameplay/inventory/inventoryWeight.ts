import { ITEMS_BY_ID } from '../../data/items'
import type { InventoryEntry } from './inventoryStore'

export const MAX_CARRY_WEIGHT = 18

export function getItemWeight(itemId: string) {
  return ITEMS_BY_ID[itemId]?.weightKg ?? 0
}

export function getInventoryWeight(items: InventoryEntry[]) {
  return items.reduce((total, entry) => total + getItemWeight(entry.itemId) * entry.quantity, 0)
}

export function formatWeight(weight: number) {
  return `${weight.toFixed(weight >= 10 ? 1 : 2)} kg`
}
