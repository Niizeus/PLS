// @ts-nocheck
/**
 * 🌍 geo.mjs — le repère du monde : où est le (0,0), et jusqu'où va la carte.
 *
 * Ces réglages sont partagés par tous les scripts hors-jeu (`build-beauvais.mjs`,
 * `update-heights-ign.mjs`, ...). Ils vivent ici pour qu'il n'y ait qu'UN endroit
 * à changer : si l'origine ou la zone divergeaient entre deux scripts, tous les
 * bâtiments seraient décalés de quelques mètres sans qu'on comprenne pourquoi.
 */

/**
 * Origine de la scène = la cathédrale Saint-Pierre. Ce point devient le (0,0) du
 * monde 3D. Tous les bâtiments sont positionnés en mètres par rapport à lui.
 */
export const ORIGIN = { lat: 49.4326, lon: 2.081 }

/**
 * Zone récupérée : TOUTE la commune de Beauvais (~7,5 km de côté) :
 * [sud, ouest, nord, est]. Couvre l'ensemble des bâtiments + le plan d'eau du
 * Canada au nord.
 */
export const BBOX = [49.398, 2.03, 49.472, 2.145]

// PROJECTION GPS → MÈTRES (équirectangulaire locale : précise à <0,1 % sur qq km)

const EARTH_RADIUS = 6378137 // rayon terrestre en mètres
const deg2rad = (d) => (d * Math.PI) / 180
const rad2deg = (r) => (r * 180) / Math.PI

/**
 * Convertit (lat, lon) en (x, z) mètres autour de l'origine.
 *  - x : est(+) / ouest(-)
 *  - z : sud(+) / nord(-)  → le nord "s'éloigne" dans la scène (z négatif)
 */
export function project(lat, lon) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return [x, z]
}

/** Inverse de project : (x, z) mètres → (lat, lon). Sert à échantillonner l'altitude. */
export function unproject(x, z) {
  const lat = ORIGIN.lat - rad2deg(z / EARTH_RADIUS)
  const lon = ORIGIN.lon + rad2deg(x / (EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))))
  return { lat, lon }
}
