/**
 * 📐 Geometrie des interieurs — partagee par l'editeur ET le jeu.
 *
 * Ce module ne connait ni React ni Three.js : il ne fait que du calcul sur des murs (segments)
 * et des sols (polygones). L'editeur s'en sert pour dessiner le plan 2D et accrocher la souris ;
 * la vue 3D s'en sert pour construire les volumes et bloquer le joueur. Les deux DOIVENT partir
 * d'ici, sinon on retombe sur le probleme classique du mur qu'on voit mais qu'on traverse.
 */

export interface Point2 {
  x: number
  z: number
}

/** Un mur : un segment A -> B, avec une epaisseur. N'importe quel angle. */
export interface WallLike {
  ax: number
  az: number
  bx: number
  bz: number
  thickness: number
}

/** Un percement le long d'un mur, repere par la distance de son centre depuis A. */
export interface OpeningLike {
  offset: number
  width: number
  sillHeight: number
  topHeight: number
}

const EPSILON = 1e-6

export function wallLength(wall: WallLike) {
  return Math.hypot(wall.bx - wall.ax, wall.bz - wall.az)
}

/** Angle du mur en radians, mesure depuis l'axe X. */
export function wallAngle(wall: WallLike) {
  return Math.atan2(wall.bz - wall.az, wall.bx - wall.ax)
}

export function wallCenter(wall: WallLike): Point2 {
  return { x: (wall.ax + wall.bx) / 2, z: (wall.az + wall.bz) / 2 }
}

/** Vecteur unitaire de A vers B. Renvoie (1, 0) pour un mur de longueur nulle. */
export function wallDirection(wall: WallLike): Point2 {
  const length = wallLength(wall)
  if (length < EPSILON) return { x: 1, z: 0 }
  return { x: (wall.bx - wall.ax) / length, z: (wall.bz - wall.az) / length }
}

/** Point situe a `distance` metres de A, le long du mur. */
export function wallPointAt(wall: WallLike, distance: number): Point2 {
  const direction = wallDirection(wall)
  return { x: wall.ax + direction.x * distance, z: wall.az + direction.z * distance }
}

/**
 * Projette un point sur un mur.
 * `distanceAlong` est borne a la longueur du mur : le resultat est toujours SUR le segment,
 * jamais sur son prolongement — c'est ce qu'on veut pour accrocher une ouverture.
 */
export function projectOnWall(wall: WallLike, point: Point2) {
  const length = wallLength(wall)
  if (length < EPSILON) {
    return { distanceAlong: 0, distance: Math.hypot(point.x - wall.ax, point.z - wall.az), closest: { x: wall.ax, z: wall.az } }
  }
  const direction = wallDirection(wall)
  const raw = (point.x - wall.ax) * direction.x + (point.z - wall.az) * direction.z
  const distanceAlong = Math.min(length, Math.max(0, raw))
  const closest = wallPointAt(wall, distanceAlong)
  return { distanceAlong, distance: Math.hypot(point.x - closest.x, point.z - closest.z), closest }
}

/** Distance d'un point a l'AXE du mur (l'epaisseur n'est pas prise en compte). */
export function distanceToWall(point: Point2, wall: WallLike) {
  return projectOnWall(wall, point).distance
}

// --- Ouvertures ---------------------------------------------------------------------------

/** Portion occupee par une ouverture, bornee aux extremites du mur. */
export function openingSpan(wall: WallLike, opening: OpeningLike) {
  const length = wallLength(wall)
  const half = opening.width / 2
  return {
    start: Math.max(0, Math.min(length, opening.offset - half)),
    end: Math.max(0, Math.min(length, opening.offset + half)),
  }
}

/** Le point est-il dans le trou d'une ouverture (vu du dessus) ? Sert aux collisions. */
export function isDistanceInsideOpening(wall: WallLike, openings: OpeningLike[], distanceAlong: number) {
  return openings.some((opening) => {
    // Une fenetre ne laisse pas passer : elle ne touche pas le sol.
    if (opening.sillHeight > 0.01) return false
    const span = openingSpan(wall, opening)
    return distanceAlong >= span.start && distanceAlong <= span.end
  })
}

