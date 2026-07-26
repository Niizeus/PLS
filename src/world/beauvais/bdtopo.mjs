// @ts-nocheck
/**
 * 🏛️  bdtopo.mjs — les VRAIES hauteurs de bâtiment, depuis l'IGN.
 *
 * Ce module tourne HORS du jeu, appelé par `build-beauvais.mjs`. Il télécharge la
 * couche « bâtiment » de la **BD TOPO** de l'IGN (gratuite, Licence Ouverte, même
 * serveur `data.geopf.fr` que le relief LiDAR) et vient greffer ses attributs sur
 * les contours OpenStreetMap qu'on utilise déjà.
 *
 * Pourquoi ? Parce que ~99 % des bâtiments OSM de Beauvais n'ont AUCUNE hauteur :
 * le pipeline les devinait à partir de la surface au sol. Mesuré sur le centre-ville,
 * cette devinette se trompe de **2,6 m en moyenne**, et de **plus de 3 m sur 35 %**
 * des bâtiments (jusqu'à 37 m d'erreur). La BD TOPO, elle, donne des hauteurs
 * mesurées par photogrammétrie/LiDAR pour 99 % des bâtiments.
 *
 * ⚠️ On ne remplace PAS les contours : on garde ceux d'OSM. C'est volontaire —
 * les routes, les collisions et la minimap sont calées dessus, et les deux jeux de
 * données se recouvrent à 98,7 %. On ne fait qu'ajouter des attributs.
 *
 * Ce qu'on récupère par bâtiment :
 *   - `h`  hauteur de GOUTTIÈRE (sol → bas du toit) — vérifié : c'est bien le sens
 *          du champ `hauteur` de la BD TOPO (écart de 0,035 m avec
 *          `altitude_minimale_toit - altitude_minimale_sol` sur 9 166 bâtiments) ;
 *   - `rh` hauteur du TOIT (gouttière → faîtage) = `altitude_maximale_toit -
 *          altitude_minimale_toit`. C'est ça qui permet de sortir des blocs plats ;
 *   - `rm` matériau de toiture (tuile / ardoise / zinc / béton), pour la couleur.
 *
 * ▶️  Astuce dev : pour ne pas re-télécharger à chaque essai, mets en cache le brut :
 *       BDTOPO_FILE=chemin/vers/bdtopo.json node src/world/beauvais/build-beauvais.mjs
 *     (le fichier est écrit automatiquement au premier passage s'il n'existe pas)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const WFS_URL = 'https://data.geopf.fr/wfs/ows'
const LAYER = 'BDTOPO_V3:batiment'
const PAGE = 5000 // maximum accepté par le serveur en une requête

// ─────────────────────────────────────────────────────────────────────────────
// TÉLÉCHARGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Télécharge tous les bâtiments BD TOPO de la BBOX [sud, ouest, nord, est].
 * Le WFS plafonne à 5 000 objets par requête → on pagine avec STARTINDEX.
 */
export async function fetchBdTopo(bbox) {
  const cache = process.env.BDTOPO_FILE
  if (cache && existsSync(cache)) {
    console.log('📄 BD TOPO : lecture du cache local', cache)
    return JSON.parse(readFileSync(cache, 'utf8'))
  }

  const features = []
  console.log('🏛️  BD TOPO : téléchargement des bâtiments IGN...')
  for (let start = 0; ; start += PAGE) {
    const url =
      `${WFS_URL}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${LAYER}` +
      `&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&COUNT=${PAGE}&STARTINDEX=${start}` +
      `&BBOX=${bbox.join(',')},urn:ogc:def:crs:EPSG::4326`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`BD TOPO (WFS) a répondu ${res.status} ${res.statusText}`)
    const page = await res.json()
    features.push(...page.features)
    process.stdout.write(`   ${features.length} bâtiments IGN...\r`)
    if (page.features.length < PAGE) break
  }
  console.log(`   ${features.length} bâtiments IGN téléchargés.       `)

  if (cache) {
    writeFileSync(cache, JSON.stringify({ features }))
    console.log('   (mis en cache dans', cache + ')')
  }
  return { features }
}

// ─────────────────────────────────────────────────────────────────────────────
// MATÉRIAU DE TOITURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La BD TOPO reprend la nomenclature MAJIC (fichiers fonciers) : un code à deux
 * chiffres. Vérifié sur le centre de Beauvais : la toiture sort 10 (2 349 objets)
 * puis 20 (753), et les murs sortent 40 en tête (1 658) — deux familles de codes
 * bien distinctes, cohérentes avec une ville picarde en brique sous tuile.
 *
 * On ne garde que les familles franches ; tout le reste retombe sur la tuile,
 * qui est très majoritaire ici. Ça ne sert qu'à COLORER le toit, donc une erreur
 * ponctuelle est sans gravité.
 */
const ROOF_MATERIAL = { 10: 't', 12: 't', 13: 't', 20: 'a', 30: 'z', 40: 'b' }

function roofMaterial(code) {
  if (!code) return undefined
  return ROOF_MATERIAL[parseInt(code, 10)] // undefined = inconnu → tuile par défaut
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEX SPATIAL + JOINTURE
// ─────────────────────────────────────────────────────────────────────────────

const CELL = 50 // côté d'une case de l'index, en mètres

function centroid(pts) {
  let x = 0
  let z = 0
  for (const [px, pz] of pts) {
    x += px
    z += pz
  }
  return [x / pts.length, z / pts.length]
}

/** Aire au sol d'un polygone (m²), par la formule du lacet. */
function polygonArea(pts) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a) / 2
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

