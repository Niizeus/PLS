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
export type PlayerAction = 'idle' | 'walk' | 'run' | 'attack' | 'defense' | 'interact' | 'jump' | 'crouch' | 'hurt'

/**
 * Le coup en cours quand `action === 'attack'`.
 * - `punch1/2/3` : les 3 coups de l'enchaînement à mains nues.
 * - `weapon`     : attaque avec une arme équipée (pelle & co).
 */
export type AttackMove = 'punch1' | 'punch2' | 'punch3' | 'weapon'

interface PlayerState {
  /** Ce que fait Chibrux en ce moment (pour le visuel + le HUD). */
  action: PlayerAction
  /** true tant que le clic droit (défense) est maintenu. */
  isDefending: boolean
  /** Quel coup est joué pendant une attaque (null si le joueur n'attaque pas). */
  attackMove: AttackMove | null
  /**
   * Compteur incrémenté à CHAQUE coup porté. Il sert de "top départ" au modèle 3D :
   * même si on rejoue deux fois le même coup, le compteur change → l'animation
   * est relancée depuis le début (sinon elle resterait figée sur sa dernière image).
   */
  attackToken: number
  /** Même principe que `attackToken`, mais pour l'animation "hurt". */
  hurtToken: number
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
  /** Déclenche un coup (appelé par la logique de combat, pas par l'UI). */
  strike: (move: AttackMove) => void
  /** Fin du coup : on efface le coup affiché. */
  endStrike: () => void
  /**
   * "Le joueur vient de prendre un coup" → joue l'animation Hurt.
   * N'importe quel système (ennemi, chute, dégâts de faim...) peut l'appeler :
   * `usePlayerStore.getState().takeHit()`.
   */
  takeHit: () => void
  setPlayerObject: (object: THREE.Object3D | null) => void
  setZoneName: (zoneName: string | null) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  action: 'idle',
  isDefending: false,
  attackMove: null,
  attackToken: 0,
  hurtToken: 0,
  zoneName: null,
  playerObject: null,
  setAction: (action) => set({ action }),
  setDefending: (isDefending) => set({ isDefending }),
  strike: (move) => set((s) => ({ attackMove: move, attackToken: s.attackToken + 1 })),
  endStrike: () => set({ attackMove: null }),
  takeHit: () => set((s) => ({ hurtToken: s.hurtToken + 1 })),
  setPlayerObject: (object) => set({ playerObject: object }),
  setZoneName: (zoneName) => set({ zoneName }),
}))
