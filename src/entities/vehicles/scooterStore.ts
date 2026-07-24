import { create } from 'zustand'
import { SPAWN } from '../../world/beauvais/cityData'

/**
 * État du scooter, partagé entre la logique (usePlayerMovement, qui le conduit) et
 * son visuel (Scooter.tsx, qui se place au bon endroit).
 *
 * - `riding` : le joueur est-il en train de le conduire ?
 * - `parkedX/Z/Rot` : où le scooter est GARÉ. Quand on roule, le scooter suit le
 *   joueur ; quand on descend, on le gare là où on s'arrête.
 *
 * Comme pour la caméra, on lit ça dans useFrame via getState() (pas de re-render).
 */
interface ScooterState {
  riding: boolean
  parkedX: number
  parkedZ: number
  parkedRot: number
  /** Monter sur le scooter. */
  mount: () => void
  /** Descendre : garer le scooter à cet endroit et cette orientation. */
  parkAt: (x: number, z: number, rot: number) => void
}

export const useScooterStore = create<ScooterState>((set) => ({
  riding: false,
  // Garé à côté du point d'apparition du joueur, pour le trouver tout de suite.
  parkedX: SPAWN.x + 2.5,
  parkedZ: SPAWN.z,
  parkedRot: 0,
  mount: () => set({ riding: true }),
  parkAt: (x, z, rot) => set({ riding: false, parkedX: x, parkedZ: z, parkedRot: rot }),
}))
