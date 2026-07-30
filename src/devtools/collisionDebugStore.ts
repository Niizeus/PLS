import { create } from 'zustand'

interface CollisionDebugState {
  enabled: boolean
  toggle: () => void
  setEnabled: (enabled: boolean) => void
}

export const useCollisionDebugStore = create<CollisionDebugState>((set) => ({
  enabled: false,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setEnabled: (enabled) => set({ enabled }),
}))
