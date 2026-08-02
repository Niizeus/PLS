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
export type ItemLegality = 'legal' | 'prescription' | 'grey_market' | 'illegal'

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
  legality?: ItemLegality
  tags?: string[]
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
    legality: 'legal',
    tags: ['soin', 'pharmacie'],
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
    legality: 'legal',
    tags: ['alcool', 'bar', 'soiree'],
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
    id: 'cbd-chelou',
    name: 'CBD chelou',
    category: 'consommable_chelou',
    rarity: 'commun',
    legality: 'grey_market',
    tags: ['drogue', 'detente', 'market'],
    price: 9,
    weightKg: 0.03,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 8,
    consumable: true,
    effectDurationMs: 90_000,
    effects: { mental: 12, speed: -1, chaos: 1 },
    description: 'Ca calme Chibrux, mais le vendeur a dit "t inquiete" beaucoup trop vite.',
  },
  {
    id: 'zombie-kush',
    name: 'Zombie Kush',
    category: 'consommable_chelou',
    rarity: 'commun',
    legality: 'illegal',
    tags: ['drogue', 'detente', 'faim', 'quartier'],
    price: 15,
    weightKg: 0.04,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 8,
    consumable: true,
    effectDurationMs: 90_000,
    effects: { health: -2, hunger: 20, mental: 18, speed: -2, agility: -1, chaos: 1 },
    description: 'Pose les nerfs et ouvre l appetit. Ferme aussi quelques connexions utiles.',
  },
  {
    id: 'anxiolytique-du-tiroir',
    name: 'Anxiolytique du tiroir',
    category: 'consommable_chelou',
    rarity: 'rare',
    legality: 'prescription',
    tags: ['drogue', 'calme', 'pharmacie'],
    price: 14,
    weightKg: 0.02,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 6,
    consumable: true,
    effectDurationMs: 90_000,
    effects: { mental: 18, defense: 1, speed: -2, agility: -2, chaos: -2 },
    description: 'Panique en baisse, reflexes en RTT. Utile quand Beauvais crie trop fort.',
  },
  {
    id: 'pilon-coupe-pneu',
    name: 'Pilon coupe au pneu',
    category: 'consommable_chelou',
    rarity: 'rare',
    legality: 'illegal',
    tags: ['drogue', 'sale', 'resistance', 'quartier'],
    price: 12,
    weightKg: 0.05,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 6,
    consumable: true,
    effectDurationMs: 75_000,
    effects: { health: -4, mental: -6, attack: 1, defense: 3, agility: -3, chaos: 2 },
    description: 'Rend solide comme une roue de caddie. Aussi maniable qu une roue de caddie.',
  },
  {
    id: 'speed-beauvais-express',
    name: 'Speed Beauvais Express',
    category: 'consommable_chelou',
    rarity: 'rare',
    legality: 'illegal',
    tags: ['drogue', 'stimulant', 'fuite', 'nuit'],
    price: 32,
    weightKg: 0.02,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 5,
    consumable: true,
    effectDurationMs: 60_000,
    effects: { health: -5, hunger: -20, mental: -7, speed: 4, agility: 2, chaos: 3 },
    description: 'Le corps dit non, les jambes disent rond-point suivant.',
  },
  {
    id: 'cocaine-platre',
    name: 'Cocaine coupee au platre',
    category: 'consommable_chelou',
    rarity: 'rare',
    legality: 'illegal',
    tags: ['drogue', 'stimulant', 'cher', 'soiree'],
    price: 55,
    weightKg: 0.02,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 4,
    consumable: true,
    effectDurationMs: 45_000,
    effects: { health: -8, thirst: -15, mental: -10, attack: 2, speed: 5, chaos: 4 },
    description: 'Boost violent, decision nulles. Chibrux va vite, le karma aussi.',
  },
  {
    id: 'taz-coeur-fluo',
    name: 'Taz coeur fluo',
    category: 'consommable_chelou',
    rarity: 'rare',
    legality: 'illegal',
    tags: ['drogue', 'empathie', 'soiree', 'psychique'],
    price: 28,
    weightKg: 0.02,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 5,
    consumable: true,
    effectDurationMs: 75_000,
    effects: { thirst: -20, mental: 10, defense: -2, speed: 2, chance: 2, chaos: 2 },
    description: 'Tout le monde devient ton frere pendant que ta barre de soif descend en ascenseur.',
  },
  {
    id: 'champignon-hallucitripogene',
    name: 'Champignon hallucitripogene',
    category: 'consommable_chelou',
    rarity: 'epique',
    legality: 'illegal',
    tags: ['drogue', 'hallucinogene', 'foret', 'psychique'],
    price: 22,
    weightKg: 0.03,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 6,
    consumable: true,
    effectDurationMs: 120_000,
    effects: { mental: -8, agility: -2, chance: 4, chaos: 3 },
    description: 'Les panneaux parlent, les trottoirs respirent, la chance rigole dans un coin.',
  },
  {
    id: 'acide-du-hippy',
    name: 'Acide du hippy',
    category: 'consommable_chelou',
    rarity: 'epique',
    legality: 'illegal',
    tags: ['drogue', 'hallucinogene', 'psychique', 'quete'],
    price: 38,
    weightKg: 0.01,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 4,
    consumable: true,
    effectDurationMs: 150_000,
    effects: { mental: -12, agility: -3, chance: 5, chaos: 5 },
    description: 'Ticket direct vers les bizarreries. Tres fort pour trouver une porte qui n existe pas.',
  },
  {
    id: 'ketamine-centre-equestre',
    name: 'Ketamine du centre equestre',
    category: 'consommable_chelou',
    rarity: 'epique',
    legality: 'illegal',
    tags: ['drogue', 'dissociatif', 'resistance', 'psychique'],
    price: 45,
    weightKg: 0.02,
    size: { w: 1, h: 1 },
    stackable: true,
    maxStack: 4,
    consumable: true,
    effectDurationMs: 60_000,
    effects: { health: -5, mental: -12, defense: 4, speed: -4, agility: -5, chance: 3, chaos: 4 },
    description: 'Chibrux devient presque un tank, mais le tank a oublie ses chenilles.',
  },
  {
    id: 'sirop-dodo-mamie',
    name: 'Sirop dodo de mamie',
    category: 'consommable_chelou',
    rarity: 'epique',
    legality: 'prescription',
    tags: ['drogue', 'calme', 'douleur', 'risque'],
    price: 18,
    weightKg: 0.25,
    size: { w: 1, h: 2 },
    stackable: true,
    maxStack: 3,
    consumable: true,
    effectDurationMs: 80_000,
    effects: { mental: 12, defense: 3, speed: -4, agility: -3, chaos: -2 },
    description: 'La douleur baisse, la motivation aussi. A garder pour les moments vraiment nuls.',
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
