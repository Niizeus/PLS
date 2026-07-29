import { create } from 'zustand'
import { type MapMarker } from '../../data/mapMarkers'
import { type MapMarkerAvailability } from './mapMarkerRuntime'

export interface NearbyMapMarker {
  marker: MapMarker
  distance: number
  availability: MapMarkerAvailability
}

interface MapMarkerState {
  nearbyMarker: NearbyMapMarker | null
  interactionMessage: string | null
  interactionToken: number
  setNearbyMarker: (nearbyMarker: NearbyMapMarker | null) => void
  showInteractionMessage: (message: string) => void
  clearInteractionMessage: () => void
}

export const useMapMarkerStore = create<MapMarkerState>((set) => ({
  nearbyMarker: null,
  interactionMessage: null,
  interactionToken: 0,
  setNearbyMarker: (nearbyMarker) => set({ nearbyMarker }),
  showInteractionMessage: (message) =>
    set((state) => ({
      interactionMessage: message,
      interactionToken: state.interactionToken + 1,
    })),
  clearInteractionMessage: () => set({ interactionMessage: null }),
}))
