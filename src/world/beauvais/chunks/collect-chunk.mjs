// @ts-nocheck
/**
 * 🪪 collect-chunk.mjs — LOT 1 de ChunkForge : fabriquer les « passeports » d'une zone.
 *
 * Ce script tourne HORS du jeu. Il ne dessine rien et ne décide rien : il RASSEMBLE.
 * Pour chaque bâtiment d'une zone choisie, il agrège tout ce qu'on peut savoir de lui
 * depuis quatre familles de sources, et écrit le tout dans un fichier de passeports.
 *
 * C'est le lot 2 (`classify.mjs`) qui, plus tard, lira ces passeports pour en déduire
 * un ARCHÉTYPE avec un pourcentage de confiance. Ici, on ne fait que constater.
 *
 *   1. 📐 GÉOMÉTRIE   aire, allongement, compacité, orthogonalité, pente du toit…
 *   2. 🏛️  BD TOPO IGN usage, nature, époque, nombre d'étages, matériaux…
 *   3. 🗺️  OSM         tags de terrain : commerce, équipement, patrimoine, nom…
 *   4. 🧭 CONTEXTE    mitoyenneté, rue la plus proche, densité du tissu, quartier
 *
 * ▶️  npm run chunk:collect              (zone par défaut : centre-ville)
 *     npm run chunk:collect -- <nom>
 *
 * 📄 Les téléchargements sont mis en cache dans `node_modules/.cache/pls-chunks/`
 *    (donc hors de Git) : relancer le script est instantané. `--fresh` force le
 *    retéléchargement.
 *
 * ⚠️  Ce script ne MODIFIE aucune donnée existante. Il lit `beauvais-buildings.json`
 *    et n'y touche pas. Voir la spécification complète dans `docs/08-CHUNKFORGE.md`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { project, unproject } from '../geo.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..', '..')
const CITY_FILE = join(__dirname, '..', 'data', 'beauvais-buildings.json')
const ZONES_FILE = join(ROOT, 'src', 'data', 'zones.json')
const OUT_DIR = join(__dirname, '..', 'data', 'chunks')
const CACHE_DIR = process.env.CHUNK_CACHE || join(ROOT, 'node_modules', '.cache', 'pls-chunks')

// ─────────────────────────────────────────────────────────────────────────────
// LES ZONES DÉCOUPABLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emprises en MÈTRES MONDE (origine = la cathédrale, voir `geo.mjs`).
 * La zone pilote est figée dans `docs/08-CHUNKFORGE.md` : carré de ±400 m.
 * On n'en ajoute d'autres qu'une fois la méthode validée sur celle-là.
 */
const CHUNKS = {
  'centre-ville': { minX: -400, maxX: 400, minZ: -400, maxZ: 400 },
}

/**
 * Marge de travail autour de la zone, en mètres.
 *
 * Elle n'est PAS cosmétique : la mitoyenneté et la densité se calculent avec les
 * VOISINS. Sans marge, une maison au bord du carré paraîtrait libre de tout côté
 * alors qu'elle est collée à celle d'à côté, juste hors cadre — et son faîtage,
 * son archétype et sa façade en découleraient faux. On collecte donc large, et on
 * ne garde que l'intérieur du carré à la fin.
 */
const MARGIN = 60

// ─────────────────────────────────────────────────────────────────────────────
// PETITS OUTILS DE GÉOMÉTRIE
// ─────────────────────────────────────────────────────────────────────────────

const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
const r3 = (v) => Math.round(v * 1000) / 1000

function centroid(pts) {
  let x = 0
  let z = 0
  for (const [px, pz] of pts) {
    x += px
    z += pz
  }
  return [x / pts.length, z / pts.length]
}

/** Aire d'un polygone (m²), formule du lacet. */
function polygonArea(pts) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a) / 2
}

function perimeter(pts) {
  let p = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    p += Math.hypot(x2 - x1, z2 - z1)
  }
  return p
}

