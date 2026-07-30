import { create } from 'zustand'

/**
 * 🎯 La destination choisie par le joueur (« Y aller » depuis le GPS du téléphone).
 *
 * C'est le seul lien entre le téléphone et le HUD : le tel POSE une destination,
 * la minimap la MONTRE. Aucun des deux ne connaît l'autre, ils ne partagent que
 * ce store — donc on pourra afficher la destination ailleurs (grande carte,
 * flèche à l'écran, tableau de bord) sans retoucher au téléphone.
 *
 * Une seule destination à la fois, comme un vrai GPS.
 */

export interface MapDestination {
  /** Position dans le monde (mètres). */
  x: number
  z: number
  label: string
  /** Emoji repris du point d'intérêt ou du point de passage. */
  icon: string
}

interface DestinationState {
  destination: MapDestination | null
  setDestination: (destination: MapDestination) => void
  clearDestination: () => void
}

export const useDestinationStore = create<DestinationState>((set) => ({
  destination: null,
  setDestination: (destination) => set({ destination }),
  clearDestination: () => set({ destination: null }),
}))
