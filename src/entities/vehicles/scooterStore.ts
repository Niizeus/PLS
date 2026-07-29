import { create } from 'zustand'
import { SPAWN } from '../../world/beauvais/cityData'

/**
 * Etat du scooter, partage entre la logique de conduite et son visuel.
 */
interface ScooterState {
  riding: boolean
  parkedX: number
  parkedZ: number
  parkedRot: number
  visualPitch: number
  visualRoll: number
  fuelLiters: number
  fuelCapacityLiters: number
  consumeFuel: (liters: number) => void
  setVisualAttitude: (pitch: number, roll: number) => void
  mount: () => void
  parkAt: (x: number, z: number, rot: number) => void
}

export const useScooterStore = create<ScooterState>((set) => ({
  riding: false,
  // Gare a cote du point d'apparition du joueur, pour le trouver tout de suite.
  parkedX: SPAWN.x + 2.5,
  parkedZ: SPAWN.z,
  parkedRot: 0,
  visualPitch: 0,
  visualRoll: 0,
  fuelLiters: 5.5,
  fuelCapacityLiters: 5.5,
  consumeFuel: (liters) => set((s) => ({ fuelLiters: Math.max(0, s.fuelLiters - liters) })),
  setVisualAttitude: (visualPitch, visualRoll) => set({ visualPitch, visualRoll }),
  mount: () => set({ riding: true }),
  parkAt: (x, z, rot) => set({ riding: false, parkedX: x, parkedZ: z, parkedRot: rot }),
}))
