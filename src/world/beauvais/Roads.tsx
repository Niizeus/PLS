import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { SPAWN, terrainHeight } from './cityData'
import { ROADWAY, ROADWAY_TILE, roadwayTiles, type RoadChunk } from './roadway'
import roadSurfaceTest from './data/road-surface-test.json'

/**
 * Routes de Beauvais en volume.
 *
 * La surface physique vient de roadway.ts. Ici on dessine de vrais rubans continus,
 * avec bordures et accotements. Les cotes interieurs fusionnes par roadway.ts sont
 * rendus en bitume pour eviter les separations inutiles entre voies paralleles.
 */

const ASPHALT = '#454b52'
const KERB = '#8d9199'
const SHOULDER = '#6d6659'

const REACH = 1

const BAND_COLORS = [SHOULDER, KERB, KERB, ASPHALT, KERB, KERB, SHOULDER].map(
  (c) => new THREE.Color(c),
)

const PROFILE = 8
const SURFACE_VISUAL_LIFT = 0.045
const SURFACE_HIDE_PAD = 8
const SURFACE_TESSELLATION_STEP = 6
const SURFACE_HEIGHT_SAMPLE_RADIUS = 1.6
const SURFACE_EDGE_DROP = 0.24
const SURFACE_EDGE_SAMPLE_STEP = 3

type RoadSurfaceTile = {
  polygons: number[][][][]
}

type RoadSurfaceTest = {
  center: { x: number; z: number }
  radius: number
  mask?: number[][] | null
  polygons?: number[][][][]
  preview?: { polygons?: number[][][][] }
  tileSize?: number
  tiles?: Record<string, RoadSurfaceTile>
}

const ROAD_SURFACE_TEST = roadSurfaceTest as RoadSurfaceTest
const SURFACE_TILE_SIZE = ROAD_SURFACE_TEST.tileSize ?? ROADWAY_TILE
const SURFACE_TILES = ROAD_SURFACE_TEST.tiles ?? null
const LEGACY_SURFACE_POLYGONS = ROAD_SURFACE_TEST.polygons ?? ROAD_SURFACE_TEST.preview?.polygons ?? []

function pointInRing(x: number, z: number, ring: number[][]): boolean {
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

function surfacePolygonsForTile(tileKey: string): number[][][][] {
  return SURFACE_TILES?.[tileKey]?.polygons ?? []
}

function hasSurfaceTile(tileKey: string): boolean {
  return surfacePolygonsForTile(tileKey).length > 0
}

function surfacePolygonsNear(x: number, z: number): number[][][][] {
  if (!SURFACE_TILES) return LEGACY_SURFACE_POLYGONS

  const tx = Math.floor(x / SURFACE_TILE_SIZE)
  const tz = Math.floor(z / SURFACE_TILE_SIZE)
  const polygons: number[][][][] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const tile = SURFACE_TILES[tx + dx + ':' + (tz + dz)]
      if (tile) polygons.push(...tile.polygons)
    }
  }
  return polygons
}

