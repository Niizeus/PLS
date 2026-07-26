import { create } from 'zustand'

export type VehicleKind = 'car' | 'scooter'

interface VehicleTelemetryState {
  riding: boolean
  kind: VehicleKind | null
  speedKmh: number
  fuelPercent: number
  setTelemetry: (kind: VehicleKind, speedMetersPerSecond: number, fuelRatio: number) => void
  clearTelemetry: () => void
}

export const useVehicleTelemetryStore = create<VehicleTelemetryState>((set) => ({
  riding: false,
  kind: null,
  speedKmh: 0,
  fuelPercent: 100,
  setTelemetry: (kind, speedMetersPerSecond, fuelRatio) =>
    set({
      riding: true,
      kind,
      speedKmh: Math.abs(speedMetersPerSecond) * 3.6,
      fuelPercent: Math.max(0, Math.min(100, fuelRatio * 100)),
    }),
  clearTelemetry: () => set({ riding: false, kind: null, speedKmh: 0, fuelPercent: 100 }),
}))
