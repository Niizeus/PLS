/**
 * 🏗️ Generateur de plans d'interieurs.
 *
 * Partir d'une piece vide de 6x5 m et tout tracer a la main prend du temps pour un resultat
 * qui est toujours le meme squelette : une enveloppe, des cloisons, des portes entre les pieces,
 * des fenetres dehors, un point d'arrivee et une sortie. Ce module fabrique ce squelette.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * 🧠 COMMENT CA MARCHE
 *
 * Un template ne decrit PAS des murs : il decrit des **pieces rectangulaires** (`PlanRoom`).
 * `buildFloorPlan` en deduit les murs, et c'est la tout l'interet :
 *
 *  1. chaque piece donne ses 4 aretes ;
 *  2. chaque arete est **coupee** aux coordonnees des angles des autres pieces, sinon deux pieces
 *     de tailles differentes ne reconnaitraient jamais leur bout de mur commun ;
 *  3. les morceaux identiques sont **dedupliques** : une cloison partagee ne devient qu'un mur ;
 *  4. chaque morceau est **classe** en tapant a 8 cm de part et d'autre : deux pieces autour =
 *     cloison, une seule = mur exterieur, la meme piece des deux cotes = rien du tout ;
 *  5. les morceaux colineaires qui se touchent sont **refusionnes** en murs longs (un mur de facade
 *     plutot que six bouts) ;
 *  6. les portes vont au milieu de la separation entre deux pieces, les fenetres au milieu de
 *     chaque facade de piece habitable.
 *
 * Consequence utile : deux pieces qui portent le meme `group` ne sont **pas** separees par un mur.
 * C'est comme ca qu'on obtient une cuisine ouverte sur le sejour (piece en L), ou un croisement
 * d'egouts ou les galeries se rejoignent a ciel ouvert.
 *
 * Le resultat est un `InteriorDefinition` normal : une fois genere, tout est editable mur par mur
 * dans l'editeur. Le generateur ne cree pas un objet special, il fait gagner le premier quart
 * d'heure.
 */

import { makeRectanglePolygon, projectOnWall, type Point2 } from './interiorGeometry'
import type {
  InteriorDefinition,
  InteriorFloor,
  InteriorOpening,
  InteriorProp,
  InteriorSpawnPoint,
  InteriorSurface,
  InteriorTarget,
  InteriorType,
  InteriorWall,
} from './interiors'

const WALL_THICKNESS = 0.18
/** Tolerance de comparaison des coordonnees : en dessous, deux points sont « le meme ». */
const TOLERANCE = 0.005
/** Distance a laquelle on tate de chaque cote d'un mur pour savoir ce qu'il separe. */
const PROBE = 0.08

// --- Pieces d'un plan ------------------------------------------------------------------------

export type RoomRole =
  | 'sejour'
  | 'cuisine'
  | 'chambre'
  | 'sdb'
  | 'wc'
  | 'couloir'
  | 'palier'
  | 'boutique'
  | 'bureau'
  | 'reserve'
  | 'salle'
  | 'galerie'
  | 'cave'
  | 'technique'

export interface PlanRoom {
  id: string
  name: string
  role: RoomRole
  /** Coin (x, z) le plus petit, en metres. */
  x: number
  z: number
  w: number
  d: number
  /**
   * Pieces du meme groupe = un seul espace : la cloison entre elles n'est pas construite.
   * Sert aux pieces en L (cuisine ouverte) et aux croisements de galeries.
   * Absent = la piece est seule dans son groupe.
   */
  group?: string
  /**
   * Piece qui definit des murs mais **aucun sol** : la tremie d'escalier a l'etage.
   *
   * Sans elle, l'etage n'aurait pas de mur exterieur au-dessus de la cage d'escalier (aucune piece
   * de part et d'autre = aucun mur). Avec elle, les murs sont construits, le trou reste ouvert, et
   * aucune porte n'y mene : on ne dessert pas une chambre par le vide.
   */
  noSurface?: boolean
  /**
   * Piece qui a un sol mais ne **dessert** rien : aucune porte ne s'ouvre sur elle.
   *
   * C'est la cage d'escalier au rez-de-chaussee. Elle fait partie du couloir (on marche dessous et
   * on y prend les marches), mais une porte posee sur cette portion donnerait **sous la volee** :
   * le plan montrerait une porte que le joueur ne peut pas franchir.
   */
  noDoors?: boolean
}

/**
 * Roles qui font circuler : c'est de la que doivent partir les portes.
 * Sans cette notion, une chambre pourrait se retrouver desservie par la chambre voisine.
 */
const circulationRoles = new Set<RoomRole>(['couloir', 'palier', 'sejour', 'salle', 'boutique', 'galerie', 'cave'])

/** Roles qui n'ont droit qu'a UNE porte : une chambre avec trois portes n'est plus une chambre. */
const singleDoorRoles = new Set<RoomRole>(['chambre', 'sdb', 'wc', 'bureau', 'reserve', 'technique'])

/**
 * Largeur minimale d'une ouverture praticable.
 *
 * ⚠️ Le joueur fait `PLAYER_RADIUS` de rayon (0,34 m, donc 0,68 m de large) et doit tenir
 * ENTIEREMENT dans l'ouverture, pas seulement la toucher. Une porte de 0,70 m laissait 2 cm de
 * marge : la piece etait fermee en pratique alors que le plan montrait une porte. Toute largeur
 * generee reste au-dessus de ce seuil, ou l'ouverture n'est pas posee du tout.
 */
const MIN_WALKABLE_WIDTH = 0.85

/** Largeur de la porte qui mene dans une piece de ce role. */
const doorWidths: Record<RoomRole, number> = {
  sejour: 1.1,
  cuisine: 1,
  chambre: 0.9,
  sdb: 0.9,
  wc: 0.9,
  couloir: 1,
  palier: 1,
  boutique: 1.4,
  bureau: 0.9,
  reserve: 1,
  salle: 1.4,
  galerie: 1.8,
  technique: 1.4,
  cave: 1.2,
}

// --- Petits outils ---------------------------------------------------------------------------

function r3(value: number) {
  return Number(value.toFixed(3))
}

/**
 * Generateur aleatoire a graine (mulberry32).
 *
 * `Math.random()` donnerait un plan different a chaque rendu React ; avec une graine, un plan est
 * reproductible — on peut redemander exactement le meme, ou en tirer un nouveau a volonte.
 */
export function makeRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Valeur autour de `base`, a `spread` metres pres, arrondie au pas (25 cm par defaut). */
function jitter(rng: () => number, base: number, spread: number, step = 0.25) {
  const value = base + (rng() * 2 - 1) * spread
  return Number((Math.round(value / step) * step).toFixed(2))
}

function groupOf(room: PlanRoom) {
  return room.group ?? room.id
}

function roomContains(room: PlanRoom, point: Point2) {
  return (
    point.x > room.x + TOLERANCE &&
    point.x < room.x + room.w - TOLERANCE &&
    point.z > room.z + TOLERANCE &&
    point.z < room.z + room.d - TOLERANCE
  )
}

// --- Moteur : des pieces vers des murs -------------------------------------------------------