function pointInRing(x, z, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]
    const [xj, zj] = ring[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** Distance du point p au segment [a, b]. */
function distToSegment(p, a, b) {
  const vx = b[0] - a[0]
  const vz = b[1] - a[1]
  const len2 = vx * vx + vz * vz
  let t = len2 > 0 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = p[0] - (a[0] + t * vx)
  const dz = p[1] - (a[1] + t * vz)
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Plus petit rectangle qui contient l'emprise (« rotating calipers » simplifié).
 *
 * On s'appuie sur un théorème pratique : ce rectangle a toujours un côté aligné
 * sur une arête du polygone. Il suffit donc d'essayer chaque direction d'arête et
 * de garder celle qui donne la plus petite aire — pas besoin de balayer 360°.
 *
 * De là sortent deux mesures que ni l'aire ni le périmètre ne donnent :
 *  - la LARGEUR réelle du bâtiment (le petit côté), qui distingue une maison de
 *    ville étroite d'un pavillon carré de même surface ;
 *  - l'ALLONGEMENT, qui trahit d'un coup d'œil un hangar ou une barre.
 */
function minAreaRect(pts) {
  let best = null
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz)
    if (len < 0.3) continue // micro-décrochement : direction non significative
    const ux = dx / len
    const uz = dz / len
    let umin = Infinity
    let umax = -Infinity
    let vmin = Infinity
    let vmax = -Infinity
    for (const [x, z] of pts) {
      const u = x * ux + z * uz
      const v = -x * uz + z * ux
      if (u < umin) umin = u
      if (u > umax) umax = u
      if (v < vmin) vmin = v
      if (v > vmax) vmax = v
    }
    const w = umax - umin
    const hh = vmax - vmin
    const area = w * hh
    if (!best || area < best.area) {
      best = { area, long: Math.max(w, hh), short: Math.min(w, hh), angle: Math.atan2(uz, ux) }
    }
  }
  if (!best) return { long: 0, short: 0, angle: 0, area: 0 }
  return best
}

/**
 * Part du périmètre dont les angles sont « droits » (à 12° près).
 *
 * Un bâtiment industriel ou d'après-guerre est franchement orthogonal ; un tissu
 * ancien de centre-ville, découpé par des parcelles biscornues, ne l'est pas.
 * C'est un des rares signaux de forme qui sépare l'ancien du moderne.
 */
function orthogonality(pts) {
  const TOL = (12 * Math.PI) / 180
  let ok = 0
  let total = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length]
    const b = pts[i]
    const c = pts[(i + 1) % pts.length]
    const a1 = Math.hypot(b[0] - a[0], b[1] - a[1])
    const a2 = Math.hypot(c[0] - b[0], c[1] - b[1])
    if (a1 < 0.5 || a2 < 0.5) continue // arête trop courte : angle non significatif
    let ang = Math.abs(
      Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]),
    )
    if (ang > Math.PI) ang = 2 * Math.PI - ang
    total++
    // Un angle de contour vaut 90° si le virage fait un quart de tour, dans un
    // sens ou dans l'autre.
    if (Math.abs(ang - Math.PI / 2) < TOL) ok++
  }
  return total ? ok / total : null
}

