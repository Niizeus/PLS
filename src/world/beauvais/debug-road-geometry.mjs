import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import polygonClipping from 'polygon-clipping'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../..')
const dataPath = path.resolve(__dirname, 'data/beauvais-buildings.json')
const zonesPath = path.resolve(root, 'src/data/zones.json')
const outDir = path.resolve(root, 'public/debug')
const outPath = path.resolve(outDir, 'road-geometry.html')
const surfaceOutPath = path.resolve(__dirname, 'data/road-surface-test.json')

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
const zonesData = JSON.parse(fs.readFileSync(zonesPath, 'utf8'))
const roads = data.roads.filter((road) => road.w > 2.5 && road.pts.length > 1)

const CELL = 32
const EPS = 1e-6
const PANEL = 420
const VIEW_RADIUS = 76
const CENTER_CITY_VIEW_RADIUS = 620
const SURFACE_TILE = 180
const SURFACE_SEGMENT_STEP = 38
const MAX_PANELS = 8
const NODE_RADIUS = 3.5
const MIN_SEGMENT = 1.5
const SIMPLIFY_EPS = 0.55
const ROUND_STEPS = 5

const TARGET_GROUPS = [
  ['centre commercial', 'commercial'],
  ['marechal leclerc'],
  ['leclerc'],
]

const keyOf = (cx, cz) => cx + ':' + cz
const tileKeyOf = (x, z) => keyOf(Math.floor(x / SURFACE_TILE), Math.floor(z / SURFACE_TILE))
const clean = (value) => String(value ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
const length = (x, z) => Math.hypot(x, z) || 1
const roadName = (road) => road.name || road.ref || road.highway || 'route'
const roadText = (road) => [road.name, road.ref, road.highway, road.service].filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const segments = []
const roadPoints = []
const grid = new Map()
const pointGrid = new Map()

function addPointToGrid(point) {
  const key = keyOf(Math.floor(point.x / CELL), Math.floor(point.z / CELL))
  let list = pointGrid.get(key)
  if (!list) pointGrid.set(key, (list = []))
  list.push(point.id)
}

function addToGrid(seg) {
  const pad = Math.max(seg.w, 8)
  const cx0 = Math.floor((Math.min(seg.ax, seg.bx) - pad) / CELL)
  const cx1 = Math.floor((Math.max(seg.ax, seg.bx) + pad) / CELL)
  const cz0 = Math.floor((Math.min(seg.az, seg.bz) - pad) / CELL)
  const cz1 = Math.floor((Math.max(seg.az, seg.bz) + pad) / CELL)
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const key = keyOf(cx, cz)
      let list = grid.get(key)
      if (!list) grid.set(key, (list = []))
      list.push(seg.id)
    }
  }
}

for (let roadIndex = 0; roadIndex < roads.length; roadIndex++) {
  const road = roads[roadIndex]

  for (let i = 0; i < road.pts.length; i++) {
    const [x, z] = road.pts[i]
    const prev = road.pts[Math.max(0, i - 1)]
    const next = road.pts[Math.min(road.pts.length - 1, i + 1)]
    const dx = next[0] - prev[0]
    const dz = next[1] - prev[1]
    const len = length(dx, dz)
    const point = {
      id: roadPoints.length,
      roadIndex,
      road,
      x,
      z,
      ux: dx / len,
      uz: dz / len,
      w: Math.max(3, road.w ?? 3),
    }
    roadPoints.push(point)
    addPointToGrid(point)
  }

  for (let i = 0; i < road.pts.length - 1; i++) {
    const [rawAx, rawAz] = road.pts[i]
    const [rawBx, rawBz] = road.pts[i + 1]
    const rawDx = rawBx - rawAx
    const rawDz = rawBz - rawAz
    const rawLen = length(rawDx, rawDz)
    if (rawLen < MIN_SEGMENT) continue

    const parts = Math.max(1, Math.ceil(rawLen / SURFACE_SEGMENT_STEP))
    for (let part = 0; part < parts; part++) {
      const t0 = part / parts
      const t1 = (part + 1) / parts
      const ax = rawAx + rawDx * t0
      const az = rawAz + rawDz * t0
      const bx = rawAx + rawDx * t1
      const bz = rawAz + rawDz * t1
      const dx = bx - ax
      const dz = bz - az
      const len = length(dx, dz)
      if (len < MIN_SEGMENT) continue
      const seg = {
        id: segments.length,
        roadIndex,
        road,
        ax,
        az,
        bx,
        bz,
        dx,
        dz,
        len,
        ux: dx / len,
        uz: dz / len,
        w: Math.max(3, road.w ?? 3),
      }
      segments.push(seg)
      addToGrid(seg)
    }
  }
}

function segmentIntersection(a, b) {
  const cross = a.dx * b.dz - a.dz * b.dx
  if (Math.abs(cross) < EPS) return null
  const qx = b.ax - a.ax
  const qz = b.az - a.az
  const t = (qx * b.dz - qz * b.dx) / cross
  const u = (qx * a.dz - qz * a.dx) / cross
  if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null
  return { x: a.ax + a.dx * t, z: a.az + a.dz * t, t, u }
}

const candidates = []
const seenPairs = new Set()
for (const ids of grid.values()) {
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = segments[ids[i]]
      const b = segments[ids[j]]
      if (!a || !b || a.roadIndex === b.roadIndex) continue
      const pair = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id
      if (seenPairs.has(pair)) continue
      seenPairs.add(pair)

      const dot = Math.abs(a.ux * b.ux + a.uz * b.uz)
      if (dot > 0.9) continue
      const hit = segmentIntersection(a, b)
      if (!hit) continue
      candidates.push({ ...hit, a, b, angle: Math.acos(Math.min(1, Math.max(-1, dot))), type: 'crossing' })
    }
  }
}

const seenNodePairs = new Set()
for (const point of roadPoints) {
  const cx = Math.floor(point.x / CELL)
  const cz = Math.floor(point.z / CELL)
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gz = cz - 1; gz <= cz + 1; gz++) {
      const ids = pointGrid.get(keyOf(gx, gz))
      if (!ids) continue
      for (const id of ids) {
        const other = roadPoints[id]
        if (!other || other.id <= point.id || other.roadIndex === point.roadIndex) continue
        const pair = point.id + ':' + other.id
        if (seenNodePairs.has(pair)) continue
        seenNodePairs.add(pair)
        const d = Math.hypot(point.x - other.x, point.z - other.z)
        if (d > NODE_RADIUS) continue
        const dot = Math.abs(point.ux * other.ux + point.uz * other.uz)
        if (dot > 0.94) continue
        candidates.push({
          x: (point.x + other.x) * 0.5,
          z: (point.z + other.z) * 0.5,
          a: point,
          b: other,
          angle: Math.acos(Math.min(1, Math.max(-1, dot))),
          type: 'node',
        })
      }
    }
  }
}

