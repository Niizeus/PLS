import { BUILDINGS, ROADS, WATERS, type Building } from '../world/beauvais/cityData'
import { ZONES } from '../world/beauvais/zones'

/**
 * Outils de dessin 2D "vue du dessus" partagés par la minimap et la grande carte.
 *
 * On dessine les empreintes (les mêmes données que la 3D) sur un canvas 2D.
 * Convention : l'axe Z du monde (sud) va vers le BAS de l'écran → le nord est en
 * haut, comme une vraie carte.
 */

export interface MapView {
  centerX: number // point du monde (mètres) au centre du canvas
  centerZ: number
  scale: number // pixels par mètre
  w: number // largeur du canvas (px)
  h: number // hauteur du canvas (px)
}

const sx = (view: MapView, x: number) => view.w / 2 + (x - view.centerX) * view.scale
const sy = (view: MapView, z: number) => view.h / 2 + (z - view.centerZ) * view.scale

/** Dessine les plans d'eau (remplis). */
export function drawWater(ctx: CanvasRenderingContext2D, view: MapView, fill: string) {
  ctx.fillStyle = fill
  for (const w of WATERS) {
    const pts = w.pts
    ctx.beginPath()
    ctx.moveTo(sx(view, pts[0][0]), sy(view, pts[0][1]))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(sx(view, pts[i][0]), sy(view, pts[i][1]))
    ctx.closePath()
    ctx.fill()
  }
}

/** Dessine les routes (traits épais selon leur largeur). */
export function drawRoads(ctx: CanvasRenderingContext2D, view: MapView, color: string) {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const r of ROADS) {
    const pts = r.pts
    if (pts.length < 2) continue
    ctx.lineWidth = Math.max(0.6, r.w * view.scale)
    ctx.beginPath()
    ctx.moveTo(sx(view, pts[0][0]), sy(view, pts[0][1]))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(sx(view, pts[i][0]), sy(view, pts[i][1]))
    ctx.stroke()
  }
}

/**
 * Dessine les empreintes des bâtiments. Par défaut TOUS ; passe une liste
 * réduite (ex : les bâtiments proches, via collision.buildingsNear) pour aller
 * beaucoup plus vite sur la minimap.
 */
export function drawBuildings(
  ctx: CanvasRenderingContext2D,
  view: MapView,
  fill: string,
  buildings: Building[] = BUILDINGS,
) {
  ctx.fillStyle = fill
  for (const b of buildings) {
    const pts = b.pts
    ctx.beginPath()
    ctx.moveTo(sx(view, pts[0][0]), sy(view, pts[0][1]))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(sx(view, pts[i][0]), sy(view, pts[i][1]))
    ctx.closePath()
    ctx.fill()
  }
}

/**
 * Dessine les quartiers : contour teinté + remplissage léger + nom au centre.
 * Sert à visualiser (et bientôt éditer) le découpage de la ville.
 */
export function drawZones(ctx: CanvasRenderingContext2D, view: MapView) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const zone of ZONES) {
    const pts = zone.pts
    if (pts.length < 3) continue
    ctx.beginPath()
    ctx.moveTo(sx(view, pts[0][0]), sy(view, pts[0][1]))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(sx(view, pts[i][0]), sy(view, pts[i][1]))
    ctx.closePath()
    ctx.fillStyle = zone.color + '22' // ~13% d'opacité (teinte discrète)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = zone.color
    ctx.stroke()

    // Nom du quartier au centre (moyenne des points).
    let cx = 0
    let cz = 0
    for (const [x, z] of pts) {
      cx += x
      cz += z
    }
    cx /= pts.length
    cz /= pts.length
    const [lx, ly] = [sx(view, cx), sy(view, cz)]
    ctx.font = '700 13px system-ui'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.fillStyle = zone.color
    ctx.strokeText(zone.name, lx, ly)
    ctx.fillText(zone.name, lx, ly)
  }
  ctx.restore()
}

/**
 * Dessine le marqueur du joueur (une flèche pointant dans sa direction).
 * `angle` = rotation Y du perso (même convention que le déplacement : atan2(x, z)).
 */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  view: MapView,
  worldX: number,
  worldZ: number,
  angle: number,
  size = 7,
  color = '#ff5a4d',
) {
  const px = sx(view, worldX)
  const py = sy(view, worldZ)
  const fx = Math.sin(angle)
  const fy = Math.cos(angle)
  const rx = -fy
  const ry = fx

  ctx.beginPath()
  ctx.moveTo(px + fx * size, py + fy * size)
  ctx.lineTo(px - fx * size * 0.6 + rx * size * 0.6, py - fy * size * 0.6 + ry * size * 0.6)
  ctx.lineTo(px - fx * size * 0.6 - rx * size * 0.6, py - fy * size * 0.6 - ry * size * 0.6)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
}
