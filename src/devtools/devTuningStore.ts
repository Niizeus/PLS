import { create } from 'zustand'
import { CAR } from '../entities/vehicles/carConfig'
import { SCOOTER } from '../entities/vehicles/scooterConfig'
import { PLAYER } from '../entities/player/playerConfig'
import type {
  CameraTuning,
  DeepPartial,
  DevTuningOverrides,
  InventoryTuning,
  PlayerTuning,
  VehicleKind,
  VehicleTuning,
} from './devTuningTypes'
import { mergeDeep, pruneEmpty, setPathValue } from './devTuningUtils'

const STORAGE_KEY = 'pls.dev-tuning.overrides.v1'
const PROJECT_TUNING_URL = '/dev/dev-tuning.json'

const CAMERA_DEFAULTS: CameraTuning = {
  SENSITIVITY: 0.0025,
  PITCH_MIN: -0.45,
  PITCH_MAX: 1.35,
  INVERT_Y: 1,
}

const INVENTORY_DEFAULTS: InventoryTuning = {
  MAX_CARRY_WEIGHT: 18,
}

interface DevTuningState {
  isOpen: boolean
  projectOverrides: DevTuningOverrides
  localOverrides: DevTuningOverrides
  overrides: DevTuningOverrides
  projectStatus: 'idle' | 'loaded' | 'missing' | 'error'
  toggleOpen: () => void
  setOpen: (isOpen: boolean) => void
  setNumber: (path: string, value: number) => void
  resetLocal: () => void
  importJson: (json: string) => void
  exportJson: () => string
  loadProjectTuning: () => Promise<void>
}

