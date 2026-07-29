import {
  openingSpan,
  polygonCentroid,
  wallAngle,
  wallLength,
  wallPointAt,
  type Point2,
} from '../data/interiorGeometry'
import { type InteriorFloor, type InteriorOpening, type InteriorWall } from '../data/interiors'

/**
 * 🎨 Dessin du plan 2D de l'editeur d'interieur.
 *
 * Separe de `InteriorEditor.tsx` pour que le composant ne s'occupe que des outils et de l'etat.
 * Tout passe par `toScreen`, fourni par l'appelant : ce module ignore la camera.
 */

export type ToScreen = (point: Point2) => [number, number]

/** Ce qui est selectionne dans le plan. */
export type InteriorSelection =
  | { kind: 'wall'; id: string }
  | { kind: 'wallEnd'; id: string; end: 'a' | 'b' }
  | { kind: 'opening'; wallId: string; id: string }
  | { kind: 'surface'; id: string }
  | { kind: 'surfaceVertex'; id: string; index: number }
  | { kind: 'spawn'; id: string }
  | { kind: 'exit'; id: string }
  | { kind: 'prop'; id: string }

const COLORS = {
  surface: '#4d5946',
  surfaceSelected: '#63764f',
  surfaceEdge: 'rgba(255,255,255,0.16)',
  wall: '#d7c8af',
  wallSelected: '#fff7dc',
  opening: '#2a2f34',
  door: '#d99a45',
  window: '#62b6cb',
  handle: '#f0b84d',
  preview: '#f0b84d',
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: { cx: number; cz: number; zoom: number },
  step: number,
) {
  const major = 1
  const minX = camera.cx - width / 2 / camera.zoom
  const maxX = camera.cx + width / 2 / camera.zoom
  const minZ = camera.cz - height / 2 / camera.zoom
  const maxZ = camera.cz + height / 2 / camera.zoom
  // Sous ~6 px d'ecart, la grille fine devient une bouillie : on ne trace que les grandes lignes.
  const fineVisible = step * camera.zoom > 6

  ctx.save()
  for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
    const isMajor = Math.abs(x % major) < 0.001
    if (!isMajor && !fineVisible) continue
    const sx = width / 2 + (x - camera.cx) * camera.zoom
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
    ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.05)'
    ctx.lineWidth = isMajor ? 1 : 0.5
    ctx.stroke()
  }
  for (let z = Math.floor(minZ / step) * step; z <= maxZ; z += step) {
    const isMajor = Math.abs(z % major) < 0.001
    if (!isMajor && !fineVisible) continue
    const sy = height / 2 + (z - camera.cz) * camera.zoom
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(width, sy)
    ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.05)'
    ctx.lineWidth = isMajor ? 1 : 0.5
    ctx.stroke()
  }
  ctx.restore()
}

