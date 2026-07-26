import { create } from 'zustand'

export type VehicleKind = 'car' | 'scooter'

/** Ce que la physique publie chaque image pour le tableau de bord. */
export interface VehicleTelemetry {
  /** Vitesse longitudinale signée (m/s). */
  speed: number
  /** Régime moteur (tr/min). */
  rpm: number
  /** Rapport engagé, 1 = première. `0` = variateur (scooter), rien à afficher. */
  gear: number
  /** Régime de la zone rouge, pour dessiner le compte-tours. */
  maxRpm: number
  /** Vitesse maxi du véhicule (m/s), pour graduer le compteur. */
  maxSpeed: number
  /** Niveau d'essence, de 0 à 1. */
  fuelRatio: number
}

interface VehicleTelemetryState {
  riding: boolean
  kind: VehicleKind | null
  speedKmh: number
  rpm: number
  gear: number
  rpmRatio: number
  /** Graduation maxi du compteur, en km/h (arrondie au multiple de 20 au-dessus). */
  dialMaxKmh: number
  fuelPercent: number
  setTelemetry: (kind: VehicleKind, telemetry: VehicleTelemetry) => void
  clearTelemetry: () => void
}

export const useVehicleTelemetryStore = create<VehicleTelemetryState>((set) => ({
  riding: false,
  kind: null,
  speedKmh: 0,
  rpm: 0,
  gear: 1,
  rpmRatio: 0,
  dialMaxKmh: 140,
  fuelPercent: 100,
  setTelemetry: (kind, t) =>
    set({
      riding: true,
      kind,
      speedKmh: Math.abs(t.speed) * 3.6,
      rpm: t.rpm,
      gear: t.gear,
      rpmRatio: t.maxRpm > 0 ? Math.min(1, t.rpm / t.maxRpm) : 0,
      // Le compteur se gradue sur le véhicule : ~80 pour le scooter, ~220 pour
      // la voiture. Un cadran figé à 140 km/h n'aurait plus aucun sens.
      dialMaxKmh: Math.ceil((t.maxSpeed * 3.6 * 1.05) / 20) * 20,
      fuelPercent: Math.max(0, Math.min(100, t.fuelRatio * 100)),
    }),
  clearTelemetry: () =>
    set({ riding: false, kind: null, speedKmh: 0, rpm: 0, gear: 1, rpmRatio: 0, fuelPercent: 100 }),
}))