export const useDevTuningStore = create<DevTuningState>((set, get) => ({
  isOpen: false,
  projectOverrides: {},
  localOverrides: loadLocalOverrides(),
  overrides: loadLocalOverrides(),
  projectStatus: 'idle',
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
  setNumber: (path, value) =>
    set((state) => {
      const localOverrides = sanitizeOverrides(setPathValue(state.localOverrides as Record<string, unknown>, path, value))
      saveLocalOverrides(localOverrides)
      return {
        localOverrides,
        overrides: mergeDeep(state.projectOverrides, localOverrides),
      }
    }),
  resetLocal: () => {
    saveLocalOverrides({})
    set((state) => ({
      localOverrides: {},
      overrides: state.projectOverrides,
    }))
  },
  importJson: (json) => {
    const parsed = JSON.parse(json) as DevTuningOverrides
    const localOverrides = sanitizeOverrides(parsed)
    saveLocalOverrides(localOverrides)
    set((state) => ({
      localOverrides,
      overrides: mergeDeep(state.projectOverrides, localOverrides),
    }))
  },
  exportJson: () => JSON.stringify(get().overrides, null, 2),
  loadProjectTuning: async () => {
    if (!import.meta.env.DEV) return
    try {
      const response = await fetch(PROJECT_TUNING_URL, { cache: 'no-store' })
      if (response.status === 404) {
        set((state) => ({
          projectOverrides: {},
          overrides: state.localOverrides,
          projectStatus: 'missing',
        }))
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const projectOverrides = sanitizeOverrides(await response.json())
      set((state) => ({
        projectOverrides,
        overrides: mergeDeep(projectOverrides, state.localOverrides),
        projectStatus: 'loaded',
      }))
    } catch {
      set((state) => ({
        projectOverrides: {},
        overrides: state.localOverrides,
        projectStatus: 'error',
      }))
    }
  },
}))

export function getPlayerTuning(): PlayerTuning {
  return mergeDeep(PLAYER, useDevTuningStore.getState().overrides.player)
}

export function getVehicleTuning(kind: VehicleKind): VehicleTuning {
  const base = kind === 'car' ? CAR : SCOOTER
  return mergeDeep(base, useDevTuningStore.getState().overrides.vehicles?.[kind])
}

export function getCameraTuning(): CameraTuning {
  return mergeDeep(CAMERA_DEFAULTS, useDevTuningStore.getState().overrides.camera)
}

export function getInventoryTuning(): InventoryTuning {
  return mergeDeep(INVENTORY_DEFAULTS, useDevTuningStore.getState().overrides.inventory)
}

function sanitizeOverrides(value: unknown): DevTuningOverrides {
  if (!isObject(value)) return {}
  const vehicles = isObject(value.vehicles) ? value.vehicles : {}
  return (pruneEmpty({
    player: sanitizePlayer(value.player),
    vehicles: {
      car: sanitizeVehicle(vehicles.car),
      scooter: sanitizeVehicle(vehicles.scooter),
    },
    camera: sanitizeCamera(value.camera),
    inventory: sanitizeInventory(value.inventory),
  }) ?? {}) as DevTuningOverrides
}

function sanitizePlayer(value: unknown): DeepPartial<PlayerTuning> | undefined {
  if (!isObject(value)) return undefined
  const out: DeepPartial<PlayerTuning> = {}
  copyNumber(value, out, 'WALK_SPEED')
  copyNumber(value, out, 'RUN_SPEED')
  copyNumber(value, out, 'CROUCH_SPEED')
  copyNumber(value, out, 'TURN_SPEED')
  copyNumber(value, out, 'JUMP_SPEED')
  copyNumber(value, out, 'GRAVITY')
  copyNumber(value, out, 'BODY_HEIGHT')
  copyNumber(value, out, 'BODY_RADIUS')
  copyNumber(value, out, 'COMBO_WINDOW')
  copyNumber(value, out, 'WEAPON_ATTACK_DURATION')
  copyNumber(value, out, 'HURT_DURATION')
  copyNumber(value, out, 'INTERACT_DURATION')
  if (Array.isArray(value.COMBO_DURATIONS)) {
    out.COMBO_DURATIONS = value.COMBO_DURATIONS.filter((entry): entry is number => typeof entry === 'number').slice(0, 3)
  }
  return pruneEmpty(out)
}

function sanitizeVehicle(value: unknown): DeepPartial<VehicleTuning> | undefined {
  if (!isObject(value)) return undefined
  const out: DeepPartial<VehicleTuning> = {}
  for (const key of VEHICLE_NUMBER_KEYS) copyNumber(value, out, key)
  if (isObject(value.ENGINE)) {
    out.ENGINE = {}
    for (const key of ENGINE_NUMBER_KEYS) copyNumber(value.ENGINE, out.ENGINE, key)
    if (Array.isArray(value.ENGINE.GEARS)) {
      out.ENGINE.GEARS = value.ENGINE.GEARS.filter((entry): entry is number => typeof entry === 'number')
    }
  }
  return pruneEmpty(out)
}

function sanitizeCamera(value: unknown): DeepPartial<CameraTuning> | undefined {
  if (!isObject(value)) return undefined
  const out: DeepPartial<CameraTuning> = {}
  copyNumber(value, out, 'SENSITIVITY')
  copyNumber(value, out, 'PITCH_MIN')
  copyNumber(value, out, 'PITCH_MAX')
  copyNumber(value, out, 'INVERT_Y')
  return pruneEmpty(out)
}

function sanitizeInventory(value: unknown): DeepPartial<InventoryTuning> | undefined {
  if (!isObject(value)) return undefined
  const out: DeepPartial<InventoryTuning> = {}
  copyNumber(value, out, 'MAX_CARRY_WEIGHT')
  return pruneEmpty(out)
}

const VEHICLE_NUMBER_KEYS = [
  'MASS',
  'WHEEL_RADIUS',
  'WHEELBASE',
  'MAX_STEER_ANGLE',
  'STEER_RESPONSE',
  'MAX_LATERAL_G',
  'GRIP',
  'BRAKE_FORCE',
  'REVERSE_FORCE',
  'REVERSE_SPEED',
  'DRAG',
  'ROLL_RESIST',
  'ENGINE_BRAKE',
  'MAX_SPEED',
  'SCRAPE_FRICTION',
  'IMPACT_RESTITUTION',
  'IMPACT_SPIN',
  'SPIN_DAMP',
  'SEAT_HEIGHT',
  'COLLISION_HALF_LENGTH',
  'COLLISION_HALF_WIDTH',
  'MOUNT_RANGE',
] as const

const ENGINE_NUMBER_KEYS = [
  'PEAK_TORQUE',
  'PEAK_RPM',
  'IDLE_RPM',
  'MAX_RPM',
  'EFFICIENCY',
  'FINAL_DRIVE',
  'SHIFT_UP_RPM',
  'SHIFT_DOWN_RPM',
  'SHIFT_TIME',
  'CVT_TARGET_RPM',
  'CVT_RATIO_MIN',
  'CVT_RATIO_MAX',
] as const

function copyNumber<T extends Record<string, unknown>>(source: Record<string, unknown>, target: T, key: string) {
  const value = source[key]
  if (typeof value === 'number' && Number.isFinite(value)) target[key as keyof T] = value as T[keyof T]
}

function loadLocalOverrides(): DevTuningOverrides {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeOverrides(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

function saveLocalOverrides(overrides: DevTuningOverrides) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
