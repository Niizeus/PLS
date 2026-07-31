import { ITEMS_BY_ID } from '../../data/items'
import { getInventoryTuning } from '../../devtools/devTuningStore'
import type { PlacedStack } from './backpackGrid'

/**
 * ⚖️ Le poids du sac.
 *
 * Depuis le passage à la grille, le poids **n'empêche plus de ramasser** : la
 * place fait ça très bien toute seule. Il ne sert plus qu'à une chose, et c'est
 * beaucoup mieux comme ça : **plus on est chargé, plus on est lent**
 * (`getMovementSpeedMultiplier`, dans `gameplay/stats/effectiveStats.ts`).
 *
 * Le seuil `MAX_CARRY_WEIGHT` n'est donc plus un mur mais un **repère** :
 * au-delà, Chibrux traîne la patte.
 */

export const MAX_CARRY_WEIGHT = 18
export const getMaxCarryWeight = () => getInventoryTuning().MAX_CARRY_WEIGHT

export function getItemWeight(itemId: string) {
  return ITEMS_BY_ID[itemId]?.weightKg ?? 0
}

/** Poids total des piles POSÉES dans le sac (l'équipement porté ne compte pas). */
export function getInventoryWeight(stacks: PlacedStack[]) {
  return stacks.reduce((total, stack) => total + getItemWeight(stack.itemId) * stack.quantity, 0)
}

export function formatWeight(weight: number) {
  return `${weight.toFixed(weight >= 10 ? 1 : 2)} kg`
}