function inExperimentalSurfaceZone(x: number, z: number): boolean {
  if (!SURFACE_TILES) {
    const dx = x - ROAD_SURFACE_TEST.center.x
    const dz = z - ROAD_SURFACE_TEST.center.z
    if (Math.hypot(dx, dz) > ROAD_SURFACE_TEST.radius + SURFACE_HIDE_PAD) return false
  }

  for (const poly of surfacePolygonsNear(x, z)) {
    const outer = poly[0]
    if (!outer || !pointInRing(x, z, outer)) continue
    let inHole = false
    for (const hole of poly.slice(1)) {
      if (pointInRing(x, z, hole)) {
        inHole = true
        break
      }
    }
    if (!inHole) return true
  }
  return false
}
function section(
  chunk: RoadChunk,
  i: number,
  n: number,
  ox: Float64Array,
  oy: Float64Array,
  oz: Float64Array,
) {
  const pts = chunk.pts
  const x = pts[i * 3]
  const z = pts[i * 3 + 1]
  const top = pts[i * 3 + 2]
  const half = chunk.half

  const pi = Math.max(0, i - 1)
  const ni = Math.min(n - 1, i + 1)
  let dx = pts[ni * 3] - pts[pi * 3]
  let dz = pts[ni * 3 + 1] - pts[pi * 3 + 1]
  const len = Math.hypot(dx, dz) || 1
  dx /= len
  dz /= len
  const nx = -dz
  const nz = dx

  const put = (k: number, offset: number, y: number) => {
    ox[i * PROFILE + k] = x + nx * offset
    oy[i * PROFILE + k] = y
    oz[i * PROFILE + k] = z + nz * offset
  }

  if (chunk.junction[i]) {
    for (let k = 0; k < PROFILE; k++) put(k, k < 4 ? half : -half, top)
    return
  }

  const kerbY = top + ROADWAY.KERB_H
  const outer = half + ROADWAY.KERB_W + ROADWAY.SHOULDER_W
  const kerbOut = half + ROADWAY.KERB_W
  const leftMerge = chunk.leftMerge[i]
  const rightMerge = chunk.rightMerge[i]

  const footY = (offset: number) =>
    Math.min(terrainHeight(x + nx * offset, z + nz * offset) - ROADWAY.EMBED, kerbY)

  if (leftMerge > 0) {
    put(0, half + leftMerge, top)
    put(1, half + leftMerge * 0.66, top)
    put(2, half + leftMerge * 0.33, top)
  } else {
    put(0, outer, footY(outer))
    put(1, kerbOut, kerbY)
    put(2, half, kerbY)
  }

  put(3, half, top)
  put(4, -half, top)

  if (rightMerge > 0) {
    put(5, -(half + rightMerge * 0.33), top)
    put(6, -(half + rightMerge * 0.66), top)
    put(7, -(half + rightMerge), top)
  } else {
    put(5, -half, kerbY)
    put(6, -kerbOut, kerbY)
    put(7, -outer, footY(-outer))
  }
}

function bandColor(chunk: RoadChunk, i: number, band: number): THREE.Color {
  const leftMerged = chunk.leftMerge[i] > 0 || chunk.leftMerge[i + 1] > 0
  const rightMerged = chunk.rightMerge[i] > 0 || chunk.rightMerge[i + 1] > 0
  if ((leftMerged && band <= 2) || (rightMerged && band >= 4)) return BAND_COLORS[3]
  return BAND_COLORS[band]
}

function addChunk(chunk: RoadChunk, positions: number[], colors: number[]) {
  const n = chunk.pts.length / 3
  if (n < 2) return

  const ox = new Float64Array(n * PROFILE)
  const oy = new Float64Array(n * PROFILE)
  const oz = new Float64Array(n * PROFILE)
  for (let i = 0; i < n; i++) section(chunk, i, n, ox, oy, oz)

  for (let i = 0; i < n - 1; i++) {
    const ax = chunk.pts[i * 3]
    const az = chunk.pts[i * 3 + 1]
    const bx = chunk.pts[(i + 1) * 3]
    const bz = chunk.pts[(i + 1) * 3 + 1]
    if (
      inExperimentalSurfaceZone(ax, az) ||
      inExperimentalSurfaceZone(bx, bz) ||
      inExperimentalSurfaceZone((ax + bx) * 0.5, (az + bz) * 0.5)
    ) {
      continue
    }

    const junction = chunk.junction[i] === 1 && chunk.junction[i + 1] === 1
    for (let band = 0; band < PROFILE - 1; band++) {
      if (junction && band !== 3) continue

      const c = bandColor(chunk, i, band)
      const l = i * PROFILE + band
      const r = l + 1
      const l2 = l + PROFILE
      const r2 = r + PROFILE

      for (const v of [l, r2, r, l, l2, r2]) {
        positions.push(ox[v], oy[v], oz[v])
        colors.push(c.r, c.g, c.b)
      }
    }
  }
}

function buildTile(chunks: RoadChunk[]): THREE.BufferGeometry | null {
  const positions: number[] = []
  const colors: number[] = []
  for (const chunk of chunks) addChunk(chunk, positions, colors)
  if (positions.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  geo.computeVertexNormals()
  return geo
}


function ringArea(ring: number[][]): number {
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    area += a[0] * b[1] - b[0] * a[1]
  }
  return area / 2
}

