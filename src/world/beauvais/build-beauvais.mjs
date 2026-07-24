// @ts-nocheck
/**
 * 🏗️  build-beauvais.mjs — CONVERSION (le "Temps 2" du pipeline, voir docs/04).
 *
 * Ce script tourne HORS du jeu (une fois, à la main). Il :
 *   1. récupère les bâtiments de Beauvais depuis OpenStreetMap (API Overpass),
 *   2. projette les coordonnées GPS (lat/lon) en mètres (x, z) autour d'une origine,
 *   3. ESTIME une hauteur réaliste pour chaque bâtiment,
 *   4. écrit un fichier COMPACT que le jeu chargera (data/beauvais-buildings.json).
 *
 * Le jeu ne lit JAMAIS le gros fichier OSM brut : il lit le fichier compact.
 *
 * ▶️  Pour (re)générer les données :
 *       node src/world/beauvais/build-beauvais.mjs
 *     (nécessite une connexion internet ; ~1 Mo téléchargé pour le quartier cathédrale)
 *
 *     Astuce dev : pour réutiliser un export déjà téléchargé sans re-solliciter
 *     Overpass, passe le fichier brut en variable d'env :
 *       RAW_FILE=chemin/vers/brut.json node src/world/beauvais/build-beauvais.mjs
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─────────────────────────────────────────────────────────────────────────────
// RÉGLAGES (change ici pour agrandir la zone ou déplacer l'origine)
// ─────────────────────────────────────────────────────────────────────────────

// Origine de la scène = la cathédrale Saint-Pierre. Ce point devient le (0,0) du
// monde 3D. Tous les bâtiments sont positionnés en mètres par rapport à lui.
const ORIGIN = { lat: 49.4326, lon: 2.081 }

// Zone récupérée (quartier cathédrale, ~650 m de côté) : [sud, ouest, nord, est].
const BBOX = [49.4297, 2.0765, 49.4357, 2.0855]

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const OUT_FILE = join(__dirname, 'data', 'beauvais-buildings.json')

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTION GPS → MÈTRES (équirectangulaire locale : précise à <0,1 % sur qq km)
// ─────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS = 6378137 // rayon terrestre en mètres
const deg2rad = (d) => (d * Math.PI) / 180

/**
 * Convertit (lat, lon) en (x, z) mètres autour de l'origine.
 *  - x : est(+) / ouest(-)
 *  - z : sud(+) / nord(-)  → le nord "s'éloigne" dans la scène (z négatif)
 */
function project(lat, lon) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return [x, z]
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATION DES HAUTEURS (le cœur du "réalisme")
//
// Problème : à Beauvais, ~99 % des bâtiments OSM n'ont NI hauteur NI nb d'étages.
// On estime donc la hauteur avec, dans l'ordre de fiabilité :
//   1. la vraie donnée OSM si elle existe (height / building:levels) ;
//   2. le TYPE de bâtiment (cathédrale, église, immeuble, garage...) ;
//   3. sinon, la SURFACE au sol (une grande emprise = souvent plus haut),
//      + une petite variation déterministe pour casser l'uniformité.
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_HEIGHT = 3 // hauteur moyenne d'un étage, en mètres

// Hauteurs typiques par type de bâtiment OSM (mètres). 0 = "laisser la surface décider".
const TYPE_HEIGHT = {
  cathedral: 45, // la cathédrale Saint-Pierre domine la ville (repère central)
  church: 22,
  chapel: 14,
  mosque: 18,
  temple: 16,
  // petites annexes basses
  garage: 3, garages: 3, shed: 3, hut: 3, carport: 3, roof: 3, cabin: 3, greenhouse: 3,
  // volumes industriels/commerciaux
  industrial: 9, warehouse: 9, hangar: 9, factory: 11,
  retail: 7, commercial: 8, supermarket: 8, kiosk: 4,
  // équipements publics (souvent plus imposants)
  school: 11, college: 12, university: 14, hospital: 16,
  public: 12, civic: 12, government: 13, museum: 13, hotel: 15,
}

/** Petit générateur pseudo-aléatoire déterministe : même id → même valeur [0,1[. */
function hash01(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Aire au sol d'un polygone (m²) par la formule du lacet. */
function polygonArea(pts) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a) / 2
}

const MIN_HEIGHT = 2.5 // garde-fou : jamais de "bâtiment-crêpe" (donnée OSM parfois aberrante)

