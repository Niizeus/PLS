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

// Zone récupérée : TOUTE la commune de Beauvais (~7,5 km de côté) : [sud, ouest, nord, est].
// Couvre l'ensemble des bâtiments + le plan d'eau du Canada au nord.
const BBOX = [49.398, 2.03, 49.472, 2.145]

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

const rad2deg = (r) => (r * 180) / Math.PI

/** Inverse de project : (x, z) mètres → (lat, lon). Sert à échantillonner l'altitude. */
function unproject(x, z) {
  const lat = ORIGIN.lat - rad2deg(z / EARTH_RADIUS)
  const lon = ORIGIN.lon + rad2deg(x / (EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))))
  return { lat, lon }
}

// ─────────────────────────────────────────────────────────────────────────────
// RELIEF : on échantillonne l'altitude réelle de Beauvais (API Open-Meteo,
// gratuite, sans clé — basée sur le modèle Copernicus ~90 m).
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ Open-Meteo (gratuit) : GET limité à ~100 points/requête ET quota par minute.
// On garde donc une grille modeste (le relief de Beauvais est doux) et on espace bien.
const TERRAIN_COLS = 32 // résolution de la grille d'altitude (COLS × COLS points)
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchElevations(lats, lons, tries = 4) {
  const url = `${ELEVATION_URL}?latitude=${lats.join(',')}&longitude=${lons.join(',')}`
  for (let t = 0; t < tries; t++) {
    const res = await fetch(url)
    if (res.ok) return (await res.json()).elevation
    if (res.status === 429) {
      await sleep(65000) // rate-limit : on attend la remise à zéro du quota (1 min)
      continue
    }
    throw new Error(`Open-Meteo a répondu ${res.status}`)
  }
  throw new Error('Open-Meteo : trop de 429 (rate limit)')
}

/**
 * Construit la grille d'altitudes couvrant la zone (BBOX), en mètres relatifs à
 * l'origine (la cathédrale = 0). Renvoie de quoi interpoler l'altitude n'importe où.
 */