/**
 * Range les bâtiments IGN dans une grille pour retrouver vite celui qui contient
 * un point. `project(lat, lon)` est la projection du pipeline (mètres autour de
 * la cathédrale) — on la reçoit en paramètre pour rester sur le même repère.
 */
function indexBdTopo(features, project) {
  const grid = new Map()
  let kept = 0

  for (const f of features) {
    const p = f.properties
    // Sans hauteur exploitable, l'objet ne nous apprend rien : on le jette.
    if (!(p.hauteur > 0)) continue
    // Bâtiments détruits / en projet : ils ne sont pas dans le paysage.
    if (p.etat_de_l_objet && p.etat_de_l_objet !== 'En service') continue

    const coords = f.geometry?.coordinates?.[0]?.[0]
    if (!coords || coords.length < 3) continue
    const ring = coords.map(([lon, lat]) => project(lat, lon))

    // Hauteur de toit = faîtage - gouttière. Absente pour ~12 % des bâtiments.
    let rh
    if (p.altitude_maximale_toit != null && p.altitude_minimale_toit != null) {
      rh = Math.max(0, p.altitude_maximale_toit - p.altitude_minimale_toit)
    }

    const rec = { ring, h: p.hauteur, rh, rm: roofMaterial(p.materiaux_de_la_toiture) }
    const [cx, cz] = centroid(ring)
    rec.c = [cx, cz]
    const key = Math.floor(cx / CELL) + ':' + Math.floor(cz / CELL)
    let list = grid.get(key)
    if (!list) grid.set(key, (list = []))
    list.push(rec)
    kept++
  }
  return { grid, kept }
}

/** Les bâtiments IGN des 9 cases autour du point (x, z). */
function around(grid, x, z) {
  const out = []
  const cx = Math.floor(x / CELL)
  const cz = Math.floor(z / CELL)
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = grid.get(cx + i + ':' + (cz + j))
      if (list) out.push(...list)
    }
  }
  return out
}

const NEAR_FALLBACK = 8 // rayon (m) du repli quand le centre ne tombe dans rien

/**
 * Garde-fou : la BD TOPO a des trous, et il faut savoir les refuser.
 *
 * Cas d'école, et pas des moindres : **la cathédrale Saint-Pierre**. Elle est bien
 * dans la BD TOPO (4 068 m² au sol, nature « Eglise »)... avec `hauteur = 0,1 m`.
 * Sans garde-fou, le repère central du jeu devient une dalle plate au ras du sol.
 *
 * La règle : un bâtiment de plus de 150 m² au sol ne fait jamais moins de 2 m de
 * haut. Quand la donnée dit ça, elle est fausse — on la refuse et on garde
 * l'estimation d'avant, qui est certes approximative mais jamais absurde.
 */
const MIN_AREA_FOR_CHECK = 150
const IMPLAUSIBLE_HEIGHT = 2

/**
 * Greffe les attributs IGN sur les bâtiments OSM (modifiés sur place).
 *
 * Deux passes, de la plus sûre à la plus tolérante :
 *   1. le centre du bâtiment OSM tombe DANS un polygone IGN (89 % des cas) ;
 *   2. sinon, le polygone IGN dont le centre est à moins de 8 m (10 % de plus).
 * Le reste (~1 %) garde la hauteur estimée d'avant — c'est le filet de sécurité.
 *
 * Renvoie un petit rapport chiffré, affiché par le pipeline.
 */
export function joinBdTopo(buildings, features, project) {
  const { grid, kept } = indexBdTopo(features, project)

  let inside = 0
  let near = 0
  let missed = 0
  let withRoof = 0
  let refused = 0

  for (const b of buildings) {
    // On repart d'une page blanche pour que relancer le script donne toujours le
    // même résultat (et n'accumule pas les attributs d'un ancien passage).
    delete b.rh
    delete b.ra
    delete b.rm
    delete b.bdtopo

    const [x, z] = centroid(b.pts)

    let hit = null
    for (const cand of around(grid, x, z)) {
      if (pointInRing(x, z, cand.ring)) {
        hit = cand
        break
      }
    }
    if (hit) inside++
    else {
      let best = null
      let bestD = NEAR_FALLBACK * NEAR_FALLBACK
      for (const cand of around(grid, x, z)) {
        const d = (cand.c[0] - x) ** 2 + (cand.c[1] - z) ** 2
        if (d < bestD) {
          bestD = d
          best = cand
        }
      }
      if (best) {
        hit = best
        near++
      } else {
        missed++
        continue // on garde la hauteur estimée : b.h n'est pas touché
      }
    }

    // Donnée IGN aberrante (voir le garde-fou plus haut) → on garde l'estimation.
    if (hit.h < IMPLAUSIBLE_HEIGHT && polygonArea(b.pts) > MIN_AREA_FOR_CHECK) {
      refused++
      continue
    }

    // Hauteur de gouttière : le champ `h` garde exactement le même sens qu'avant
    // (sol → haut des murs), donc collisions et minimap ne bougent pas.
    b.h = Math.round(hit.h * 10) / 10
    b.bdtopo = 1 // trace : cette hauteur est mesurée, pas devinée
    if (hit.rh > 0.3) {
      b.rh = Math.round(hit.rh * 10) / 10
      withRoof++
    }
    if (hit.rm) b.rm = hit.rm
  }

  return { kept, inside, near, missed, refused, withRoof, total: buildings.length }
}