/** Un morceau plein de mur a construire en 3D, exprime le long du mur. */
export interface WallChunk {
  /** Distance depuis A ou commence le morceau. */
  start: number
  /** Distance depuis A ou il finit. */
  end: number
  /** Hauteur du bas du morceau (0 = pose au sol). */
  bottom: number
  /** Hauteur du haut. */
  top: number
}

/**
 * Decoupe un mur en morceaux pleins, en contournant ses ouvertures.
 *
 * C'est le coeur du "percer une ouverture sans supprimer le mur" : une porte laisse les
 * troncons de part et d'autre PLUS un linteau au-dessus, une fenetre ajoute en plus une
 * allege en dessous. Le mur reste entier partout ailleurs.
 */
export function getWallChunks(wall: WallLike, openings: OpeningLike[], wallHeight: number): WallChunk[] {
  const length = wallLength(wall)
  if (length < EPSILON) return []

  const spans = openings
    .map((opening) => ({ ...openingSpan(wall, opening), opening }))
    .filter((span) => span.end - span.start > EPSILON)
    .sort((a, b) => a.start - b.start)

  const chunks: WallChunk[] = []
  let cursor = 0

  for (const span of spans) {
    // Portion pleine avant l'ouverture, sur toute la hauteur.
    if (span.start - cursor > EPSILON) {
      chunks.push({ start: cursor, end: span.start, bottom: 0, top: wallHeight })
    }
    // Allege sous une fenetre.
    if (span.opening.sillHeight > EPSILON) {
      chunks.push({ start: span.start, end: span.end, bottom: 0, top: Math.min(span.opening.sillHeight, wallHeight) })
    }
    // Linteau au-dessus de l'ouverture.
    if (span.opening.topHeight < wallHeight - EPSILON) {
      chunks.push({ start: span.start, end: span.end, bottom: span.opening.topHeight, top: wallHeight })
    }
    cursor = Math.max(cursor, span.end)
  }

  if (length - cursor > EPSILON) {
    chunks.push({ start: cursor, end: length, bottom: 0, top: wallHeight })
  }
  return chunks
}

// --- Sols (polygones) ---------------------------------------------------------------------

/**
 * Le point est-il dans le polygone ? Algorithme du lancer de rayon : on compte combien de
 * fois un rayon partant du point traverse le contour. Nombre impair = dedans.
 */
export function pointInPolygon(point: Point2, pts: [number, number][]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, zi] = pts[i]
    const [xj, zj] = pts[j]
    const crosses = zi > point.z !== zj > point.z
    if (crosses && point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function polygonCentroid(pts: [number, number][]): Point2 {
  if (!pts.length) return { x: 0, z: 0 }
  const sum = pts.reduce((acc, [x, z]) => ({ x: acc.x + x, z: acc.z + z }), { x: 0, z: 0 })
  return { x: sum.x / pts.length, z: sum.z / pts.length }
}

/** Aire du polygone (formule du lacet), toujours positive. */
export function polygonArea(pts: [number, number][]) {
  let total = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    total += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1])
  }
  return Math.abs(total / 2)
}