function addCandidateToCluster(clusters, candidate) {
  let best = null
  let bestDist = Infinity
  for (const cluster of clusters) {
    const d = Math.hypot(candidate.x - cluster.x, candidate.z - cluster.z)
    if (d < 18 && d < bestDist) {
      best = cluster
      bestDist = d
    }
  }
  if (!best) {
    clusters.push({ x: candidate.x, z: candidate.z, candidates: [candidate] })
    return
  }
  const n = best.candidates.length
  best.x = (best.x * n + candidate.x) / (n + 1)
  best.z = (best.z * n + candidate.z) / (n + 1)
  best.candidates.push(candidate)
}

const clusters = []
for (const candidate of candidates) addCandidateToCluster(clusters, candidate)

function scoreCluster(cluster) {
  const roadIds = new Set()
  const names = new Set()
  let maxW = 0
  for (const candidate of cluster.candidates) {
    roadIds.add(candidate.a.road.id ?? candidate.a.roadIndex)
    roadIds.add(candidate.b.road.id ?? candidate.b.roadIndex)
    if (candidate.a.road.name) names.add(candidate.a.road.name)
    if (candidate.b.road.name) names.add(candidate.b.road.name)
    maxW = Math.max(maxW, candidate.a.w, candidate.b.w)
  }
  return cluster.candidates.length * 2 + roadIds.size * 3 + names.size + maxW * 0.3
}

function visibleSegments(center, radius = VIEW_RADIUS) {
  return segments.filter((seg) => {
    const mx = (seg.ax + seg.bx) * 0.5
    const mz = (seg.az + seg.bz) * 0.5
    const nearMid = Math.hypot(mx - center.x, mz - center.z) <= radius + seg.w
    const nearA = Math.hypot(seg.ax - center.x, seg.az - center.z) <= radius + seg.w
    const nearB = Math.hypot(seg.bx - center.x, seg.bz - center.z) <= radius + seg.w
    return nearMid || nearA || nearB
  })
}

function polygonCenter(pts) {
  const x = pts.reduce((sum, p) => sum + p[0], 0) / pts.length
  const z = pts.reduce((sum, p) => sum + p[1], 0) / pts.length
  return { x, z }
}

function targetCenter() {
  const zone = zonesData.zones.find((candidate) => candidate.id === 'centre-ville')
  if (zone) {
    const center = polygonCenter(zone.pts)
    return {
      ...center,
      title: 'Centre-ville complet',
      mask: zone.pts,
      radius: CENTER_CITY_VIEW_RADIUS,
    }
  }

  return { x: 0, z: 0, title: 'Centre-ville approx', radius: CENTER_CITY_VIEW_RADIUS }
}

const target = targetCenter()
const selected = []
if (target) selected.push({ ...target, candidates: candidates.filter((candidate) => Math.hypot(candidate.x - target.x, candidate.z - target.z) < VIEW_RADIUS) })
for (const cluster of clusters
  .filter((cluster) => cluster.candidates.length >= 1)
  .sort((a, b) => scoreCluster(b) - scoreCluster(a))) {
  if (selected.some((other) => Math.hypot(cluster.x - other.x, cluster.z - other.z) < 130)) continue
  selected.push(cluster)
  if (selected.length >= MAX_PANELS) break
}

function segmentCapsule(seg, extra = 0) {
  const half = seg.w / 2 + extra
  const nx = -seg.uz
  const nz = seg.ux
  const theta = Math.atan2(seg.uz, seg.ux)
  const ring = [
    [seg.ax + nx * half, seg.az + nz * half],
    [seg.bx + nx * half, seg.bz + nz * half],
  ]

  for (let i = 1; i <= ROUND_STEPS; i++) {
    const a = theta + Math.PI / 2 - (i / ROUND_STEPS) * Math.PI
    ring.push([seg.bx + Math.cos(a) * half, seg.bz + Math.sin(a) * half])
  }

  ring.push([seg.ax - nx * half, seg.az - nz * half])

  for (let i = 1; i <= ROUND_STEPS; i++) {
    const a = theta - Math.PI / 2 - (i / ROUND_STEPS) * Math.PI
    ring.push([seg.ax + Math.cos(a) * half, seg.az + Math.sin(a) * half])
  }

  return [ring]
}

function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz || 1
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2
  t = Math.max(0, Math.min(1, t))
  const x = a[0] + dx * t
  const z = a[1] + dz * t
  return Math.hypot(p[0] - x, p[1] - z)
}

function simplifyRing(points, epsilon = SIMPLIFY_EPS) {
  if (points.length <= 4) return points
  const closed = points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]
  const src = closed ? points.slice(0, -1) : points.slice()
  const keep = new Array(src.length).fill(false)
  keep[0] = true
  keep[src.length - 1] = true

  const stack = [[0, src.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()
    let maxDist = 0
    let index = -1
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(src[i], src[start], src[end])
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }
    if (index !== -1 && maxDist > epsilon) {
      keep[index] = true
      stack.push([start, index], [index, end])
    }
  }
  const out = src.filter((_, i) => keep[i])
  if (closed) out.push(out[0])
  return out
}

function polygonArea(ring) {
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    area += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(area) / 2
}


function pointInRing(x, z, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const zi = ring[i][1]
    const xj = ring[j][0]
    const zj = ring[j][1]
    const crosses = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function segmentTouchesMask(seg, mask) {
  if (!mask) return true
  const samples = 8
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const x = seg.ax + seg.dx * t
    const z = seg.az + seg.dz * t
    if (pointInRing(x, z, mask)) return true
  }
  return false
}


