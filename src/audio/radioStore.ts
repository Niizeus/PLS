import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getRadioStation, RADIO_STATION_IDS, type RadioStationId } from './radioCatalog'

export type RadioSourceKind = 'vehicle' | 'world-speaker'

export interface ActiveRadioSource {
  kind: RadioSourceKind
  id: string
}

interface RadioState {
  activeSource: ActiveRadioSource | null
  currentStationId: RadioStationId | null
  currentContentLabel: string | null
  vehicleStations: Record<string, RadioStationId>
  volume: number
  radioFilterEnabled: boolean
  assignStationToVehicle: (vehicleId: string) => RadioStationId
  startVehicleRadio: (vehicleId: string) => RadioStationId
  stopRadio: (sourceId: string) => void
  setCurrentContentLabel: (label: string | null) => void
  setVolume: (volume: number) => void
  setRadioFilterEnabled: (enabled: boolean) => void
}

export const useRadioStore = create<RadioState>()(
  persist(
    (set, get) => ({
      activeSource: null,
      currentStationId: null,
      currentContentLabel: null,
      vehicleStations: {},
      volume: 0.48,
      radioFilterEnabled: false,
      assignStationToVehicle: (vehicleId) => {
        const existing = get().vehicleStations[vehicleId]
        if (existing) return existing

        const stationId = RADIO_STATION_IDS[Math.floor(Math.random() * RADIO_STATION_IDS.length)]
        set((state) => ({
          vehicleStations: {
            ...state.vehicleStations,
            [vehicleId]: stationId,
          },
        }))
        return stationId
      },
      startVehicleRadio: (vehicleId) => {
        const stationId = get().assignStationToVehicle(vehicleId)
        set({
          activeSource: { kind: 'vehicle', id: vehicleId },
          currentStationId: stationId,
          currentContentLabel: null,
        })
        return stationId
      },
      stopRadio: (sourceId) => {
        const active = get().activeSource
        if (!active || active.id !== sourceId) return
        set({ activeSource: null, currentStationId: null, currentContentLabel: null })
      },
      setCurrentContentLabel: (label) => set((state) => state.currentContentLabel === label ? state : { currentContentLabel: label }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setRadioFilterEnabled: (enabled) => set({ radioFilterEnabled: enabled }),
    }),
    {
      name: 'pls-radio-state',
      partialize: (state) => ({
        vehicleStations: state.vehicleStations,
        volume: state.volume,
        radioFilterEnabled: state.radioFilterEnabled,
      }),
    },
  ),
)

export function getCurrentRadioLabel(): string | null {
  const stationId = useRadioStore.getState().currentStationId
  return stationId ? getRadioStation(stationId).shortName : null
}