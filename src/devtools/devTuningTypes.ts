import type { CAR } from '../entities/vehicles/carConfig'
import type { SCOOTER } from '../entities/vehicles/scooterConfig'
import type { PLAYER } from '../entities/player/playerConfig'
import type { SkyTuning } from '../core/sky/skyAtmosphere'

export type PlayerTuning = typeof PLAYER
export type VehicleTuning = typeof CAR | typeof SCOOTER
export type VehicleKind = 'car' | 'scooter'

export interface CameraTuning {
  SENSITIVITY: number
  PITCH_MIN: number
  PITCH_MAX: number
  INVERT_Y: number
}

export interface InventoryTuning {
  MAX_CARRY_WEIGHT: number
}

export type DeepPartial<T> = {
  -readonly [K in keyof T]?: T[K] extends readonly number[]
    ? number[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

export interface DevTuningOverrides {
  player?: DeepPartial<PlayerTuning>
  vehicles?: Partial<Record<VehicleKind, DeepPartial<VehicleTuning>>>
  camera?: DeepPartial<CameraTuning>
  inventory?: DeepPartial<InventoryTuning>
  sky?: DeepPartial<SkyTuning>
}

export type DevTuningPath = string

export type DevFieldKind = 'number'

export interface DevTuningField {
  id: DevTuningPath
  section: 'player' | 'car' | 'scooter' | 'camera' | 'inventory' | 'sky'
  label: string
  help: string
  kind: DevFieldKind
  min: number
  max: number
  step: number
}
