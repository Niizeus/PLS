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
export type PlayerAction =
  | 'idle'
  | 'walk'
  | 'sadWalk'
  | 'run'
  | 'attack'
  | 'defense'
  | 'interact'
  | 'jump'
  | 'crouch'
  | 'hurt'

export type PlayerLocomotionAction = Exclude<PlayerAction, 'attack' | 'hurt'>

export interface PlayerPose {
  x: number
  y: number
  z: number
  rot: number
  vx?: number
  vy?: number
  vz?: number
}

export type PlayerPhysicsMode = 'grounded' | 'airborne' | 'sliding' | 'unstucking'

export interface PlayerPhysicsDebug {
  mode: PlayerPhysicsMode
  grounded: boolean
  position: { x: number; y: number; z: number }
  groundY: number | null
  hitPoint: { x: number; y: number; z: number } | null
  hitNormal: { x: number; y: number; z: number } | null
}

/**
 * Le coup en cours quand `action === 'attack'`.
 * - `punch1/2/3` : les 3 coups de l'enchaînement à mains nues.
 * - `weapon`     : attaque avec une arme équipée (pelle & co).
 */
export type AttackMove = 'punch1' | 'punch2' | 'punch3' | 'weapon'

interface PlayerState {
  /** Ce que fait Chibrux en ce moment (pour le visuel + le HUD). */
  action: PlayerAction
  /** Animation de base des jambes / du corps, meme pendant un coup haut du corps. */
  locomotionAction: PlayerLocomotionAction
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
  /** Ragdoll debug actif : le controleur joueur normal est mis en pause. */
  isRagdoll: boolean
  /** Pose de retour publiee par le ragdoll, ou pose de depart quand il s'active. */
  ragdollPose: PlayerPose | null
  /** Infos DEV du controller physique joueur, publiees seulement quand le debug collision est actif. */
  physicsDebug: PlayerPhysicsDebug
  /**
   * Le groupe 3D du joueur, publié par Player à son montage.
   * La caméra (FollowCamera) le lit pour suivre le perso, sans que les deux
   * aient besoin de se connaître ni de passer par GameCanvas.
   */
  playerObject: THREE.Object3D | null
  setAction: (action: PlayerAction) => void
  setLocomotionAction: (action: PlayerLocomotionAction) => void
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
  setRagdoll: (enabled: boolean, pose?: PlayerPose) => void
  setRagdollPose: (pose: PlayerPose) => void
  setPhysicsDebug: (debug: PlayerPhysicsDebug) => void
  setPlayerObject: (object: THREE.Object3D | null) => void
  setZoneName: (zoneName: string | null) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  action: 'idle',
  locomotionAction: 'idle',
  isDefending: false,
  attackMove: null,
  attackToken: 0,
  hurtToken: 0,
  zoneName: null,
  isRagdoll: false,
  ragdollPose: null,
  physicsDebug: {
    mode: 'grounded',
    grounded: true,
    position: { x: 0, y: 0, z: 0 },
    groundY: null,
    hitPoint: null,
    hitNormal: null,
  },
  playerObject: null,
  setAction: (action) => set({ action }),
  setLocomotionAction: (locomotionAction) => set({ locomotionAction }),
  setDefending: (isDefending) => set({ isDefending }),
  strike: (move) => set((s) => ({ attackMove: move, attackToken: s.attackToken + 1 })),
  endStrike: () => set({ attackMove: null }),
  takeHit: () => set((s) => ({ hurtToken: s.hurtToken + 1 })),
  setRagdoll: (enabled, pose) =>
    set((s) => ({
      isRagdoll: enabled,
      ragdollPose: pose ?? s.ragdollPose,
      action: enabled ? 'hurt' : s.action,
      attackMove: enabled ? null : s.attackMove,
      isDefending: enabled ? false : s.isDefending,
    })),
  setRagdollPose: (ragdollPose) => set({ ragdollPose }),
  setPhysicsDebug: (physicsDebug) => set({ physicsDebug }),
  setPlayerObject: (object) => set({ playerObject: object }),
  setZoneName: (zoneName) => set({ zoneName }),
}))