function safeUnionMany(polygons, label = 'surface') {
  if (polygons.length === 0) return []
  try {
    return polygonClipping.union(...polygons)
  } catch (error) {
    if (polygons.length === 1) {
      console.warn('[debug:roads] union fallback single ' + label + ': ' + error.message)
      return [polygons[0]]
    }

    const mid = Math.floor(polygons.length / 2)
    const left = safeUnionMany(polygons.slice(0, mid), label + '/L')
    const right = safeUnionMany(polygons.slice(mid), label + '/R')
    try {
      return polygonClipping.union(...left, ...right)
    } catch (mergeError) {
      console.warn('[debug:roads] union fallback split ' + label + ': ' + mergeError.message)
      return [...left, ...right]
    }
  }
}

function drivableSurfaceSegment(seg) {
  const text = roadText(seg.road)
  if (text.includes('footway') || text.includes('path') || text.includes('steps')) return false
  return true
}

/**
 * Débord du bitume au-delà de la demi-chaussée, en mètres.
 *
 * ⚠️ Cette valeur est le JOINT entre la dalle de bitume et le trottoir : le
 * trottoir est fabriqué en RETIRANT exactement ce polygone-là. Les deux partagent
 * donc la même arête au micromètre près — ni jour, ni recouvrement, ni z-fighting.
 * Si tu la changes, les deux bougent ensemble. Ne la duplique pas.
 */
const ROAD_PAD = 0.15

function mergeSegmentSurface(local, label, extra = ROAD_PAD) {
  const polygons = local.map((seg) => segmentCapsule(seg, extra))
  const mergedChunks = []
  for (let i = 0; i < polygons.length; i += 36) {
    const chunk = polygons.slice(i, i + 36)
    if (chunk.length === 0) continue
    mergedChunks.push(...safeUnionMany(chunk, label + '/chunk-' + i))
  }
  const union = safeUnionMany(mergedChunks, label + '/final')
  return union.map((poly) => poly.map((ring) => simplifyRing(ring)))
}

function mergedSurface(center) {
  const radius = center.radius ?? VIEW_RADIUS
  const local = visibleSegments(center, radius).filter((seg) => {
    if (!segmentTouchesMask(seg, center.mask)) return false
    return drivableSurfaceSegment(seg)
  })
  return { local, polygons: mergeSegmentSurface(local, 'preview') }
}

/** Range les segments de chaussée par tuile, d'après leur milieu. */
function bucketSegmentsByTile() {
  const buckets = new Map()
  for (const seg of segments) {
    if (!drivableSurfaceSegment(seg)) continue
    const key = tileKeyOf((seg.ax + seg.bx) * 0.5, (seg.az + seg.bz) * 0.5)
    let list = buckets.get(key)
    if (!list) buckets.set(key, (list = []))
    list.push(seg)
  }
  return buckets
}

/**
 * Arrondit et nettoie un multipolygone avant de l'écrire dans le JSON.
 *
 * `digits` est un compromis de POIDS : ce fichier part dans le bundle du jeu. Le
 * centimètre (2 décimales) est déjà en dessous de ce qu'on peut voir sur un
 * trottoir, et il économise ~15 % du fichier par rapport au millimètre.
 */
function tidyPolygons(multi, minArea = 4, digits = 3, eps = SIMPLIFY_EPS) {
  return multi
    .map((poly) =>
      poly
        .map((ring) =>
          simplifyRing(ring, eps).map(([x, z]) => [
            Number(x.toFixed(digits)),
            Number(z.toFixed(digits)),
          ]),
        )
        .filter((ring) => ring.length >= 3 && polygonArea(ring) >= minArea),
    )
    .filter((poly) => poly.length > 0)
}

