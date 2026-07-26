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

function mergeSegmentSurface(local, label) {
  const polygons = local.map((seg) => segmentCapsule(seg, 0.15))
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

function buildSurfaceTiles() {
  const buckets = new Map()
  for (const seg of segments) {
    if (!drivableSurfaceSegment(seg)) continue
    const key = tileKeyOf((seg.ax + seg.bx) * 0.5, (seg.az + seg.bz) * 0.5)
    let list = buckets.get(key)
    if (!list) buckets.set(key, (list = []))
    list.push(seg)
  }

  const tiles = {}
  const entries = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
  let surfaceSegmentCount = 0
  for (const [key, local] of entries) {
    const polygons = mergeSegmentSurface(local, 'tile-' + key)
      .map((poly) =>
        poly
          .map((ring) => simplifyRing(ring, SIMPLIFY_EPS).map(([x, z]) => [Number(x.toFixed(3)), Number(z.toFixed(3))]))
          .filter((ring) => ring.length >= 3 && polygonArea(ring) >= 4),
      )
      .filter((poly) => poly.length > 0)
    if (polygons.length === 0) continue
    tiles[key] = { polygons }
    surfaceSegmentCount += local.length
  }

  return { tiles, surfaceSegmentCount }
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
  const citySurface = buildSurfaceTiles()
  const json = {
    generatedAt: new Date().toISOString(),
    label: 'Beauvais complet tuiles',
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
  }
  fs.writeFileSync(surfaceOutPath, JSON.stringify(json, null, 2) + '\n', 'utf8')
  console.log('Surface test generee: ' + surfaceOutPath)
  console.log(Object.keys(citySurface.tiles).length + ' tuiles de surface, ' + citySurface.surfaceSegmentCount + ' segments de surface.')
}

console.log('Diagnostic genere: ' + outPath)
console.log(roads.length + ' routes, ' + segments.length + ' segments, ' + roadPoints.length + ' points, ' + candidates.length + ' croisements/noeuds, ' + selected.length + ' panneaux.')
console.log('Cible: ' + targetLabel)
