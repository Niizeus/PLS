import { create } from 'zustand'
import { SPAWN } from '../../world/beauvais/cityData'

interface CarState {
  riding: boolean
  parkedX: number
  parkedZ: number
  parkedRot: number
  fuelLiters: number
  fuelCapacityLiters: number
  consumeFuel: (liters: number) => void
  mount: () => void
  parkAt: (x: number, z: number, rot: number) => void
}

export const useCarStore = create<CarState>((set) => ({
  riding: false,
  // Gares pres du spawn pour tester tout de suite la conduite voiture.
  parkedX: SPAWN.x - 4.5,
  parkedZ: SPAWN.z + 1.8,
  parkedRot: Math.PI * 0.5,
  fuelLiters: 42,
  fuelCapacityLiters: 42,
  consumeFuel: (liters) => set((s) => ({ fuelLiters: Math.max(0, s.fuelLiters - liters) })),
  mount: () => set({ riding: true }),
  parkAt: (x, z, rot) => set({ riding: false, parkedX: x, parkedZ: z, parkedRot: rot }),
}))