function buildSurfaceTiles(buckets) {
  const tiles = {}
  /**
   * Les contours de bitume TELS QU'ILS SERONT AFFICHÉS — c'est d'eux qu'on
   * soustrait le trottoir.
   *
   * ⚠️ Surtout pas l'union avant nettoyage. Le trottoir est le complément du
   * bitume : si on le découpe sur un contour puis qu'on en dessine un autre,
   * légèrement simplifié, les deux ne coïncident plus et le trottoir déborde dans
   * la rue. Mesuré sur la version qui soustrayait l'union brute : 0,6 % des points
   * de trottoir tombaient sur le bitume.
   */
  const drawn = new Map()
  const entries = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
  let surfaceSegmentCount = 0
  for (const [key, local] of entries) {
    const polygons = tidyPolygons(mergeSegmentSurface(local, 'tile-' + key))
    if (polygons.length === 0) continue
    drawn.set(key, polygons)
    tiles[key] = { polygons }
    surfaceSegmentCount += local.length
  }

  return { tiles, drawn, surfaceSegmentCount }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚶 LES TROTTOIRS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un trottoir est une propriété du RÉSEAU, pas d'une rue prise isolément.
 *
 * ── Ce qui ne marchait pas ──────────────────────────────────────────────────
 * La version précédente extrudait un ruban à 7 bandes par rue, trottoir compris.
 * Deux rues qui se croisent produisaient donc deux rubans qui se chevauchent, et
 * le seul moyen de s'en sortir était de SUPPRIMER le trottoir dans les carrefours.
 * Résultat en jeu : un trou à chaque intersection, des planches grises qui
 * s'arrêtent en l'air, et deux voies voisines qui ne tombaient pas d'accord sur
 * l'emplacement du bord.
 *
 * ── La méthode ──────────────────────────────────────────────────────────────
 * On ne dessine plus le trottoir : on le DÉDUIT, par une soustraction.
 *
 *     trottoir = (réseau élargi de la largeur du trottoir)
 *                − (la chaussée)
 *                − (les emprises des bâtiments)
 *
 * Les trois termes sont des polygones fusionnés, donc :
 *  - les carrefours sont justes PAR CONSTRUCTION — l'union de deux rues élargies
 *    couvre le coin, et la soustraction de la chaussée ouvre le passage. Il n'y a
 *    plus de cas particulier « carrefour » à écrire, donc plus de trou ;
 *  - deux rues voisines partagent forcément le même bord, puisqu'il n'y a qu'un
 *    seul polygone ;
 *  - le trottoir s'arrête NET au pied des murs, au lieu d'y rentrer.
 *
 * ⚠️ La contrepartie physique vit dans `roadway.ts` (`roadwayHeightAt`). Elle
 * exprime exactement la même règle, mais en requête de distance : au-delà de la
 * dalle de bitume et en deçà de `half + KERB_W + walkTarget(half)`, on est sur le
 * trottoir. Les deux DOIVENT rester d'accord — sinon on marche dans le vide. Les
 * constantes ci-dessous sont donc le miroir de `ROADWAY` ; toute modification se
 * fait des deux côtés, dans le même commit.
 */
const WALK_KERB_W = 0.35 // ROADWAY.KERB_W
const WALK_TARGET_RATIO = 0.7 // ROADWAY.WALK_TARGET_RATIO
const WALK_TARGET_MIN = 1.2 // ROADWAY.WALK_TARGET_MIN
const WALK_TARGET_MAX = 3 // ROADWAY.WALK_TARGET_MAX

/** Largeur de trottoir voulue pour une voie : une avenue en mérite un vrai, pas une ruelle. */
function walkTarget(half) {
  const wanted = half * WALK_TARGET_RATIO
  if (wanted < WALK_TARGET_MIN) return WALK_TARGET_MIN
  if (wanted > WALK_TARGET_MAX) return WALK_TARGET_MAX
  return wanted
}

/** Bord extérieur du trottoir — miroir de `walkOuterReach()` dans `roadway.ts`. */
function walkOuterReach(half) {
  return half + WALK_KERB_W + walkTarget(half)
}

// ── Les deux vetos ───────────────────────────────────────────────────────────
//
// Un trottoir « géométriquement possible » n'est pas pour autant un trottoir
// réel. Deux situations produisaient des rubans gris absurdes, et toutes deux se
// règlent en INTERDISANT un côté plutôt qu'en rabotant une largeur.

/**
 * Veto n°1 — **entre deux voies parallèles proches, jamais de trottoir.**
 *
 * Le trottoir est le complément du bitume : le terre-plein qui sépare les deux
 * chaussées d'un boulevard n'est pas du bitume, il devenait donc du trottoir. On
 * se retrouvait avec une bande grise en plein milieu de la route. C'est le défaut
 * le plus visible du premier jet — 20 % des segments de Beauvais ont une voie
 * parallèle à moins de 8 m, écart médian 3 m.
 *
 * Seuil : on interdit tant que l'écart entre les deux bitumes est plus petit que
 * ce que les deux trottoirs occuperaient. En dessous, il n'y a pas de place pour
 * un trottoir de chaque côté — donc ce n'en est pas un, c'est un terre-plein.
 */
const PARALLEL_DOT = 0.9 // |cos| au-delà duquel deux voies sont « parallèles »
const PARALLEL_VETO_MARGIN = 1.0

/**
 * Veto n°2 — **pas de bâti, pas de trottoir.**
 *
 * Une route de campagne, une bretelle, un chemin d'exploitation n'ont pas de
 * trottoir. La géométrie seule ne peut pas le savoir : pour elle, une départementale
 * au milieu des champs ressemble à une rue. Le signal qui fait la différence est le
 * BÂTI — un trottoir existe là où il y a des portes à desservir.
 *
 * ⚠️ Le critère porte sur la RUE, pas sur le côté. Compter les bâtiments côté par
 * côté paraissait plus fin, mais c'est faux dans la ville réelle : une rue bâtie qui
 * longe un parc, une place, une rivière ou un parking a bien un trottoir du côté
 * dégagé. Mesuré au centre-ville, le critère par côté supprimait le trottoir de
 * **40 %** des côtés de rue — beaucoup trop.
 *
 * Réglage retenu : 4 bâtiments distincts dans 25 m d'un segment (≤ 38 m de long).
 * C'est le meilleur contraste mesuré entre le centre-ville (70,6 % des côtés
 * équipés) et la commune entière (29,2 %), qui est pleine de routes rurales et de
 * zones d'activité. Une ferme et ses dépendances atteignent rarement quatre.
 */
const URBAN_PROBE = 25
const URBAN_MIN_BUILDINGS = 4

/** Les chemins de terre n'ont pas de trottoir, quelle que soit la densité autour. */
function walkableStreet(seg) {
  return seg.road.cls !== 'track'
}

// ── Grilles de recherche, construites une fois ───────────────────────────────

const PROBE_CELL = 32
const probeKey = (x, z) => Math.floor(x / PROBE_CELL) + ':' + Math.floor(z / PROBE_CELL)

function buildProbeGrid(items, boundsOf, pad) {
  const map = new Map()
  items.forEach((item, index) => {
    const [x0, z0, x1, z1] = boundsOf(item)
    for (let cx = Math.floor((x0 - pad) / PROBE_CELL); cx <= Math.floor((x1 + pad) / PROBE_CELL); cx++) {
      for (let cz = Math.floor((z0 - pad) / PROBE_CELL); cz <= Math.floor((z1 + pad) / PROBE_CELL); cz++) {
        const key = cx + ':' + cz
        let list = map.get(key)
        if (!list) map.set(key, (list = []))
        list.push(index)
      }
    }
  })
  return map
}

function queryProbeGrid(map, x0, z0, x1, z1) {
  const out = new Set()
  for (let cx = Math.floor(x0 / PROBE_CELL); cx <= Math.floor(x1 / PROBE_CELL); cx++) {
    for (let cz = Math.floor(z0 / PROBE_CELL); cz <= Math.floor(z1 / PROBE_CELL); cz++) {
      for (const i of map.get(cx + ':' + cz) ?? []) out.add(i)
    }
  }
  return out
}

const segBounds = (s) => [
  Math.min(s.ax, s.bx),
  Math.min(s.az, s.bz),
  Math.max(s.ax, s.bx),
  Math.max(s.az, s.bz),
]

let segProbeGrid = null
let buildingPoints = null
let buildingProbeGrid = null

function ensureProbeGrids() {
  if (segProbeGrid) return
  segProbeGrid = buildProbeGrid(segments, segBounds, 24)

  // Un point par sommet de bâtiment, étiqueté par bâtiment : il suffit de savoir
  // COMBIEN de bâtiments distincts bordent un côté, pas où précisément.
  buildingPoints = []
  data.buildings.forEach((b, id) => {
    if (!b.pts || b.pts.length < 3) return
    for (const [x, z] of b.pts) buildingPoints.push({ x, z, id })
  })
  buildingProbeGrid = buildProbeGrid(buildingPoints, (p) => [p.x, p.z, p.x, p.z], 0)
}

/**
 * Les deux côtés d'un segment sont-ils autorisés à porter un trottoir ?
 *
 * Renvoie `[gauche, droite]`, « gauche » étant le côté de la normale (−uz, ux).
 */
function walkSidesAllowed(seg) {
  ensureProbeGrids()
  const nx = -seg.uz
  const nz = seg.ux
  const mx = (seg.ax + seg.bx) * 0.5
  const mz = (seg.az + seg.bz) * 0.5
  const half = seg.w / 2

  if (!walkableStreet(seg)) return [false, false]

  // ── Veto n°1 : voie parallèle proche.
  const vetoParallel = [false, false]
  const reach = walkOuterReach(half) + PARALLEL_VETO_MARGIN
  const [sx0, sz0, sx1, sz1] = segBounds(seg)
  for (const j of queryProbeGrid(segProbeGrid, sx0 - 24, sz0 - 24, sx1 + 24, sz1 + 24)) {
    const other = segments[j]
    if (other.roadIndex === seg.roadIndex) continue
    if (Math.abs(seg.ux * other.ux + seg.uz * other.uz) < PARALLEL_DOT) continue

    const ox = (other.ax + other.bx) * 0.5
    const oz = (other.az + other.bz) * 0.5
    // Les deux voies doivent réellement se longer, pas seulement se croiser au loin.
    const along = (ox - mx) * seg.ux + (oz - mz) * seg.uz
    if (Math.abs(along) > seg.len / 2 + other.len / 2) continue

    const perp = (ox - mx) * nx + (oz - mz) * nz
    const otherHalf = other.w / 2
    const gap = Math.abs(perp) - half - otherHalf

    /**
     * ⚠️ Écarter les tronçons COLINÉAIRES, qui ne sont pas des voies parallèles.
     *
     * L'IGN découpe une rue en tronçons successifs, chacun avec son propre index de
     * route. Deux tronçons qui se suivent sont donc « une autre route », colinéaire
     * (|cos| ≈ 1) et à écart négatif — le veto les prenait pour un boulevard à deux
     * chaussées et supprimait le trottoir des DEUX côtés de la rue. Mesuré avant
     * correction : **54,5 % des déclenchements du veto au centre-ville** étaient ce
     * faux positif, et le centre tombait à 46,7 % de côtés équipés.
     *
     * Un vrai couple de chaussées parallèles est décalé LATÉRALEMENT ; une
     * continuation ne l'est pas. Il suffit donc d'exiger que les deux axes soient
     * réellement à côté l'un de l'autre.
     */
    if (gap <= -Math.min(half, otherHalf)) continue
    /**
     * Le seuil : la place que prendraient les DEUX trottoirs, plus une marge.
     *
     * ⚠️ On compare des largeurs de trottoir, pas des portées depuis l'axe —
     * `walkOuterReach()` inclut la demi-chaussée, qu'il faut retirer ici. Avec elle,
     * le seuil montait à 7,7 m pour deux rues de 5 m au lieu de 5,2, et le veto
     * supprimait des trottoirs parfaitement légitimes de part et d'autre d'une rue
     * voisine.
     *
     * En dessous du seuil, il n'y a pas la place pour un trottoir de chaque côté :
     * ce n'est pas un trottoir, c'est un terre-plein.
     */
    const seuil = reach - half + (walkOuterReach(otherHalf) - otherHalf)
    if (gap >= seuil) continue
    vetoParallel[perp >= 0 ? 0 : 1] = true
  }

  // ── Veto n°2 : la rue est-elle bâtie ? (les deux côtés confondus, voir plus haut)
  const built = new Set()
  const pad = URBAN_PROBE
  for (const j of queryProbeGrid(buildingProbeGrid, sx0 - pad, sz0 - pad, sx1 + pad, sz1 + pad)) {
    const p = buildingPoints[j]
    const dx = p.x - seg.ax
    const dz = p.z - seg.az
    const along = dx * seg.ux + dz * seg.uz
    if (along < -URBAN_PROBE || along > seg.len + URBAN_PROBE) continue
    if (Math.abs(dx * nx + dz * nz) > URBAN_PROBE) continue
    built.add(p.id)
    if (built.size >= URBAN_MIN_BUILDINGS) break
  }
  if (built.size < URBAN_MIN_BUILDINGS) return [false, false]

  return [!vetoParallel[0], !vetoParallel[1]]
}

/**
 * Le quadrilatère à RETIRER quand un côté n'a pas droit au trottoir.
 *
 * Volontairement borné au bord extérieur du trottoir : un veto qui s'étendrait
 * loin sur le côté raboterait aussi le trottoir des rues perpendiculaires qui
 * débouchent ici.
 */
function sideVetoQuad(seg, side) {
  const nx = -seg.uz * side
  const nz = seg.ux * side
  const half = seg.w / 2
  const out = walkOuterReach(half) + 0.2
  // Léger débord en longueur, sinon un cheveu de trottoir subsiste au raccord
  // entre deux segments consécutifs qui portent le même veto.
  const ex = seg.ux * 0.3
  const ez = seg.uz * 0.3
  const ring = [
    [seg.ax + nx * half - ex, seg.az + nz * half - ez],
    [seg.bx + nx * half + ex, seg.bz + nz * half + ez],
    [seg.bx + nx * out + ex, seg.bz + nz * out + ez],
    [seg.ax + nx * out - ex, seg.az + nz * out - ez],
  ]
  ring.push([ring[0][0], ring[0][1]])
  return [ring]
}

/** Emprises des bâtiments rangées par tuile, pour ne soustraire que le voisinage utile. */
function bucketBuildingsByTile() {
  const buckets = new Map()
  for (const b of data.buildings) {
    const pts = b.pts
    if (!pts || pts.length < 3) continue
    let cx = 0
    let cz = 0
    for (const [x, z] of pts) {
      cx += x
      cz += z
    }
    cx /= pts.length
    cz /= pts.length
    const ring = pts.map(([x, z]) => [x, z])
    // polygon-clipping veut des anneaux fermés.
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push([ring[0][0], ring[0][1]])
    }
    const key = tileKeyOf(cx, cz)
    let list = buckets.get(key)
    if (!list) buckets.set(key, (list = []))
    list.push([ring])
  }
  return buckets
}

