import { BUILDINGS } from '../world/beauvais/cityData'

/**
 * Outils de dessin 2D "vue du dessus" partagés par la minimap et la grande carte.
 *
 * On dessine les empreintes des bâtiments (les mêmes données que la 3D) sur un
 * canvas 2D. Convention : l'axe Z du monde (sud) va vers le BAS de l'écran → le
 * nord est en haut, comme une vraie carte.
 */

export interface MapView {
  centerX: number // point du monde (mètres) au centre du canvas
  centerZ: number
  scale: number // pixels par mètre
  w: number // largeur du canvas (px)
  h: number // hauteur du canvas (px)
}

function worldToScreenX(view: MapView, x: number): number {
  return view.w / 2 + (x - view.centerX) * view.scale
}
function worldToScreenY(view: MapView, z: number): number {
  return view.h / 2 + (z - view.centerZ) * view.scale
}

interface BuildingStyle {
  fill: string
  /** Ne dessine que les bâtiments dont le centre est à moins de N mètres du centre. */
  cullRadius?: number
}

/** Dessine les empreintes des bâtiments sur le contexte 2D. */
export function drawBuildings(ctx: CanvasRenderingContext2D, view: MapView, style: BuildingStyle) {
  ctx.fillStyle = style.fill
  const cull2 = style.cullRadius ? style.cullRadius * style.cullRadius : Infinity

  for (const b of BUILDINGS) {
    if (style.cullRadius) {
      const dx = b.cx - view.centerX
      const dz = b.cz - view.centerZ
      if (dx * dx + dz * dz > cull2) continue
    }
    const pts = b.pts
    ctx.beginPath()
    ctx.moveTo(worldToScreenX(view, pts[0][0]), worldToScreenY(view, pts[0][1]))
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(worldToScreenX(view, pts[i][0]), worldToScreenY(view, pts[i][1]))
    }
    ctx.closePath()
    ctx.fill()
  }
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
  const px = worldToScreenX(view, worldX)
  const py = worldToScreenY(view, worldZ)

  // Direction "avant" du perso à l'écran (x droite, y bas).
  const fx = Math.sin(angle)
  const fy = Math.cos(angle)
  // Perpendiculaire (côté droit).
  const rx = -fy
  const ry = fx

  ctx.beginPath()
  ctx.moveTo(px + fx * size, py + fy * size) // pointe
  ctx.lineTo(px - fx * size * 0.6 + rx * size * 0.6, py - fy * size * 0.6 + ry * size * 0.6)
  ctx.lineTo(px - fx * size * 0.6 - rx * size * 0.6, py - fy * size * 0.6 - ry * size * 0.6)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
}
