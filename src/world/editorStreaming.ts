import * as THREE from 'three'
import { BOUNDS } from './beauvais/cityData'

interface ViewportSize {
  width: number
  height: number
}

const CITY_SPAN = Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ)
const VIEW_REACH_FACTOR = 0.72

/**
 * Budget de tuiles de ville montees en meme temps dans les vues IG de l'editeur.
 *
 * ⚠️ Pourquoi un plafond ? Beauvais fait ~34 000 batiments et la geometrie d'une tuile est
 * construite EN SYNCHRONE a son montage (voir CityTile dans world/beauvais/Beauvais.tsx).
 * Sans plafond, dezoomer sur la ville entiere demandait un rayon de ~69 tuiles, soit des
 * milliers de tuiles et la totalite des batiments construits d'un coup : l'onglet gelait
 * puis se faisait tuer par le navigateur.
 *
 * 15 x 15 tuiles de 180 m = environ 2,7 km de cote, ce qui couvre tres largement une zone
 * de travail confortable. Au-dela on continue de dezoomer, mais le decor 3D ne suit plus :
 * c'est le plan 2D qui sert a voir la ville entiere.
 */
const MAX_TILES = 225

/** Rayon maximal en anneaux de tuiles autour du centre (7 => 15 x 15 tuiles). */
export const EDITOR_MAX_REACH = Math.floor((Math.sqrt(MAX_TILES) - 1) / 2)

/**
 * Combien d'anneaux de tuiles autour du centre faut-il monter pour remplir l'ecran ?
 * Le resultat est borne par `minReach` en bas et par `EDITOR_MAX_REACH` en haut.
 */
export function editorTileReach(
  camera: THREE.Camera,
  size: ViewportSize,
  tileSize: number,
  minReach: number,
) {
  if (!(camera instanceof THREE.OrthographicCamera) || camera.zoom <= 0) return minReach

  const visibleSpan = Math.max(size.width, size.height) / camera.zoom
  const wantedRadius = Math.min(CITY_SPAN, visibleSpan * VIEW_REACH_FACTOR)
  const wanted = Math.ceil(wantedRadius / tileSize) + 1
  return Math.min(Math.max(minReach, wanted), Math.max(minReach, EDITOR_MAX_REACH))
}