function cleanRing(ring: number[][]): THREE.Vector2[] {
  const points = ring.slice()
  const first = points[0]
  const last = points[points.length - 1]
  if (first && last && Math.abs(first[0] - last[0]) < 0.001 && Math.abs(first[1] - last[1]) < 0.001) {
    points.pop()
  }
  return points.map(([x, z]) => new THREE.Vector2(x, z))
}

function surfaceTopHeight(x: number, z: number): number {
  const r = SURFACE_HEIGHT_SAMPLE_RADIUS
  let h = terrainHeight(x, z)
  h = Math.max(h, terrainHeight(x + r, z), terrainHeight(x - r, z))
  h = Math.max(h, terrainHeight(x, z + r), terrainHeight(x, z - r))
  h = Math.max(h, terrainHeight(x + r, z + r), terrainHeight(x - r, z - r))
  h = Math.max(h, terrainHeight(x + r, z - r), terrainHeight(x - r, z + r))
  return h + ROADWAY.THICKNESS + SURFACE_VISUAL_LIFT
}

function edgeLength(a: THREE.Vector2, b: THREE.Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: THREE.Vector2, b: THREE.Vector2): THREE.Vector2 {
  return new THREE.Vector2((a.x + b.x) * 0.5, (a.y + b.y) * 0.5)
}

function pushSurfaceVertex(p: THREE.Vector2, positions: number[]) {
  positions.push(p.x, surfaceTopHeight(p.x, p.y), p.y)
}

function addSurfaceTriangle(
  a: THREE.Vector2,
  b: THREE.Vector2,
  c: THREE.Vector2,
  positions: number[],
  depth = 0,
) {
  const ab = edgeLength(a, b)
  const bc = edgeLength(b, c)
  const ca = edgeLength(c, a)
  if (depth < 9 && Math.max(ab, bc, ca) > SURFACE_TESSELLATION_STEP) {
    if (ab >= bc && ab >= ca) {
      const m = midpoint(a, b)
      addSurfaceTriangle(a, m, c, positions, depth + 1)
      addSurfaceTriangle(m, b, c, positions, depth + 1)
    } else if (bc >= ca) {
      const m = midpoint(b, c)
      addSurfaceTriangle(a, b, m, positions, depth + 1)
      addSurfaceTriangle(a, m, c, positions, depth + 1)
    } else {
      const m = midpoint(c, a)
      addSurfaceTriangle(a, b, m, positions, depth + 1)
      addSurfaceTriangle(m, b, c, positions, depth + 1)
    }
    return
  }

  pushSurfaceVertex(a, positions)
  pushSurfaceVertex(b, positions)
  pushSurfaceVertex(c, positions)
}

function addSurfacePolygon(poly: number[][][], positions: number[]) {
  if (poly.length === 0) return

  const outerRing = ringArea(poly[0]) < 0 ? poly[0].slice().reverse() : poly[0]
  const holeRings = poly.slice(1).map((ring) => (ringArea(ring) > 0 ? ring.slice().reverse() : ring))
  const outer = cleanRing(outerRing)
  const holes = holeRings.map(cleanRing).filter((ring) => ring.length >= 3)
  if (outer.length < 3) return

  const vertices = [...outer, ...holes.flat()]
  const triangles = THREE.ShapeUtils.triangulateShape(outer, holes)

  for (const tri of triangles) {
    // ShapeUtils returns clockwise triangles in XY. After mapping XY to world XZ,
    // that faces downward, so each triangle is flipped once here.
    addSurfaceTriangle(vertices[tri[0]], vertices[tri[2]], vertices[tri[1]], positions)
  }
}

