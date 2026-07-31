import { ITEMS_BY_ID, getItemSize } from '../../data/items'
import { findFreeSpot, type PlacedStack } from './backpackGrid'

/**
 * 📏 Les règles du sac : ce qui rentre, ce qui ne rentre pas, et pourquoi.
 *
 * ⚠️ **Le poids n'empêche plus de ramasser.** La seule limite est la PLACE.
 * Le poids, lui, ralentit le joueur (`inventoryWeight.ts`) : deux contraintes
 * différentes qui ne font pas doublon — l'une sur ce qu'on emporte, l'autre sur
 * la façon dont on se déplace avec.
 */

export type AddItemFailureReason = 'invalid' | 'noRoom'

export function clampInventoryQuantity(itemId: string, quantity: number) {
  const item = ITEMS_BY_ID[itemId]
  if (!item) return 0
  if (!item.stackable) return Math.min(quantity, 1)
  return Math.min(Math.max(quantity, 0), item.maxStack ?? 99)
}

export function getMaxQuantity(itemId: string) {
  const item = ITEMS_BY_ID[itemId]
  if (!item) return 0
  return item.stackable ? item.maxStack ?? 99 : 1
}

/** Quantité totale d'un objet dans le sac, toutes piles confondues. */
export function getCurrentQuantity(stacks: PlacedStack[], itemId: string) {
  return stacks.reduce((total, stack) => (stack.itemId === itemId ? total + stack.quantity : total), 0)
}

/** Y a-t-il **quelque part** de la place pour cet objet ? */
export function canFitInBackpack(stacks: PlacedStack[], itemId: string) {
  return findFreeSpot(stacks, itemId) !== null
}

export function getAddItemFailureReason(
  stacks: PlacedStack[],
  itemId: string,
  quantity = 1,
): AddItemFailureReason | null {
  const item = ITEMS_BY_ID[itemId]
  if (!item || quantity <= 0) return 'invalid'
  if (!canFitInBackpack(stacks, itemId)) return 'noRoom'
  return null
}

export function getAddItemFailureMessage(itemId: string, reason: AddItemFailureReason) {
  const name = ITEMS_BY_ID[itemId]?.name ?? 'Objet'
  if (reason === 'noRoom') return `${name} : plus de place dans le sac.`
  return `${name} impossible a ramasser.`
}

/** Petit texte affiché sous l'invite « Ramasser » : la place que ça prend. */
export function getPickupHint(stacks: PlacedStack[], itemId: string, quantity = 1) {
  const reason = getAddItemFailureReason(stacks, itemId, quantity)
  if (reason === 'noRoom') return 'Sac plein'
  if (reason === 'invalid') return 'Impossible'

  const size = getItemSize(itemId)
  return `${size.w}×${size.h} cases`
}
