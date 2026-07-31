// @ts-nocheck
/**
 * 🛣️  bdtopoRoads.mjs — les routes de Beauvais telles que l'IGN les a MESURÉES.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────────
 *
 * Avant, les routes venaient d'OSM et leur largeur était DEVINÉE par une table
 * `highway → mètres` (« une résidentielle, ça fait 5 m en général »). Deux
 * défauts, et le second est le pire :
 *
 *  1. La largeur était un stéréotype, pas une mesure. Une venelle du centre et
 *     un boulevard de lotissement sortaient tous les deux à 5 m.
 *
 *  2. **Les routes et les bâtiments ne venaient pas du même référentiel.** Les
 *     bâtiments sont levés par l'IGN (`bdtopo.mjs`), les routes étaient tracées
 *     à la main sur fond d'ortho par les contributeurs OSM. Entre les deux, un
 *     décalage courant de 1 à 5 m. Une rue de 8 m dont l'axe est décalé de 3 m
 *     devient 1 m d'un côté et 7 de l'autre : c'est ça qui donnait la sensation
 *     de rues étranglées, bien plus que la largeur du bitume elle-même.
 *
 * On prend donc les routes à la MÊME source que les bâtiments : la BD TOPO de
 * l'IGN, couche `troncon_de_route`, même serveur WFS que `bdtopo.mjs`. Routes et
 * façades sont alors levées par la même photogrammétrie, dans le même repère.
 *
 * ── Ce que l'IGN donne et qu'OSM ne donnait pas ──────────────────────────────
 *
 * Relevé sur les 7 892 tronçons de la commune (60057) :
 *
 *  - `largeur_de_chaussee` : la largeur réelle du bitume, renseignée sur 96,7 %
 *    des voies carrossables. Les 3,3 % restants retombent sur `nombre_de_voies`.
 *  - `nature` : sépare franchement Sentier (776), Chemin (353), Escalier (11) et
 *    Route empierrée (334) des vraies chaussées. Plus besoin de deviner qu'un
 *    trait fin « n'est probablement pas une route » à partir de sa largeur.
 *  - `acces_vehicule_leger` : *Libre* / *Restreint aux ayants droit* (dessertes,
 *    allées de parking) / *Physiquement impossible* / *A péage*.
 *  - `urbain` : en tissu urbain → trottoirs ; hors tissu → accotement.
 *
 * ── La trouvaille ────────────────────────────────────────────────────────────
 *
 * 174 tronçons sont de nature « Route » (donc une vraie chaussée, avec largeur,
 * bordures et revêtement) mais avec `acces_vehicule_leger = Physiquement
 * impossible` : ce sont exactement les **rues piétonnisées** — bornes, potelets,
 * plots. Le centre de Beauvais en est plein. C'est la définition d'une zone
 * piétonne, donnée par la donnée elle-même, sans avoir à la dessiner à la main.
 *
 * ── Attention, ce fichier ne corrige PAS tout ────────────────────────────────
 *
 * `largeur_de_chaussee` est quantifiée au demi-mètre et vaut 5 m dans 48 % des
 * cas. Autrement dit : l'IGN confirme que les rues de Beauvais font réellement
 * ~5 m de bitume. Ce module rend les largeurs JUSTES, il ne les rend pas plus
 * GRANDES. L'impression d'étroitesse restante ne se corrigera pas ici mais dans
 * l'espace entre le bitume et la façade (trottoir), qui est encore une constante
 * dans `roadway.ts` (`SHOULDER_W`).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const WFS_URL = 'https://data.geopf.fr/wfs/ows'
const LAYER = 'BDTOPO_V3:troncon_de_route'
const PAGE = 5000 // plafond du serveur par requête

// ─────────────────────────────────────────────────────────────────────────────
// TÉLÉCHARGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Télécharge tous les tronçons de route de la BBOX [sud, ouest, nord, est].
 *
 * ⚠️ Le suffixe `urn:ogc:def:crs:EPSG::4326` sur la BBOX n'est pas décoratif :
 * sans lui le serveur lit les coordonnées en (lon, lat) au lieu de (lat, lon) et
 * renvoie tranquillement 0 objet, sans erreur. Même piège que dans `bdtopo.mjs`.
 */