/** Une arete horizontale ou verticale, reperee par sa coordonnee fixe et son intervalle. */
interface Segment {
  horizontal: boolean
  fixed: number
  start: number
  end: number
}

/** Un morceau d'arete, une fois qu'on sait ce qu'il separe. */
interface ClassifiedSegment {
  segment: Segment
  kind: 'exterior' | 'partition'
  /** Mur exterieur : la seule piece derriere. Cloison : la premiere des deux. */
  roomIndex: number
  /** Cloison uniquement : l'autre piece. */
  otherIndex?: number
}

interface BuiltWall {
  wall: InteriorWall
  segment: Segment
  kind: 'exterior' | 'partition'
}

function segmentPoints(segment: Segment) {
  return segment.horizontal
    ? { a: { x: segment.start, z: segment.fixed }, b: { x: segment.end, z: segment.fixed } }
    : { a: { x: segment.fixed, z: segment.start }, b: { x: segment.fixed, z: segment.end } }
}

function segmentMiddle(segment: Segment): Point2 {
  const middle = (segment.start + segment.end) / 2
  return segment.horizontal ? { x: middle, z: segment.fixed } : { x: segment.fixed, z: middle }
}

function segmentLength(segment: Segment) {
  return segment.end - segment.start
}

/** Coupe une arete a chaque valeur donnee, en ignorant celles qui tombent sur ses extremites. */
function splitSegment(segment: Segment, cuts: number[]): Segment[] {
  const inside = cuts
    .filter((value) => value > segment.start + TOLERANCE && value < segment.end - TOLERANCE)
    .sort((a, b) => a - b)
  const bounds = [segment.start, ...inside, segment.end]
  const pieces: Segment[] = []
  for (let i = 0; i < bounds.length - 1; i += 1) {
    if (bounds[i + 1] - bounds[i] <= TOLERANCE) continue
    pieces.push({ horizontal: segment.horizontal, fixed: segment.fixed, start: bounds[i], end: bounds[i + 1] })
  }
  return pieces
}

/**
 * Etape 1 a 4 : les aretes des pieces deviennent des morceaux uniques, chacun sachant s'il donne
 * dehors ou s'il separe deux pieces.
 */
function classifySegments(rooms: PlanRoom[]): ClassifiedSegment[] {
  const xs = [...new Set(rooms.flatMap((room) => [r3(room.x), r3(room.x + room.w)]))]
  const zs = [...new Set(rooms.flatMap((room) => [r3(room.z), r3(room.z + room.d)]))]

  // Cle = geometrie du morceau : deux pieces voisines produisent exactement la meme, donc un
  // seul mur au lieu de deux murs superposes.
  const unique = new Map<string, Segment>()
  rooms.forEach((room) => {
    const edges: Segment[] = [
      { horizontal: true, fixed: room.z, start: room.x, end: room.x + room.w },
      { horizontal: true, fixed: room.z + room.d, start: room.x, end: room.x + room.w },
      { horizontal: false, fixed: room.x, start: room.z, end: room.z + room.d },
      { horizontal: false, fixed: room.x + room.w, start: room.z, end: room.z + room.d },
    ]
    for (const edge of edges) {
      for (const piece of splitSegment(edge, edge.horizontal ? xs : zs)) {
        unique.set(`${edge.horizontal ? 'h' : 'v'}|${r3(piece.fixed)}|${r3(piece.start)}|${r3(piece.end)}`, piece)
      }
    }
  })

  const classified: ClassifiedSegment[] = []
  for (const segment of unique.values()) {
    const middle = segmentMiddle(segment)
    const normal = segment.horizontal ? { x: 0, z: 1 } : { x: 1, z: 0 }
    const sideA = { x: middle.x + normal.x * PROBE, z: middle.z + normal.z * PROBE }
    const sideB = { x: middle.x - normal.x * PROBE, z: middle.z - normal.z * PROBE }

    const inA = rooms.map((room, index) => (roomContains(room, sideA) ? index : -1)).filter((index) => index >= 0)
    const inB = rooms.map((room, index) => (roomContains(room, sideB) ? index : -1)).filter((index) => index >= 0)

    if (inA.length && inB.length) {
      // Meme espace des deux cotes (piece en L, croisement de galeries) : aucun mur ici.
      const groupsA = new Set(inA.map((index) => groupOf(rooms[index])))
      if (inB.some((index) => groupsA.has(groupOf(rooms[index])))) continue
      classified.push({ segment, kind: 'partition', roomIndex: inA[0], otherIndex: inB[0] })
    } else if (inA.length || inB.length) {
      classified.push({ segment, kind: 'exterior', roomIndex: inA.length ? inA[0] : inB[0] })
    }
    // Aucune piece des deux cotes : morceau orphelin, on le jette.
  }
  return classified
}

/** Etape 5 : les morceaux alignes et jointifs de meme nature redeviennent un seul mur. */
function mergeSegments(segments: ClassifiedSegment[], idPrefix: string): BuiltWall[] {
  const lines = new Map<string, Segment[]>()
  for (const item of segments) {
    const key = `${item.segment.horizontal ? 'h' : 'v'}|${r3(item.segment.fixed)}|${item.kind}`
    const list = lines.get(key)
    if (list) list.push(item.segment)
    else lines.set(key, [item.segment])
  }

  const walls: BuiltWall[] = []
  let index = 0
  for (const [key, list] of lines) {
    const kind = key.endsWith('exterior') ? ('exterior' as const) : ('partition' as const)
    const sorted = [...list].sort((a, b) => a.start - b.start)
    const spans: Segment[] = []
    for (const segment of sorted) {
      const last = spans[spans.length - 1]
      if (last && segment.start <= last.end + TOLERANCE) last.end = Math.max(last.end, segment.end)
      else spans.push({ ...segment })
    }
    for (const span of spans) {
      index += 1
      const { a, b } = segmentPoints(span)
      walls.push({
        segment: span,
        kind,
        wall: {
          id: `${idPrefix}_mur_${index}`,
          name: kind === 'exterior' ? `Mur exterieur ${index}` : `Cloison ${index}`,
          ax: r3(a.x),
          az: r3(a.z),
          bx: r3(b.x),
          bz: r3(b.z),
          thickness: WALL_THICKNESS,
          material: 'proto_wall',
          openings: [],
        },
      })
    }
  }
  return walls
}

/** Retrouve le mur construit qui porte ce point, pour y percer une ouverture. */
function wallAt(walls: BuiltWall[], point: Point2, horizontal: boolean, fixed: number, kind: 'exterior' | 'partition') {
  return (
    walls.find((item) => {
      if (item.kind !== kind || item.segment.horizontal !== horizontal) return false
      if (Math.abs(item.segment.fixed - fixed) > TOLERANCE) return false
      const along = horizontal ? point.x : point.z
      return along >= item.segment.start - TOLERANCE && along <= item.segment.end + TOLERANCE
    }) ?? null
  )
}

/**
 * Perce une ouverture centree sur `point`, si elle tient sur le mur sans coller aux angles.
 *
 * `minWidth` est le garde-fou important : plutot que de rogner une porte jusqu'a une fente ou le
 * joueur ne passe pas, on **rapproche d'abord l'ouverture des angles**, et si ca ne suffit toujours
 * pas on ne la pose pas du tout. Une porte trop etroite est un piege : le plan montre un passage,
 * le joueur se cogne.
 */
