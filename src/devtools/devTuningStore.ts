import { create } from 'zustand'
import { CAR } from '../entities/vehicles/carConfig'
import { SCOOTER } from '../entities/vehicles/scooterConfig'
import { PLAYER } from '../entities/player/playerConfig'
import { SKY_TUNING_DEFAULTS, type SkyTuning } from '../core/sky/skyAtmosphere'
import type {
  CameraTuning,
  DeepPartial,
  DevSavedPreset,
  DevTuningOverrides,
  InventoryTuning,
  PlayerTuning,
  VehicleKind,
  VehicleTuning,
} from './devTuningTypes'
import { deletePathValue, getPathValue, mergeDeep, pruneEmpty, setPathValue } from './devTuningUtils'

const STORAGE_KEY = 'pls.dev-tuning.overrides.v1'
const SAVED_PRESETS_KEY = 'pls.dev-tuning.saved-presets.v1'
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

/**
 * Valeurs d'origine ecrites dans le code (`carConfig.ts`, `playerConfig.ts`...).
 * C'est la reference « valeur par defaut » affichee dans le panneau, et la cible
 * du bouton « revenir a la valeur d'origine ».
 */
const BASE_VALUES = {
  player: PLAYER,
  vehicles: { car: CAR, scooter: SCOOTER },
  camera: CAMERA_DEFAULTS,
  inventory: INVENTORY_DEFAULTS,
  sky: SKY_TUNING_DEFAULTS,
} as const

interface DevTuningState {
  isOpen: boolean
  projectOverrides: DevTuningOverrides
  localOverrides: DevTuningOverrides
  overrides: DevTuningOverrides
  projectStatus: 'idle' | 'loaded' | 'missing' | 'error'
  /** Photo des overrides locaux prise a l'ouverture du panneau : sert au avant / apres. */
  sessionBaseline: DevTuningOverrides
  /** Mode « avant / apres » : le jeu tourne temporairement avec les valeurs d'avant. */
  compareMode: boolean
  savedPresets: DevSavedPreset[]
  toggleOpen: () => void
  setOpen: (isOpen: boolean) => void
  setNumber: (path: string, value: number) => void
  /** Pose plusieurs valeurs d'un coup (prereglages). */
  setNumbers: (values: Record<string, number>) => void
  /** Remet un reglage a sa valeur d'origine. */
  resetPath: (path: string) => void
  /** Remet a l'origine tous les reglages d'une liste (une categorie, un onglet). */
  resetPaths: (paths: string[]) => void
  resetLocal: () => void
  /** Annule tout ce qui a ete change depuis l'ouverture du panneau. */
  revertSession: () => void
  /** Bascule entre les valeurs d'avant l'ouverture et les valeurs en cours. */
  toggleCompare: () => void
  importJson: (json: string) => void
  exportJson: () => string
  loadProjectTuning: () => Promise<void>
  saveUserPreset: (name: string) => void
  applyUserPreset: (name: string) => void
  deleteUserPreset: (name: string) => void
}