/** Les valeurs des 9 tuiles autour de `key` (la tuile elle-même comprise), aplaties. */
function neighbourhood(map, key) {
  const [tx, tz] = key.split(':').map(Number)
  const out = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const value = map.get(tx + dx + ':' + (tz + dz))
      if (value) out.push(...value)
    }
  }
  return out
}

/**
 * Ramène tous les sommets sur une grille du millimètre.
 *
 * ⚠️ Ce n'est pas de la cosmétique, c'est ce qui fait TENIR la soustraction.
 * `polygon-clipping` travaille en flottants et échoue (« Unable to complete output
 * ring ») quand deux sommets sont séparés de 1e-13 — exactement ce que produit
 * l'union de capsules dont les arrondis se touchent presque. En quantifiant entre
 * chaque opération, ces sommets fusionnent et la topologie redevient saine.
 */
function quantize(multi, precision = 1000) {
  const snap = (v) => Math.round(v * precision) / precision
  const out = []
  for (const poly of multi) {
    const rings = []
    for (const ring of poly) {
      const snapped = []
      for (const [x, z] of ring) {
        const p = [snap(x), snap(z)]
        const last = snapped[snapped.length - 1]
        if (last && last[0] === p[0] && last[1] === p[1]) continue // doublon né de l'arrondi
        snapped.push(p)
      }
      if (snapped.length >= 3) rings.push(snapped)
    }
    if (rings.length > 0) out.push(rings)
  }
  return out
}

