import { create } from 'zustand'

export interface WorldPickup {
  id: string
  itemId: string
  quantity: number
  x: number
  z: number
}

interface NearbyPickup {
  pickupId: string
  itemId: string
  itemName: string
  quantity: number
}

interface PickupState {
  collectedIds: string[]
  droppedPickups: WorldPickup[]
  nearbyPickup: NearbyPickup | null
  addDroppedPickup: (pickup: WorldPickup) => void
  collectPickup: (pickupId: string) => void
  setNearbyPickup: (pickup: NearbyPickup | null) => void
}

const STORAGE_KEY = 'pls.pickups.v1'

interface StoredPickups {
  collectedIds: string[]
  droppedPickups: WorldPickup[]
}

const EMPTY_PICKUPS: StoredPickups = { collectedIds: [], droppedPickups: [] }

const loadPickups = (): StoredPickups => {
  if (typeof localStorage === 'undefined') return EMPTY_PICKUPS

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_PICKUPS
    const parsed = JSON.parse(raw) as StoredPickups | string[]
    if (Array.isArray(parsed)) return { collectedIds: parsed, droppedPickups: [] }
    return {
      collectedIds: parsed.collectedIds ?? [],
      droppedPickups: parsed.droppedPickups ?? [],
    }
  } catch {
    return EMPTY_PICKUPS
  }
}

const savePickups = (pickups: StoredPickups) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pickups))
}

const initialPickups = loadPickups()

export const usePickupStore = create<PickupState>((set) => ({
  collectedIds: initialPickups.collectedIds,
  droppedPickups: initialPickups.droppedPickups,
  nearbyPickup: null,

  addDroppedPickup: (pickup) =>
    set((state) => {
      const droppedPickups = [...state.droppedPickups, pickup]
      savePickups({ collectedIds: state.collectedIds, droppedPickups })
      return { droppedPickups }
    }),

  collectPickup: (pickupId) =>
    set((state) => {
      const isDroppedPickup = state.droppedPickups.some((pickup) => pickup.id === pickupId)
      const droppedPickups = state.droppedPickups.filter((pickup) => pickup.id !== pickupId)
      const collectedIds =
        isDroppedPickup || state.collectedIds.includes(pickupId)
          ? state.collectedIds
          : [...state.collectedIds, pickupId]

      savePickups({ collectedIds, droppedPickups })
      return { collectedIds, droppedPickups, nearbyPickup: null }
    }),

  setNearbyPickup: (nearbyPickup) => set({ nearbyPickup }),
}))