export async function fetchBdTopoRoads(bbox) {
  const cache = process.env.BDTOPO_ROADS_FILE
  if (cache && existsSync(cache)) {
    console.log('📄 BD TOPO routes : lecture du cache local', cache)
    return JSON.parse(readFileSync(cache, 'utf8'))
  }

  const features = []
  console.log('🛣️  BD TOPO : téléchargement des routes IGN...')
  for (let start = 0; ; start += PAGE) {
    const url =
      `${WFS_URL}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${LAYER}` +
      `&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&COUNT=${PAGE}&STARTINDEX=${start}` +
      `&BBOX=${bbox.join(',')},urn:ogc:def:crs:EPSG::4326`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`BD TOPO routes (WFS) a répondu ${res.status} ${res.statusText}`)
    const page = await res.json()
    features.push(...page.features)
    process.stdout.write(`   ${features.length} tronçons IGN...\r`)
    if (page.features.length < PAGE) break
  }
  console.log(`   ${features.length} tronçons IGN téléchargés.       `)

  if (cache) {
    writeFileSync(cache, JSON.stringify({ features }))
    console.log('   (mis en cache dans', cache + ')')
  }
  return { features }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRADUCTION BD TOPO → VOCABULAIRE DU JEU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `importance` BD TOPO (1 = axe majeur … 6 = desserte) traduite dans le
 * vocabulaire `highway` d'OSM.
 *
 * On garde le vocabulaire OSM au lieu d'en inventer un nouveau parce que tout
 * l'aval le lit déjà : `MAJOR_HIGHWAYS`, la détection des bretelles `_link` et
 * la fusion des chaussées parallèles dans `roadway.ts`. Changer de vocabulaire
 * ici obligerait à réécrire ces trois logiques pour zéro gain.
 */
const IMPORTANCE_TO_HIGHWAY = {
  1: 'trunk', // grande liaison (l'autoroute est traitée par `nature` ci-dessous)
  2: 'primary',
  3: 'secondary',
  4: 'tertiary',
  5: 'residential',
  6: 'service',
}

/**
 * Natures qui ne sont pas une chaussée et qu'on ne pose PAS au sol.
 *
 * C'est le remplaçant direct du seuil `MIN_DRIVABLE_WIDTH` de `roadway.ts`, qui
 * devinait « trop étroit donc pas une route ». Un seuil de largeur se trompe
 * dans les deux sens : il gardait des sentiers larges et jetait des ruelles
 * étroites bien réelles. Ici, c'est l'IGN qui a tranché sur le terrain.
 */
const NOT_A_ROAD = new Set(['Sentier', 'Escalier'])

/** Natures carrossables mais non revêtues → piste de terre, pas du bitume. */
const UNPAVED = new Set(['Chemin', 'Route empierrée'])

/** Largeur de repli quand `largeur_de_chaussee` est vide (chemins, surtout). */
const FALLBACK_WIDTH = { Chemin: 3, 'Route empierrée': 3.5 }

/** Largeur d'une voie de circulation, pour reconstruire une largeur manquante. */
const LANE_WIDTH = 3

/**
 * Classe d'usage — l'information que la largeur seule ne pouvait pas porter.
 *
 * C'est ce qui permet enfin de distinguer une rue piétonne d'une rue de même
 * largeur : ce n'est plus une question de mètres, mais d'accès.
 */
function roadClass(p) {
  if (UNPAVED.has(p.nature)) return 'track'
  switch (p.acces_vehicule_leger) {
    case 'Physiquement impossible':
      // Une vraie chaussée où la voiture ne peut PAS entrer : bornes, potelets,
      // plots. C'est la définition d'une rue piétonnisée.
      return 'pedestrian'
    case 'Restreint aux ayants droit':
      // Desserte privée, allée de parking, cour d'immeuble.
      return 'service'
    default:
      return 'drivable'
  }
}

/** Largeur du bitume en mètres, mesurée si possible, reconstruite sinon. */
function roadWidth(p) {
  const measured = Number(p.largeur_de_chaussee)
  if (Number.isFinite(measured) && measured > 0) return measured

  const lanes = Number(p.nombre_de_voies)
  if (Number.isFinite(lanes) && lanes > 0) return lanes * LANE_WIDTH

  return FALLBACK_WIDTH[p.nature] ?? LANE_WIDTH
}