export const useDevTuningStore = create<DevTuningState>((set, get) => ({
  isOpen: false,
  projectOverrides: {},
  localOverrides: loadLocalOverrides(),
  overrides: loadLocalOverrides(),
  projectStatus: 'idle',
  sessionBaseline: loadLocalOverrides(),
  compareMode: false,
  savedPresets: loadSavedPresets(),
  toggleOpen: () => get().setOpen(!get().isOpen),
  setOpen: (isOpen) => {
    if (get().compareMode) get().toggleCompare()
    set((state) => ({ isOpen, sessionBaseline: isOpen ? state.localOverrides : state.sessionBaseline }))
  },
  setNumber: (path, value) => set((state) => applyLocal(state, setPathValue(state.localOverrides as Record<string, unknown>, path, value))),
  setNumbers: (values) =>
    set((state) => {
      let next = state.localOverrides as Record<string, unknown>
      for (const [path, value] of Object.entries(values)) next = setPathValue(next, path, value)
      return applyLocal(state, next)
    }),
  resetPath: (path) => set((state) => applyLocal(state, clearOne(state.localOverrides as Record<string, unknown>, path))),
  resetPaths: (paths) =>
    set((state) => {
      let next = state.localOverrides as Record<string, unknown>
      for (const path of paths) next = clearOne(next, path)
      return applyLocal(state, next)
    }),
  resetLocal: () => {
    saveLocalOverrides({})
    set((state) => ({
      localOverrides: {},
      overrides: state.projectOverrides,
    }))
  },
  revertSession: () => {
    pendingCompare = null
    set((state) => ({ ...applyLocal(state, state.sessionBaseline as Record<string, unknown>), compareMode: false }))
  },
  toggleCompare: () => {
    const state = get()
    if (state.compareMode) {
      const restored = pendingCompare ?? state.localOverrides
      pendingCompare = null
      set({ ...applyLocal(state, restored as Record<string, unknown>), compareMode: false })
      return
    }
    pendingCompare = state.localOverrides
    set({ ...applyLocal(state, state.sessionBaseline as Record<string, unknown>, false), compareMode: true })
  },
  importJson: (json) => {
    const parsed = JSON.parse(json) as DevTuningOverrides
    set((state) => applyLocal(state, sanitizeOverrides(parsed) as Record<string, unknown>))
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
  saveUserPreset: (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const entry: DevSavedPreset = { name: trimmed, createdAt: Date.now(), overrides: get().overrides }
    const savedPresets = [...get().savedPresets.filter((item) => item.name !== trimmed), entry].sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    saveSavedPresets(savedPresets)
    set({ savedPresets })
  },
  applyUserPreset: (name) => {
    const entry = get().savedPresets.find((item) => item.name === name)
    if (!entry) return
    set((state) => applyLocal(state, sanitizeOverrides(entry.overrides) as Record<string, unknown>))
  },
  deleteUserPreset: (name) => {
    const savedPresets = get().savedPresets.filter((item) => item.name !== name)
    saveSavedPresets(savedPresets)
    set({ savedPresets })
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

export function getSkyTuning(): SkyTuning {
  return mergeDeep(SKY_TUNING_DEFAULTS, useDevTuningStore.getState().overrides.sky)
}

/** Valeur d'origine (celle du code) pour un chemin de reglage. */
export function getBaseValue(path: string): number | undefined {
  const value = getPathValue(BASE_VALUES, path)
  return typeof value === 'number' ? value : undefined
}

/** Valeur active, overrides projet + locaux appliques. */
export function getCurrentValue(path: string, overrides: DevTuningOverrides): number | undefined {
  const override = getPathValue(overrides, path)
  if (typeof override === 'number') return override
  return getBaseValue(path)
}

/**
 * Sauvegarde temporaire des reglages en cours pendant un « avant / apres ».
 * Hors module d'etat : c'est un detail d'implementation du bouton comparer.
 */
let pendingCompare: DevTuningOverrides | null = null

/**
 * Etat commun a tous les `set` qui modifient les overrides locaux.
 * `persist` a `false` pendant le mode comparaison : on ne veut pas ecraser le
 * localStorage avec les valeurs d'avant.
 */
function applyLocal(state: DevTuningState, nextLocal: Record<string, unknown>, persist = true) {
  const localOverrides = sanitizeOverrides(nextLocal)
  if (persist) saveLocalOverrides(localOverrides)
  return {
    localOverrides,
    overrides: mergeDeep(state.projectOverrides, localOverrides),
  }
}

/**
 * Efface un override. Cas particulier des tableaux (`COMBO_DURATIONS.0`) : on ne
 * peut pas y laisser un trou, donc on y REECRIT la valeur d'origine.
 */
function clearOne(source: Record<string, unknown>, path: string): Record<string, unknown> {
  const isArrayIndex = /\.\d+$/.test(path)
  if (!isArrayIndex) return deletePathValue(source, path)
  const base = getBaseValue(path)
  return base === undefined ? source : setPathValue(source, path, base)
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
    sky: sanitizeSky(value.sky),
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

function sanitizeSky(value: unknown): DeepPartial<SkyTuning> | undefined {
  if (!isObject(value) || !isObject(value.paint)) return undefined
  const out: DeepPartial<SkyTuning> = { paint: {} }
  for (const key of SKY_PAINT_NUMBER_KEYS) copyNumber(value.paint, out.paint as Record<string, unknown>, key)
  return pruneEmpty(out)
}

const VEHICLE_NUMBER_KEYS = [
  'MASS',
  'WHEEL_RADIUS',
  'WHEELBASE',
  'MAX_STEER_ANGLE',
  'VISUAL_STEER_MAX',
  'STEER_RESPONSE',
  'MAX_LATERAL_G',
  'STEER_ASSIST_G',
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
  'SUSPENSION_TRAVEL',
  'TAKEOFF_MIN_SPEED',
  'TAKEOFF_MIN_VELOCITY',
  'TAKEOFF_MIN_PITCH',
  'AIR_GRAVITY',
  'AIR_PITCH_CONTROL',
  'AIR_ROLL_CONTROL',
  'AIR_ROTATION_DAMP',
  'TAKEOFF_ROTATION_IMPULSE',
  'LANDING_BOUNCE',
  'SEAT_HEIGHT',
  'COLLISION_HALF_LENGTH',
  'COLLISION_HALF_WIDTH',
  'MOUNT_RANGE',
  'LIMITER_MIN_SPEED',
  'LIMITER_FADE_SPEED',
  'HANDBRAKE_FORCE',
  'HANDBRAKE_REAR_GRIP',
  'DRIFT_STEER_AUTHORITY',
  'SURFACE_GRIP_ROAD',
  'SURFACE_GRIP_OFFROAD',
  'AIR_PITCH_TORQUE',
  'AIR_ROLL_TORQUE',
  'AIR_MAX_RATE',
  'AIR_LEVEL_ASSIST',
  'FLIP_RECOVERY_HOLD',
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

const SKY_PAINT_NUMBER_KEYS = [
  'enabled',
  'opacity',
  'primaryShapeScale',
  'secondaryShapeScale',
  'warpStrength',
  'shapeSoftness',
  'horizontalStretch',
  'animationSpeed',
  'horizonIntensity',
  'zenithIntensity',
  'sunHaloIntensity',
  'moonHaloIntensity',
  'materialTint',
  'fogIntensity',
  'cloudTint',
  'particleIntensity',
  'horizonGlowIntensity',
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

function loadSavedPresets(): DevSavedPreset[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(SAVED_PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is DevSavedPreset => isObject(entry) && typeof entry.name === 'string')
      .map((entry) => ({
        name: entry.name,
        createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : 0,
        overrides: sanitizeOverrides(entry.overrides),
      }))
  } catch {
    return []
  }
}

function saveSavedPresets(presets: DevSavedPreset[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(SAVED_PRESETS_KEY, JSON.stringify(presets))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
