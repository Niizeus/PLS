import scheduleFile from '../data/radioSchedule.json'
import type { RadioStationId } from './radioCatalog'

/**
 * 🗓️ LA GRILLE DE PROGRAMMATION — qui passe quoi, quel jour, à quelle heure.
 *
 * Avant, la programmation était **déduite du disque** : chaque dossier
 * d'`Emissions/` prenait l'antenne une heure, à partir de 18h00, dans l'ordre
 * alphabétique. Renommer un dossier changeait donc l'horaire, on ne pouvait
 * rien mettre le matin, et le week-end ressemblait au lundi.
 *
 * La grille est maintenant une **donnée**, dans `src/data/radioSchedule.json`,
 * remplie depuis la page Régie (`regie.html`) — voir `src/regie/`.
 *
 * ## Ce qu'une case veut dire
 *
 * Une case couvre **une heure de jeu** d'une station, un jour donné :
 *
 * | `kind`   | Ce qui passe |
 * |----------|--------------|
 * | `show`   | l'émission `show`, qui démarre à cette heure |
 * | `music`  | la playlist de la station |
 * | `ads`    | les publicités |
 * | `off`    | antenne coupée : il ne reste que le souffle |
 *
 * Une case vide vaut `music`. Une grille entièrement vide donne donc de la
 * musique toute la journée, sur toutes les stations — jamais de silence.
 *
 * ⚠️ **Une émission dure ce qu'elle dure**, pas une heure pile. Une heure de jeu
 * ne vaut que 2 min 30 réelles : imposer un créneau d'une heure trancherait la
 * plupart des émissions en plein milieu. Une émission posée à 18h déborde donc
 * sur les cases suivantes jusqu'à sa fin — la Régie l'affiche comme un bloc qui
 * s'étale, pour qu'il n'y ait pas de surprise.
 *
 * Trois choses seulement peuvent l'interrompre :
 *  - une **autre émission** programmée plus loin dans la journée ;
 *  - une case **pub** ou **antenne coupée** ;
 *  - **minuit** : une émission ne déborde jamais sur le lendemain.
 *
 * Une case **musique** (ou vide) ne l'interrompt pas : c'est du remplissage, et
 * c'est ce qui permet de poser une émission longue sans avoir à noircir dix
 * cases à la main.
 */

export type RadioSlotKind = 'show' | 'music' | 'ads' | 'off'

export interface RadioSlot {
  station: string
  /** 0 = lundi … 6 = dimanche, comme `getDayIndex()`. */
  day: number
  /** 0 → 23. */
  hour: number
  kind: RadioSlotKind
  /** Nom du dossier de l'émission, quand `kind` vaut `show`. */
  show?: string
}

export interface RadioScheduleFile {
  version: number
  slots: RadioSlot[]
}

export const HOURS_PER_DAY = 24
export const DAYS_PER_WEEK = 7

const SCHEDULE = scheduleFile as RadioScheduleFile

/**
 * Index `station|jour|heure` → case, construit une fois.
 * Sans lui, chaque image parcourrait la liste entière des cases.
 */
const byKey = new Map<string, RadioSlot>()
for (const slot of SCHEDULE.slots) {
  byKey.set(keyOf(slot.station, slot.day, slot.hour), slot)
}

function keyOf(station: string, day: number, hour: number): string {
  return `${station}|${day}|${hour}`
}

/** La case programmée, ou `null` si elle est vide (ce qui vaut « musique »). */
export function getSlot(station: RadioStationId, day: number, hour: number): RadioSlot | null {
  return byKey.get(keyOf(station, day, hour)) ?? null
}

/** Toutes les cases d'une station pour un jour, indexées par heure (`null` = vide). */
export function getDaySlots(station: RadioStationId, day: number): (RadioSlot | null)[] {
  return Array.from({ length: HOURS_PER_DAY }, (_, hour) => getSlot(station, day, hour))
}

/**
 * L'émission qui a l'antenne à cette heure-là, et depuis quelle heure.
 *
 * On remonte dans la journée : une émission posée à 18h et qui dure quatre
 * heures de jeu doit encore être trouvée quand on regarde à 21h. C'est la
 * timeline qui décidera ensuite si l'épisode est réellement fini ou non.
 */
export function findShowOnAir(
  station: RadioStationId,
  day: number,
  hour: number,
): { show: string; startHour: number } | null {
  for (let h = hour; h >= 0; h--) {
    const slot = getSlot(station, day, h)
    if (slot?.kind === 'show' && slot.show) return { show: slot.show, startHour: h }
    // Une case vide ou « musique » laisse l'émission déborder : on continue de
    // remonter. Une pub ou une coupure d'antenne, elle, l'interrompt.
    if (slot && (slot.kind === 'ads' || slot.kind === 'off')) return null
  }
  return null
}

/** L'heure de la prochaine émission de la journée, ou `null` s'il n'y en a plus. */
export function nextShowHour(station: RadioStationId, day: number, afterHour: number): number | null {
  for (let h = afterHour + 1; h < HOURS_PER_DAY; h++) {
    const slot = getSlot(station, day, h)
    if (slot?.kind === 'show' && slot.show) return h
  }
  return null
}