/**
 * Soustraction tolérante aux pannes.
 *
 * `polygon-clipping` lève sur certaines configurations dégénérées (anneau
 * auto-intersecté d'un bâtiment OSM, sommets confondus). Sur 1 953 tuiles ça
 * arrive ; laisser planter le build entier pour un bâtiment tordu serait absurde.
 * On retombe donc sur une soustraction terme à terme, et on saute le fautif.
 */
let differenceFailures = 0

function safeDifference(subject, clips, label) {
  if (subject.length === 0 || clips.length === 0) return subject
  const clean = quantize(clips)
  try {
    return quantize(polygonClipping.difference(quantize(subject), ...clean))
  } catch {
    // Un seul contour tordu ne doit pas faire perdre toute la tuile : on retire les
    // autres un par un et on saute le fautif.
    let current = quantize(subject)
    for (const clip of clean) {
      if (current.length === 0) break
      try {
        current = quantize(polygonClipping.difference(current, clip))
      } catch {
        // Deuxième chance au centimètre : l'échec vient presque toujours de
        // sommets trop proches, et une grille plus grossière les fusionne.
        try {
          current = quantize(polygonClipping.difference(quantize(current, 100), quantize([clip], 100)))
        } catch (error) {
          differenceFailures++
          if (differenceFailures <= 5) {
            console.warn('[debug:roads] difference ignoree ' + label + ': ' + error.message)
          }
        }
      }
    }
    return current
  }
}

function buildWalkTiles(segmentBuckets, roadUnions, centreOf) {
  const buildingBuckets = bucketBuildingsByTile()
  const tiles = {}
  const entries = [...segmentBuckets.entries()].sort(([a], [b]) => a.localeCompare(b))
  let walkSegmentCount = 0
  let allowedSides = 0
  let totalSides = 0
  let allowedCentre = 0
  let totalCentre = 0

  /**
   * Les vetos, calculés d'abord pour TOUTES les tuiles.
   *
   * Ils doivent être appliqués par voisinage de 9 tuiles, comme la chaussée : le
   * trottoir d'une tuile déborde sur sa voisine, et c'est là que se trouve parfois
   * la voie parallèle qui le disqualifie.
   */
  const vetoTiles = new Map()
  for (const [key, local] of entries) {
    const vetos = []
    for (const seg of local) {
      const [gauche, droite] = walkSidesAllowed(seg)
      if (!gauche) vetos.push(...quantize([sideVetoQuad(seg, 1)]))
      if (!droite) vetos.push(...quantize([sideVetoQuad(seg, -1)]))
      if (gauche) allowedSides++
      if (droite) allowedSides++
      totalSides += 2
      // Statistique séparée pour le CENTRE-VILLE : c'est là qu'un trottoir manquant
      // se remarque, et une moyenne sur toute la commune (pleine de chemins et de
      // routes de campagne) ne dit rien de ce qui se passe en ville.
      if (centreOf && Math.hypot((seg.ax + seg.bx) / 2 - centreOf.x, (seg.az + seg.bz) / 2 - centreOf.z) < 600) {
        if (gauche) allowedCentre++
        if (droite) allowedCentre++
        totalCentre += 2
      }
    }
    if (vetos.length > 0) vetoTiles.set(key, vetos)
  }

  for (const [key, local] of entries) {
    // 1. Le réseau ÉLARGI : chaque voie, plus sa bordure, plus son trottoir.
    // Capsules quantifiées AVANT l'union : deux arrondis de capsules voisines se
    // frôlent à 1e-13 près, et c'est précisément ce qui fait échouer l'union.
    const wide = []
    for (const seg of local) {
      const half = Math.max(1.5, seg.w / 2)
      wide.push(...quantize([segmentCapsule(seg, WALK_KERB_W + walkTarget(half))]))
    }
    let poly = []
    for (let i = 0; i < wide.length; i += 36) {
      const chunk = wide.slice(i, i + 36)
      if (chunk.length === 0) continue
      poly.push(...quantize(safeUnionMany(chunk, 'walk-' + key + '/chunk-' + i)))
    }
    poly = safeUnionMany(poly, 'walk-' + key + '/final')
    if (poly.length === 0) continue

    // 2. Moins la chaussée — celle des 9 tuiles, sinon un trottoir qui déborde sur
    //    la tuile voisine ne serait pas percé par la rue qui s'y trouve.
    poly = safeDifference(poly, neighbourhood(roadUnions, key), 'walk-' + key + '/road')
    if (poly.length === 0) continue

    // 3. Moins les bâtiments : le trottoir s'arrête au pied du mur.
    poly = safeDifference(poly, neighbourhood(buildingBuckets, key), 'walk-' + key + '/build')
    if (poly.length === 0) continue

    // 4. Moins les côtés interdits : terre-plein entre deux voies parallèles,
    //    et bords sans bâti (voir les deux vetos plus haut).
    poly = safeDifference(poly, neighbourhood(vetoTiles, key), 'walk-' + key + '/veto')
    if (poly.length === 0) continue

    /**
     * ⚠️ Simplification quasi nulle (5 cm), là où le bitume tolère 55 cm.
     *
     * Le trottoir est le RÉSULTAT d'une soustraction : son bord intérieur EST le
     * bord du bitume. Le simplifier à 55 cm déplace ce bord d'autant, et il repasse
     * par-dessus la chaussée — mesuré : 2,3 % des points de trottoir retombaient
     * sur le bitume, soit un débord de bordure jusqu'à un demi-mètre dans la rue.
     * Les contours entrants sont déjà simplifiés, il ne reste ici qu'à retirer les
     * sommets rigoureusement alignés.
     *
     * Le seuil d'aire, lui, est plus HAUT que pour le bitume : la soustraction
     * laisse des échardes de quelques centimètres carrés le long des murs, qui ne
     * produiraient que du z-fighting.
     */
    const polygons = tidyPolygons(poly, 0.8, 2, 0.05)
    if (polygons.length === 0) continue
    tiles[key] = { polygons }
    walkSegmentCount += local.length
  }

  return { tiles, walkSegmentCount, allowedSides, totalSides, allowedCentre, totalCentre }
}