export function polygonBounds(pts: [number, number][]) {
  const xs = pts.map(([x]) => x)
  const zs = pts.map(([, z]) => z)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

// --- Fabriques de formes ------------------------------------------------------------------

function roundPoint(x: number, z: number): [number, number] {
  return [Number(x.toFixed(3)), Number(z.toFixed(3))]
}

export function makeRectanglePolygon(x: number, z: number, w: number, d: number): [number, number][] {
  return [roundPoint(x, z), roundPoint(x + w, z), roundPoint(x + w, z + d), roundPoint(x, z + d)]
}

/**
 * Polygone approchant un arc de cercle.
 *
 * ⚠️ Un "rond" est toujours une suite de segments : `segments` regle la finesse. En cell-shading
 * cartoon, 16 segments suffisent largement pour un cercle complet — monter plus haut coute des
 * triangles sans que ca se voie.
 *
 * `sweep` = angle balaye en radians : 2π donne un disque, π un demi-disque, π/2 un quart.
 * Quand l'arc est partiel, le centre est ajoute au contour pour fermer la part de camembert.
 */
export function makeArcPolygon(
  cx: number,
  cz: number,
  radius: number,
  segments: number,
  sweep = Math.PI * 2,
  startAngle = 0,
): [number, number][] {
  const steps = Math.max(3, Math.round(segments))
  const full = Math.abs(sweep) >= Math.PI * 2 - 1e-3
  const pts: [number, number][] = []
  // Pour un arc partiel il faut un point de plus pour atteindre l'angle final.
  const count = full ? steps : steps + 1
  for (let i = 0; i < count; i += 1) {
    const angle = startAngle + (sweep * i) / steps
    pts.push(roundPoint(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius))
  }
  if (!full) pts.push(roundPoint(cx, cz))
  return pts
}

export function makeCirclePolygon(cx: number, cz: number, radius: number, segments = 16): [number, number][] {
  return makeArcPolygon(cx, cz, radius, segments, Math.PI * 2)
}

/** Polygone regulier a `sides` cotes (5 = pentagone, 6 = hexagone...). */
export function makeRegularPolygon(cx: number, cz: number, radius: number, sides: number, rotation = 0): [number, number][] {
  return makeArcPolygon(cx, cz, radius, Math.max(3, Math.round(sides)), Math.PI * 2, rotation)
}

// --- Escaliers ----------------------------------------------------------------------------

/**
 * Une volee d'escalier, vue du dessus : un rectangle pose a plat.
 *
 * ⚠️ Convention a ne pas casser : la volee **monte le long de son axe Z local**, sa largeur est
 * sur son axe X local. Le bas de la volee est donc a `z local = -length / 2`, le haut a
 * `+length / 2`, et `rotation` decide vers ou ca monte dans le monde. Sans cette convention, un
 * escalier tourne monterait dans le vide.
 *
 * Une volee n'existe qu'**une fois**, sur l'etage du BAS, et relie cet etage a `targetFloorId`.
 * On ne la duplique pas en haut : ce serait deux escaliers superposes.
 */
export interface StairsLike {
  x: number
  z: number
  rotation: number
  width: number
  length: number
}

/** Passe des coordonnees locales de la volee aux coordonnees du monde. */
export function stairsToWorld(stairs: StairsLike, localX: number, localZ: number): Point2 {
  const cos = Math.cos(stairs.rotation)
  const sin = Math.sin(stairs.rotation)
  return {
    x: stairs.x + localX * cos + localZ * sin,
    z: stairs.z - localX * sin + localZ * cos,
  }
}

/** Passe d'un point du monde aux coordonnees locales de la volee. */
export function stairsToLocal(stairs: StairsLike, point: Point2) {
  const dx = point.x - stairs.x
  const dz = point.z - stairs.z
  const cos = Math.cos(stairs.rotation)
  const sin = Math.sin(stairs.rotation)
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }
}

/** Les 4 coins de l'emprise, dans l'ordre du contour. Sert au dessin du plan 2D. */
export function stairsCorners(stairs: StairsLike): [number, number][] {
  const halfWidth = stairs.width / 2
  const halfLength = stairs.length / 2
  return (
    [
      [-halfWidth, -halfLength],
      [halfWidth, -halfLength],
      [halfWidth, halfLength],
      [-halfWidth, halfLength],
    ] as [number, number][]
  ).map(([localX, localZ]) => {
    const point = stairsToWorld(stairs, localX, localZ)
    return [point.x, point.z] as [number, number]
  })
}

/**
 * Ou en est-on dans la montee ? `0` = en bas, `1` = arrive en haut, `null` = hors de l'emprise.
 *
 * `margin` elargit l'emprise : le joueur a un rayon, il doit pouvoir aborder la marche du bas
 * sans etre deja pile dessus.
 */
export function stairsProgress(stairs: StairsLike, point: Point2, margin = 0): number | null {
  const local = stairsToLocal(stairs, point)
  if (Math.abs(local.x) > stairs.width / 2 + margin) return null
  if (Math.abs(local.z) > stairs.length / 2 + margin) return null
  const raw = (local.z + stairs.length / 2) / Math.max(0.01, stairs.length)
  return Math.min(1, Math.max(0, raw))
}

