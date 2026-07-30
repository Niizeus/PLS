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

export type DevSectionId = 'player' | 'car' | 'scooter' | 'camera' | 'inventory' | 'sky'

export type DevFieldKind = 'number'

/**
 * Niveau d'affichage d'un reglage (voir le selecteur Simple / Avance du panneau).
 * - `simple` : ce qu'on touche pour changer le feeling, comprehensible sans lire le code.
 * - `advanced` : valeur technique, secondaire, ou dangereuse a bouger sans contexte.
 */
export type DevFieldLevel = 'simple' | 'advanced'

/**
 * Zone du schema de vehicule (vue de dessus) associee a une categorie.
 * Cliquer une zone ouvre la categorie correspondante.
 */
export type VehicleZone =
  | 'engine'
  | 'wheels'
  | 'brakes'
  | 'suspension'
  | 'mass'
  | 'aero'
  | 'steering'
  | 'drift'
  | 'air'
  | 'body'
  | 'lights'
  | 'audio'

/**
 * Un reglage expose dans le panneau `F2`.
 *
 * Le but de ce registre : qu'on puisse regler le jeu **sans lire le code**. Donc
 * chaque entree porte un nom en francais clair, ce que la valeur change, ce que
 * produit une valeur plus basse / plus haute, et quand c'est utile.
 */
export interface DevTuningField {
  /** Chemin JSON dans les overrides, ex. `vehicles.car.GRIP`. */
  id: DevTuningPath
  section: DevSectionId
  /** Identifiant de categorie (voir `devTuningGroups.ts`). */
  group: string
  /** Nom clair, jamais le nom de la variable interne. */
  label: string
  /** Ce que le parametre modifie, en une phrase. */
  help: string
  /** Ce que produit une valeur plus FAIBLE. */
  lower?: string
  /** Ce que produit une valeur plus ELEVEE. */
  higher?: string
  /** Dans quels cas on y touche. */
  useCase?: string
  /** Consequence importante ou lien avec d'autres reglages. */
  warning?: string
  /** Unite affichee a cote du nombre (`m/s`, `kg`, `s`...). */
  unit?: string
  /** Lecture secondaire plus parlante : `{ unit: 'km/h', factor: 3.6 }`. */
  readout?: { unit: string; factor: number }
  level: DevFieldLevel
  kind: DevFieldKind
  min: number
  max: number
  step: number
}

/** Une categorie de reglages dans un onglet (« Freinage », « Adherence »...). */
export interface DevTuningGroup {
  id: string
  section: DevSectionId
  label: string
  /** Petite icone emoji, pour reperer la categorie d'un coup d'oeil. */
  icon: string
  /** Une ligne : a quoi sert cette categorie. */
  summary: string
  /** Zone du schema de vehicule qui ouvre cette categorie. */
  zone?: VehicleZone
  /** Avertissement affiche en tete de categorie (ex. reglages pas encore utilises). */
  warning?: string
}

/** Un prereglage : un nom comprehensible qui pose plusieurs valeurs d'un coup. */
export interface DevTuningPreset {
  id: string
  label: string
  description: string
  /** Chemin -> valeur. Les chemins sont relatifs a la section (ex. `GRIP`). */
  values: Record<string, number>
}

/** Un menu deroulant de prereglages (« Style de conduite », « Drift »...). */
export interface DevTuningPresetSet {
  id: string
  /** Categorie ou le menu s'affiche. */
  group: string
  label: string
  help: string
  presets: DevTuningPreset[]
}

/** Prereglage nomme enregistre par l'utilisateur (onglet « Mes preregl. »). */
export interface DevSavedPreset {
  name: string
  createdAt: number
  overrides: DevTuningOverrides
}