function pierce(
  target: BuiltWall,
  point: Point2,
  width: number,
  opening: Omit<InteriorOpening, 'offset' | 'width'>,
  margin = 0.3,
  minWidth = MIN_WALKABLE_WIDTH,
) {
  const length = segmentLength(target.segment)
  let usedMargin = margin
  if (length - usedMargin * 2 < width) usedMargin = 0.12
  const usable = length - usedMargin * 2
  const finalWidth = Math.min(width, usable)
  if (finalWidth < minWidth) return false
  const offset = projectOnWall(target.wall, point).distanceAlong
  const clamped = Math.min(length - usedMargin - finalWidth / 2, Math.max(usedMargin + finalWidth / 2, offset))
  // Deux ouvertures qui se chevauchent donneraient un mur mange : on garde la premiere posee.
  const conflict = target.wall.openings.some(
    (item) => Math.abs(item.offset - clamped) < (item.width + finalWidth) / 2 + 0.25,
  )
  if (conflict) return false
  target.wall.openings.push({ ...opening, offset: r3(clamped), width: r3(finalWidth) })
  return true
}

// --- Meubles ---------------------------------------------------------------------------------

function roomProps(room: PlanRoom, idPrefix: string): InteriorProp[] {
  const props: InteriorProp[] = []
  const cx = room.x + room.w / 2
  const cz = room.z + room.d / 2
  let count = 0
  const put = (assetId: string, name: string, x: number, z: number, rotation = 0) => {
    count += 1
    props.push({ id: `${idPrefix}_${room.id}_prop_${count}`, assetId, name, x: r3(x), z: r3(z), rotation })
  }

  switch (room.role) {
    case 'sejour':
      put('proto_table', 'Table', cx, cz)
      put('proto_chair', 'Chaise', cx - 0.9, cz)
      put('proto_chair', 'Chaise', cx + 0.9, cz, Math.PI)
      break
    case 'cuisine':
      put('proto_counter', 'Plan de travail', cx, room.z + 0.7)
      break
    case 'chambre':
      put('proto_cube', 'Lit', cx, room.z + 1.2)
      break
    case 'salle':
      put('proto_counter', 'Comptoir', room.x + 1.4, room.z + 0.9)
      put('proto_counter', 'Comptoir', room.x + 0.7, room.z + 1.9, Math.PI / 2)
      put('proto_table', 'Table', cx + 0.6, cz)
      put('proto_chair', 'Chaise', cx + 0.6, cz - 0.9, Math.PI / 2)
      put('proto_chair', 'Chaise', cx + 0.6, cz + 0.9, -Math.PI / 2)
      put('proto_table', 'Table', room.x + room.w - 1.6, room.z + room.d - 1.6)
      break
    case 'boutique':
      put('proto_counter', 'Comptoir', room.x + room.w - 1.6, room.z + 1.2, Math.PI / 2)
      put('proto_cube', 'Etal', cx - 1.2, cz)
      put('proto_cube', 'Etal', cx + 1.2, cz)
      break
    case 'bureau':
      put('proto_table', 'Bureau', cx, cz)
      put('proto_chair', 'Chaise', cx, cz + 0.8, -Math.PI / 2)
      break
    case 'reserve':
    case 'cave':
    case 'technique':
      put('proto_cube', 'Caisse', room.x + 0.8, room.z + 0.8)
      put('proto_cube', 'Caisse', room.x + room.w - 0.8, room.z + 0.8)
      break
    default:
      break
  }

  if (room.role === 'galerie') {
    // Une galerie est longue : une lumiere tous les 6 m, sinon on avance dans le noir.
    const along = Math.max(room.w, room.d)
    const steps = Math.max(1, Math.round(along / 6))
    for (let i = 0; i < steps; i += 1) {
      const t = (i + 0.5) / steps
      put('proto_light', 'Lumiere', room.w > room.d ? room.x + room.w * t : cx, room.w > room.d ? cz : room.z + room.d * t)
    }
  } else {
    put('proto_light', 'Lumiere', cx, cz)
  }
  return props
}

// --- Fabrication d'un etage ------------------------------------------------------------------

interface FloorPlanOptions {
  idPrefix: string
  floorId: string
  label: string
  elevation: number
  height: number
  rooms: PlanRoom[]
  /** Piece par laquelle on entre : la porte est posee sur sa facade sud (cote z le plus grand). */
  entryRoomId?: string
  /** Separation interne : une vraie porte (logement) ou un simple passage (egouts, cave). */
  interiorOpening?: 'door' | 'passage'
  /** Roles dont les facades recoivent des fenetres. Vide = aucune (sous-sol). */
  windowRoles?: RoomRole[]
}

interface BuiltFloor {
  floor: InteriorFloor
  /** Position de la porte d'entree, pour poser le spawn et la sortie juste derriere. */
  entry: Point2 | null
}

