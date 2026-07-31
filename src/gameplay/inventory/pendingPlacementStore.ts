import { create } from 'zustand'

/**
 * ✋ L'objet qu'on tient en main, en attente d'être RANGÉ.
 *
 * C'est le cœur du parti pris du sac : **ramasser ne range pas tout seul**. Quand
 * le joueur appuie sur `E` devant un objet, celui-ci ne se téléporte pas dans
 * une liste — il vient se coller au curseur, le sac s'ouvre, et le joueur doit
 * lui trouver une place. C'est là que se joue le petit jeu de gestion (voir
 * `docs/05-OBJETS-EQUIPEMENTS.md`).
 *
 * ⚠️ Tant que le placement n'est pas confirmé, **l'objet reste dans le monde** :
 * `pickupId` n'est consommé qu'au moment où la pile est effectivement posée. Si
 * le joueur annule (Échap), l'objet est toujours par terre, rien n'est perdu.
 */

export interface PendingPlacement {
  itemId: string
  quantity: number
  /** Objet du monde à consommer une fois posé. Absent = il vient déjà du sac. */
  pickupId?: string
  /** Pivoté ? Le joueur peut tourner l'objet avant de le poser. */
  rotated: boolean
}

interface PendingPlacementState {
  pending: PendingPlacement | null
  /** Met un objet « en main » et ouvre le sac. */
  startPlacement: (placement: Omit<PendingPlacement, 'rotated'>) => void
  /** Fait pivoter l'objet tenu, si sa forme le permet. */
  toggleRotation: () => void
  /** Abandonne : l'objet reste là où il était. */
  cancelPlacement: () => void
}

export const usePendingPlacementStore = create<PendingPlacementState>((set) => ({
  pending: null,
  startPlacement: (placement) => set({ pending: { ...placement, rotated: false } }),
  toggleRotation: () =>
    set((state) => (state.pending ? { pending: { ...state.pending, rotated: !state.pending.rotated } } : state)),
  cancelPlacement: () => set({ pending: null }),
}))