/** Hauteur du nez de marche a cet endroit de la volee. */
export function stairsHeightAt(progress: number, fromElevation: number, toElevation: number) {
  return fromElevation + (toElevation - fromElevation) * progress
}

// --- Aides au trace -----------------------------------------------------------------------

/**
 * Contraint le point d'arrivee sur un multiple d'angle depuis le point de depart.
 * Avec un pas de 15°, on obtient gratuitement l'horizontale, la verticale et les diagonales.
 */
export function constrainAngle(from: Point2, to: Point2, stepDegrees = 15): Point2 {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.hypot(dx, dz)
  if (length < EPSILON) return { ...to }
  const step = (stepDegrees * Math.PI) / 180
  const angle = Math.round(Math.atan2(dz, dx) / step) * step
  return { x: from.x + Math.cos(angle) * length, z: from.z + Math.sin(angle) * length }
}

/** Angle du segment en degres, ramene dans [0, 360[ — pour l'affichage des cotes. */
export function angleDegrees(from: Point2, to: Point2) {
  const degrees = (Math.atan2(to.z - from.z, to.x - from.x) * 180) / Math.PI
  return (degrees + 360) % 360
}

/**
 * Fusionne les murs colineaires qui se recouvrent, en un seul mur par intervalle continu.
 *
 * Sert a la conversion des anciennes donnees : deux pieces collees produisaient chacune leur
 * propre mur sur l'arete commune, donc deux murs superposes. On les regroupe par droite
 * porteuse (meme direction, meme decalage), puis on fusionne les intervalles qui se touchent.
 */
export function mergeCollinearWalls<T extends WallLike>(walls: T[], tolerance = 0.01): WallLike[] {
  interface Line {
    // Repere de la droite : origine + direction unitaire.
    ox: number
    oz: number
    dx: number
    dz: number
    thickness: number
    spans: { start: number; end: number }[]
  }
  const lines: Line[] = []

  for (const wall of walls) {
    if (wallLength(wall) < tolerance) continue
    let direction = wallDirection(wall)
    // On oriente toutes les droites dans le meme sens, sinon A->B et B->A ne se reconnaissent pas.
    if (direction.x < -tolerance || (Math.abs(direction.x) <= tolerance && direction.z < 0)) {
      direction = { x: -direction.x, z: -direction.z }
    }

    const project = (x: number, z: number) => x * direction.x + z * direction.z
    // Distance signee a l'origine, perpendiculairement a la droite : identifie la droite porteuse.
    const offset = -wall.ax * direction.z + wall.az * direction.x

    let line = lines.find(
      (item) =>
        Math.abs(item.dx - direction.x) <= tolerance &&
        Math.abs(item.dz - direction.z) <= tolerance &&
        Math.abs(-item.ox * item.dz + item.oz * item.dx - offset) <= tolerance &&
        Math.abs(item.thickness - wall.thickness) <= tolerance,
    )
    if (!line) {
      line = { ox: wall.ax, oz: wall.az, dx: direction.x, dz: direction.z, thickness: wall.thickness, spans: [] }
      lines.push(line)
    }

    const a = project(wall.ax, wall.az)
    const b = project(wall.bx, wall.bz)
    line.spans.push({ start: Math.min(a, b), end: Math.max(a, b) })
  }

  const merged: WallLike[] = []
  for (const line of lines) {
    const spans = [...line.spans].sort((a, b) => a.start - b.start)
    const unions: { start: number; end: number }[] = []
    for (const span of spans) {
      const last = unions[unions.length - 1]
      if (last && span.start <= last.end + tolerance) last.end = Math.max(last.end, span.end)
      else unions.push({ ...span })
    }
    // Un point de la droite, pour repasser des distances aux coordonnees monde.
    const baseProjection = line.ox * line.dx + line.oz * line.dz
    for (const union of unions) {
      const toWorld = (distance: number) => ({
        x: line.ox + line.dx * (distance - baseProjection),
        z: line.oz + line.dz * (distance - baseProjection),
      })
      const a = toWorld(union.start)
      const b = toWorld(union.end)
      merged.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, thickness: line.thickness })
    }
  }
  return merged
}