function buildFloorPlan(options: FloorPlanOptions): BuiltFloor {
  const { idPrefix, rooms, interiorOpening = 'door', windowRoles = [] } = options
  const classified = classifySegments(rooms)
  const walls = mergeSegments(classified, idPrefix)

  // --- Porte d'entree : sur la facade sud de la piece d'accueil ---------------------------
  let entry: Point2 | null = null
  const entryIndex = rooms.findIndex((room) => room.id === options.entryRoomId)
  if (entryIndex >= 0) {
    const entryRoom = rooms[entryIndex]
    const facades = classified
      .filter((item) => item.kind === 'exterior' && item.roomIndex === entryIndex)
      .sort((a, b) => {
        // On prefere la facade sud (z max) ; a defaut, la plus longue facade de la piece.
        const southA = a.segment.horizontal && Math.abs(a.segment.fixed - (entryRoom.z + entryRoom.d)) < TOLERANCE
        const southB = b.segment.horizontal && Math.abs(b.segment.fixed - (entryRoom.z + entryRoom.d)) < TOLERANCE
        if (southA !== southB) return southA ? -1 : 1
        return segmentLength(b.segment) - segmentLength(a.segment)
      })
    const facade = facades[0]
    if (facade) {
      const middle = segmentMiddle(facade.segment)
      const target = wallAt(walls, middle, facade.segment.horizontal, facade.segment.fixed, 'exterior')
      if (
        target &&
        pierce(target, middle, 1, {
          id: `${idPrefix}_porte_entree`,
          name: 'Entree',
          kind: 'door',
          sillHeight: 0,
          topHeight: 2.1,
        })
      ) {
        entry = middle
      }
    }
  }

  // --- Portes entre pieces ---------------------------------------------------------------
  // On regroupe par couple d'ESPACES (le `group`, pas la piece) : deux pieces voisines n'ont besoin
  // que d'UNE porte, meme si leur separation a ete coupee en plusieurs morceaux.
  //
  // ⚠️ Grouper par piece ne suffit pas : un WC qui longe a la fois « Salle » et « Coin billard » —
  // deux morceaux du MEME espace — se retrouvait avec deux bouts de façade trop courts chacun pour
  // porter une porte, donc sans aucune porte. En raisonnant par espace, les deux bouts se cumulent.
  const pairs = new Map<string, { segments: ClassifiedSegment[]; rooms: [number, number] }>()
  for (const item of classified) {
    if (item.kind !== 'partition' || item.otherIndex === undefined) continue
    // Tremie et cage d'escalier ne desservent rien : leurs morceaux de façade sont ecartes ICI, avant
    // le regroupement. Les ecarter plus tard reviendrait a jeter la porte de tout l'espace, la cage
    // partageant le groupe du couloir.
    const sides = [rooms[item.roomIndex], rooms[item.otherIndex]]
    if (sides.some((room) => room.noSurface || room.noDoors)) continue
    const ordered = groupOf(rooms[item.roomIndex]) <= groupOf(rooms[item.otherIndex])
      ? ([item.roomIndex, item.otherIndex] as [number, number])
      : ([item.otherIndex, item.roomIndex] as [number, number])
    const key = `${groupOf(rooms[ordered[0]])}|${groupOf(rooms[ordered[1]])}|${item.segment.horizontal ? 'h' : 'v'}|${r3(item.segment.fixed)}`
    const found = pairs.get(key)
    if (found) found.segments.push(item)
    else pairs.set(key, { segments: [item], rooms: ordered })
  }

  // On liste d'abord toutes les portes possibles, pour pouvoir les trier avant de percer.
  interface DoorCandidate {
    rooms: [number, number]
    point: Point2
    horizontal: boolean
    fixed: number
    span: number
    fromCirculation: boolean
  }
  const candidates: DoorCandidate[] = []
  for (const { segments, rooms: pairRooms } of pairs.values()) {
    // Le plus long troncon continu de la separation : c'est la qu'une porte tient le mieux.
    const sorted = [...segments].sort((a, b) => a.segment.start - b.segment.start)
    const spans: { start: number; end: number }[] = []
    for (const item of sorted) {
      const last = spans[spans.length - 1]
      if (last && item.segment.start <= last.end + TOLERANCE) last.end = Math.max(last.end, item.segment.end)
      else spans.push({ start: item.segment.start, end: item.segment.end })
    }
    const best = [...spans].sort((a, b) => b.end - b.start - (a.end - a.start))[0]
    // Sous cette longueur, la separation ne peut pas porter une porte franchissable.
    if (!best || best.end - best.start < MIN_WALKABLE_WIDTH + 0.25) continue

    const first = sorted[0].segment
    const middleAlong = (best.start + best.end) / 2
    const [a, b] = pairRooms
    candidates.push({
      rooms: [a, b],
      point: first.horizontal ? { x: middleAlong, z: first.fixed } : { x: first.fixed, z: middleAlong },
      horizontal: first.horizontal,
      fixed: first.fixed,
      span: best.end - best.start,
      fromCirculation: circulationRoles.has(rooms[a].role) || circulationRoles.has(rooms[b].role),
    })
  }

  // Une piece desservie par un couloir doit recevoir sa porte AVANT qu'une voisine « privee » ne
  // consomme son unique porte : d'ou le tri, les acces depuis la circulation d'abord.
  candidates.sort((a, b) => {
    if (a.fromCirculation !== b.fromCirculation) return a.fromCirculation ? -1 : 1
    return b.span - a.span
  })

  const doorCount = rooms.map(() => 0)
  let doorIndex = 0
  for (const candidate of candidates) {
    const [a, b] = candidate.rooms
    // ⚠️ Jamais de porte entre deux pieces privees. Sans cette regle, le WC prenait sa porte sur la
    // salle de bain voisine (leur cloison est plus longue que la façade sur le sejour), les deux
    // consommaient leur unique porte, et le bloc entier devenait inaccessible.
    if (singleDoorRoles.has(rooms[a].role) && singleDoorRoles.has(rooms[b].role)) continue
    const saturated = candidate.rooms.some((index) => singleDoorRoles.has(rooms[index].role) && doorCount[index] >= 1)
    if (saturated) continue
    const target = wallAt(walls, candidate.point, candidate.horizontal, candidate.fixed, 'partition')
    if (!target) continue

    // La porte prend la largeur de la plus « fermee » des deux pieces (un WC garde sa petite porte).
    const width = Math.min(doorWidths[rooms[a].role], doorWidths[rooms[b].role])
    doorIndex += 1
    const placed = pierce(
      target,
      candidate.point,
      interiorOpening === 'passage' ? Math.max(width, 1.4) : width,
      interiorOpening === 'passage'
        ? { id: `${idPrefix}_passage_${doorIndex}`, name: 'Passage', kind: 'passage', sillHeight: 0, topHeight: 2.4 }
        : { id: `${idPrefix}_porte_${doorIndex}`, name: `Porte ${doorIndex}`, kind: 'door', sillHeight: 0, topHeight: 2.1 },
    )
    if (placed) {
      doorCount[a] += 1
      doorCount[b] += 1
    } else {
      doorIndex -= 1
    }
  }

  // --- Fenetres --------------------------------------------------------------------------
  // Une fenetre par facade de piece habitable, deux si la facade est large. On travaille sur les
  // morceaux d'avant fusion : un morceau = la facade d'UNE piece, donc les fenetres suivent les
  // pieces au lieu de se poser n'importe ou sur un long mur.
  let windowIndex = 0
  const windowed = new Set(windowRoles)
  for (const item of classified) {
    if (item.kind !== 'exterior' || !windowed.has(rooms[item.roomIndex].role)) continue
    const length = segmentLength(item.segment)
    if (length < 1.8) continue
    const count = length >= 5 ? 2 : 1
    const target = wallAt(walls, segmentMiddle(item.segment), item.segment.horizontal, item.segment.fixed, 'exterior')
    if (!target) continue
    for (let i = 0; i < count; i += 1) {
      const along = item.segment.start + (length * (i + 1)) / (count + 1)
      const point: Point2 = item.segment.horizontal
        ? { x: along, z: item.segment.fixed }
        : { x: item.segment.fixed, z: along }
      windowIndex += 1
      pierce(
        target,
        point,
        Math.min(1.4, length - 1),
        {
          id: `${idPrefix}_fenetre_${windowIndex}`,
          name: `Fenetre ${windowIndex}`,
          kind: 'window',
          sillHeight: 0.9,
          topHeight: 2.1,
        },
        0.5,
        // Une fenetre n'a pas a etre franchissable : une petite fenetre de WC est legitime.
        0.6,
      )
    }
  }

  // --- Sols et meubles -------------------------------------------------------------------
  const surfaces: InteriorSurface[] = rooms
    .filter((room) => !room.noSurface)
    .map((room) => ({
      id: `${idPrefix}_${room.id}_sol`,
      name: `${room.name} — sol`,
      pts: makeRectanglePolygon(room.x, room.z, room.w, room.d),
      material: 'proto_floor',
    }))
  const props = rooms.filter((room) => !room.noSurface).flatMap((room) => roomProps(room, idPrefix))

  return {
    entry,
    floor: {
      id: options.floorId,
      label: options.label,
      elevation: options.elevation,
      height: options.height,
      walls: walls.map((item) => item.wall),
      surfaces,
      props,
      spawnPoints: [],
      exits: [],
      stairs: [],
    },
  }
}