/** Type de voie dans le vocabulaire `highway`, bretelles comprises. */
function roadHighway(p) {
  if (p.nature === 'Type autoroutier') return 'motorway'
  if (UNPAVED.has(p.nature)) return 'track'

  const base = IMPORTANCE_TO_HIGHWAY[String(p.importance)] ?? 'residential'

  // Une bretelle hérite du rang de l'axe qu'elle dessert : `roadway.ts` reconnaît
  // le suffixe `_link` pour ne pas la fusionner avec la chaussée principale.
  if (p.nature === 'Bretelle') {
    return base === 'residential' || base === 'service' ? 'tertiary_link' : `${base}_link`
  }
  return base
}

/**
 * Remet un nom de rue en forme lisible.
 *
 * L'IGN stocke les voies en abrégé majuscules façon cadastre (`R DE GASCOGNE`,
 * `PL JAMMY SCHMIDT`). Affiché tel quel dans le jeu, ça sonne administratif ;
 * on développe les abréviations et on repasse en casse de titre.
 */
const ABBREV = {
  R: 'Rue', RTE: 'Route', AV: 'Avenue', BD: 'Boulevard', PL: 'Place', IMP: 'Impasse',
  ALL: 'Allée', CHE: 'Chemin', RLE: 'Ruelle', PAS: 'Passage', SEN: 'Sentier',
  SQ: 'Square', CRS: 'Cours', QUAI: 'Quai', VOI: 'Voie', ESP: 'Esplanade',
  RPT: 'Rond-point', CAR: 'Carrefour', MTE: 'Montée', DSC: 'Descente', VLA: 'Villa',
}
const PARTICLES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'au', 'aux', 'sur'])

/**
 * Particules élidées, collées au mot suivant : `D'ALSACE`, `L'ABBÉ`.
 *
 * Elles ne peuvent pas passer par `PARTICLES` : une fois en minuscules le mot
 * vaut `d'alsace`, pas `d'`. Il faut donc les repérer par leur préfixe.
 */
const ELIDED = /^(d|l|qu|n)'/i

