import { ITEMS_BY_ID } from '../../data/items'
import type { InventoryEntry } from './inventoryStore'
import { formatWeight, getInventoryWeight, getItemWeight, getMaxCarryWeight } from './inventoryWeight'

export type AddItemFailureReason = 'invalid' | 'stackFull' | 'tooHeavy'

export function clampInventoryQuantity(itemId: string, quantity: number) {
  const item = ITEMS_BY_ID[itemId]
  if (!item) return 0
  if (!item.stackable) return Math.min(quantity, 1)
  return Math.min(Math.max(quantity, 0), item.maxStack ?? 99)
}

export function getCurrentQuantity(items: InventoryEntry[], itemId: string) {
  return items.find((entry) => entry.itemId === itemId)?.quantity ?? 0
}

export function getMaxQuantity(itemId: string) {
  const item = ITEMS_BY_ID[itemId]
  if (!item) return 0
  return item.stackable ? item.maxStack ?? 99 : 1
}

export function getStackSpace(items: InventoryEntry[], itemId: string) {
  return Math.max(0, getMaxQuantity(itemId) - getCurrentQuantity(items, itemId))
}

export function getAddItemFailureReason(
  items: InventoryEntry[],
  itemId: string,
  quantity = 1,
): AddItemFailureReason | null {
  const item = ITEMS_BY_ID[itemId]
  if (!item || quantity <= 0) return 'invalid'
  if (getStackSpace(items, itemId) < quantity) return 'stackFull'

  const nextWeight = getInventoryWeight(items) + getItemWeight(itemId) * quantity
  if (nextWeight > getMaxCarryWeight()) return 'tooHeavy'

  return null
}

export function getAddItemFailureMessage(itemId: string, reason: AddItemFailureReason) {
  const item = ITEMS_BY_ID[itemId]
  const name = item?.name ?? 'Objet'

  if (reason === 'stackFull') return `${name} ne rentre plus dans la pile.`
  if (reason === 'tooHeavy') return `${name} est trop lourd. Inventaire plein.`
  return `${name} impossible a ramasser.`
}

export function getPickupHint(items: InventoryEntry[], itemId: string, quantity = 1) {
  const reason = getAddItemFailureReason(items, itemId, quantity)
  if (reason === 'stackFull') return 'Pile pleine'
  if (reason === 'tooHeavy') return 'Trop lourd'
  if (reason === 'invalid') return 'Impossible'
  return `+${formatWeight(getItemWeight(itemId) * quantity)}`
}
