import rawZones from '../../data/zones.json'
import { pointInFootprint } from './cityData'

/**
 * 🗺️  Les QUARTIERS de Beauvais (zones de la ville).
 *
 * Chaque quartier est un polygone (contour [x,z] en mètres monde). Ça sert à :
 *  - afficher le nom du quartier où se trouve le joueur (HUD),
 *  - découper le travail "zone par zone" (densité de décor, palette, ambiance),
 *  - plus tard : spawns, règles de gameplay propres à un quartier.
 *
 * La donnée vit dans src/data/zones.json (éditable, versionnée, redessinable
 * dans l'éditeur de carte — touche M). Ce module ne fait que la charger et
 * répondre à "dans quel quartier est ce point ?".
 */

export interface Zone {
  id: string
  name: string
  /** Couleur d'identification (overlay carte, plus tard teintes de décor). */
  color: string
  /** Contour du quartier : liste de points [x, z] en mètres monde. */
  pts: number[][]
}

interface RawZones {
  zones: Zone[]
}

export const ZONES: Zone[] = (rawZones as unknown as RawZones).zones

/**
 * Dans quel quartier se trouve le point monde (x, z) ? `null` si aucun.
 *
 * On renvoie la PREMIÈRE zone qui contient le point (ordre du JSON) : le
 * centre-ville, plus petit et prioritaire, est en tête → il "gagne" là où les
 * grandes zones voisines se chevauchent sur les axes.
 */
export function zoneAt(x: number, z: number): Zone | null {
  for (const zone of ZONES) {
    if (pointInFootprint(x, z, zone.pts)) return zone
  }
  return null
}