function polygonPath(ctx: CanvasRenderingContext2D, pts: [number, number][], toScreen: ToScreen) {
  ctx.beginPath()
  pts.forEach(([x, z], index) => {
    const [sx, sy] = toScreen({ x, z })
    if (index === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
  })
  ctx.closePath()
}

export function drawSurfaces(
  ctx: CanvasRenderingContext2D,
  floor: InteriorFloor,
  toScreen: ToScreen,
  selected: InteriorSelection | null,
) {
  for (const surface of floor.surfaces) {
    const isSelected = selected?.kind === 'surface' && selected.id === surface.id
    const vertexSelected = selected?.kind === 'surfaceVertex' && selected.id === surface.id
    polygonPath(ctx, surface.pts, toScreen)
    ctx.fillStyle = isSelected || vertexSelected ? COLORS.surfaceSelected : COLORS.surface
    ctx.fill()
    ctx.lineWidth = isSelected ? 2 : 1
    ctx.strokeStyle = isSelected ? COLORS.wallSelected : COLORS.surfaceEdge
    ctx.stroke()

    const center = polygonCentroid(surface.pts)
    const [cx, cy] = toScreen(center)
    ctx.fillStyle = 'rgba(255,247,220,0.75)'
    ctx.font = '650 11px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(surface.name, cx, cy)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'

    // Poignees de sommet, seulement sur le sol en cours d'edition (sinon le plan est illisible).
    if (isSelected || vertexSelected) {
      surface.pts.forEach(([x, z], index) => {
        const [sx, sy] = toScreen({ x, z })
        const active = vertexSelected && selected.index === index
        ctx.beginPath()
        ctx.arc(sx, sy, active ? 6 : 4.5, 0, Math.PI * 2)
        ctx.fillStyle = active ? COLORS.wallSelected : COLORS.handle
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#15191d'
        ctx.stroke()
      })
    }
  }
}

/** Dessine un mur comme un rectangle epais, en laissant un trou a chaque ouverture. */
export function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: InteriorWall,
  toScreen: ToScreen,
  pixelsPerMeter: number,
  selected: InteriorSelection | null,
) {
  const length = wallLength(wall)
  if (length < 0.01) return

  const isSelected = selected?.kind === 'wall' && selected.id === wall.id
  const endSelected = selected?.kind === 'wallEnd' && selected.id === wall.id
  const [ax, ay] = toScreen({ x: wall.ax, z: wall.az })
  const [bx, by] = toScreen({ x: wall.bx, z: wall.bz })
  const screenThickness = Math.max(2, wall.thickness * pixelsPerMeter)

  ctx.save()
  ctx.lineCap = 'butt'
  ctx.lineWidth = screenThickness
  ctx.strokeStyle = isSelected || endSelected ? COLORS.wallSelected : COLORS.wall
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()

  // Les ouvertures sont repeintes par-dessus, en couleur de fond : c'est le trou.
  for (const opening of wall.openings) {
    const span = openingSpan(wall, opening)
    const start = wallPointAt(wall, span.start)
    const end = wallPointAt(wall, span.end)
    const [sx, sy] = toScreen(start)
    const [ex, ey] = toScreen(end)
    const openingSelected = selected?.kind === 'opening' && selected.id === opening.id

    ctx.lineWidth = screenThickness
    ctx.strokeStyle = COLORS.opening
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    // Un trait de couleur rappelle de quel type d'ouverture il s'agit.
    if (opening.kind !== 'passage') {
      ctx.lineWidth = Math.max(2, screenThickness * 0.45)
      ctx.strokeStyle = openingSelected
        ? COLORS.wallSelected
        : opening.kind === 'door'
          ? COLORS.door
          : COLORS.window
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
    } else if (openingSelected) {
      ctx.lineWidth = 2
      ctx.strokeStyle = COLORS.wallSelected
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // Poignees d'extremite, uniquement sur le mur selectionne.
  if (isSelected || endSelected) {
    ;(['a', 'b'] as const).forEach((end) => {
      const point = end === 'a' ? { x: wall.ax, z: wall.az } : { x: wall.bx, z: wall.bz }
      const [hx, hy] = toScreen(point)
      const active = endSelected && selected.end === end
      ctx.beginPath()
      ctx.arc(hx, hy, active ? 6.5 : 5, 0, Math.PI * 2)
      ctx.fillStyle = active ? COLORS.wallSelected : COLORS.handle
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#15191d'
      ctx.stroke()
    })
  }
  ctx.restore()
}

export function drawWalls(
  ctx: CanvasRenderingContext2D,
  floor: InteriorFloor,
  toScreen: ToScreen,
  pixelsPerMeter: number,
  selected: InteriorSelection | null,
) {
  for (const wall of floor.walls) drawWall(ctx, wall, toScreen, pixelsPerMeter, selected)
}

export function drawPoint(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  x: number,
  z: number,
  color: string,
  label: string,
  selected = false,
) {
  const [sx, sy] = toScreen({ x, z })
  ctx.beginPath()
  ctx.arc(sx, sy, selected ? 10 : 8, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = selected ? 3 : 2
  ctx.strokeStyle = selected ? COLORS.wallSelected : '#ffffff'
  ctx.stroke()
  ctx.fillStyle = '#111'
  ctx.font = '900 10px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, sx, sy + 0.5)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  floor: InteriorFloor,
  toScreen: ToScreen,
  selected: InteriorSelection | null,
  propColor: (assetId: string) => { color: string; label: string },
) {
  for (const prop of floor.props) {
    const asset = propColor(prop.assetId)
    drawPoint(ctx, toScreen, prop.x, prop.z, asset.color, asset.label, selected?.kind === 'prop' && selected.id === prop.id)
  }
  for (const spawn of floor.spawnPoints) {
    drawPoint(ctx, toScreen, spawn.x, spawn.z, '#e6493f', 'S', selected?.kind === 'spawn' && selected.id === spawn.id)
  }
  for (const exit of floor.exits) {
    drawPoint(ctx, toScreen, exit.x, exit.z, '#4dab5f', 'X', selected?.kind === 'exit' && selected.id === exit.id)
  }
}

/** Repere visuel sur le point accroche par le magnetisme, avec la raison de l'accroche. */
export function drawSnapHint(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  point: Point2,
  label: string,
) {
  const [sx, sy] = toScreen(point)
  ctx.save()
  ctx.strokeStyle = '#6de3ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(sx, sy, 8, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(sx - 11, sy)
  ctx.lineTo(sx + 11, sy)
  ctx.moveTo(sx, sy - 11)
  ctx.lineTo(sx, sy + 11)
  ctx.stroke()
  ctx.font = '700 11px system-ui'
  ctx.fillStyle = '#6de3ff'
  ctx.fillText(label, sx + 13, sy - 9)
  ctx.restore()
}

/** Mur en cours de trace, avec sa longueur et son angle affiches en direct. */
export function drawWallPreview(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  from: Point2,
  to: Point2,
  thickness: number,
  pixelsPerMeter: number,
) {
  const [ax, ay] = toScreen(from)
  const [bx, by] = toScreen(to)
  ctx.save()
  ctx.lineCap = 'butt'
  ctx.lineWidth = Math.max(2, thickness * pixelsPerMeter)
  ctx.strokeStyle = 'rgba(240,184,77,0.65)'
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()

  const length = Math.hypot(to.x - from.x, to.z - from.z)
  const degrees = ((Math.atan2(to.z - from.z, to.x - from.x) * 180) / Math.PI + 360) % 360
  const text = `${length.toFixed(2)} m · ${degrees.toFixed(0)}°`
  const midX = (ax + bx) / 2
  const midY = (ay + by) / 2
  ctx.font = '800 12px system-ui'
  const width = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(20,24,27,0.88)'
  ctx.fillRect(midX - width / 2 - 6, midY - 26, width + 12, 20)
  ctx.fillStyle = '#ffe9a8'
  ctx.textAlign = 'center'
  ctx.fillText(text, midX, midY - 12)
  ctx.textAlign = 'start'
  ctx.restore()
}

/** Contour en cours de trace pour un sol ou une piece. */
export function drawPolygonPreview(ctx: CanvasRenderingContext2D, toScreen: ToScreen, pts: [number, number][]) {
  if (pts.length < 2) return
  ctx.save()
  polygonPath(ctx, pts, toScreen)
  ctx.fillStyle = 'rgba(240,184,77,0.18)'
  ctx.fill()
  ctx.strokeStyle = COLORS.preview
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

/** Ouverture en cours de percement, surlignee sur son mur. */
export function drawOpeningPreview(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  wall: InteriorWall,
  opening: Pick<InteriorOpening, 'offset' | 'width'>,
  pixelsPerMeter: number,
) {
  const span = openingSpan(wall, { ...opening, sillHeight: 0, topHeight: 2 })
  const start = wallPointAt(wall, span.start)
  const end = wallPointAt(wall, span.end)
  const [sx, sy] = toScreen(start)
  const [ex, ey] = toScreen(end)
  ctx.save()
  ctx.lineCap = 'butt'
  ctx.lineWidth = Math.max(3, wall.thickness * pixelsPerMeter)
  ctx.strokeStyle = 'rgba(109,227,255,0.85)'
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.stroke()

  const text = `${opening.width.toFixed(2)} m`
  ctx.font = '800 12px system-ui'
  ctx.fillStyle = '#6de3ff'
  ctx.textAlign = 'center'
  ctx.fillText(text, (sx + ex) / 2, (sy + ey) / 2 - 12)
  ctx.textAlign = 'start'
  ctx.restore()
}

/** Angle du mur, utile a l'inspecteur. */
export function wallAngleDegrees(wall: InteriorWall) {
  return ((wallAngle(wall) * 180) / Math.PI + 360) % 360
}