async function fetchTerrain() {
  // Étendue monde de la BBOX (coins projetés).
  const [s, w, n, e] = BBOX
  const [xw] = project(ORIGIN.lat, w)
  const [xe] = project(ORIGIN.lat, e)
  const [, zn] = project(n, ORIGIN.lon)
  const [, zs] = project(s, ORIGIN.lon)
  const x0 = Math.min(xw, xe)
  const z0 = Math.min(zn, zs)
  const dx = (Math.max(xw, xe) - x0) / (TERRAIN_COLS - 1)
  const dz = (Math.max(zn, zs) - z0) / (TERRAIN_COLS - 1)

  // Liste des points (lat, lon) de la grille.
  const lats = []
  const lons = []
  for (let j = 0; j < TERRAIN_COLS; j++) {
    for (let i = 0; i < TERRAIN_COLS; i++) {
      const { lat, lon } = unproject(x0 + i * dx, z0 + j * dz)
      lats.push(+lat.toFixed(6))
      lons.push(+lon.toFixed(6))
    }
  }

  // Requêtes par paquets de 100 points.
  console.log(`🗻 Altitudes : ${lats.length} points (Open-Meteo)...`)
  const elev = []
  for (let k = 0; k < lats.length; k += 100) {
    const part = await fetchElevations(lats.slice(k, k + 100), lons.slice(k, k + 100))
    elev.push(...part)
    await sleep(4000) // on reste poli avec l'API (évite le rate-limit)
  }

  // Datum = altitude à l'origine (cathédrale) → le centre-ville est ~0.
  const [baseElev] = await fetchElevations([ORIGIN.lat], [ORIGIN.lon])
  const h = elev.map((v) => round1(v - baseElev))
  const min = Math.min(...h)
  const max = Math.max(...h)
  console.log(`   relief : ${min} m à ${max} m (datum cathédrale = 0)`)

  return {
    cols: TERRAIN_COLS,
    x0: round1(x0), z0: round1(z0),
    dx: round1(dx), dz: round1(dz),
    h,
  }
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

/** Le point [x,z] est-il dans le polygone (liste de [x,z]) ? (lancer de rayon) */
function pointInPolygon(pt, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > pt[1] !== zj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/**
 * Recolle des tronçons (chacun = suite de {lat,lon}) en anneaux fermés.
 * Les gros bâtiments OSM (relations/multipolygones) ont leur contour découpé en
 * plusieurs tronçons qu'il faut rabouter bout à bout.
 */
function stitchRings(segments) {
  const key = (p) => p.lat.toFixed(7) + ',' + p.lon.toFixed(7)
  const pool = segments.filter((s) => s && s.length >= 2).map((s) => s.slice())
  const used = new Array(pool.length).fill(false)
  const rings = []
  for (let i = 0; i < pool.length; i++) {
    if (used[i]) continue
    used[i] = true
    let ring = pool[i].slice()
    let extended = true
    while (extended && key(ring[0]) !== key(ring[ring.length - 1])) {
      extended = false
      for (let j = 0; j < pool.length; j++) {
        if (used[j]) continue
        const w = pool[j]
        const end = key(ring[ring.length - 1])
        if (key(w[0]) === end) { ring = ring.concat(w.slice(1)); used[j] = true; extended = true; break }
        if (key(w[w.length - 1]) === end) { ring = ring.concat(w.slice().reverse().slice(1)); used[j] = true; extended = true; break }
      }
    }
    rings.push(ring)
  }
  return rings
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
// ROUTES : largeur (mètres) selon le type de voie OSM (highway=...)
// ─────────────────────────────────────────────────────────────────────────────

const ROAD_WIDTH = {
  motorway: 12, trunk: 10, primary: 9, secondary: 7.5, tertiary: 6.5,
  residential: 5, unclassified: 5, living_street: 4.5, service: 3.5,
  pedestrian: 5, footway: 2, path: 1.8, cycleway: 2, steps: 1.6, track: 3,
}
// Types de voies qu'on n'affiche pas (pas de vraie surface au sol).
const ROAD_SKIP = new Set(['proposed', 'construction', 'raceway', 'bus_guideway'])

function roadWidth(tags) {
  if (ROAD_SKIP.has(tags.highway)) return 0
  return ROAD_WIDTH[tags.highway] ?? 4 // largeur par defaut si type inconnu
}

function parseRoadNumber(value) {
  if (value === undefined || value === null) return undefined
  const n = parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined
}

function osmYes(value) {
  return ['yes', 'true', '1'].includes(String(value ?? '').toLowerCase())
}

function roadMeta(id, tags) {
  const meta = { id, highway: tags.highway }
  if (tags.name) meta.name = String(tags.name)
  if (tags.ref) meta.ref = String(tags.ref)
  if (tags.service) meta.service = String(tags.service)
  if (tags.junction) meta.junction = String(tags.junction)
  const lanes = parseRoadNumber(tags.lanes)
  if (lanes !== undefined) meta.lanes = lanes
  const layer = parseRoadNumber(tags.layer)
  if (layer !== undefined) meta.layer = layer
  if (osmYes(tags.oneway) || tags.oneway === '-1') meta.oneway = true
  if (osmYes(tags.bridge)) meta.bridge = true
  if (osmYes(tags.tunnel)) meta.tunnel = true
  return meta
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDURE, MONUMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Renvoie 'wood' (boisé, on y sèmera des arbres), 'green' (pelouse/parc), ou null. */
function greenKind(tags) {
  if (tags.natural === 'wood' || tags.landuse === 'forest') return 'wood'
  if (
    tags.leisure === 'park' ||
    tags.natural === 'scrub' ||
    tags.natural === 'grassland' ||
    ['grass', 'meadow', 'recreation_ground', 'village_green'].includes(tags.landuse)
  )
    return 'green'
  return null
}

/** Type de monument pour un look distinct (repères), ou undefined. */
function landmarkKind(tags) {
  if (['cathedral', 'church', 'chapel'].includes(tags.building)) return tags.building
  return undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// RÉCUPÉRATION DES DONNÉES OSM
// ─────────────────────────────────────────────────────────────────────────────

async function fetchOsm() {
  if (process.env.RAW_FILE) {
    console.log('📄 Lecture du brut local :', process.env.RAW_FILE)
    return JSON.parse(readFileSync(process.env.RAW_FILE, 'utf8'))
  }
  const b = BBOX.join(',')
  const query = `[out:json][timeout:300];
(
  way["building"](${b});
  relation["building"](${b});
  way["highway"](${b});
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["leisure"="park"](${b});
  way["landuse"~"grass|forest|meadow|recreation_ground|village_green"](${b});
  way["natural"~"wood|scrub|grassland"](${b});
  relation["leisure"="park"](${b});
  relation["landuse"~"forest|recreation_ground"](${b});
  way["barrier"~"wall|fence|hedge|city_wall"](${b});
  node["natural"="tree"](${b});
  node["highway"="street_lamp"](${b});
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

  // Relief (facultatif : si l'API échoue, on reste à plat).
  let terrain = null
  try {
    terrain = await fetchTerrain()
  } catch (err) {
    console.warn('⚠️  Altitudes indisponibles, terrain plat :', err.message)
  }

  const buildings = []
  const roads = []
  const waters = []
  const greens = [] // { pts, wood? }
  const walls = [] // { pts } (polylignes)
  const trees = [] // [x, z]
  const lamps = [] // [x, z]
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }

  const grow = (x, z) => {
    if (x < bounds.minX) bounds.minX = x
    if (x > bounds.maxX) bounds.maxX = x
    if (z < bounds.minZ) bounds.minZ = z
    if (z > bounds.maxZ) bounds.maxZ = z
  }

  // Projette une géométrie OSM en polygone fermé (on retire le point répété final).
  const toPolygon = (geometry) => {
    const pts = geometry.map((p) => project(p.lat, p.lon).map(round1))
    if (pts.length >= 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop()
    return pts
  }

  for (const el of osm.elements) {
    const tags = el.tags || {}

    if (el.type === 'node') {
      // ARBRES et LAMPADAIRES (points).
      if (tags.natural === 'tree') trees.push(project(el.lat, el.lon).map(round1))
      else if (tags.highway === 'street_lamp') lamps.push(project(el.lat, el.lon).map(round1))
      continue
    }

    if (el.type === 'way' && el.geometry?.length >= 2) {
      const pts = el.geometry.map((p) => project(p.lat, p.lon).map(round1))

      if (tags.building) {
        // BÂTIMENT : polygone fermé.
        if (pts.length >= 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop()
        if (pts.length < 3) continue
        const bl = { h: estimateHeight(tags, polygonArea(pts), el.id), pts }
        const kind = landmarkKind(tags)
        if (kind) bl.kind = kind
        buildings.push(bl)
        for (const [x, z] of pts) grow(x, z)
      } else if (tags.highway) {
        // ROUTE : polyligne (ouverte). Largeur selon le type.
        const w = roadWidth(tags)
        if (w <= 0 || pts.length < 2) continue
        roads.push({ w, pts, ...roadMeta(el.id, tags) })
        for (const [x, z] of pts) grow(x, z)
      } else if (tags.natural === 'water') {
        // PLAN D'EAU (way fermé).
        const poly = pts.slice()
        if (poly.length >= 2 && poly[0][0] === poly.at(-1)[0] && poly[0][1] === poly.at(-1)[1]) poly.pop()
        if (poly.length < 3) continue
        waters.push({ pts: poly })
        for (const [x, z] of poly) grow(x, z)
      } else if (tags.barrier) {
        // MUR / CLÔTURE : polyligne (on la garde telle quelle).
        if (pts.length >= 2) walls.push({ pts })
      } else if (greenKind(tags)) {
        // ESPACE VERT (parc, pelouse, bois) : polygone fermé.
        const poly = pts.slice()
        if (poly.length >= 2 && poly[0][0] === poly.at(-1)[0] && poly[0][1] === poly.at(-1)[1]) poly.pop()
        if (poly.length < 3) continue
        const g = { pts: poly }
        if (greenKind(tags) === 'wood') g.wood = 1
        greens.push(g)
        for (const [x, z] of poly) grow(x, z)
      }
    } else if (el.type === 'relation' && greenKind(tags)) {
      // ESPACE VERT en relation (multipolygone) : contours "outer".
      const wood = greenKind(tags) === 'wood'
      for (const m of el.members || []) {
        if (m.type !== 'way' || !m.geometry || (m.role && m.role !== 'outer')) continue
        const poly = toPolygon(m.geometry)
        if (poly.length < 3) continue
        const g = { pts: poly }
        if (wood) g.wood = 1
        greens.push(g)
        for (const [x, z] of poly) grow(x, z)
      }
    } else if (el.type === 'relation' && tags.natural === 'water') {
      // PLAN D'EAU en relation (multipolygone) : on garde chaque contour "outer".
      for (const m of el.members || []) {
        if (m.type !== 'way' || !m.geometry || (m.role && m.role !== 'outer')) continue
        const poly = toPolygon(m.geometry)
        if (poly.length < 3) continue
        waters.push({ pts: poly })
        for (const [x, z] of poly) grow(x, z)
      }
    } else if (el.type === 'relation' && tags.building) {
      // BÂTIMENT en relation (multipolygone) : contours "outer" = murs, "inner" = cours.
      const outerSegs = []
      const innerSegs = []
      for (const m of el.members || []) {
        if (m.type !== 'way' || !m.geometry) continue
        if (m.role === 'inner') innerSegs.push(m.geometry)
        else outerSegs.push(m.geometry) // "outer" ou rôle vide
      }
      // Anneaux projetés en mètres, sans le point de fermeture répété.
      const toRing = (r) => {
        const p = r.map((q) => project(q.lat, q.lon).map(round1))
        if (p.length >= 2 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p.pop()
        return p
      }
      const outers = stitchRings(outerSegs).map(toRing).filter((r) => r.length >= 3)
      const inners = stitchRings(innerSegs).map(toRing).filter((r) => r.length >= 3)

      const kind = landmarkKind(tags)
      for (const pts of outers) {
        // Cours intérieures : les anneaux "inner" situés dans ce contour.
        const holes = inners.filter((h) => pointInPolygon(h[0], pts))
        const b = { h: estimateHeight(tags, polygonArea(pts), el.id), pts }
        if (holes.length) b.holes = holes
        if (kind) b.kind = kind
        buildings.push(b)
        for (const [x, z] of pts) grow(x, z)
      }
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
    roadCount: roads.length,
    waterCount: waters.length,
    terrain,
    buildings,
    roads,
    waters,
    greens,
    walls,
    trees,
    lamps,
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(out))
  const mb = (readFileSync(OUT_FILE).length / 1024 / 1024).toFixed(2)
  console.log(`✅ ${buildings.length} bâtiments, ${roads.length} routes, ${waters.length} eau, ${greens.length} verdure, ${walls.length} murs, ${trees.length} arbres, ${lamps.length} lampadaires (${mb} Mo)`)
  console.log(`   hauteurs (m) — min ${heights[0]} / médiane ${q(0.5)} / p90 ${q(0.9)} / max ${heights.at(-1)}`)
}

main().catch((err) => {
  console.error('❌ Échec de la génération :', err.message)
  process.exit(1)
})