/** Hachage stable → graine de variation. Deux builds doivent donner le même monde. */
function seedOf(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEX SPATIAL GÉNÉRIQUE
// ─────────────────────────────────────────────────────────────────────────────

/** Grille de cases carrées : range des objets par position, pour les retrouver vite. */
function makeGrid(cell) {
  const map = new Map()
  return {
    add(x, z, item) {
      const key = Math.floor(x / cell) + ':' + Math.floor(z / cell)
      let list = map.get(key)
      if (!list) map.set(key, (list = []))
      list.push(item)
    },
    /** Tout ce qui se trouve dans les (2r+1)² cases autour du point. */
    around(x, z, r = 1) {
      const out = []
      const cx = Math.floor(x / cell)
      const cz = Math.floor(z / cell)
      for (let i = -r; i <= r; i++) {
        for (let j = -r; j <= r; j++) {
          const list = map.get(cx + i + ':' + (cz + j))
          if (list) out.push(...list)
        }
      }
      return out
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TÉLÉCHARGEMENTS (avec cache disque)
// ─────────────────────────────────────────────────────────────────────────────

const FRESH = process.argv.includes('--fresh')

async function cached(name, loader) {
  mkdirSync(CACHE_DIR, { recursive: true })
  const file = join(CACHE_DIR, name + '.json')
  if (!FRESH && existsSync(file)) {
    console.log(`   📄 cache : ${name}`)
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  const data = await loader()
  writeFileSync(file, JSON.stringify(data))
  return data
}

const WFS_URL = 'https://data.geopf.fr/wfs/ows'
const PAGE = 5000 // maximum accepté par le serveur WFS en une requête

/**
 * Overpass est un service public gratuit, souvent saturé : il répond 504 ou 429
 * sans que la requête soit en cause. On tourne donc sur plusieurs miroirs, avec
 * une attente qui double à chaque échec. Sans ça, une collecte échoue une fois
 * sur trois pour une raison qui n'a rien à voir avec le projet.
 */
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
]

/** Bâtiments BD TOPO de la bbox géographique [sud, ouest, nord, est]. */
async function fetchBdTopo(geo, tag) {
  return cached(`bdtopo-${tag}`, async () => {
    const features = []
    console.log('🏛️  BD TOPO : téléchargement…')
    for (let start = 0; ; start += PAGE) {
      const url =
        `${WFS_URL}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment` +
        `&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&COUNT=${PAGE}&STARTINDEX=${start}` +
        `&BBOX=${geo.join(',')},urn:ogc:def:crs:EPSG::4326`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`BD TOPO (WFS) a répondu ${res.status} ${res.statusText}`)
      const page = await res.json()
      features.push(...page.features)
      if (page.features.length < PAGE) break
    }
    console.log(`   ${features.length} bâtiments IGN.`)
    return features
  })
}

/** Bâtiments OSM (avec leurs tags) de la bbox géographique. */
async function fetchOsm(geo, tag) {
  return cached(`osm-${tag}`, async () => {
    const b = geo.join(',')
    // ⚠️ Les contours de bâtiment d'OSM à Beauvais sont quasiment nus : `building=yes`
    // sur 99 % d'entre eux, et 0 % de `shop`/`amenity`. Ce n'est pas une lacune de la
    // ville — c'est la convention OSM : le commerce est un NŒUD posé À L'INTÉRIEUR du
    // bâtiment, pas un attribut de son contour. Sans cette seconde requête, l'archétype
    // « immeuble avec commerce en RDC » serait indétectable.
    const query = `[out:json][timeout:180];
(
  way["building"](${b});
  relation["building"](${b});
);
out geom;
(
  node["shop"](${b});
  node["amenity"](${b});
  node["office"](${b});
  node["tourism"](${b});
  node["craft"](${b});
  node["historic"](${b});
  node["healthcare"](${b});
  node["addr:housenumber"](${b});
);
out;`
    console.log('🌐 OSM : requête Overpass…')
    let lastErr
    for (let attempt = 0; attempt < 6; attempt++) {
      const url = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length]
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'PLS-game-dev/0.1 (ChunkForge, jeu amateur)',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'data=' + encodeURIComponent(query),
        })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const json = await res.json()
        console.log(`   ${json.elements?.length ?? 0} objets OSM.`)
        return json
      } catch (e) {
        lastErr = e
        const wait = 3000 * 2 ** Math.floor(attempt / OVERPASS_MIRRORS.length)
        console.log(`   ⏳ ${new URL(url).host} : ${e.message} — nouvelle tentative dans ${wait / 1000} s`)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
    throw new Error(`Overpass injoignable après 6 tentatives : ${lastErr?.message}`)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DES SOURCES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Codes matériaux : la BD TOPO reprend la nomenclature MAJIC (fichiers fonciers),
 * un code à deux chiffres. On garde le libellé en clair pour que le lot 2 et
 * l'éditeur soient lisibles — la traduction en couleur, elle, reste au rendu.
 */
const MUR_MATERIAL = { 10: 'pierre', 20: 'meuliere', 30: 'beton', 40: 'brique', 50: 'bois', 60: 'metal' }
const TOIT_MATERIAL = { 10: 'tuile', 12: 'tuile', 13: 'tuile', 20: 'ardoise', 30: 'zinc', 40: 'beton', 50: 'chaume' }

/**
 * ⚠️ Piège de la BD TOPO : `date_d_apparition` vaut très souvent `1800-01-01`.
 * Ce n'est PAS une date de construction — c'est la sentinelle « ancien, date
 * inconnue ». La prendre au pied de la lettre classerait la moitié du centre en
 * bâti d'Empire. On la sort donc explicitement, dans son propre champ.
 */
const DATE_SENTINELLE = '1800-01-01'

function readBdTopoProps(p) {
  const out = {}
  if (p.nature && p.nature !== 'Indifférenciée') out.nature = p.nature
  if (p.usage_1) out.usage1 = p.usage_1
  if (p.usage_2) out.usage2 = p.usage_2
  if (p.construction_legere === true) out.legere = 1
  if (p.nombre_d_etages != null) out.etages = p.nombre_d_etages
  if (p.nombre_de_logements != null) out.logements = p.nombre_de_logements
  if (p.materiaux_des_murs) out.murMat = MUR_MATERIAL[parseInt(p.materiaux_des_murs, 10)]
  if (p.materiaux_de_la_toiture) out.toitMat = TOIT_MATERIAL[parseInt(p.materiaux_de_la_toiture, 10)]
  if (p.origine_du_batiment) out.origine = p.origine_du_batiment

  const d = p.date_d_apparition
  if (d) {
    if (d.startsWith(DATE_SENTINELLE)) out.anneeInconnueAncien = 1
    else out.annee = parseInt(d.slice(0, 4), 10)
  }
  return out
}

/** Tags OSM qui disent quelque chose sur la NATURE du bâtiment. */
const OSM_TAGS = [
  'building',
  'building:levels',
  'building:material',
  'roof:shape',
  'roof:levels',
  'shop',
  'amenity',
  'office',
  'tourism',
  'historic',
  'heritage',
  'craft',
  'leisure',
  'name',
  'start_date',
  // L'adresse ne sert pas à classer — elle sert à ce qu'un humain SACHE de quel
  // bâtiment on parle quand il bascule sur Street View pour trancher.
  'addr:housenumber',
  'addr:street',
]

/** Clés qui font d'un nœud OSM un point d'activité, par ordre de priorité. */
const POI_KEYS = ['shop', 'amenity', 'craft', 'office', 'tourism', 'healthcare', 'historic']

function readOsmTags(tags) {
  const out = {}
  for (const k of OSM_TAGS) {
    if (tags[k] != null && tags[k] !== '') out[k.replace(':', '_')] = tags[k]
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMME PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const name = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'centre-ville'
  const box = CHUNKS[name]
  if (!box) {
    console.error(`❌ Zone inconnue : « ${name} ». Connues : ${Object.keys(CHUNKS).join(', ')}`)
    process.exit(1)
  }

  const wide = {
    minX: box.minX - MARGIN,
    maxX: box.maxX + MARGIN,
    minZ: box.minZ - MARGIN,
    maxZ: box.maxZ + MARGIN,
  }
  console.log(`\n🪪 ChunkForge — collecte « ${name} »`)
  console.log(
    `   emprise ${box.minX}..${box.maxX} × ${box.minZ}..${box.maxZ} m ` +
      `(${((box.maxX - box.minX) * (box.maxZ - box.minZ)) / 1e6} km²), marge ${MARGIN} m\n`,
  )

  // --- 1. Les emprises : on repart du fichier existant, pas d'un nouveau téléchargement.
  // Elles sont déjà projetées, déjà nettoyées, et surtout `ra` y a été calculé par
  // `roofs.mjs` sur la ville ENTIÈRE — donc avec les vrais voisins partout.
  const city = JSON.parse(readFileSync(CITY_FILE, 'utf8'))
  const inWide = (c) => c[0] >= wide.minX && c[0] <= wide.maxX && c[1] >= wide.minZ && c[1] <= wide.maxZ
  const inBox = (c) => c[0] >= box.minX && c[0] <= box.maxX && c[1] >= box.minZ && c[1] <= box.maxZ

  const local = []
  for (const b of city.buildings) {
    if (!b.pts || b.pts.length < 3) continue
    const c = centroid(b.pts)
    if (!inWide(c)) continue
    // `idx` = position dans `local`, mémorisée pour que le test de mitoyenneté
    // puisse s'ignorer lui-même sans chercher l'objet dans le tableau.
    local.push({ src: b, c, area: polygonArea(b.pts), idx: local.length })
  }
  const keep = local.filter((b) => inBox(b.c))
  console.log(`📦 ${keep.length} bâtiments dans la zone (${local.length} avec la marge)`)

  // --- 2. La bbox géographique correspondante, pour les téléchargements.
  // ⚠️ z NÉGATIF = nord (voir geo.mjs) : le coin minZ donne la latitude MAXI.
  const nw = unproject(wide.minX, wide.minZ)
  const se = unproject(wide.maxX, wide.maxZ)
  const geo = [se.lat, nw.lon, nw.lat, se.lon] // [sud, ouest, nord, est]
  // Le suffixe de version fait partie de la clé de cache : si la requête change,
  // on ne veut surtout pas relire l'ancienne réponse. À incrémenter à chaque
  // modification d'une requête réseau.
  const tag = `${name}-${MARGIN}-v3`

  const [ignFeatures, osmJson] = await Promise.all([fetchBdTopo(geo, tag), fetchOsm(geo, tag)])

  // --- 3. Index BD TOPO. On garde le contour pour pouvoir tester l'appartenance,
  // et l'aire pour départager quand plusieurs objets IGN tombent dans une emprise.
  const ignGrid = makeGrid(50)
  let ignKept = 0
  for (const f of ignFeatures) {
    const p = f.properties
    if (p.etat_de_l_objet && p.etat_de_l_objet !== 'En service') continue
    const coords = f.geometry?.coordinates?.[0]?.[0]
    if (!coords || coords.length < 3) continue
    const ring = coords.map(([lon, lat]) => project(lat, lon))
    const c = centroid(ring)
    ignGrid.add(c[0], c[1], { ring, c, area: polygonArea(ring), p })
    ignKept++
  }
  console.log(`🏛️  ${ignKept} bâtiments IGN retenus (en service)`)

  // --- 4. Index OSM. Overpass renvoie la géométrie en `geometry` (ways) ou en
  // `members` (relations) ; on ne garde que l'anneau extérieur, qui suffit ici.
  const osmGrid = makeGrid(50)
  const poiGrid = makeGrid(50)
  const addrGrid = makeGrid(50)
  let osmKept = 0
  let poiKept = 0
  let addrKept = 0
  for (const el of osmJson.elements ?? []) {
    if (el.type === 'node') {
      const t = el.tags ?? {}
      const [x, z] = project(el.lat, el.lon)

      // Un point d'adresse : ne sert pas à classer, sert à SE REPÉRER.
      if (t['addr:housenumber']) {
        addrGrid.add(x, z, {
          x,
          z,
          num: t['addr:housenumber'],
          street: t['addr:street'] ?? null,
        })
        addrKept++
      }

      // Un POI : commerce, service, équipement… Il sera rattaché au bâtiment qui
      // le contient. C'est LUI qui porte l'information d'usage réel, pas le contour.
      const kind = POI_KEYS.find((k) => t[k])
      if (!kind) continue
      poiGrid.add(x, z, { x, z, k: kind, v: t[kind], name: t.name })
      poiKept++
      continue
    }
    if (!el.tags?.building) continue
    let geom = el.geometry
    if (!geom && el.members) geom = el.members.find((m) => m.role === 'outer')?.geometry
    if (!geom || geom.length < 3) continue
    const ring = geom.map((g) => project(g.lat, g.lon))
    const c = centroid(ring)
    osmGrid.add(c[0], c[1], { ring, c, tags: el.tags })
    osmKept++
  }
  console.log(
    `🗺️  ${osmKept} contours OSM · ${poiKept} POI (commerces, services) · ${addrKept} points d'adresse`,
  )

  // --- 5. Index des murs de TOUS les bâtiments de la zone élargie → mitoyenneté.
  const SHARE_DIST = 1.0 // deux murs à moins d'1 m = mitoyens (même règle que roofs.mjs)
  const edgeGrid = makeGrid(8)
  for (let i = 0; i < local.length; i++) {
    const pts = local[i].src.pts
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k]
      const b = pts[(k + 1) % pts.length]
      const edge = { a, b, i }
      edgeGrid.add(a[0], a[1], edge)
      edgeGrid.add(b[0], b[1], edge)
    }
  }

  // --- 6. Index des routes (segment par segment) → rue la plus proche.
  const roadGrid = makeGrid(40)
  for (const r of city.roads ?? []) {
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i]
      const b = r.pts[i + 1]
      const mx = (a[0] + b[0]) / 2
      const mz = (a[1] + b[1]) / 2
      if (mx < wide.minX - 60 || mx > wide.maxX + 60) continue
      if (mz < wide.minZ - 60 || mz > wide.maxZ + 60) continue
      roadGrid.add(mx, mz, { a, b, r })
    }
  }

  // --- 7. Les quartiers.
  const zones = JSON.parse(readFileSync(ZONES_FILE, 'utf8')).zones ?? []

  // --- 8. Fabrication des passeports.
  const passports = []
  const stats = { ignJoin: 0, osmJoin: 0, multiIgn: 0, withPoi: 0, withAddr: 0 }

  for (const item of keep) {
    const b = item.src
    const pts = b.pts
    const [cx, cz] = item.c
    const area = item.area

    // ── Jointure BD TOPO : l'objet IGN dont le centroïde tombe DANS l'emprise.
    // Si plusieurs (cas d'une grande emprise OSM couvrant plusieurs bâtis IGN),
    // on garde le plus grand — c'est lui qui porte le caractère du bâtiment.
    let ign = null
    let ignCount = 0
    for (const cand of ignGrid.around(cx, cz, 1)) {
      if (!pointInRing(cand.c[0], cand.c[1], pts)) continue
      ignCount++
      if (!ign || cand.area > ign.area) ign = cand
    }
    // Repli : aucune correspondance → l'objet IGN qui CONTIENT notre centroïde.
    if (!ign) {
      for (const cand of ignGrid.around(cx, cz, 1)) {
        if (pointInRing(cx, cz, cand.ring)) {
          ign = cand
          break
        }
      }
    }
    if (ign) stats.ignJoin++
    if (ignCount > 1) stats.multiIgn++

    // ── Jointure OSM : même principe, sur le centroïde.
    let osm = null
    for (const cand of osmGrid.around(cx, cz, 1)) {
      if (pointInRing(cx, cz, cand.ring)) {
        osm = cand
        break
      }
    }
    if (!osm) {
      let bestD = 4 // m : au-delà, ce n'est plus le même bâtiment
      for (const cand of osmGrid.around(cx, cz, 1)) {
        const d = Math.hypot(cand.c[0] - cx, cand.c[1] - cz)
        if (d < bestD) {
          bestD = d
          osm = cand
        }
      }
    }
    if (osm) stats.osmJoin++

    // ── Les POI contenus dans l'emprise. Un bâtiment qui abrite une boulangerie
    // et un coiffeur a forcément un rez-de-chaussée commercial : c'est la preuve
    // la plus directe qu'on puisse avoir, et elle ne vient que d'ici.
    const pois = []
    for (const p of poiGrid.around(cx, cz, 1)) {
      if (pointInRing(p.x, p.z, pts)) {
        pois.push({ k: p.k, v: p.v, ...(p.name ? { name: p.name } : {}) })
      }
    }
    if (pois.length) stats.withPoi++

    // ── L'adresse. D'abord les tags du contour, sinon un point d'adresse posé
    // dans l'emprise. C'est le seul moyen de savoir DE QUEL bâtiment on parle
    // quand on bascule sur Street View pour trancher à la main.
    let addr = null
    if (osm?.tags?.['addr:housenumber']) {
      addr = [osm.tags['addr:housenumber'], osm.tags['addr:street']].filter(Boolean).join(' ')
    } else {
      // 1. Un point d'adresse posé DANS l'emprise : c'est certain.
      let best = null
      let bestD = Infinity
      for (const a of addrGrid.around(cx, cz, 1)) {
        if (pointInRing(a.x, a.z, pts)) {
          best = a
          bestD = 0
          break
        }
        // 2. Sinon on retient le plus proche : beaucoup de points d'adresse OSM
        // sont posés en limite de parcelle ou au bord de la rue, pas dans le
        // bâtiment. Mesuré : la jointure stricte ne couvrait que 10 % des cas.
        const d = Math.hypot(a.x - cx, a.z - cz)
        if (d < bestD) {
          bestD = d
          best = a
        }
      }
      if (best && bestD <= 12) {
        addr = [best.num, best.street].filter(Boolean).join(' ')
        // ⚠️ Une adresse approchée est un REPÈRE, pas une donnée : on le signale,
        // pour qu'on ne la prenne jamais pour l'adresse officielle du bâtiment.
        if (bestD > 0) addr = `~ ${addr}`
      }
    }
    if (addr) stats.withAddr++

    // ── Géométrie.
    const per = perimeter(pts)
    const rect = minAreaRect(pts)
    const geom = {
      area: r1(area),
      perimeter: r1(per),
      /** Petit côté du rectangle englobant : la LARGEUR du bâtiment. */
      width: r1(rect.short),
      length: r1(rect.long),
      /** > 3 ≈ hangar ou barre ; ≈ 1 ≈ pavillon. */
      elongation: rect.short > 0.3 ? r2(rect.long / rect.short) : null,
      /** 1 = disque, ~0,78 = carré parfait, faible = découpé/biscornu. */
      compactness: per > 0 ? r3((4 * Math.PI * area) / (per * per)) : null,
      /** Part de l'emprise réellement remplie par son rectangle : détecte les L et U. */
      rectFill: rect.area > 0 ? r2(area / rect.area) : null,
      orthogonality: orthogonality(pts) == null ? null : r2(orthogonality(pts)),
      vertices: pts.length,
    }

    // ── Mitoyenneté : on mesure la LONGUEUR de mur partagée, pas seulement le
    // nombre de côtés. « 2 côtés mitoyens » ne dit pas si c'est 2 m ou 20 m ;
    // la part du périmètre, si — et c'est elle qui sépare une maison de ville
    // d'un pavillon qui frôle son garage.
    let sharedLen = 0
    let sharedSides = 0
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k]
      const c = pts[(k + 1) % pts.length]
      const len = Math.hypot(c[0] - a[0], c[1] - a[1])
      if (len < 0.5) continue
      let shared = false
      for (const e of edgeGrid.around(a[0], a[1], 1)) {
        if (e.i === item.idx) continue // ne pas se compter soi-même
        if (distToSegment(a, e.a, e.b) < SHARE_DIST && distToSegment(c, e.a, e.b) < SHARE_DIST) {
          shared = true
          break
        }
      }
      if (shared) {
        sharedLen += len
        sharedSides++
      }
    }

    // ── Densité du tissu autour (rayon 50 m) : combien de voisins, et quelle
    // part du sol est bâtie. Un centre ancien et un lotissement ont la même
    // taille de maison mais pas du tout la même densité.
    const R = 50
    let neigh = 0
    let builtArea = 0
    for (const other of local) {
      if (other === item) continue
      const d = Math.hypot(other.c[0] - cx, other.c[1] - cz)
      if (d <= R) {
        neigh++
        builtArea += other.area
      }
    }

    // ── Rue la plus proche.
    let road = null
    let roadDist = Infinity
    for (const s of roadGrid.around(cx, cz, 2)) {
      const d = distToSegment([cx, cz], s.a, s.b)
      if (d < roadDist) {
        roadDist = d
        road = s.r
      }
    }

    // ── Quartier.
    let zone = null
    for (const z of zones) {
      if (pointInRing(cx, cz, z.pts)) {
        zone = z.id
        break
      }
    }

    // ── Pente du toit. `ra` donne le sens du faîtage ; la profondeur mesurée
    // PERPENDICULAIREMENT à ce sens est la distance que le rampant parcourt.
    // La pente vaut donc rh / demi-profondeur. (Même calcul que roofs.mjs.)
    let pitch = null
    if (b.rh > 0 && b.ra != null) {
      const nx = -Math.sin(b.ra)
      const nz = Math.cos(b.ra)
      let smin = Infinity
      let smax = -Infinity
      for (const [x, z] of pts) {
        const s = x * nx + z * nz
        if (s < smin) smin = s
        if (s > smax) smax = s
      }
      const D = (smax - smin) / 2
      if (D > 0.5) pitch = r1((Math.atan(b.rh / D) * 180) / Math.PI)
    }

    const id = ign?.p?.cleabs ?? `xz:${Math.round(cx)}_${Math.round(cz)}`

    passports.push({
      id,
      cx: r1(cx),
      cz: r1(cz),
      seed: seedOf(id),

      // Mesuré — repris tel quel, jamais réinventé.
      pts,
      ...(b.holes ? { holes: b.holes } : {}),
      ...(b.h != null ? { h: r1(b.h) } : {}),
      ...(b.rh != null ? { rh: r1(b.rh) } : {}),
      ...(b.ra != null ? { ra: b.ra } : {}),
      ...(b.rm ? { rm: b.rm } : {}),
      ...(b.kind ? { kind: b.kind } : {}),
      ...(b.bdtopo ? { bdtopo: 1 } : {}),
      ...(pitch != null ? { pitch } : {}),

      geom,
      ign: ign ? readBdTopoProps(ign.p) : {},
      osm: {
        ...(osm ? readOsmTags(osm.tags) : {}),
        ...(pois.length ? { pois } : {}),
        ...(addr ? { addr } : {}),
      },
      ctx: {
        sharedSides,
        sharedLen: r1(sharedLen),
        /** Part du périmètre collée à un voisin. 0 = isolé, > 0,4 = mitoyen franc. */
        sharedRatio: per > 0 ? r2(sharedLen / per) : 0,
        neighbours50: neigh,
        /** Part du sol bâtie dans un rayon de 50 m. */
        builtRatio50: r2(builtArea / (Math.PI * R * R)),
        ...(road
          ? {
              roadDist: r1(roadDist),
              roadClass: road.cls ?? null,
              roadWidth: road.w ?? null,
              ...(road.name ? { roadName: road.name } : {}),
            }
          : {}),
        ...(zone ? { zone } : {}),
      },
    })
  }

  // --- 9. Rapport de couverture. C'est le LIVRABLE du lot 1 : sans lui, on ne
  // sait pas sur quels signaux le lot 2 a le droit de s'appuyer.
  report(passports, stats)

  mkdirSync(OUT_DIR, { recursive: true })
  const out = join(OUT_DIR, `${name}.passports.json`)
  writeFileSync(
    out,
    JSON.stringify(
      {
        chunk: name,
        box,
        margin: MARGIN,
        generatedAt: new Date().toISOString(),
        count: passports.length,
        source: 'collect-chunk.mjs (lot 1) — OSM + BD TOPO IGN + géométrie + contexte',
        passports,
      },
      null,
      0,
    ),
  )
  const mb = (Buffer.byteLength(readFileSync(out)) / 1e6).toFixed(2)
  console.log(`\n✅ ${passports.length} passeports écrits → ${out} (${mb} Mo)`)
  console.log('   Prochaine étape : lot 2 — classify.mjs (voir docs/08-CHUNKFORGE.md)\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT DE COUVERTURE
// ─────────────────────────────────────────────────────────────────────────────

function pct(n, total) {
  return ((100 * n) / total).toFixed(0).padStart(3) + ' %'
}

function bar(n, total) {
  const w = Math.round((20 * n) / total)
  return '█'.repeat(w) + '·'.repeat(20 - w)
}

/** Les valeurs les plus fréquentes d'un champ, pour voir ce qu'il contient vraiment. */
function top(passports, get, n = 6) {
  const counts = new Map()
  for (const p of passports) {
    const v = get(p)
    if (v == null || v === '') continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, c]) => `${k} ${c}`)
    .join(' · ')
}

