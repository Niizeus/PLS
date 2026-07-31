import { create } from 'zustand'
import { ITEMS_BY_ID, type EquipmentSlot } from '../../data/items'
import { useCharacterStatsStore } from '../stats/characterStatsStore'
import {
  BACKPACK_SIZE,
  canPlace,
  createStackUid,
  findFreeSpot,
  findMergeTarget,
  type PlacedStack,
} from './backpackGrid'
import { clampInventoryQuantity } from './inventoryRules'

/**
 * 🎒 L'INVENTAIRE — un sac à dos en grille.
 *
 * ── Ce qui a changé, et pourquoi ────────────────────────────────────────────
 * Avant : une **liste** d'objets + un poids maximum. On ramassait, ça rentrait
 * (ou pas), et il n'y avait aucune décision à prendre.
 * Maintenant : chaque objet occupe une **place physique** dans une grille de
 * 8×5. Le joueur choisit quoi emporter ET comment le ranger — c'est le petit
 * jeu de gestion décrit dans `docs/05-OBJETS-EQUIPEMENTS.md`.
 *
 * Trois règles à connaître avant de toucher à ce fichier :
 *
 * 1. **Le ramassage ne range PAS tout seul.** `addItem` n'existe plus : on
 *    utilise `placeItem(itemId, quantity, x, y, rotated)`, et c'est le joueur
 *    qui choisit la case. Le rangement automatique (`findFreeSpot`) ne sert
 *    qu'aux cas où le joueur n'a rien demandé : migration d'une sauvegarde,
 *    objet qui revient d'un emplacement d'équipement.
 * 2. **Un objet équipé n'est plus dans le sac.** Il quitte la grille et libère
 *    sa place. Le retirer demande donc de la place — s'il n'y en a pas, on
 *    refuse (et on le dit).
 * 3. **Le poids ne bloque plus rien**, il ralentit (`inventoryWeight.ts`). La
 *    seule vraie limite, c'est la place.
 */

/** Une pile posée dans le sac. Le type vit dans `backpackGrid.ts`. */
export type InventoryStack = PlacedStack

export type EquippedItems = Partial<Record<EquipmentSlot, string>>
export type QuickSlotId = 'slot1' | 'slot2' | 'slot3' | 'slot4'
export type QuickSlots = Partial<Record<QuickSlotId, string>>

export const QUICK_SLOT_IDS: QuickSlotId[] = ['slot1', 'slot2', 'slot3', 'slot4']

interface InventoryData {
  stacks: InventoryStack[]
  equipped: EquippedItems
  quickSlots: QuickSlots
  /** Pile mise en avant dans le panneau de détails (`uid`). */
  selectedUid: string | null
  lastMessage: string | null
}

interface InventoryState extends InventoryData {
  /** Pose une pile à un endroit précis. Renvoie `false` si ça ne rentre pas. */
  placeItem: (itemId: string, quantity: number, x: number, y: number, rotated: boolean) => boolean
  /** Déplace/pivote une pile déjà dans le sac. */
  moveStack: (uid: string, x: number, y: number, rotated: boolean) => boolean
  /** Range un objet à la première place libre. Renvoie `false` si le sac est plein. */
  autoPlaceItem: (itemId: string, quantity?: number) => boolean
  removeStack: (uid: string, quantity?: number) => void
  useStack: (uid: string) => void
  /** Équipe la pile : elle sort du sac et libère sa place. */
  equipStack: (uid: string) => void
  /** Retire l'équipement : il lui faut de la place dans le sac. */
  unequipSlot: (slot: EquipmentSlot) => void
  assignQuickSlot: (slot: QuickSlotId, itemId: string | null) => void
  activateQuickSlot: (slot: QuickSlotId) => void
  selectStack: (uid: string | null) => void
  clearMessage: () => void
}

/** ⚠️ `v2` : la v1 était une liste sans coordonnées (voir `migrateFromV1`). */
const STORAGE_KEY = 'pls.inventory.v2'
const LEGACY_STORAGE_KEY = 'pls.inventory.v1'

const STARTER_ITEMS: { itemId: string; quantity: number }[] = [
  { itemId: 'poing-basique', quantity: 1 },
  { itemId: 'kebab-chef', quantity: 2 },
  { itemId: 'doliprane', quantity: 1 },
  { itemId: 'soda-market', quantity: 1 },
  { itemId: 'chouffe-guerrier', quantity: 1 },
  { itemId: 'casquette-envers', quantity: 1 },
  { itemId: 'cendrier', quantity: 3 },
]

