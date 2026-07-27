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
  /** Passe à la station suivante. Ne fait rien si aucune radio ne joue. */
  nextStation: () => RadioStationId | null
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
      /**
       * Attribue une station à un véhicule, la première fois qu'on y monte.
       *
       * ⚠️ On ne tire QUE parmi les stations qui ont de la musique. Avant, le
       * tirage prenait les cinq au hasard — or une station sans un seul fichier
       * dans `Musiques/` est muette hors de ses émissions. Comme le choix est
       * ensuite MÉMORISÉ pour ce véhicule, une caisse sur cinq restait
       * définitivement silencieuse, et ça ressemblait à une radio cassée.
       *
       * On peut toujours zapper dessus avec R : c'est alors un choix, pas un
       * mauvais tirage.
       */
      assignStationToVehicle: (vehicleId) => {
        const existing = get().vehicleStations[vehicleId]
        if (existing) return existing

        const withMusic = RADIO_STATION_IDS.filter((id) => getRadioStation(id).musicTracks.length > 0)
        const pool = withMusic.length > 0 ? withMusic : RADIO_STATION_IDS
        const stationId = pool[Math.floor(Math.random() * pool.length)]
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
      /**
       * Station suivante (touche R en véhicule).
       *
       * On mémorise le choix dans `vehicleStations` : chaque véhicule garde SA
       * station, donc en redescendant puis remontant on retrouve la sienne — c'est
       * ce qui donne l'impression que l'autoradio est celui de la caisse.
       */
      nextStation: () => {
        const { activeSource, currentStationId } = get()
        if (!activeSource || !currentStationId) return null

        const index = RADIO_STATION_IDS.indexOf(currentStationId)
        const stationId = RADIO_STATION_IDS[(index + 1) % RADIO_STATION_IDS.length]

        set((state) => ({
          currentStationId: stationId,
          currentContentLabel: null,
          vehicleStations:
            activeSource.kind === 'vehicle'
              ? { ...state.vehicleStations, [activeSource.id]: stationId }
              : state.vehicleStations,
        }))
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