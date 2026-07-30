import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getRadioStation, RADIO_STATION_IDS, type RadioStationId } from './radioCatalog'

export type RadioSourceKind = 'vehicle' | 'world-speaker'

export interface ActiveRadioSource {
  kind: RadioSourceKind
  id: string
}

/**
 * 🔇 Le poste ÉTEINT est un cran du bouton comme un autre.
 *
 * On ne l'a pas modélisé comme une sixième « station muette » : une station a un
 * programme, des jingles, une grille horaire. Éteint, il n'y a rien à diffuser —
 * ni musique, ni jingle, ni souffle, ni transition. C'est donc simplement
 * `currentStationId === null` **alors qu'une source est toujours active**, ce
 * que `RadioAudioSystem` sait déjà traiter (il coupe le lecteur et le souffle).
 *
 * ⚠️ À ne pas confondre avec `activeSource === null`, qui veut dire « il n'y a
 * pas de poste ici » (on est à pied). Le poste éteint, lui, est bien là : R le
 * rallume sur la première station.
 */
export const RADIO_OFF = 'OFF' as const

/** Ce qu'un véhicule a mémorisé : une station, ou le poste coupé. */
export type RadioTuning = RadioStationId | typeof RADIO_OFF

interface RadioState {
  activeSource: ActiveRadioSource | null
  /** `null` = poste éteint (voir `RADIO_OFF`), tant qu'`activeSource` existe. */
  currentStationId: RadioStationId | null
  currentContentLabel: string | null
  vehicleStations: Record<string, RadioTuning>
  volume: number
  radioFilterEnabled: boolean
  assignStationToVehicle: (vehicleId: string) => RadioTuning
  startVehicleRadio: (vehicleId: string) => RadioStationId | null
  /**
   * Cran suivant du bouton. L'ordre est : R01 → … → R05 → **éteint** → R01.
   * Ne fait rien s'il n'y a pas de poste (à pied).
   */
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
        const tuning = get().assignStationToVehicle(vehicleId)
        // Le véhicule avait été laissé poste coupé : il le reste. C'est ce qui
        // rend l'option réellement utilisable — sinon la radio se rallumerait
        // à chaque fois qu'on remonte dans la caisse.
        const stationId = tuning === RADIO_OFF ? null : tuning
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
        // Pas de poste du tout (à pied) : R ne doit rien allumer.
        if (!activeSource) return null

        // Le cran « éteint » vient APRÈS la dernière station, d'où un tour de
        // roue de longueur `stations + 1`. Poste coupé → on repart sur la 1re.
        const wheelLength = RADIO_STATION_IDS.length + 1
        const index = currentStationId ? RADIO_STATION_IDS.indexOf(currentStationId) : RADIO_STATION_IDS.length
        const next = (index + 1) % wheelLength
        const stationId = next < RADIO_STATION_IDS.length ? RADIO_STATION_IDS[next] : null

        set((state) => ({
          currentStationId: stationId,
          currentContentLabel: null,
          vehicleStations:
            activeSource.kind === 'vehicle'
              ? { ...state.vehicleStations, [activeSource.id]: stationId ?? RADIO_OFF }
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