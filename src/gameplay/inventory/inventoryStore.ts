import { create } from 'zustand'
import { ITEMS_BY_ID, type EquipmentSlot } from '../../data/items'
import { useCharacterStatsStore } from '../stats/characterStatsStore'
import { clampInventoryQuantity, getAddItemFailureMessage, getAddItemFailureReason } from './inventoryRules'

export interface InventoryEntry {
  itemId: string
  quantity: number
}

export type EquippedItems = Partial<Record<EquipmentSlot, string>>
export type QuickSlotId = 'slot1' | 'slot2' | 'slot3' | 'slot4'
export type QuickSlots = Partial<Record<QuickSlotId, string>>

export const QUICK_SLOT_IDS: QuickSlotId[] = ['slot1', 'slot2', 'slot3', 'slot4']

interface InventoryData {
  items: InventoryEntry[]
  equipped: EquippedItems
  quickSlots: QuickSlots
  selectedItemId: string | null
  lastMessage: string | null
}

interface InventoryState extends InventoryData {
  addItem: (itemId: string, quantity?: number) => boolean
  removeItem: (itemId: string, quantity?: number) => void
  useItem: (itemId: string) => void
  equipItem: (itemId: string) => void
  unequipSlot: (slot: EquipmentSlot) => void
  assignQuickSlot: (slot: QuickSlotId, itemId: string | null) => void
  activateQuickSlot: (slot: QuickSlotId) => void
  selectItem: (itemId: string | null) => void
  clearMessage: () => void
}

const STORAGE_KEY = 'pls.inventory.v1'

const STARTER_INVENTORY: InventoryData = {
  items: [
    { itemId: 'poing-basique', quantity: 1 },
    { itemId: 'kebab-chef', quantity: 2 },
    { itemId: 'doliprane', quantity: 1 },
    { itemId: 'soda-market', quantity: 1 },
    { itemId: 'chouffe-guerrier', quantity: 1 },
    { itemId: 'casquette-envers', quantity: 1 },
    { itemId: 'cendrier', quantity: 3 },
  ],
  equipped: { rightHand: 'poing-basique' },
  quickSlots: { slot1: 'kebab-chef', slot2: 'soda-market', slot3: 'doliprane', slot4: 'chouffe-guerrier' },
  selectedItemId: 'poing-basique',
  lastMessage: 'Inventaire pret.',
}

const hasItem = (items: InventoryEntry[], itemId: string) =>
  items.some((entry) => entry.itemId === itemId && entry.quantity > 0)

const sanitizeData = (data: InventoryData): InventoryData => {
  const items = data.items
    .filter((entry) => ITEMS_BY_ID[entry.itemId])
    .map((entry) => ({ itemId: entry.itemId, quantity: clampInventoryQuantity(entry.itemId, entry.quantity) }))
    .filter((entry) => entry.quantity > 0)

  const equipped = Object.fromEntries(
    Object.entries(data.equipped).filter(([, itemId]) => itemId && hasItem(items, itemId)),
  ) as EquippedItems
  const quickSlots = Object.fromEntries(
    Object.entries(data.quickSlots ?? {}).filter(([, itemId]) => itemId && hasItem(items, itemId)),
  ) as QuickSlots

  const selectedItemId =
    data.selectedItemId && hasItem(items, data.selectedItemId) ? data.selectedItemId : items[0]?.itemId ?? null

  return {
    items,
    equipped,
    quickSlots,
    selectedItemId,
    lastMessage: data.lastMessage ?? null,
  }
}

const saveInventory = (data: InventoryData) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const loadInventory = (): InventoryData => {
  if (typeof localStorage === 'undefined') return STARTER_INVENTORY

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return STARTER_INVENTORY
    return sanitizeData(JSON.parse(raw) as InventoryData)
  } catch {
    return STARTER_INVENTORY
  }
}