/**
 * Pose le point d'arrivee du joueur et la sortie derriere la porte d'entree.
 *
 * Un interieur sans spawn ni sortie n'est pas testable et enferme le joueur : le generateur ne
 * livre jamais un plan sans ces deux reperes.
 */
function placeSpawnAndExit(built: BuiltFloor, idPrefix: string, target: InteriorTarget) {
  const entry = built.entry ?? { x: 0, z: 0 }
  const spawn: InteriorSpawnPoint = { id: `spawn_${idPrefix}`, name: 'Arrivee', x: r3(entry.x), z: r3(entry.z - 1.2), rotation: 0 }
  built.floor.spawnPoints = [spawn]
  built.floor.exits = [{ id: `exit_${idPrefix}`, name: 'Sortie', x: r3(entry.x), z: r3(entry.z - 0.5), rotation: 0, target }]
}

// --- Templates -------------------------------------------------------------------------------

export interface TemplateContext {
  id: string
  name: string
  /** POI de la carte qui ouvre cet interieur, pour que la sortie sache ou reposer le joueur. */
  markerId?: string
  rng: () => number
}

export interface InteriorTemplate {
  id: string
  label: string
  description: string
  type: InteriorType
  build: (context: TemplateContext) => InteriorDefinition
}

/** Enveloppe d'un plan, centree sur l'origine : c'est la que la vue de l'editeur regarde. */
function envelope(w: number, d: number) {
  return { x0: -w / 2, z0: -d / 2, x1: w / 2, z1: d / 2, w, d }
}

/** Tirage a la demande : sert a decider la presence d'une piece optionnelle. */
function chance(rng: () => number, probability: number) {
  return rng() < probability
}

/** Une piece a decouper dans une bande, avec son poids et sa taille minimale. */
interface BandPart {
  id: string
  name: string
  role: RoomRole
  /** Part relative de la bande. Les poids sont bruites : deux plans n'ont pas les memes proportions. */
  weight: number
  /** Taille minimale sur l'axe de decoupe, en metres. */
  min?: number
  group?: string
}

/**
 * Decoupe une bande rectangulaire en pieces alignees.
 *
 * ⚠️ Toutes les pieces d'une bande partagent le meme cote sur l'autre axe : c'est ce qui garantit
 * que **chacune touche la circulation** qui longe la bande, donc que chacune aura sa propre porte.
 * Un plan ou une chambre ne serait accessible qu'en traversant une autre chambre serait rate.
 */
function splitBand(options: {
  along: 'x' | 'z'
  start: number
  end: number
  otherStart: number
  otherEnd: number
  parts: BandPart[]
  rng: () => number
}): PlanRoom[] {
  const { along, start, end, otherStart, otherEnd, parts, rng } = options
  const total = end - start
  const mins = parts.map((part) => part.min ?? 1.6)

  const weights = parts.map((part) => Math.max(0.12, part.weight * (0.78 + rng() * 0.44)))
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  let sizes = weights.map((weight) => (weight / weightSum) * total)

  // Chaque piece doit garder sa taille minimale ; ce qui manque est pris a celles qui ont du mou.
  for (let pass = 0; pass < 5; pass += 1) {
    const deficit = sizes.reduce((sum, size, index) => sum + Math.max(0, mins[index] - size), 0)
    if (deficit < 0.001) break
    const slack = sizes.reduce((sum, size, index) => sum + Math.max(0, size - mins[index]), 0)
    if (slack < 0.001) break
    const taken = Math.min(deficit, slack)
    sizes = sizes.map((size, index) =>
      size < mins[index] ? mins[index] : size - (Math.max(0, size - mins[index]) / slack) * taken,
    )
  }

  let cursor = start
  return parts.map((part, index) => {
    // La derniere piece ferme la bande exactement, pour ne pas laisser un filet de sol manquant.
    const size = index === parts.length - 1 ? end - cursor : Number((Math.round(sizes[index] / 0.25) * 0.25).toFixed(2))
    const room: PlanRoom =
      along === 'x'
        ? {
            id: part.id,
            name: part.name,
            role: part.role,
            group: part.group,
            x: cursor,
            z: otherStart,
            w: size,
            d: otherEnd - otherStart,
          }
        : {
            id: part.id,
            name: part.name,
            role: part.role,
            group: part.group,
            x: otherStart,
            z: cursor,
            w: otherEnd - otherStart,
            d: size,
          }
    cursor += size
    return room
  })
}

/**
 * Bande longeant un couloir vertical dont le fond est occupe par la tremie d'escalier.
 *
 * Les pieces sont dimensionnees sur la façade **reellement disponible** le long du palier, puis la
 * premiere piece absorbe la profondeur restante derriere la tremie. Sans ca, la piece du fond
 * n'aurait aucune façade sur le palier — donc aucune porte.
 */
function bandAlongLanding(options: {
  zTop: number
  landingStart: number
  zBottom: number
  otherStart: number
  otherEnd: number
  parts: BandPart[]
  rng: () => number
}): PlanRoom[] {
  const rooms = splitBand({
    along: 'z',
    start: options.landingStart,
    end: options.zBottom,
    otherStart: options.otherStart,
    otherEnd: options.otherEnd,
    parts: options.parts,
    rng: options.rng,
  })
  const first = rooms[0]
  return [{ ...first, z: options.zTop, d: first.d + (first.z - options.zTop) }, ...rooms.slice(1)]
}

/** Retourne le plan de gauche a droite. Diversite gratuite : le squelette ne se reconnait plus. */
function mirrorRooms(rooms: PlanRoom[]): PlanRoom[] {
  return rooms.map((room) => ({ ...room, x: -(room.x + room.w) }))
}

function makeDefinition(options: {
  context: TemplateContext
  type: InteriorType
  wallHeight: number
  floors: InteriorFloor[]
}): InteriorDefinition {
  return {
    id: options.context.id,
    name: options.context.name,
    type: options.type,
    version: 2,
    defaultWallHeight: options.wallHeight,
    defaultWallThickness: WALL_THICKNESS,
    floors: options.floors,
  }
}

function exitTarget(context: TemplateContext): InteriorTarget {
  return context.markerId ? { kind: 'exterior', markerId: context.markerId } : { kind: 'exterior' }
}

const habitableWindows: RoomRole[] = ['sejour', 'cuisine', 'chambre', 'sdb', 'wc', 'bureau']

/**
 * Maison sur deux niveaux, distribuee par un couloir central.
 *
 * Le couloir traverse la maison du nord au sud ; les pieces sont des bandes de part et d'autre,
 * donc **toutes desservies directement**. L'escalier occupe le fond du couloir, et sa tremie perce
 * le plancher de l'etage juste au-dessus.
 */