function makePaths(polygons, tx, ty) {
  const paths = []
  for (const poly of polygons) {
    for (const ring of poly) {
      if (ring.length < 3 || polygonArea(ring) < 4) continue
      const d = ring.map((p, i) => (i === 0 ? 'M ' : 'L ') + tx(p[0]).toFixed(1) + ' ' + ty(p[1]).toFixed(1)).join(' ') + ' Z'
      paths.push('<path class="surface" d="' + d + '" />')
    }
  }
  return paths.join('\n')
}

function makeLinePreview(local, tx, ty, scale) {
  return local
    .map((seg) => {
      const x1 = tx(seg.ax).toFixed(1)
      const y1 = ty(seg.az).toFixed(1)
      const x2 = tx(seg.bx).toFixed(1)
      const y2 = ty(seg.bz).toFixed(1)
      const outer = ((seg.w + 1.0) * scale).toFixed(1)
      const inner = (seg.w * scale).toFixed(1)
      const name = clean(roadName(seg.road))
      return '<line class="edge" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke-width="' + outer + '"><title>' + name + '</title></line><line class="asphalt" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke-width="' + inner + '"><title>' + name + '</title></line>'
    })
    .join('\n')
}

function panelNames(local) {
  const names = new Set()
  for (const seg of local) if (seg.road.name) names.add(clean(seg.road.name))
  return [...names].slice(0, 5).join(', ') || 'routes sans nom'
}

function makePanel(center, index) {
  const radius = center.radius ?? VIEW_RADIUS
  const scale = PANEL / (radius * 2)
  const tx = (x) => (x - center.x) * scale + PANEL / 2
  const ty = (z) => (z - center.z) * scale + PANEL / 2
  const surface = mergedSurface(center)
  const local = surface.local
  const linePreview = makeLinePreview(local, tx, ty, scale)
  const surfacePaths = makePaths(surface.polygons, tx, ty)
  const hits = (center.candidates ?? [])
    .map((hit) => '<circle class="hit" cx="' + tx(hit.x).toFixed(1) + '" cy="' + ty(hit.z).toFixed(1) + '" r="3.4" />')
    .join('\n')
  const surfaceCount = surface.polygons.reduce((sum, poly) => sum + poly.length, 0)
  const title = clean(center.title || panelNames(local))
  return '<article class="panel">\n' +
    '  <header><b>#' + (index + 1) + '</b><span>' + title + '</span></header>\n' +
    '  <div class="views">\n' +
    '    <figure><figcaption>Rubans actuels</figcaption><svg viewBox="0 0 ' + PANEL + ' ' + PANEL + '"><rect width="' + PANEL + '" height="' + PANEL + '" fill="#8f9a70" /><g>' + linePreview + '</g><circle class="center" cx="' + PANEL / 2 + '" cy="' + PANEL / 2 + '" r="6" /><g>' + hits + '</g></svg></figure>\n' +
    '    <figure><figcaption>Surface fusionnee V2</figcaption><svg viewBox="0 0 ' + PANEL + ' ' + PANEL + '"><rect width="' + PANEL + '" height="' + PANEL + '" fill="#8f9a70" /><g>' + surfacePaths + '</g><circle class="center" cx="' + PANEL / 2 + '" cy="' + PANEL / 2 + '" r="6" /><g>' + hits + '</g></svg></figure>\n' +
    '  </div>\n' +
    '  <footer>' + local.length + ' segments locaux - ' + surfaceCount + ' contours fusionnes - ' + (center.candidates?.length ?? 0) + ' noeuds/croisements proches</footer>\n' +
    '</article>'
}

