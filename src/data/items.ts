export type ItemCategory =
  | 'arme'
  | 'arme_lancer'
  | 'consommable_nourriture'
  | 'consommable_boisson'
  | 'consommable_chelou'
  | 'alcool'
  | 'armure_tete'
  | 'armure_torse'
  | 'armure_bras'
  | 'armure_jambes'
  | 'vehicule'

export type ItemRarity = 'commun' | 'rare' | 'epique' | 'legendaire'

/**
 * 👕 Les emplacements d'équipement.
 *
 * Volontairement **quatre pièces d'équipement + une main** : c'est le modèle le
 * plus simple à comprendre pour le joueur, et le plus simple à équilibrer pour
 * nous. Pas de slot chaussures ni de slot bijou séparés — les baskets comptent
 * comme « jambes », les bagues comme « bras ». Si un jour ça manque vraiment,
 * ajouter un emplacement, c'est une ligne ici et une ligne dans `SLOT_LABEL`.
 *
 * ⚠️ Une seule main : on ne porte qu'une arme à la fois. Un objet équipé
 * **sort du sac** (il ne prend plus de place) et doit pouvoir y retourner quand
 * on le retire — voir `gameplay/inventory/`.
 */
export type EquipmentSlot = 'head' | 'torso' | 'arms' | 'legs' | 'hand'

/**
 * 📐 La taille d'un objet dans la grille du sac, en cases.
 *
 * C'est LA donnée qui remplace « un poids maximum » : le sac est un espace, pas
 * un compteur. Le poids existe toujours, mais il ne fait plus que ralentir.
 */
export interface ItemSize {
  /** Largeur en cases (≥ 1). */
  w: number
  /** Hauteur en cases (≥ 1). */
  h: number
}

export type ItemEffectKey =
  | 'health'
  | 'hunger'
  | 'thirst'
  | 'mental'
  | 'attack'
  | 'defense'
  | 'agility'
  | 'chance'
  | 'speed'
  | 'chaos'

export interface ItemDefinition {
  id: string
  name: string
  category: ItemCategory
  rarity: ItemRarity
  price: number
  weightKg: number
  description: string
  /** Place occupée dans le sac. Absent = 1×1 (voir `getItemSize`). */
  size?: ItemSize
  /**
   * L'objet peut-il être tourné de 90° dans la grille ? Sans intérêt pour un
   * carré, indispensable pour une pelle. Absent = oui dès que l'objet n'est
   * pas carré.
   */
  rotatable?: boolean
  stackable?: boolean
  maxStack?: number
  consumable?: boolean
  effectDurationMs?: number
  equipSlot?: EquipmentSlot
  effects?: Partial<Record<ItemEffectKey, number>>
}

/** Taille d'un objet, avec le repli 1×1 pour ne jamais avoir à la déclarer. */
export function getItemSize(itemId: string): ItemSize {
  const size = ITEMS_BY_ID[itemId]?.size
  return { w: Math.max(1, size?.w ?? 1), h: Math.max(1, size?.h ?? 1) }
}