function prettyName(raw) {
  if (!raw) return undefined
  const words = String(raw).trim().split(/\s+/)
  if (!words.length) return undefined

  const head = ABBREV[words[0].toUpperCase()]
  const rest = (head ? words.slice(1) : words).map((w, i) => {
    const low = w.toLowerCase()
    // Les particules restent en minuscules, sauf si elles ouvrent vraiment le
    // nom. Attention : quand une abréviation a été retirée (`PL DE PLOUY`), le
    // mot d'indice 0 n'ouvre PAS le nom — il suit « Place ». Sans cette nuance
    // on écrit « Place De Plouy » et « Rue D'Alsace ».
    if ((head || i > 0) && PARTICLES.has(low)) return low

    // On capitalise chaque segment, y compris après apostrophe ou trait d'union
    // (`SAINT-LUCIEN` → `Saint-Lucien`).
    const titled = low.replace(/(^|['-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase())

    // Puis on rabaisse la particule élidée : `D'Alsace` → `d'Alsace`.
    return head || i > 0 ? titled.replace(ELIDED, (m) => m.toLowerCase()) : titled
  })
  return [head, ...rest].filter(Boolean).join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

const round1 = (n) => Math.round(n * 10) / 10

/**
 * Convertit les tronçons BD TOPO en routes du jeu (`Road` de `cityData.ts`).
 *
 * `project` est passé en paramètre plutôt qu'importé pour que ce module reste
 * testable seul et qu'il n'existe qu'UNE origine de scène, celle de `geo.mjs`.
 *
 * Renvoie `{ roads, report }` — le rapport sert au récap de fin de build, pour
 * qu'une dégradation de la donnée IGN se voie tout de suite au lieu d'être
 * découverte des mois plus tard en jouant.
 */
export function buildRoadsFromBdTopo(features, project) {
  const roads = []
  const report = {
    total: features.length,
    skipped: 0,
    measured: 0, // largeur venue de `largeur_de_chaussee`
    reconstructed: 0, // largeur reconstruite depuis `nombre_de_voies`
    fallback: 0, // ni l'une ni l'autre → largeur type (chemins, surtout)
    byClass: {},
  }

  for (const f of features) {
    const p = f.properties || {}

    // Tronçons de service de la donnée : projetés, détruits, ou pure fiction
    // topologique (raccords). Les poser au sol créerait des routes fantômes.
    if (p.etat_de_l_objet && p.etat_de_l_objet !== 'En service') { report.skipped++; continue }
    if (p.fictif) { report.skipped++; continue }
    if (NOT_A_ROAD.has(p.nature)) { report.skipped++; continue }

    const coords = f.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) { report.skipped++; continue }

    // La BD TOPO livre des coordonnées 3D (lon, lat, altitude). On ignore le Z :
    // l'altitude du jeu vient du LiDAR HD via `terrain`, et mélanger deux
    // sources d'altitude ferait des routes qui flottent ou s'enterrent.
    const pts = coords.map(([lon, lat]) => project(lat, lon).map(round1))

    const cls = roadClass(p)
    const road = {
      w: roadWidth(p),
      pts,
      id: p.cleabs,
      highway: roadHighway(p),
      cls,
    }

    if (Number(p.largeur_de_chaussee) > 0) report.measured++
    else if (Number(p.nombre_de_voies) > 0) report.reconstructed++
    else report.fallback++
    report.byClass[cls] = (report.byClass[cls] || 0) + 1

    const name = prettyName(p.nom_collaboratif_gauche || p.nom_collaboratif_droite)
    if (name) road.name = name

    const lanes = Number(p.nombre_de_voies)
    if (Number.isFinite(lanes) && lanes > 0) road.lanes = lanes

    // `Sans objet` = tronçon sans sens défini (rond-point isolé, aire) : ce n'est
    // pas un sens unique, on ne met donc rien.
    if (p.sens_de_circulation === 'Sens direct' || p.sens_de_circulation === 'Sens inverse') {
      road.oneway = true
    }

    if (p.nature === 'Rond-point') road.junction = 'roundabout'
    if (p.urbain === true) road.urban = true

    // 147 tronçons passent au-dessus (ponts) et 3 en dessous (tunnels) à
    // Beauvais. `roadway.ts` s'en sert pour ne pas fusionner deux chaussées qui
    // se croisent sans se rencontrer.
    const level = Number(p.position_par_rapport_au_sol)
    if (Number.isFinite(level) && level !== 0) {
      road.layer = level
      if (level > 0) road.bridge = true
      else road.tunnel = true
    }

    roads.push(road)
  }

  return { roads, report }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORRECTIONS MANUELLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applique les retouches de `data/road-overrides.json`.
 *
 * ⚠️ C'est la pièce qui rend le chantier CUMULATIF. Sans elle, chaque
 * régénération de la ville efface les corrections faites à la main, et on tourne
 * en rond : on corrige, on rebuild, on a tout perdu. Le fichier est indexé par
 * `cleabs` (l'identifiant IGN, stable dans le temps) et n'est jamais réécrit par
 * le build — donc chaque correction est acquise pour de bon.
 *
 * Clés reconnues, toutes optionnelles : `w`, `cls`, `name`, `skip`.
 */
export function applyRoadOverrides(roads, overrides) {
  if (!overrides) return { roads, applied: 0, unknown: [] }

  const seen = new Set()
  const kept = []
  let applied = 0

  for (const road of roads) {
    const patch = overrides[road.id]
    if (!patch) { kept.push(road); continue }

    seen.add(road.id)
    applied++
    if (patch.skip) continue

    if (patch.w > 0) road.w = patch.w
    if (patch.cls) road.cls = patch.cls
    if (patch.name) road.name = patch.name
    kept.push(road)
  }

  // Une correction qui ne trouve plus sa route signale un `cleabs` disparu du
  // millésime IGN : on le dit, sinon la retouche s'évapore en silence.
  const unknown = Object.keys(overrides).filter((id) => !id.startsWith('_') && !seen.has(id))
  return { roads: kept, applied, unknown }
}