function buildSurfaceGeometry(polygons: number[][][][]): THREE.BufferGeometry | null {
  const positions: number[] = []
  for (const poly of polygons) addSurfacePolygon(poly, positions)
  if (positions.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

function addEdgeVertex(p: THREE.Vector2, top: boolean, positions: number[]) {
  const terrain = terrainHeight(p.x, p.y)
  const topY = surfaceTopHeight(p.x, p.y)
  const bottomY = Math.min(topY - SURFACE_EDGE_DROP, terrain - ROADWAY.EMBED * 0.2)
  positions.push(p.x, top ? topY : bottomY, p.y)
}

function addSurfaceRingEdge(ring: number[][], positions: number[]) {
  const points = cleanRing(ring)
  if (points.length < 2) return

  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const steps = Math.max(1, Math.ceil(edgeLength(a, b) / SURFACE_EDGE_SAMPLE_STEP))
    for (let step = 0; step < steps; step++) {
      const t0 = step / steps
      const t1 = (step + 1) / steps
      const p0 = new THREE.Vector2(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0)
      const p1 = new THREE.Vector2(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1)

      addEdgeVertex(p0, true, positions)
      addEdgeVertex(p1, false, positions)
      addEdgeVertex(p1, true, positions)
      addEdgeVertex(p0, true, positions)
      addEdgeVertex(p0, false, positions)
      addEdgeVertex(p1, false, positions)

      addEdgeVertex(p0, true, positions)
      addEdgeVertex(p1, true, positions)
      addEdgeVertex(p1, false, positions)
      addEdgeVertex(p0, true, positions)
      addEdgeVertex(p1, false, positions)
      addEdgeVertex(p0, false, positions)
    }
  }
}

function buildSurfaceEdgeGeometry(polygons: number[][][][]): THREE.BufferGeometry | null {
  const positions: number[] = []
  for (const poly of polygons) {
    for (const ring of poly) addSurfaceRingEdge(ring, positions)
  }
  if (positions.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.computeVertexNormals()
  return geo
}

function ExperimentalRoadSurface({ tileKey }: { tileKey?: string }) {
  const polygons = tileKey ? surfacePolygonsForTile(tileKey) : LEGACY_SURFACE_POLYGONS
  const surfaceGeometry = useMemo(() => buildSurfaceGeometry(polygons), [polygons])
  const edgeGeometry = useMemo(() => buildSurfaceEdgeGeometry(polygons), [polygons])

  useEffect(
    () => () => {
      surfaceGeometry?.dispose()
      edgeGeometry?.dispose()
    },
    [surfaceGeometry, edgeGeometry],
  )

  if (!surfaceGeometry && !edgeGeometry) return null
  return (
    <>
      {surfaceGeometry && (
        <mesh geometry={surfaceGeometry} castShadow={false} receiveShadow={false}>
          <meshToonMaterial color={ASPHALT} gradientMap={toonGradient} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      {edgeGeometry && (
        <mesh geometry={edgeGeometry} castShadow={false} receiveShadow={false}>
          <meshToonMaterial color={KERB} gradientMap={toonGradient} />
        </mesh>
      )}
    </>
  )
}

function RoadTile({ tileKey }: { tileKey: string }) {
  const geometry = useMemo(() => {
    const chunks = roadwayTiles().get(tileKey)
    return chunks ? buildTile(chunks) : null
  }, [tileKey])

  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow={false} receiveShadow={false}>
      <meshToonMaterial vertexColors gradientMap={toonGradient} />
    </mesh>
  )
}

export default function Roads() {
  const [center, setCenter] = useState(() => ({
    tx: Math.floor(SPAWN.x / ROADWAY_TILE),
    tz: Math.floor(SPAWN.z / ROADWAY_TILE),
  }))
  const frame = useRef(0)

  useFrame(() => {
    frame.current = (frame.current + 1) % 12
    if (frame.current !== 0) return

    const p = usePlayerStore.getState().playerObject
    const tx = Math.floor((p ? p.position.x : SPAWN.x) / ROADWAY_TILE)
    const tz = Math.floor((p ? p.position.z : SPAWN.z) / ROADWAY_TILE)
    setCenter((c) => (c.tx === tx && c.tz === tz ? c : { tx, tz }))
  })

  const tiles = roadwayTiles()
  const keys: string[] = []
  for (let dx = -REACH; dx <= REACH; dx++) {
    for (let dz = -REACH; dz <= REACH; dz++) {
      const key = center.tx + dx + ':' + (center.tz + dz)
      if (tiles.has(key) || hasSurfaceTile(key)) keys.push(key)
    }
  }

  return (
    <>
      {keys.map((key) => (
        <RoadTile key={key} tileKey={key} />
      ))}
      {SURFACE_TILES
        ? keys.map((key) => <ExperimentalRoadSurface key={'surface:' + key} tileKey={key} />)
        : <ExperimentalRoadSurface />}
    </>
  )
}