/** Range une liste d'objets dans une grille vide. Sert au démarrage ET à la migration. */
function packItems(entries: { itemId: string; quantity: number }[]): InventoryStack[] {
  const stacks: InventoryStack[] = []

  for (const entry of entries) {
    if (!ITEMS_BY_ID[entry.itemId]) continue
    const quantity = clampInventoryQuantity(entry.itemId, entry.quantity)
    if (quantity <= 0) continue

    const spot = findFreeSpot(stacks, entry.itemId)
    // Sac plein : l'objet est simplement perdu. Ça ne peut arriver qu'avec une
    // sauvegarde d'avant la grille, et mieux vaut ça qu'un inventaire cassé.
    if (!spot) continue
    stacks.push({ uid: createStackUid(), itemId: entry.itemId, quantity, ...spot })
  }

  return stacks
}

const starterData = (): InventoryData => ({
  stacks: packItems(STARTER_ITEMS),
  equipped: {},
  quickSlots: { slot1: 'kebab-chef', slot2: 'soda-market', slot3: 'doliprane', slot4: 'chouffe-guerrier' },
  selectedUid: null,
  lastMessage: 'Sac pret.',
})

const hasItem = (stacks: InventoryStack[], itemId: string) =>
  stacks.some((stack) => stack.itemId === itemId && stack.quantity > 0)

/**
 * Nettoie une sauvegarde : objets inconnus, quantités aberrantes, piles hors
 * grille ou qui se chevauchent. On reconstruit en re-posant chaque pile : une
 * pile qui ne rentre plus (grille réduite, objet agrandi) est reposée ailleurs.
 */
const sanitizeData = (data: InventoryData): InventoryData => {
  const stacks: InventoryStack[] = []

  for (const stack of data.stacks ?? []) {
    if (!ITEMS_BY_ID[stack.itemId]) continue
    const quantity = clampInventoryQuantity(stack.itemId, stack.quantity)
    if (quantity <= 0) continue

    const rotated = Boolean(stack.rotated)
    if (canPlace(stacks, stack.itemId, stack.x, stack.y, rotated, { size: BACKPACK_SIZE })) {
      stacks.push({ uid: stack.uid || createStackUid(), itemId: stack.itemId, quantity, x: stack.x, y: stack.y, rotated })
      continue
    }

    const spot = findFreeSpot(stacks, stack.itemId)
    if (spot) stacks.push({ uid: stack.uid || createStackUid(), itemId: stack.itemId, quantity, ...spot })
  }

  // Un objet équipé n'est PAS dans le sac : on garde l'emplacement tel quel,
  // on vérifie juste que l'objet existe et qu'il va bien dans cet emplacement.
  const equipped = Object.fromEntries(
    Object.entries(data.equipped ?? {}).filter(([slot, itemId]) => itemId && ITEMS_BY_ID[itemId]?.equipSlot === slot),
  ) as EquippedItems

  const quickSlots = Object.fromEntries(
    Object.entries(data.quickSlots ?? {}).filter(
      ([, itemId]) => itemId && (hasItem(stacks, itemId) || Object.values(equipped).includes(itemId)),
    ),
  ) as QuickSlots

  const selectedUid = stacks.some((stack) => stack.uid === data.selectedUid) ? data.selectedUid : null

  return { stacks, equipped, quickSlots, selectedUid, lastMessage: data.lastMessage ?? null }
}

/** Ancienne sauvegarde (liste + poids) → grille. Rien n'est perdu tant que ça rentre. */
function migrateFromV1(): InventoryData | null {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) return null

  try {
    const legacy = JSON.parse(raw) as {
      items?: { itemId: string; quantity: number }[]
      quickSlots?: QuickSlots
    }
    return {
      stacks: packItems(legacy.items ?? []),
      // Les anciens emplacements (rightHand, feet, accessory...) n'existent
      // plus : on repart sans équipement plutôt que d'inventer une conversion.
      equipped: {},
      quickSlots: legacy.quickSlots ?? {},
      selectedUid: null,
      lastMessage: 'Sac reorganise apres la mise a jour.',
    }
  } catch {
    return null
  }
}