const commit = (data: InventoryData) => {
  const clean = sanitizeData(data)
  saveInventory(clean)
  return clean
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  ...loadInventory(),

  addItem: (itemId, quantity = 1) => {
    const item = ITEMS_BY_ID[itemId]
    if (!item) return false

    const currentItems = get().items
    const failureReason = getAddItemFailureReason(currentItems, itemId, quantity)
    if (failureReason) {
      set((state) =>
        commit({
          items: state.items,
          equipped: state.equipped,
          quickSlots: state.quickSlots,
          selectedItemId: state.selectedItemId,
          lastMessage: getAddItemFailureMessage(itemId, failureReason),
        }),
      )
      return false
    }

    set((state) => {
      const current = state.items.find((entry) => entry.itemId === itemId)
      const nextItems = current
        ? state.items.map((entry) =>
            entry.itemId === itemId
              ? { ...entry, quantity: clampInventoryQuantity(itemId, entry.quantity + quantity) }
              : entry,
          )
        : [...state.items, { itemId, quantity: clampInventoryQuantity(itemId, quantity) }]

      return commit({
        items: nextItems,
        equipped: state.equipped,
        quickSlots: state.quickSlots,
        selectedItemId: itemId,
        lastMessage: `${item.name} ajoute a l inventaire.`,
      })
    })
    return true
  },

  removeItem: (itemId, quantity = 1) => {
    set((state) => {
      const nextItems = state.items
        .map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity - quantity } : entry))
        .filter((entry) => entry.quantity > 0)
      const nextEquipped = Object.fromEntries(
        Object.entries(state.equipped).filter(
          ([, equippedItemId]) => equippedItemId !== itemId || hasItem(nextItems, itemId),
        ),
      ) as EquippedItems

      return commit({
        items: nextItems,
        equipped: nextEquipped,
        quickSlots: state.quickSlots,
        selectedItemId:
          state.selectedItemId === itemId && !hasItem(nextItems, itemId) ? nextItems[0]?.itemId ?? null : state.selectedItemId,
        lastMessage: state.lastMessage,
      })
    })
  },

  useItem: (itemId) => {
    const item = ITEMS_BY_ID[itemId]
    if (!item || !item.consumable || !hasItem(get().items, itemId)) return
    if (item.effects) useCharacterStatsStore.getState().applyConsumableEffects(item.name, item.effects, item.effectDurationMs, item.id)

    set((state) => {
      const nextItems = state.items
        .map((entry) => (entry.itemId === itemId ? { ...entry, quantity: entry.quantity - 1 } : entry))
        .filter((entry) => entry.quantity > 0)

      return commit({
        items: nextItems,
        equipped: state.equipped,
        quickSlots: state.quickSlots,
        selectedItemId: hasItem(nextItems, itemId) ? itemId : nextItems[0]?.itemId ?? null,
        lastMessage: `${item.name} consomme. Effets appliques.`,
      })
    })
  },

  equipItem: (itemId) => {
    const item = ITEMS_BY_ID[itemId]
    if (!item?.equipSlot || !hasItem(get().items, itemId)) return

    set((state) =>
      commit({
        items: state.items,
        equipped: { ...state.equipped, [item.equipSlot!]: itemId },
        quickSlots: state.quickSlots,
        selectedItemId: itemId,
        lastMessage: `${item.name} equipe.`,
      }),
    )
  },

  unequipSlot: (slot) => {
    set((state) => {
      const { [slot]: removedItemId, ...nextEquipped } = state.equipped
      const item = removedItemId ? ITEMS_BY_ID[removedItemId] : null

      return commit({
        items: state.items,
        equipped: nextEquipped,
        quickSlots: state.quickSlots,
        selectedItemId: state.selectedItemId,
        lastMessage: item ? `${item.name} retire.` : null,
      })
    })
  },

  assignQuickSlot: (slot, itemId) => {
    set((state) => {
      const nextQuickSlots = { ...state.quickSlots }
      if (itemId && hasItem(state.items, itemId)) nextQuickSlots[slot] = itemId
      else delete nextQuickSlots[slot]

      const item = itemId ? ITEMS_BY_ID[itemId] : null
      return commit({
        items: state.items,
        equipped: state.equipped,
        quickSlots: nextQuickSlots,
        selectedItemId: state.selectedItemId,
        lastMessage: item ? `${item.name} assigne au raccourci ${slot.replace('slot', '')}.` : `Raccourci ${slot.replace('slot', '')} vide.`,
      })
    })
  },

  activateQuickSlot: (slot) => {
    const itemId = get().quickSlots[slot]
    const item = itemId ? ITEMS_BY_ID[itemId] : null

    if (!itemId || !item || !hasItem(get().items, itemId)) {
      set((state) =>
        commit({
          items: state.items,
          equipped: state.equipped,
          quickSlots: state.quickSlots,
          selectedItemId: state.selectedItemId,
          lastMessage: `Raccourci ${slot.replace('slot', '')} vide.`,
        }),
      )
      return
    }

    if (item.consumable) get().useItem(itemId)
    else if (item.equipSlot) get().equipItem(itemId)
    else set((state) => commit({ ...state, selectedItemId: itemId, lastMessage: `${item.name} selectionne.` }))
  },

  selectItem: (itemId) => set((state) => commit({ ...state, selectedItemId: itemId })),
  clearMessage: () => set((state) => commit({ ...state, lastMessage: null })),
}))