function buildHouse(context: TemplateContext): InteriorDefinition {
  const { rng } = context
  const w = jitter(rng, 12.5, 1.5)
  const d = jitter(rng, 11.5, 1.5)
  const { x0, z0, x1, z1 } = envelope(w, d)

  const hallWidth = jitter(rng, 2.4, 0.4)
  const leftWidth = jitter(rng, (w - hallWidth) * 0.5, (w - hallWidth) * 0.12)
  const hallStart = x0 + leftWidth
  const hallEnd = hallStart + hallWidth

  // ⚠️ La volee mange le fond du couloir aux DEUX niveaux : en bas c'est la cage d'escalier, en haut
  // la tremie. Il doit donc rester assez de couloir libre (~6,5 m) pour desservir les trois pieces
  // de chaque bande, sinon une piece se retrouve sans façade sur le couloir, donc sans porte.
  const stairsLength = Math.min(Math.max(3.6, jitter(rng, 4.25, 0.4)), d - 6.6)
  const landingStart = z0 + stairsLength

  // --- RDC -------------------------------------------------------------------------------
  const groundLeft: BandPart[] = [
    { id: 'cuisine', name: 'Cuisine', role: 'cuisine', weight: 1.8, min: 2.8 },
    { id: 'sejour', name: 'Sejour', role: 'sejour', weight: 2.8, min: 4 },
  ]
  if (chance(rng, 0.4)) {
    groundLeft.unshift({ id: 'cellier', name: 'Cellier', role: 'reserve', weight: 1, min: 1.9 })
  }

  const groundRight: BandPart[] = [{ id: 'wc', name: 'WC', role: 'wc', weight: 0.85, min: 1.8 }]
  if (chance(rng, 0.5)) {
    groundRight.push({ id: 'buanderie', name: 'Buanderie', role: 'reserve', weight: 1.1, min: 1.9 })
  }
  groundRight.push(
    chance(rng, 0.5)
      ? { id: 'bureau', name: 'Bureau', role: 'bureau', weight: 1.8, min: 2.6 }
      : { id: 'salle_a_manger', name: 'Salle a manger', role: 'sejour', weight: 2.4, min: 3.2 },
  )

  const groundRooms: PlanRoom[] = [
    // La cage d'escalier fait partie du couloir (meme groupe, donc pas de cloison) mais ne dessert
    // rien : les portes des pieces sont donc toutes posees sur le couloir libre, jamais sous la volee.
    {
      id: 'cage_escalier',
      name: 'Cage d’escalier',
      role: 'couloir',
      x: hallStart,
      z: z0,
      w: hallWidth,
      d: stairsLength,
      group: 'couloir',
      noDoors: true,
    },
    { id: 'couloir', name: 'Couloir', role: 'couloir', x: hallStart, z: landingStart, w: hallWidth, d: z1 - landingStart, group: 'couloir' },
    ...bandAlongLanding({ zTop: z0, landingStart, zBottom: z1, otherStart: x0, otherEnd: hallStart, parts: groundLeft, rng }),
    ...bandAlongLanding({ zTop: z0, landingStart, zBottom: z1, otherStart: hallEnd, otherEnd: x1, parts: groundRight, rng }),
  ]

  // --- Etage -----------------------------------------------------------------------------
  const upperLeft: BandPart[] = [
    { id: 'chambre_1', name: 'Chambre 1', role: 'chambre', weight: 2.2, min: 1.8 },
    { id: 'chambre_2', name: 'Chambre 2', role: 'chambre', weight: 2, min: 1.8 },
  ]
  const upperRight: BandPart[] = [{ id: 'sdb', name: 'Salle de bain', role: 'sdb', weight: 1.4, min: 1.8 }]
  if (chance(rng, 0.45)) {
    upperRight.push({ id: 'dressing', name: 'Dressing', role: 'reserve', weight: 1, min: 1.7 })
  }
  upperRight.push({ id: 'chambre_3', name: 'Chambre 3', role: 'chambre', weight: 2.2, min: 1.8 })

  const upperRooms: PlanRoom[] = [
    // La tremie : des murs, pas de sol. C'est par la qu'on debouche de l'escalier.
    {
      id: 'tremie',
      name: 'Tremie escalier',
      role: 'palier',
      x: hallStart,
      z: z0,
      w: hallWidth,
      d: stairsLength,
      group: 'palier',
      noSurface: true,
    },
    { id: 'palier', name: 'Palier', role: 'palier', x: hallStart, z: landingStart, w: hallWidth, d: z1 - landingStart, group: 'palier' },
    ...bandAlongLanding({ zTop: z0, landingStart, zBottom: z1, otherStart: x0, otherEnd: hallStart, parts: upperLeft, rng }),
    ...bandAlongLanding({ zTop: z0, landingStart, zBottom: z1, otherStart: hallEnd, otherEnd: x1, parts: upperRight, rng }),
  ]

  const mirror = chance(rng, 0.5)
  const ground = buildFloorPlan({
    idPrefix: `${context.id}_rdc`,
    floorId: 'rdc',
    label: 'RDC',
    elevation: 0,
    height: 2.7,
    entryRoomId: 'couloir',
    windowRoles: habitableWindows,
    rooms: mirror ? mirrorRooms(groundRooms) : groundRooms,
  })
  const upper = buildFloorPlan({
    idPrefix: `${context.id}_etage`,
    floorId: 'etage',
    label: 'Etage',
    elevation: 2.7,
    height: 2.7,
    windowRoles: habitableWindows,
    rooms: mirror ? mirrorRooms(upperRooms) : upperRooms,
  })

  placeSpawnAndExit(ground, context.id, exitTarget(context))

  // ⚠️ La volee monte vers le SUD (rotation 0 : son +Z local suit les z croissants), donc du fond
  // du couloir vers le palier. Elle ne peut pas monter vers le nord : elle deboucherait dans le mur
  // de facade. La premiere marche est decollee de ce mur, sinon on grimpe collé a la façade.
  // Elle vit uniquement sur l'etage du BAS — la dupliquer en haut donnerait deux volees superposees.
  const runStart = z0 + 0.25
  const runLength = landingStart - runStart
  const hallCenterX = mirror ? -(hallStart + hallWidth / 2) : hallStart + hallWidth / 2
  ground.floor.stairs = [
    {
      id: `${context.id}_escalier`,
      name: 'Escalier vers l’etage',
      x: r3(hallCenterX),
      z: r3(runStart + runLength / 2),
      rotation: 0,
      width: r3(Math.min(1.4, hallWidth - 0.3)),
      length: r3(runLength),
      targetFloorId: 'etage',
    },
  ]

  return makeDefinition({ context, type: 'apartment', wallHeight: 2.7, floors: [ground.floor, upper.floor] })
}

/**
 * Appartement de plain-pied. `bedrooms` = 0 pour un studio, 1 pour un T2, 2 pour un T3.
 *
 * La bande sud est l'espace de jour (sejour + cuisine) ; la bande nord porte les chambres et la
 * salle d'eau, toutes ouvertes sur le sejour, donc toutes desservies.
 */