const saveInventory = (data: InventoryData) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const loadInventory = (): InventoryData => {
  if (typeof localStorage === 'undefined') return starterData()

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return sanitizeData(JSON.parse(raw) as InventoryData)

    // Pas encore de sauvegarde v2 : on convertit l'ancienne (ou on démarre), et
    // on écrit tout de suite — sinon la conversion serait refaite à chaque
    // chargement tant que le joueur ne touche à rien.
    const migrated = migrateFromV1()
    const data = sanitizeData(migrated ?? starterData())
    saveInventory(data)
    return data
  } catch {
    return starterData()
  }
}

const commit = (data: InventoryData) => {
  const clean = sanitizeData(data)
  saveInventory(clean)
  return clean
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  ...loadInventory(),

  placeItem: (itemId, quantity, x, y, rotated) => {
    const item = ITEMS_BY_ID[itemId]
    if (!item || quantity <= 0) return false

    const state = get()

    // Lâché sur une pile identique : on fusionne plutôt que de refuser.
    const mergeTarget = findMergeTarget(state.stacks, itemId, x, y, quantity)
    if (mergeTarget) {
      set(
        commit({
          ...state,
          stacks: state.stacks.map((candidate) =>
            candidate.uid === mergeTarget.uid
              ? { ...candidate, quantity: clampInventoryQuantity(itemId, candidate.quantity + quantity) }
              : candidate,
          ),
          lastMessage: `${item.name} ajoute a la pile.`,
        }),
      )
      return true
    }

    if (!canPlace(state.stacks, itemId, x, y, rotated)) {
      set(commit({ ...state, lastMessage: `Pas la place pour ${item.name}.` }))
      return false
    }

    set(
      commit({
        ...state,
        stacks: [
          ...state.stacks,
          { uid: createStackUid(), itemId, quantity: clampInventoryQuantity(itemId, quantity), x, y, rotated },
        ],
        lastMessage: `${item.name} range.`,
      }),
    )
    return true
  },

  moveStack: (uid, x, y, rotated) => {
    const state = get()
    const stack = state.stacks.find((candidate) => candidate.uid === uid)
    if (!stack) return false

    // Lâchée sur une pile identique et empilable : les deux fusionnent.
    const mergeTarget = findMergeTarget(state.stacks, stack.itemId, x, y, stack.quantity, { ignoreUid: uid })
    if (mergeTarget) {
      set(
        commit({
          ...state,
          stacks: state.stacks
            .filter((candidate) => candidate.uid !== uid)
            .map((candidate) =>
              candidate.uid === mergeTarget.uid
                ? { ...candidate, quantity: candidate.quantity + stack.quantity }
                : candidate,
            ),
          selectedUid: mergeTarget.uid,
        }),
      )
      return true
    }

    // `ignoreUid` : la pile doit pouvoir glisser sur ses propres cases.
    if (!canPlace(state.stacks, stack.itemId, x, y, rotated, { ignoreUid: uid })) return false

    set(
      commit({
        ...state,
        stacks: state.stacks.map((candidate) =>
          candidate.uid === uid ? { ...candidate, x, y, rotated } : candidate,
        ),
      }),
    )
    return true
  },

  autoPlaceItem: (itemId, quantity = 1) => {
    const item = ITEMS_BY_ID[itemId]
    if (!item) return false

    const state = get()
    const spot = findFreeSpot(state.stacks, itemId)
    if (!spot) {
      set(commit({ ...state, lastMessage: `Sac plein : ${item.name} ne rentre pas.` }))
      return false
    }

    set(
      commit({
        ...state,
        stacks: [
          ...state.stacks,
          { uid: createStackUid(), itemId, quantity: clampInventoryQuantity(itemId, quantity), ...spot },
        ],
        lastMessage: `${item.name} range.`,
      }),
    )
    return true
  },

  removeStack: (uid, quantity) => {
    set((state) => {
      const stack = state.stacks.find((candidate) => candidate.uid === uid)
      if (!stack) return state

      const left = quantity == null ? 0 : stack.quantity - quantity
      const item = ITEMS_BY_ID[stack.itemId]

      return commit({
        ...state,
        stacks:
          left > 0
            ? state.stacks.map((candidate) => (candidate.uid === uid ? { ...candidate, quantity: left } : candidate))
            : state.stacks.filter((candidate) => candidate.uid !== uid),
        selectedUid: left > 0 ? state.selectedUid : null,
        lastMessage: item ? `${item.name} jete.` : state.lastMessage,
      })
    })
  },

  useStack: (uid) => {
    const state = get()
    const stack = state.stacks.find((candidate) => candidate.uid === uid)
    const item = stack ? ITEMS_BY_ID[stack.itemId] : null
    if (!stack || !item?.consumable) return

    if (item.effects) {
      useCharacterStatsStore.getState().applyConsumableEffects(item.name, item.effects, item.effectDurationMs, item.id)
    }

    const left = stack.quantity - 1
    set(
      commit({
        ...state,
        stacks:
          left > 0
            ? state.stacks.map((candidate) => (candidate.uid === uid ? { ...candidate, quantity: left } : candidate))
            : state.stacks.filter((candidate) => candidate.uid !== uid),
        selectedUid: left > 0 ? state.selectedUid : null,
        lastMessage: `${item.name} consomme.`,
      }),
    )
  },

  equipStack: (uid) => {
    const state = get()
    const stack = state.stacks.find((candidate) => candidate.uid === uid)
    const item = stack ? ITEMS_BY_ID[stack.itemId] : null
    if (!stack || !item?.equipSlot) return

    const slot = item.equipSlot
    const previous = state.equipped[slot]

    // L'objet déjà porté revient dans le sac — à la place que l'autre libère.
    const withoutNew = state.stacks.filter((candidate) => candidate.uid !== uid)
    const nextStacks = previous
      ? [
          ...withoutNew,
          {
            uid: createStackUid(),
            itemId: previous,
            quantity: 1,
            ...(findFreeSpot(withoutNew, previous) ?? { x: stack.x, y: stack.y, rotated: stack.rotated }),
          },
        ]
      : withoutNew

    set(
      commit({
        ...state,
        stacks: nextStacks,
        equipped: { ...state.equipped, [slot]: stack.itemId },
        selectedUid: null,
        lastMessage: `${item.name} equipe.`,
      }),
    )
  },

  unequipSlot: (slot) => {
    const state = get()
    const itemId = state.equipped[slot]
    const item = itemId ? ITEMS_BY_ID[itemId] : null
    if (!itemId || !item) return

    const spot = findFreeSpot(state.stacks, itemId)
    if (!spot) {
      // Refus explicite : sans ça, l'objet disparaîtrait purement et simplement.
      set(commit({ ...state, lastMessage: `Pas de place dans le sac pour ranger ${item.name}.` }))
      return
    }

    const { [slot]: _removed, ...nextEquipped } = state.equipped
    set(
      commit({
        ...state,
        stacks: [...state.stacks, { uid: createStackUid(), itemId, quantity: 1, ...spot }],
        equipped: nextEquipped,
        lastMessage: `${item.name} retire et range.`,
      }),
    )
  },

  assignQuickSlot: (slot, itemId) => {
    set((state) => {
      const nextQuickSlots = { ...state.quickSlots }
      if (itemId) nextQuickSlots[slot] = itemId
      else delete nextQuickSlots[slot]

      const item = itemId ? ITEMS_BY_ID[itemId] : null
      return commit({
        ...state,
        quickSlots: nextQuickSlots,
        lastMessage: item
          ? `${item.name} assigne au raccourci ${slot.replace('slot', '')}.`
          : `Raccourci ${slot.replace('slot', '')} vide.`,
      })
    })
  },

  activateQuickSlot: (slot) => {
    const state = get()
    const itemId = state.quickSlots[slot]
    const item = itemId ? ITEMS_BY_ID[itemId] : null
    // On agit sur la PREMIÈRE pile de cet objet dans le sac.
    const stack = itemId ? state.stacks.find((candidate) => candidate.itemId === itemId) : undefined

    if (!item || !stack) {
      set(commit({ ...state, lastMessage: `Raccourci ${slot.replace('slot', '')} vide.` }))
      return
    }

    if (item.consumable) get().useStack(stack.uid)
    else if (item.equipSlot) get().equipStack(stack.uid)
    else set(commit({ ...state, selectedUid: stack.uid, lastMessage: `${item.name} selectionne.` }))
  },

  selectStack: (uid) => set((state) => ({ ...state, selectedUid: uid })),
  clearMessage: () => set((state) => ({ ...state, lastMessage: null })),
}))
