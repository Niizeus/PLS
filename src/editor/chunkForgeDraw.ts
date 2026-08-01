import { ROADS } from '../world/beauvais/cityData'
import type { Famille, Passport } from './chunkForgeData'

/**
 * 🖌️ chunkForgeDraw.ts — dessin du plan de quartier de ChunkForge.
 *
 * Canvas et non SVG : on affiche ~2 000 emprises plus le réseau de rues, et on veut
 * pouvoir déplacer et zoomer sans à-coups. En SVG, ça ferait 2 000 nœuds DOM à
 * recalculer à chaque image.
 *
 * Le dessin est SANS ÉTAT : il reçoit tout ce qu'il doit afficher. Ça permet de le
 * rejouer à l'identique et de ne jamais avoir de rendu qui « traîne » derrière l'état
 * réel de l'interface.
 */

export interface Vue {
  /** Centre de la vue, en mètres monde. */
  cx: number
  cz: number
  /** Pixels par mètre. */
  echelle: number
}

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface DrawOptions {
  passports: Passport[]
  familles: Famille[]
  vue: Vue
  /** Zone de travail choisie sur le plan. `null` = tout le chunk. */
  selection: Rect | null
  /** Rectangle en cours de tracé à la souris. */
  enCours: Rect | null
  /** Famille mise en avant : les autres passent en sourdine. */
  surligne: string | null
  /** Bâtiment inspecté. */
  actifId: string | null
  /** N'afficher que ce qui reste à valider. */
  filtreAValider: boolean
  /** Bâtiments corrigés à la main, à distinguer d'un coup d'œil. */
  overrides: Record<string, { archetype: string }>
}

export function contient(r: Rect, x: number, z: number) {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ
}

export function normaliseRect(a: { x: number; z: number }, b: { x: number; z: number }): Rect {
  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minZ: Math.min(a.z, b.z),
    maxZ: Math.max(a.z, b.z),
  }
}

/** Monde → écran. */
export function versEcran(vue: Vue, w: number, h: number, x: number, z: number): [number, number] {
  return [(x - vue.cx) * vue.echelle + w / 2, (z - vue.cz) * vue.echelle + h / 2]
}

/** Écran → monde. Indispensable pour savoir où on a cliqué. */
export function versMonde(vue: Vue, w: number, h: number, px: number, pz: number): [number, number] {
  return [(px - w / 2) / vue.echelle + vue.cx, (pz - h / 2) / vue.echelle + vue.cz]
}