function buildApartment(bedrooms: number) {
  return (context: TemplateContext): InteriorDefinition => {
    const { rng } = context
    const w = jitter(rng, 8.75 + bedrooms * 1.9, 0.9)
    const d = jitter(rng, 7.25 + bedrooms * 0.75, 0.75)
    const { x0, z0, x1, z1 } = envelope(w, d)
    const zDay = z1 - jitter(rng, d * 0.5, 0.5)

    // Cuisine ouverte (meme groupe que le sejour, donc aucune cloison) ou cuisine fermee.
    const openKitchen = chance(rng, 0.6)
    const dayParts: BandPart[] = [
      { id: 'sejour', name: 'Sejour', role: 'sejour', weight: 3, min: 3.6, group: openKitchen ? 'jour' : undefined },
      {
        id: 'cuisine',
        name: openKitchen ? 'Cuisine ouverte' : 'Cuisine',
        role: 'cuisine',
        weight: 1.3,
        min: 2.4,
        group: openKitchen ? 'jour' : undefined,
      },
    ]
    // La cuisine passe parfois a gauche : le plan ne se reconnait plus au premier coup d'oeil.
    if (chance(rng, 0.5)) dayParts.reverse()

    const nightParts: BandPart[] = []
    for (let i = 0; i < bedrooms; i += 1) {
      nightParts.push({ id: `chambre_${i + 1}`, name: `Chambre ${i + 1}`, role: 'chambre', weight: 2.4, min: 2.8 })
    }
    nightParts.push({ id: 'sdb', name: 'Salle de bain', role: 'sdb', weight: 1.3, min: 2 })
    if (bedrooms > 0 && chance(rng, 0.45)) {
      nightParts.push({ id: 'wc', name: 'WC', role: 'wc', weight: 0.8, min: 1.7 })
    }
    if (bedrooms === 0) {
      nightParts.unshift({ id: 'rangement', name: 'Rangement', role: 'reserve', weight: 1, min: 1.8 })
    }

    const rooms = [
      ...splitBand({ along: 'x', start: x0, end: x1, otherStart: zDay, otherEnd: z1, parts: dayParts, rng }),
      ...splitBand({ along: 'x', start: x0, end: x1, otherStart: z0, otherEnd: zDay, parts: nightParts, rng }),
    ]

    const built = buildFloorPlan({
      idPrefix: `${context.id}_rdc`,
      floorId: 'rdc',
      label: 'Appartement',
      elevation: 0,
      height: 2.6,
      rooms: chance(rng, 0.5) ? mirrorRooms(rooms) : rooms,
      entryRoomId: 'sejour',
      windowRoles: habitableWindows,
    })
    placeSpawnAndExit(built, context.id, exitTarget(context))
    return makeDefinition({ context, type: 'apartment', wallHeight: 2.6, floors: [built.floor] })
  }
}

/** Commerce : vitrine sur la rue, espace de vente, reserve et bureau a l'arriere. */
function buildShop(context: TemplateContext): InteriorDefinition {
  const { rng } = context
  const w = jitter(rng, 13.5, 1.75)
  const d = jitter(rng, 13.5, 1.75)
  const { x0, z0, x1, z1 } = envelope(w, d)
  const zBack = z0 + jitter(rng, d * 0.3, 0.7)

  const backParts: BandPart[] = [{ id: 'reserve', name: 'Reserve', role: 'reserve', weight: 2.6, min: 3 }]
  if (chance(rng, 0.7)) backParts.push({ id: 'bureau', name: 'Bureau', role: 'bureau', weight: 1.5, min: 2.4 })
  if (chance(rng, 0.5)) backParts.push({ id: 'wc', name: 'WC', role: 'wc', weight: 0.8, min: 1.7 })
  if (chance(rng, 0.5)) backParts.reverse()

  // Parfois un second rayon : meme groupe que la vente, donc un espace en L sans cloison.
  const frontParts: BandPart[] = chance(rng, 0.45)
    ? [
        { id: 'vente', name: 'Espace de vente', role: 'boutique', weight: 3, min: 4, group: 'vente' },
        { id: 'rayon', name: 'Rayon du fond', role: 'boutique', weight: 1.4, min: 2.6, group: 'vente' },
      ]
    : [{ id: 'vente', name: 'Espace de vente', role: 'boutique', weight: 1, min: 4 }]

  const rooms = [
    ...splitBand({ along: 'x', start: x0, end: x1, otherStart: zBack, otherEnd: z1, parts: frontParts, rng }),
    ...splitBand({ along: 'x', start: x0, end: x1, otherStart: z0, otherEnd: zBack, parts: backParts, rng }),
  ]

  const built = buildFloorPlan({
    idPrefix: `${context.id}_rdc`,
    floorId: 'rdc',
    label: 'Boutique',
    elevation: 0,
    height: 3.2,
    entryRoomId: 'vente',
    // Seul l'espace de vente est vitre : une reserve avec vue sur la rue, ca n'existe pas.
    windowRoles: ['boutique'],
    rooms: chance(rng, 0.5) ? mirrorRooms(rooms) : rooms,
  })
  placeSpawnAndExit(built, context.id, exitTarget(context))
  return makeDefinition({ context, type: 'shop', wallHeight: 3.2, floors: [built.floor] })
}

/** Bar : grande salle avec comptoir, cuisine, WC et arriere-salle. */
function buildBar(context: TemplateContext): InteriorDefinition {
  const { rng } = context
  const w = jitter(rng, 15, 2)
  const d = jitter(rng, 12.5, 1.5)
  const { x0, z0, x1, z1 } = envelope(w, d)
  const zBack = z0 + jitter(rng, d * 0.28, 0.6)

  const backParts: BandPart[] = [{ id: 'cuisine', name: 'Cuisine', role: 'cuisine', weight: 2.4, min: 3 }]
  if (chance(rng, 0.55)) {
    backParts.push({ id: 'wc_hommes', name: 'WC hommes', role: 'wc', weight: 0.9, min: 1.8 })
    backParts.push({ id: 'wc_dames', name: 'WC dames', role: 'wc', weight: 0.9, min: 1.8 })
  } else {
    backParts.push({ id: 'wc', name: 'WC', role: 'wc', weight: 1, min: 1.8 })
  }
  backParts.push({ id: 'reserve', name: 'Arriere-salle', role: 'reserve', weight: 1.8, min: 2.4 })
  if (chance(rng, 0.5)) backParts.reverse()

  // Une salle en L une fois sur deux : le comptoir n'est plus toujours au meme endroit.
  const frontParts: BandPart[] = chance(rng, 0.5)
    ? [
        { id: 'salle', name: 'Salle', role: 'salle', weight: 3, min: 4.5, group: 'salle' },
        { id: 'salle_billard', name: 'Coin billard', role: 'salle', weight: 1.5, min: 3, group: 'salle' },
      ]
    : [{ id: 'salle', name: 'Salle', role: 'salle', weight: 1, min: 5 }]

  const rooms = [
    ...splitBand({ along: 'x', start: x0, end: x1, otherStart: zBack, otherEnd: z1, parts: frontParts, rng }),
    ...splitBand({ along: 'x', start: x0, end: x1, otherStart: z0, otherEnd: zBack, parts: backParts, rng }),
  ]

  const built = buildFloorPlan({
    idPrefix: `${context.id}_rdc`,
    floorId: 'rdc',
    label: 'Bar',
    elevation: 0,
    height: 3.2,
    entryRoomId: 'salle',
    windowRoles: ['salle'],
    rooms: chance(rng, 0.5) ? mirrorRooms(rooms) : rooms,
  })
  placeSpawnAndExit(built, context.id, exitTarget(context))
  return makeDefinition({ context, type: 'bar', wallHeight: 3.2, floors: [built.floor] })
}

/**
 * Reseau d'egouts : une galerie principale et deux a quatre branches.
 *
 * Toutes les galeries partagent le groupe `reseau`, donc leurs croisements sont **ouverts** : pas
 * de mur en travers du passage. Seules les chambres techniques sont de vraies pieces, avec leur
 * passage.
 */
