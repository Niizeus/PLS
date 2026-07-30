import type { DevSectionId, DevTuningField } from './devTuningTypes'
import { PLAYER_FIELDS } from './schema/playerFields'
import { WORLD_FIELDS } from './schema/worldFields'
import { vehicleFields } from './schema/vehicleFields'

/**
 * Registre de TOUS les reglages exposes dans le panneau `F2`.
 *
 * Chaque entree porte un nom clair, une description, l effet d une valeur plus
 * basse / plus haute, et son niveau (simple ou avance) — voir `devTuningTypes.ts`.
 * Le detail vit dans `schema/`, un fichier par famille.
 */
export const DEV_TUNING_FIELDS: DevTuningField[] = [
  ...PLAYER_FIELDS,
  ...WORLD_FIELDS,
  ...vehicleFields('car'),
  ...vehicleFields('scooter'),
]

const FIELDS_BY_ID = new Map(DEV_TUNING_FIELDS.map((entry) => [entry.id, entry]))

export function getField(path: string): DevTuningField | undefined {
  return FIELDS_BY_ID.get(path)
}

export function getSectionFields(section: DevSectionId): DevTuningField[] {
  return DEV_TUNING_FIELDS.filter((entry) => entry.section === section)
}
