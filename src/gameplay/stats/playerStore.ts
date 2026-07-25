import { create } from 'zustand'
import type * as THREE from 'three'

/**
 * État du joueur, partagé entre la 3D (Player) et l'UI (HUD).
 * Zustand = store global simple : on lit avec usePlayerStore(s => s.xxx),
 * on écrit avec les actions ci-dessous. Voir docs/02-ARCHITECTURE.md.
 *
 * Ce store sert aussi de POINT DE RENDEZ-VOUS entre modules : plutôt que de
 * brancher les composants entre eux "à la main" dans GameCanvas (source de
 * conflits Git), chacun publie/lit ce dont il a besoin ici.
 * Ex : Player publie son objet 3D, la caméra le lit pour le suivre.
 */

// Les états visuels possibles du personnage.
export type PlayerAction = 'idle' | 'walk' | 'run' | 'attack' | 'defense' | 'interact' | 'jump' | 'crouch'

interface PlayerState {
  /** Ce que fait Chibrux en ce moment (pour le visuel + le HUD). */
  action: PlayerAction
  /** true tant que le clic droit (défense) est maintenu. */
  isDefending: boolean
  /** Nom du quartier où se trouve le joueur (null = hors zones connues). */
  zoneName: string | null
  /**
   * Le groupe 3D du joueur, publié par Player à son montage.
   * La caméra (FollowCamera) le lit pour suivre le perso, sans que les deux
   * aient besoin de se connaître ni de passer par GameCanvas.
   */
  playerObject: THREE.Object3D | null
  setAction: (action: PlayerAction) => void
  setDefending: (isDefending: boolean) => void
  setPlayerObject: (object: THREE.Object3D | null) => void
  setZoneName: (zoneName: string | null) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  action: 'idle',
  isDefending: false,
  zoneName: null,
  playerObject: null,
  setAction: (action) => set({ action }),
  setDefending: (isDefending) => set({ isDefending }),
  setPlayerObject: (object) => set({ playerObject: object }),
  setZoneName: (zoneName) => set({ zoneName }),
}))
