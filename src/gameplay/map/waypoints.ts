/**
 * 📍 Points de passage posés par le joueur sur la grande carte (touche M).
 *
 * Ce fichier existe pour une raison simple : le téléphone (app GPS) doit lire les
 * MÊMES points que la carte. Avant, la clé `localStorage` et le type vivaient dans
 * `WorldMap.tsx` — les recopier ailleurs aurait été le meilleur moyen d'avoir deux
 * listes qui divergent au premier changement de format.
 *
 * ⚠️ Si tu changes la forme d'un `Waypoint`, change aussi la VERSION dans la clé
 * (`...v2`), sinon les sauvegardes existantes seront relues avec le mauvais format.
 */

export interface Waypoint {
  id: number
  /** Position dans le monde (mètres). */
  x: number
  z: number
  text: string
  icon: string
}

const STORAGE_KEY = 'pls.waypoints.v1'

export function loadWaypoints(): Waypoint[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    // Sauvegarde corrompue : on repart d'une liste vide plutôt que de planter le jeu.
    return []
  }
}

export function saveWaypoints(waypoints: Waypoint[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints))
}