export function dessiner(ctx: CanvasRenderingContext2D, o: DrawOptions) {
  const { width: w, height: h } = ctx.canvas
  const { vue } = o
  const P = (x: number, z: number) => versEcran(vue, w, h, x, z)

  ctx.fillStyle = '#12141a'
  ctx.fillRect(0, 0, w, h)

  // --- Les rues d'abord, en fond : ce sont elles qui rendent le plan lisible.
  // On les dessine à leur vraie largeur, comme sur la page d'annotation.
  ctx.lineCap = 'round'
  for (const r of ROADS) {
    if (r.cls === 'track') continue
    ctx.beginPath()
    let visible = false
    for (let i = 0; i < r.pts.length; i++) {
      const [x, z] = r.pts[i]
      const [px, pz] = P(x, z)
      if (px > -50 && px < w + 50 && pz > -50 && pz < h + 50) visible = true
      if (i === 0) ctx.moveTo(px, pz)
      else ctx.lineTo(px, pz)
    }
    if (!visible) continue
    ctx.strokeStyle = r.cls === 'pedestrian' ? '#242a33' : '#2b323d'
    ctx.lineWidth = Math.max(1, (r.w ?? 4) * vue.echelle)
    ctx.stroke()
  }

  // --- Les bâtiments, colorés par famille.
  const couleurs = new Map(o.familles.map((f) => [f.key, f.color]))
  for (const p of o.passports) {
    const [px, pz] = P(p.cx, p.cz)
    if (px < -60 || px > w + 60 || pz < -60 || pz > h + 60) continue

    const corrige = o.overrides[p.id] != null
    const famille = corrige ? o.overrides[p.id].archetype : p.archetype
    const aValider = p.confidence < 0.55 && !corrige && !p.suspect

    if (o.filtreAValider && !aValider) continue

    // Mise en sourdine : on garde le contexte visible sans qu'il attire l'œil.
    let alpha = 1
    if (o.surligne && famille !== o.surligne) alpha = 0.15
    if (o.selection && !contient(o.selection, p.cx, p.cz)) alpha *= 0.35

    ctx.globalAlpha = alpha
    ctx.beginPath()
    for (let i = 0; i < p.pts.length; i++) {
      const [x, z] = p.pts[i]
      const [ax, az] = P(x, z)
      if (i === 0) ctx.moveTo(ax, az)
      else ctx.lineTo(ax, az)
    }
    ctx.closePath()

    ctx.fillStyle = couleurs.get(famille) ?? '#3a3f4a'
    ctx.fill()

    // Les emprises aberrantes sont hachurées : il n'y a rien à y décider tant que
    // la géométrie n'est pas réparée, il ne faut pas perdre de temps dessus.
    if (p.suspect) {
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fill()
    } else if (corrige) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else if (aValider && vue.echelle > 0.25) {
      ctx.strokeStyle = 'rgba(224,123,123,0.85)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  // --- Le bâtiment inspecté, par-dessus tout le reste.
  const actif = o.passports.find((p) => p.id === o.actifId)
  if (actif) {
    ctx.beginPath()
    for (let i = 0; i < actif.pts.length; i++) {
      const [ax, az] = P(actif.pts[i][0], actif.pts[i][1])
      if (i === 0) ctx.moveTo(ax, az)
      else ctx.lineTo(ax, az)
    }
    ctx.closePath()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Un halo, pour le retrouver même quand il est minuscule à l'écran.
    const [hx, hz] = P(actif.cx, actif.cz)
    ctx.beginPath()
    ctx.arc(hx, hz, 16, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // --- La zone de travail.
  const cadre = o.enCours ?? o.selection
  if (cadre) {
    const [x1, z1] = P(cadre.minX, cadre.minZ)
    const [x2, z2] = P(cadre.maxX, cadre.maxZ)
    ctx.strokeStyle = o.enCours ? '#ffffff' : '#e8b84b'
    ctx.setLineDash(o.enCours ? [5, 4] : [])
    ctx.lineWidth = 1.5
    ctx.strokeRect(x1, z1, x2 - x1, z2 - z1)
    ctx.setLineDash([])
  }

  // --- Échelle : sans elle on ne sait plus si on regarde un îlot ou un quartier.
  const metres = vue.echelle > 1 ? 20 : vue.echelle > 0.4 ? 50 : 100
  const long = metres * vue.echelle
  ctx.strokeStyle = '#9fb0c8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(14, h - 16)
  ctx.lineTo(14 + long, h - 16)
  ctx.stroke()
  ctx.fillStyle = '#9fb0c8'
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${metres} m`, 14 + long / 2, h - 21)

  // --- Le nord. Rappel : dans le repère du jeu, z négatif = nord (voir geo.mjs),
  // donc le nord est bien vers le haut.
  ctx.beginPath()
  ctx.moveTo(w - 20, 30)
  ctx.lineTo(w - 20, 12)
  ctx.strokeStyle = '#9fb0c8'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillText('N', w - 20, 44)
  ctx.textAlign = 'left'
}

/** Le bâtiment le plus proche d'un point du monde, dans un rayon donné. */
export function batimentA(passports: Passport[], x: number, z: number, rayon: number) {
  let best: Passport | null = null
  let bestD = rayon
  for (const p of passports) {
    const d = Math.hypot(p.cx - x, p.cz - z)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}