/** Un objet carré n'a rien à gagner à tourner : on ne propose la rotation que si ça change quelque chose. */
export function isItemRotatable(itemId: string): boolean {
  const item = ITEMS_BY_ID[itemId]
  if (!item) return false
  const size = getItemSize(itemId)
  if (size.w === size.h) return false
  return item.rotatable ?? true
}

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  {
    id: 'poing-basique',
    name: 'Poing basique',
    category: 'arme',
    rarity: 'commun',
    price: 0,
    weightKg: 0,
    size: { w: 1, h: 1 },
    equipSlot: 'hand',
    effects: { attack: 1 },
    description: 'Toujours disponible. Pas glorieux, mais fidele.',
  },
  {
    id: 'pelle',
    name: 'Pelle',
    category: 'arme',
    rarity: 'commun',
    price: 18,
    weightKg: 3.2,
    // Le manche : long et fin. C'est l'objet qui rend la rotation utile.
    size: { w: 1, h: 4 },
    equipSlot: 'hand',
    effects: { attack: 5, speed: -1 },
    description: 'Tape fort, ralentit un peu, et pose beaucoup de questions.',
  },
  {
    id: 'cendrier',
    name: 'Cendrier',
    category: 'arme_lancer',
    rarity: 'commun',
    price: 4,
    weightKg: 0.6,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 12,
    effects: { attack: 3, chaos: 1 },
    description: 'Objet de lancer ponctuel. Bruyant, lourd, efficace.',
  },
  {
    id: 'kebab-chef',
    name: 'Kebab du chef',
    category: 'consommable_nourriture',
    rarity: 'commun',
    price: 8,
    weightKg: 0.45,
    size: { w: 2, h: 1 },
    stackable: true,
    maxStack: 5,
    consumable: true,
    effectDurationMs: 45_000,
    effects: { health: 15, hunger: 35, attack: 1 },
    description: 'Soigne bien et donne envie de se battre avec confiance.',
  },
  {
    id: 'doliprane',
    name: 'Doliprane',
    category: 'consommable_chelou',
    rarity: 'commun',
    price: 6,
    weightKg: 0.05,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 10,
    consumable: true,
    effects: { health: 10, mental: 5 },
    description: 'Calme les douleurs et remet Chibrux a peu pres droit.',
  },
  {
    id: 'soda-market',
    name: 'Soda du market',
    category: 'consommable_boisson',
    rarity: 'commun',
    price: 4,
    weightKg: 0.35,
    size: { w: 1, h: 2 },
    stackable: true,
    maxStack: 6,
    consumable: true,
    effectDurationMs: 30_000,
    effects: { thirst: 30, mental: 2, speed: 1 },
    description: 'Sucre, bulles, cafeine suspecte. Remonte la soif et secoue un peu.',
  },
  {
    id: 'chouffe-guerrier',
    name: 'Chouffe du guerrier',
    category: 'alcool',
    rarity: 'rare',
    price: 7,
    weightKg: 0.5,
    size: { w: 1, h: 2 },
    stackable: true,
    maxStack: 6,
    consumable: true,
    effectDurationMs: 60_000,
    effects: { attack: 3, mental: 8, agility: -2 },
    description: 'Courage liquide. Precision optionnelle.',
  },
  {
    id: 'casquette-envers',
    name: 'Casquette a l envers',
    category: 'armure_tete',
    rarity: 'commun',
    price: 12,
    weightKg: 0.2,
    size: { w: 2, h: 1 },
    equipSlot: 'head',
    effects: { agility: 1, chance: 1 },
    description: 'Style discutable, esquive legerement meilleure.',
  },
  {
    id: 'gilet-fluo',
    name: 'Gilet fluorescent',
    category: 'armure_torse',
    rarity: 'commun',
    price: 15,
    weightKg: 0.55,
    size: { w: 2, h: 2 },
    equipSlot: 'torso',
    effects: { defense: 2, chaos: -1 },
    description: 'Visible de loin. Parfois, ca sauve vraiment.',
  },
  {
    // Pas de slot « chaussures » : les baskets s'équipent sur les jambes.
    id: 'nike-ton-pied',
    name: 'Nike ton pied',
    category: 'armure_jambes',
    rarity: 'rare',
    price: 35,
    weightKg: 0.8,
    size: { w: 2, h: 2 },
    equipSlot: 'legs',
    effects: { speed: 2, agility: 1 },
    description: 'Pour fuir les problemes avant qu ils finissent leur phrase.',
  },
  {
    // Pas de slot « bijou » non plus : une bague, ça se porte au bras.
    id: 'bagouze-gitan',
    name: 'Bagouze du gitan',
    category: 'armure_bras',
    rarity: 'epique',
    price: 60,
    weightKg: 0.25,
    size: { w: 1, h: 1 },
    equipSlot: 'arms',
    effects: { chance: 3, chaos: 1 },
    description: 'Bonus de chance et aura intimidante totalement assumee.',
  },
]

export const ITEMS_BY_ID = Object.fromEntries(ITEM_DEFINITIONS.map((item) => [item.id, item])) as Record<
  string,
  ItemDefinition
>
