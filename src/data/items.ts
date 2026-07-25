export type ItemCategory =
  | 'arme'
  | 'arme_lancer'
  | 'consommable_nourriture'
  | 'consommable_boisson'
  | 'consommable_chelou'
  | 'alcool'
  | 'armure_tete'
  | 'armure_torse'
  | 'armure_jambes'
  | 'armure_pieds'
  | 'accessoire'
  | 'vehicule'

export type ItemRarity = 'commun' | 'rare' | 'epique' | 'legendaire'

export type EquipmentSlot =
  | 'head'
  | 'torso'
  | 'legs'
  | 'feet'
  | 'accessory'
  | 'rightHand'
  | 'leftHand'

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
  stackable?: boolean
  maxStack?: number
  consumable?: boolean
  effectDurationMs?: number
  equipSlot?: EquipmentSlot
  effects?: Partial<Record<ItemEffectKey, number>>
}

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  {
    id: 'poing-basique',
    name: 'Poing basique',
    category: 'arme',
    rarity: 'commun',
    price: 0,
    weightKg: 0,
    equipSlot: 'rightHand',
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
    equipSlot: 'rightHand',
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
    equipSlot: 'torso',
    effects: { defense: 2, chaos: -1 },
    description: 'Visible de loin. Parfois, ca sauve vraiment.',
  },
  {
    id: 'nike-ton-pied',
    name: 'Nike ton pied',
    category: 'armure_pieds',
    rarity: 'rare',
    price: 35,
    weightKg: 0.8,
    equipSlot: 'feet',
    effects: { speed: 2, agility: 1 },
    description: 'Pour fuir les problemes avant qu ils finissent leur phrase.',
  },
  {
    id: 'bagouze-gitan',
    name: 'Bagouze du gitan',
    category: 'accessoire',
    rarity: 'epique',
    price: 60,
    weightKg: 0.25,
    equipSlot: 'accessory',
    effects: { chance: 3, chaos: 1 },
    description: 'Bonus de chance et aura intimidante totalement assumee.',
  },
]

export const ITEMS_BY_ID = Object.fromEntries(ITEM_DEFINITIONS.map((item) => [item.id, item])) as Record<
  string,
  ItemDefinition
>
