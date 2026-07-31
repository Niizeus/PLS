import { ITEMS_BY_ID } from '../../data/items'
import { useInventoryStore } from '../../gameplay/inventory/inventoryStore'

/**
 * Style de combat du joueur : à mains nues, ou avec une arme en main.
 * C'est ce qui décide QUELLE animation d'attaque est jouée.
 */
export type CombatStyle = 'fists' | 'weapon'

/**
 * Objets "arme" qui ne comptent PAS comme une vraie arme : ce sont les poings.
 * (Le joueur peut équiper `poing-basique` dans sa main.)
 */
const BARE_HANDS_ITEMS = new Set(['poing-basique'])

/**
 * Lit l'équipement et renvoie le style de combat courant.
 *
 * Lecture "hors React" (`getState()`) : cette fonction est appelée depuis la
 * boucle de jeu (useFrame), on ne veut surtout pas de re-render à chaque frame.
 */
export function getCombatStyle(): CombatStyle {
  // Une seule main depuis le passage au sac : on ne porte qu'une arme à la fois.
  const itemId = useInventoryStore.getState().equipped.hand
  if (!itemId || BARE_HANDS_ITEMS.has(itemId)) return 'fists'

  const item = ITEMS_BY_ID[itemId]
  return item?.category === 'arme' || item?.category === 'arme_lancer' ? 'weapon' : 'fists'
}