function buildSewer(context: TemplateContext): InteriorDefinition {
  const { rng } = context
  const length = jitter(rng, 35, 5, 0.5)
  const width = jitter(rng, 2.6, 0.4)
  const half = width / 2
  const mainStart = -length / 2

  const rooms: PlanRoom[] = [
    {
      id: 'galerie_principale',
      name: 'Galerie principale',
      role: 'galerie',
      x: mainStart,
      z: -half,
      w: length,
      d: width,
      group: 'reseau',
    },
  ]

  const branchCount = 2 + Math.floor(rng() * 3)
  let technicalCount = 0
  for (let i = 0; i < branchCount; i += 1) {
    // Branches reparties sur la longueur, tirees au nord ou au sud.
    const t = (i + 0.5 + (rng() - 0.5) * 0.5) / branchCount
    const branchX = mainStart + length * Math.min(0.92, Math.max(0.08, t))
    const branchLength = jitter(rng, 8, 3, 0.5)
    const branchWidth = jitter(rng, 2.4, 0.3)
    const toNorth = chance(rng, 0.5)
    const top = toNorth ? -half - branchLength : -half

    rooms.push({
      id: `galerie_${i + 1}`,
      name: `Galerie ${i + 1}`,
      role: 'galerie',
      x: branchX - branchWidth / 2,
      z: top,
      w: branchWidth,
      d: branchLength + width,
      group: 'reseau',
    })

    if (technicalCount < 2 && chance(rng, 0.45)) {
      technicalCount += 1
      const roomWidth = jitter(rng, 5, 1)
      const roomDepth = jitter(rng, 4.5, 0.75)
      rooms.push({
        id: `technique_${technicalCount}`,
        name: `Chambre technique ${technicalCount}`,
        role: 'technique',
        x: branchX - roomWidth / 2,
        // Collee au bout de la branche : leur arete commune devient le passage.
        z: toNorth ? top - roomDepth : top + branchLength + width,
        w: roomWidth,
        d: roomDepth,
      })
    }
  }

  const built = buildFloorPlan({
    idPrefix: `${context.id}_niveau`,
    floorId: 'egouts',
    label: 'Galeries',
    elevation: 0,
    height: 2.6,
    entryRoomId: 'galerie_principale',
    interiorOpening: 'passage',
    rooms,
  })
  placeSpawnAndExit(built, context.id, exitTarget(context))
  return makeDefinition({ context, type: 'sewer', wallHeight: 2.6, floors: [built.floor] })
}

/** Cave / sous-sol : une grande cave et deux a quatre reserves, aucune fenetre. */
function buildBasement(context: TemplateContext): InteriorDefinition {
  const { rng } = context
  const w = jitter(rng, 11.5, 1.5)
  const d = jitter(rng, 9.5, 1.5)
  const { x0, z0, x1, z1 } = envelope(w, d)
  const zBack = z0 + jitter(rng, d * 0.42, 0.6)

  const backParts: BandPart[] = []
  const count = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < count; i += 1) {
    backParts.push({ id: `reserve_${i + 1}`, name: `Reserve ${i + 1}`, role: 'reserve', weight: 1 + rng(), min: 2 })
  }
  if (chance(rng, 0.4)) {
    backParts[Math.floor(rng() * backParts.length)] = {
      id: 'technique',
      name: 'Local technique',
      role: 'technique',
      weight: 1.2,
      min: 2.2,
    }
  }

  const rooms: PlanRoom[] = [
    { id: 'cave', name: 'Cave', role: 'cave', x: x0, z: zBack, w, d: z1 - zBack },
    ...splitBand({ along: 'x', start: x0, end: x1, otherStart: z0, otherEnd: zBack, parts: backParts, rng }),
  ]

  const built = buildFloorPlan({
    idPrefix: `${context.id}_sous_sol`,
    floorId: 'sous_sol',
    label: 'Sous-sol',
    elevation: 0,
    height: 2.5,
    entryRoomId: 'cave',
    interiorOpening: 'passage',
    rooms: chance(rng, 0.5) ? mirrorRooms(rooms) : rooms,
  })
  placeSpawnAndExit(built, context.id, exitTarget(context))
  return makeDefinition({ context, type: 'basement', wallHeight: 2.5, floors: [built.floor] })
}

export const INTERIOR_TEMPLATES: InteriorTemplate[] = [
  {
    id: 'maison',
    label: 'Maison (RDC + etage)',
    description:
      'Couloir central qui dessert toutes les pieces, escalier praticable au fond, tremie percee dans le plancher de l’etage. Pieces optionnelles tirees au hasard : cellier, buanderie, bureau, dressing.',
    type: 'apartment',
    build: buildHouse,
  },
  {
    id: 'studio',
    label: 'Studio (T1)',
    description: 'Grande piece a vivre, cuisine ouverte ou fermee, salle de bain, rangement.',
    type: 'apartment',
    build: buildApartment(0),
  },
  {
    id: 'appartement_t2',
    label: 'Appartement (T2)',
    description: 'Sejour, cuisine ouverte ou fermee, une chambre, salle de bain, parfois un WC separe.',
    type: 'apartment',
    build: buildApartment(1),
  },
  {
    id: 'appartement_t3',
    label: 'Appartement (T3)',
    description: 'Sejour, cuisine ouverte ou fermee, deux chambres, salle de bain, parfois un WC separe.',
    type: 'apartment',
    build: buildApartment(2),
  },
  {
    id: 'commerce',
    label: 'Commerce / boutique',
    description: 'Vitrine sur la rue, espace de vente parfois en L, reserve, bureau et WC a l’arriere.',
    type: 'shop',
    build: buildShop,
  },
  {
    id: 'bar',
    label: 'Bar / troquet',
    description: 'Grande salle vitree, parfois en L avec un coin billard, comptoir, cuisine, WC, arriere-salle.',
    type: 'bar',
    build: buildBar,
  },
  {
    id: 'egouts',
    label: 'Egouts (galeries)',
    description: 'Galerie principale de 30 a 40 m, deux a quatre branches aux croisements ouverts, une ou deux chambres techniques.',
    type: 'sewer',
    build: buildSewer,
  },
  {
    id: 'sous_sol',
    label: 'Cave / sous-sol',
    description: 'Grande cave et deux a quatre reserves, passages sans portes, aucune fenetre.',
    type: 'basement',
    build: buildBasement,
  },
]

/**
 * Fabrique un interieur a partir d'un template.
 *
 * `seed` decide des dimensions, des decoupes, des pieces optionnelles et du sens du plan : deux
 * appels avec la meme graine donnent le meme plan, deux graines differentes donnent deux variantes
 * du meme type de lieu.
 */
export function buildTemplateInterior(options: {
  templateId: string
  id: string
  name: string
  markerId?: string
  seed?: number
}): InteriorDefinition | null {
  const template = INTERIOR_TEMPLATES.find((item) => item.id === options.templateId)
  if (!template) return null
  const seed = options.seed ?? Math.floor(Math.random() * 0xffffffff)
  return template.build({
    id: options.id,
    name: options.name,
    markerId: options.markerId,
    rng: makeRandom(seed),
  })
}