function report(passports, stats) {
  const T = passports.length
  console.log(
    `\n🔗 Jointures : IGN ${pct(stats.ignJoin, T)} · OSM ${pct(stats.osmJoin, T)} · ` +
      `avec POI ${pct(stats.withPoi, T)} · avec adresse ${pct(stats.withAddr, T)}`,
  )
  if (stats.multiIgn) {
    console.log(`   ${stats.multiIgn} emprises contiennent plusieurs bâtis IGN (le plus grand gagne)`)
  }

  console.log('\n📊 TAUX DE REMPLISSAGE DES SIGNAUX')
  console.log('   (c\'est ce tableau qui décide des poids du lot 2)\n')

  const fields = [
    ['mesuré', 'hauteur h', (p) => p.h],
    ['mesuré', 'toit rh', (p) => p.rh],
    ['mesuré', 'faîtage ra', (p) => p.ra],
    ['mesuré', 'pente toit', (p) => p.pitch],
    ['mesuré', 'matériau toit rm', (p) => p.rm],
    ['IGN', 'usage_1', (p) => p.ign.usage1],
    ['IGN', 'usage_2', (p) => p.ign.usage2],
    ['IGN', 'nature (hors Indifférenciée)', (p) => p.ign.nature],
    ['IGN', 'nombre_d_etages', (p) => p.ign.etages],
    ['IGN', 'nombre_de_logements', (p) => p.ign.logements],
    ['IGN', 'année DATÉE (exploitable)', (p) => p.ign.annee],
    ['IGN', 'année = sentinelle 1800', (p) => p.ign.anneeInconnueAncien],
    ['IGN', 'matériaux des murs', (p) => p.ign.murMat],
    ['IGN', 'construction légère', (p) => p.ign.legere],
    ['IGN', 'origine du bâtiment', (p) => p.ign.origine],
    ['OSM', 'building (type)', (p) => p.osm.building],
    ['OSM', 'building:levels', (p) => p.osm.building_levels],
    ['OSM', 'shop (sur le contour)', (p) => p.osm.shop],
    ['OSM', 'amenity (sur le contour)', (p) => p.osm.amenity],
    ['OSM', '⭐ POI contenu dans le bâtiment', (p) => p.osm.pois?.length],
    ['OSM', 'historic / heritage', (p) => p.osm.historic ?? p.osm.heritage],
    ['OSM', 'name', (p) => p.osm.name],
    ['OSM', 'roof:shape', (p) => p.osm.roof_shape],
    ['contexte', 'rue à moins de 15 m', (p) => (p.ctx.roadDist <= 15 ? 1 : null)],
    ['contexte', 'quartier connu', (p) => p.ctx.zone],
    ['contexte', 'mitoyen (ratio > 0,15)', (p) => (p.ctx.sharedRatio > 0.15 ? 1 : null)],
  ]

  let group = null
  for (const [g, label, get] of fields) {
    if (g !== group) {
      console.log(`   ── ${g} ─────────────────────────────────`)
      group = g
    }
    const n = passports.filter((p) => {
      const v = get(p)
      return v != null && v !== ''
    }).length
    const flag = n / T < 0.5 ? ' ⚠️' : ''
    console.log(`   ${bar(n, T)} ${pct(n, T)}  ${label}${flag}`)
  }

  console.log('\n🔍 CE QUE CONTIENNENT VRAIMENT LES CHAMPS CLÉS\n')
  console.log('   usage_1      :', top(passports, (p) => p.ign.usage1))
  console.log('   usage_2      :', top(passports, (p) => p.ign.usage2))
  console.log('   nature       :', top(passports, (p) => p.ign.nature) || '(tout Indifférenciée)')
  console.log('   étages       :', top(passports, (p) => p.ign.etages, 8))
  console.log('   murs         :', top(passports, (p) => p.ign.murMat))
  console.log('   toiture      :', top(passports, (p) => p.rm))
  console.log('   OSM building :', top(passports, (p) => p.osm.building, 8))
  console.log('   origine IGN  :', top(passports, (p) => p.ign.origine))
  console.log('   quartier     :', top(passports, (p) => p.ctx.zone))

  // Les POI, à plat : quels usages réels abrite la zone ?
  const poiCounts = new Map()
  for (const p of passports) {
    for (const poi of p.osm.pois ?? []) {
      const key = `${poi.k}=${poi.v}`
      poiCounts.set(key, (poiCounts.get(key) ?? 0) + 1)
    }
  }
  if (poiCounts.size) {
    console.log(
      '   POI (top 10) :',
      [...poiCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, c]) => `${k} ${c}`).join(' · '),
    )
  }

  // Décennies : c'est LE signal d'époque. On veut voir s'il est utilisable.
  const dec = new Map()
  for (const p of passports) {
    if (p.ign.annee == null) continue
    const d = Math.floor(p.ign.annee / 10) * 10
    dec.set(d, (dec.get(d) ?? 0) + 1)
  }
  if (dec.size) {
    console.log(
      '\n   époques datées :',
      [...dec.entries()].sort((a, b) => a[0] - b[0]).map(([d, c]) => `${d}s:${c}`).join(' '),
    )
  }

  // Distribution des tailles : elle doit confirmer (ou démentir) que la moitié
  // de la zone est faite de dépendances.
  const areas = passports.map((p) => p.geom.area).sort((a, b) => a - b)
  const q = (f) => areas[Math.floor(f * (areas.length - 1))]
  console.log(
    `\n   aire au sol (m²) : p10 ${q(0.1)} · médiane ${q(0.5)} · p90 ${q(0.9)} · max ${areas.at(-1)}`,
  )
  const petits = passports.filter((p) => p.geom.area < 40 && (p.h ?? 0) < 3.5).length
  console.log(`   candidats « dépendance » (< 40 m² et h < 3,5 m) : ${petits} (${pct(petits, T)})`)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
