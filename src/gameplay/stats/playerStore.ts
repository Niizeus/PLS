import { create } from 'zustand'

/**
 * État du joueur, partagé entre la 3D (Player) et l'UI (HUD).
 * Zustand = store global simple : on lit avec usePlayerStore(s => s.xxx),
 * on écrit avec les actions ci-dessous. Voir docs/02-ARCHITECTURE.md.
 *
 * Pour l'instant on ne garde que "l'action en cours" du perso, ce qui suffit
 * à faire réagir le visuel et à l'afficher dans le HUD.
 */

// Les états visuels possibles du personnage.
export type PlayerAction = 'idle' | 'walk' | 'run' | 'attack' | 'defense' | 'interact'

interface PlayerState {
  /** Ce que fait Chibrux en ce moment (pour le visuel + le HUD). */
  action: PlayerAction
  /** true tant que le clic droit (défense) est maintenu. */
  isDefending: boolean
  setAction: (action: PlayerAction) => void
  setDefending: (isDefending: boolean) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  action: 'idle',
  isDefending: false,
  setAction: (action) => set({ action }),
  setDefending: (isDefending) => set({ isDefending }),
}))