function estimateHeight(tags, area, id) {
  // 1) Vraie donnée OSM (le plus fiable)
  const explicit = parseFloat(String(tags.height ?? tags['building:height'] ?? '').replace(',', '.'))
  if (!Number.isNaN(explicit) && explicit > 0) return Math.max(MIN_HEIGHT, explicit)
  const levels = parseFloat(tags['building:levels'])
  if (!Number.isNaN(levels) && levels > 0) {
    const roofLevels = parseFloat(tags['roof:levels']) || 0
    return Math.max(MIN_HEIGHT, levels * FLOOR_HEIGHT + roofLevels * 2)
  }

  // 2) Type de bâtiment
  const type = tags.building
  let base = type && TYPE_HEIGHT[type] ? TYPE_HEIGHT[type] : 0

  // 3) Sinon (cas ultra-majoritaire), on déduit de la surface au sol
  if (base === 0) {
    if (area < 25) base = 3 // annexe / garage
    else if (area < 70) base = 6 // petite maison de ville (2 niveaux)
    else if (area < 150) base = 9 // maison / petit immeuble (3 niveaux)
    else if (area < 350) base = 12 // immeuble (4 niveaux)
    else base = 15 // gros immeuble / équipement (5 niveaux)
    if (type === 'apartments') base += 3 // les immeubles d'habitation un cran plus haut
  }

  // Variation déterministe (±2 m) : casse l'effet "toits tous à la même hauteur".
  // Les repères hauts (cathédrale...) ne sont pas jités, on garde leur silhouette.
  const jitter = base >= 20 ? 0 : (hash01(id) - 0.5) * 4
  return Math.max(MIN_HEIGHT, Math.round((base + jitter) * 10) / 10)
}

const round1 = (n) => Math.round(n * 10) / 10 // 0,1 m suffit → fichier plus léger

// ─────────────────────────────────────────────────────────────────────────────
// RÉCUPÉRATION DES DONNÉES OSM
// ─────────────────────────────────────────────────────────────────────────────

async function fetchOsm() {
  if (process.env.RAW_FILE) {
    console.log('📄 Lecture du brut local :', process.env.RAW_FILE)
    return JSON.parse(readFileSync(process.env.RAW_FILE, 'utf8'))
  }
  const query = `[out:json][timeout:90];
(
  way["building"](${BBOX.join(',')});
);
out geom;`
  console.log('🌐 Requête Overpass en cours...')
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'User-Agent': 'PLS-game-dev/0.1 (import bâtiments OSM pour jeu amateur)',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'data=' + encodeURIComponent(query),
  })
  if (!res.ok) throw new Error(`Overpass a répondu ${res.status} ${res.statusText}`)
  return res.json()
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMME PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const osm = await fetchOsm()
  const ways = osm.elements.filter((e) => e.type === 'way' && e.geometry?.length >= 4)

  const buildings = []
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }

  for (const way of ways) {
    const tags = way.tags || {}
    // Contour projeté en mètres. OSM ferme le polygone (dernier point = premier) :
    // on retire ce doublon, la 3D refermera la forme toute seule.
    const pts = way.geometry.map((p) => project(p.lat, p.lon).map(round1))
    if (pts.length >= 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) {
      pts.pop()
    }
    if (pts.length < 3) continue // pas un polygone valide

    const area = polygonArea(pts)
    const h = estimateHeight(tags, area, way.id)
    buildings.push({ h, pts })

    for (const [x, z] of pts) {
      if (x < bounds.minX) bounds.minX = x
      if (x > bounds.maxX) bounds.maxX = x
      if (z < bounds.minZ) bounds.minZ = z
      if (z > bounds.maxZ) bounds.maxZ = z
    }
  }

  // Petit récap des hauteurs, utile pour vérifier le réalisme d'un coup d'œil.
  const heights = buildings.map((b) => b.h).sort((a, b) => a - b)
  const q = (p) => heights[Math.floor(p * heights.length)]

  const out = {
    origin: ORIGIN,
    bbox: BBOX,
    bounds: {
      minX: round1(bounds.minX), maxX: round1(bounds.maxX),
      minZ: round1(bounds.minZ), maxZ: round1(bounds.maxZ),
    },
    source: 'OpenStreetMap contributors (ODbL)',
    generatedAt: new Date().toISOString(),
    count: buildings.length,
    buildings,
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(out))
  const kb = (readFileSync(OUT_FILE).length / 1024).toFixed(0)
  console.log(`✅ ${buildings.length} bâtiments écrits dans ${OUT_FILE} (${kb} Ko)`)
  console.log(`   hauteurs (m) — min ${heights[0]} / médiane ${q(0.5)} / p90 ${q(0.9)} / max ${heights.at(-1)}`)
}

main().catch((err) => {
  console.error('❌ Échec de la génération :', err.message)
  process.exit(1)
})
