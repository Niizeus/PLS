import * as THREE from 'three'
import { terrainHeight } from './cityData'
import { ROADWAY } from './roadway'

const SURFACE_VISUAL_LIFT = 0.045
const SURFACE_TESSELLATION_STEP = 10
const SURFACE_HEIGHT_SAMPLE_RADIUS = 1.6
const SURFACE_EDGE_DROP = 0.24
const SURFACE_EDGE_SAMPLE_STEP = 6

export interface RoadSurfaceBuffers {
  surfacePositions: Float32Array | null
  edgePositions: Float32Array | null
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

function createSurfaceHeightSampler() {
  const cache = new Map<string, number>()
  return (x: number, z: number) => {
    const key = x.toFixed(2) + ':' + z.toFixed(2)
    let h = cache.get(key)
    if (h === undefined) {
      h = surfaceTopHeight(x, z)
      cache.set(key, h)
    }
    return h
  }
}

function edgeLength(a: THREE.Vector2, b: THREE.Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: THREE.Vector2, b: THREE.Vector2): THREE.Vector2 {
  return new THREE.Vector2((a.x + b.x) * 0.5, (a.y + b.y) * 0.5)
}

function pushSurfaceVertex(p: THREE.Vector2, positions: number[], heightAt: (x: number, z: number) => number) {
  positions.push(p.x, heightAt(p.x, p.y), p.y)
}

function addSurfaceTriangle(
  a: THREE.Vector2,
  b: THREE.Vector2,
  c: THREE.Vector2,
  positions: number[],
  heightAt: (x: number, z: number) => number,
  depth = 0,
) {
  const ab = edgeLength(a, b)
  const bc = edgeLength(b, c)
  const ca = edgeLength(c, a)
  if (depth < 9 && Math.max(ab, bc, ca) > SURFACE_TESSELLATION_STEP) {
    if (ab >= bc && ab >= ca) {
      const m = midpoint(a, b)
      addSurfaceTriangle(a, m, c, positions, heightAt, depth + 1)
      addSurfaceTriangle(m, b, c, positions, heightAt, depth + 1)
    } else if (bc >= ca) {
      const m = midpoint(b, c)
      addSurfaceTriangle(a, b, m, positions, heightAt, depth + 1)
      addSurfaceTriangle(a, m, c, positions, heightAt, depth + 1)
    } else {
      const m = midpoint(c, a)
      addSurfaceTriangle(a, b, m, positions, heightAt, depth + 1)
      addSurfaceTriangle(m, b, c, positions, heightAt, depth + 1)
    }
    return
  }

  pushSurfaceVertex(a, positions, heightAt)
  pushSurfaceVertex(b, positions, heightAt)
  pushSurfaceVertex(c, positions, heightAt)
}

function addSurfacePolygon(poly: number[][][], positions: number[], heightAt: (x: number, z: number) => number) {
  if (poly.length === 0) return

  const outerRing = ringArea(poly[0]) < 0 ? poly[0].slice().reverse() : poly[0]
  const holeRings = poly.slice(1).map((ring) => (ringArea(ring) > 0 ? ring.slice().reverse() : ring))
  const outer = cleanRing(outerRing)
  const holes = holeRings.map(cleanRing).filter((ring) => ring.length >= 3)
  if (outer.length < 3) return

  const vertices = [...outer, ...holes.flat()]
  const triangles = THREE.ShapeUtils.triangulateShape(outer, holes)

  for (const tri of triangles) {
    addSurfaceTriangle(vertices[tri[0]], vertices[tri[2]], vertices[tri[1]], positions, heightAt)
  }
}

function buildSurfacePositions(
  polygons: number[][][][],
  heightAt: (x: number, z: number) => number,
): Float32Array | null {
  const positions: number[] = []
  for (const poly of polygons) addSurfacePolygon(poly, positions, heightAt)
  return positions.length === 0 ? null : new Float32Array(positions)
}

function addEdgeVertex(p: THREE.Vector2, top: boolean, positions: number[], heightAt: (x: number, z: number) => number) {
  const terrain = terrainHeight(p.x, p.y)
  const topY = heightAt(p.x, p.y)
  const bottomY = Math.min(topY - SURFACE_EDGE_DROP, terrain - ROADWAY.EMBED * 0.2)
  positions.push(p.x, top ? topY : bottomY, p.y)
}

function addSurfaceRingEdge(ring: number[][], positions: number[], heightAt: (x: number, z: number) => number) {
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

      addEdgeVertex(p0, true, positions, heightAt)
      addEdgeVertex(p1, false, positions, heightAt)
      addEdgeVertex(p1, true, positions, heightAt)
      addEdgeVertex(p0, true, positions, heightAt)
      addEdgeVertex(p0, false, positions, heightAt)
      addEdgeVertex(p1, false, positions, heightAt)

      addEdgeVertex(p0, true, positions, heightAt)
      addEdgeVertex(p1, true, positions, heightAt)
      addEdgeVertex(p1, false, positions, heightAt)
      addEdgeVertex(p0, true, positions, heightAt)
      addEdgeVertex(p1, false, positions, heightAt)
      addEdgeVertex(p0, false, positions, heightAt)
    }
  }
}

function buildSurfaceEdgePositions(
  polygons: number[][][][],
  heightAt: (x: number, z: number) => number,
): Float32Array | null {
  const positions: number[] = []
  for (const poly of polygons) {
    for (const ring of poly) addSurfaceRingEdge(ring, positions, heightAt)
  }
  return positions.length === 0 ? null : new Float32Array(positions)
}

export function buildRoadSurfaceBuffers(polygons: number[][][][]): RoadSurfaceBuffers {
  const heightAt = createSurfaceHeightSampler()
  return {
    surfacePositions: buildSurfacePositions(polygons, heightAt),
    edgePositions: buildSurfaceEdgePositions(polygons, heightAt),
  }
}