const panels = selected.map(makePanel).join('\n')
const targetLabel = target ? clean(target.title + ' centre ' + target.x.toFixed(1) + ', ' + target.z.toFixed(1)) : 'Centre-ville non detecte'
const html = '<!doctype html>\n' +
'<html lang="fr">\n' +
'<head>\n' +
'<meta charset="utf-8" />\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
'<title>PLS - Diagnostic routes Beauvais V2</title>\n' +
'<style>\n' +
'  :root { color-scheme: dark; font-family: Inter, Segoe UI, Arial, sans-serif; background: #111827; color: #e5e7eb; }\n' +
'  body { margin: 0; padding: 24px; }\n' +
'  h1 { margin: 0 0 8px; font-size: 24px; }\n' +
'  p { max-width: 1060px; color: #cbd5e1; line-height: 1.45; }\n' +
'  .meta { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 22px; }\n' +
'  .chip { border: 1px solid #334155; background: #1f2937; border-radius: 6px; padding: 8px 10px; color: #d1d5db; }\n' +
'  .grid { display: grid; grid-template-columns: 1fr; gap: 20px; }\n' +
'  .panel { background: #172033; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }\n' +
'  header, footer { display: flex; gap: 10px; align-items: center; padding: 10px 12px; font-size: 13px; color: #cbd5e1; }\n' +
'  header { border-bottom: 1px solid #334155; min-height: 42px; }\n' +
'  header b { color: #f8fafc; }\n' +
'  footer { border-top: 1px solid #334155; }\n' +
'  .views { display: grid; grid-template-columns: repeat(2, minmax(320px, 1fr)); gap: 0; }\n' +
'  figure { margin: 0; border-right: 1px solid #334155; }\n' +
'  figure:last-child { border-right: 0; }\n' +
'  figcaption { padding: 8px 10px; background: #0f172a; color: #e2e8f0; font-size: 12px; border-bottom: 1px solid #334155; }\n' +
'  svg { display: block; width: 100%; height: auto; background: #8f9a70; }\n' +
'  .edge { stroke: #9ca3af; stroke-linecap: round; stroke-linejoin: round; opacity: 1; }\n' +
'  .asphalt { stroke: #2f363d; stroke-linecap: round; stroke-linejoin: round; opacity: 1; }\n' +
'  .surface { fill: #2f363d; stroke: #9ca3af; stroke-width: 1.15; stroke-linejoin: round; }\n' +
'  .hit { fill: #ef4444; stroke: #fff7ed; stroke-width: 1.2; }\n' +
'  .center { fill: none; stroke: #f59e0b; stroke-width: 2; stroke-dasharray: 4 4; }\n' +
'  @media (max-width: 760px) { .views { grid-template-columns: 1fr; } figure { border-right: 0; border-bottom: 1px solid #334155; } }\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'  <h1>Diagnostic 2D des routes de Beauvais - V2 surfaces fusionnees</h1>\n' +
'  <p>Cette page compare les rubans actuels et une vraie surface de chaussee fusionnee. Le premier panneau cible le centre-ville complet pour un test visuel plus parlant. Si la surface de droite est propre, la methode peut ensuite alimenter la 3D. Si elle reste brouillonne, on corrige ici avant le jeu.</p>\n' +
'  <div class="meta">\n' +
'    <div class="chip">' + roads.length + ' routes drivable lues</div>\n' +
'    <div class="chip">' + segments.length + ' segments analyses</div>\n' +
'    <div class="chip">' + roadPoints.length + ' points OSM analyses</div>\n' +
'    <div class="chip">' + candidates.length + ' croisements/noeuds detectes</div>\n' +
'    <div class="chip">' + selected.length + ' panneaux</div>\n' +
'    <div class="chip">Cible: ' + targetLabel + '</div>\n' +
'  </div>\n' +
'  <section class="grid">' + panels + '</section>\n' +
'</body>\n' +
'</html>\n'

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outPath, html, 'utf8')

if (target) {
  const surface = mergedSurface(target)
  const segmentBuckets = bucketSegmentsByTile()
  const citySurface = buildSurfaceTiles(segmentBuckets)
  const cityWalks = buildWalkTiles(segmentBuckets, citySurface.drawn, target)
  const json = {
    generatedAt: new Date().toISOString(),
    label: 'Beauvais complet tuiles',
    /**
     * Empreinte de la ville qui a servi à fabriquer cette surface.
     *
     * ⚠️ Ce fichier est DÉRIVÉ de `beauvais-buildings.json`. Si on régénère la
     * ville sans relancer `npm run debug:roads`, la dalle de bitume reste celle
     * des ANCIENNES routes pendant que les rubans suivent les nouvelles : on
     * obtient des bouts de route qui dépassent partout. C'est arrivé une fois,
     * en passant les routes d'OSM à l'IGN (84,5 % d'axes encore sur la dalle au
     * lieu de 99,5 %). `roadway.ts` compare cette empreinte au démarrage et
     * hurle dans la console si elle ne correspond plus.
     */
    sourceCity: { generatedAt: data.generatedAt ?? null, roadCount: data.roads.length },
    center: { x: Number(target.x.toFixed(3)), z: Number(target.z.toFixed(3)) },
    radius: target.radius ?? VIEW_RADIUS,
    mask: target.mask?.map(([x, z]) => [Number(x.toFixed(3)), Number(z.toFixed(3))]) ?? null,
    tileSize: SURFACE_TILE,
    sourceSegmentCount: citySurface.surfaceSegmentCount,
    preview: {
      label: target.title,
      sourceSegmentCount: surface.local.length,
      polygons: surface.polygons.map((poly) =>
        poly
          .map((ring) => simplifyRing(ring, SIMPLIFY_EPS).map(([x, z]) => [Number(x.toFixed(3)), Number(z.toFixed(3))]))
          .filter((ring) => ring.length >= 3 && polygonArea(ring) >= 4),
      ).filter((poly) => poly.length > 0),
    },
    tiles: citySurface.tiles,
    /**
     * Les trottoirs, déduits par soustraction (voir `buildWalkTiles`).
     *
     * Même découpage en tuiles que `tiles`, même convention de contours. Un
     * fichier produit AVANT ce lot n'a pas ce champ : `Roads.tsx` le traite alors
     * comme « pas de trottoir » plutôt que de planter.
     */
    walkTiles: cityWalks.tiles,
  }
  /**
   * Écrit COMPACT, pas indenté.
   *
   * Ce fichier part dans le bundle du jeu. Indenté, l'ajout des trottoirs le
   * faisait passer de 6,7 à 18 Mo — l'essentiel n'étant que des espaces autour de
   * couples de nombres. Il n'y perd rien : c'est un fichier généré, jamais relu ni
   * fusionné à la main (`npm run debug:roads` le refait entièrement).
   */
  fs.writeFileSync(surfaceOutPath, JSON.stringify(json) + '\n', 'utf8')
  console.log('Surface test generee: ' + surfaceOutPath)
  console.log(Object.keys(citySurface.tiles).length + ' tuiles de surface, ' + citySurface.surfaceSegmentCount + ' segments de surface.')
  console.log(
    Object.keys(cityWalks.tiles).length +
      ' tuiles de trottoir, ' +
      differenceFailures +
      ' soustractions ignorees.',
  )
  console.log(
    'cotes de voie avec trottoir : ' +
      cityWalks.allowedSides +
      ' / ' +
      cityWalks.totalSides +
      ' (' +
      ((100 * cityWalks.allowedSides) / cityWalks.totalSides).toFixed(1) +
      '%)',
  )
  console.log(
    'dont centre-ville (600 m)   : ' +
      cityWalks.allowedCentre +
      ' / ' +
      cityWalks.totalCentre +
      ' (' +
      ((100 * cityWalks.allowedCentre) / cityWalks.totalCentre).toFixed(1) +
      '%)',
  )
}

console.log('Diagnostic genere: ' + outPath)
console.log(roads.length + ' routes, ' + segments.length + ' segments, ' + roadPoints.length + ' points, ' + candidates.length + ' croisements/noeuds, ' + selected.length + ' panneaux.')
console.log('Cible: ' + targetLabel)
