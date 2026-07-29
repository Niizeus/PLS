import {
  makeRectanglePolygon,
  mergeCollinearWalls,
  polygonArea,
  projectOnWall,
  wallLength,
  type WallLike,
} from './interiorGeometry'

/**
 * Tous les niveaux interieurs du jeu, un fichier JSON par interieur.
 *
 * `import.meta.glob` (fourni par Vite) ramasse automatiquement tout `src/data/interiors/*.json` :
 * quand l'editeur cree un nouvel interieur, son fichier est pris en compte sans qu'on ait a
 * ajouter un import ici. `eager: true` charge tout au demarrage, comme un import classique.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🧱 MODELE : un interieur est fait de MURS et de SOLS, pas de "pieces".
 *
 * Avant, un interieur etait une liste de rectangles ("pieces"), et un mur n'existait que comme
 * un COTE de rectangle. Trois limites bloquantes en decoulaient :
 *  - supprimer la separation entre deux pieces de tailles differentes supprimait tout le cote,
 *    y compris la partie qui donnait sur l'exterieur ;
 *  - impossible de poser un mur seul, ou un sol seul ;
 *  - impossible de faire une diagonale ou un arrondi, tout etant aligne sur les axes.
 *
 * Desormais :
 *  - un **mur** (`InteriorWall`) est un segment A -> B, a n'importe quel angle, avec ses
 *    **ouvertures** (`InteriorOpening`) percees sur une portion seulement ;
 *  - un **sol** (`InteriorSurface`) est un polygone quelconque — donc rond, en demi-cercle, en
 *    diagonale, comme on veut ;
 *  - la "piece" n'est plus une donnee : c'est un raccourci de l'editeur qui pose 4 murs + 1 sol.
 *
 * Les anciens fichiers restent lisibles : `migrateFloor` convertit pieces/murs supprimes/portes/
 * fenetres vers ce modele au chargement.
 */
const interiorModules = import.meta.glob('./interiors/*.json', { eager: true, import: 'default' })

export const INTERIOR_TYPES = [
  'apartment',
  'shop',
  'bar',
  'workplace',
  'police',
  'station',
  'town_hall',
  'basement',
  'sewer',
  'secret',
] as const

export type InteriorType = (typeof INTERIOR_TYPES)[number]
export type InteriorTargetKind = 'exterior' | 'interior'

export interface InteriorTarget {
  kind: InteriorTargetKind
  markerId?: string
  interiorId?: string
  floorId?: string
  spawnId?: string
}

/** Percement d'un mur : passage libre, porte, ou fenetre. */
export type InteriorOpeningKind = 'passage' | 'door' | 'window'

export interface InteriorOpening {
  id: string
  name: string
  kind: InteriorOpeningKind
  /** Distance depuis l'extremite A du mur jusqu'au CENTRE de l'ouverture, en metres. */
  offset: number
  width: number
  /** Hauteur du bas de l'ouverture. 0 = au sol (passage, porte). */
  sillHeight: number
  /** Hauteur du haut de l'ouverture. */
  topHeight: number
  /** Uniquement pour une porte qui mene ailleurs (autre interieur, retour exterieur). */
  target?: InteriorTarget
}

/** Un mur : segment A -> B avec une epaisseur, une hauteur, et ses ouvertures. */
export interface InteriorWall {
  id: string
  name: string
  ax: number
  az: number
  bx: number
  bz: number
  thickness: number
  /** Hauteur propre du mur. Absent = `defaultWallHeight` de l'interieur. */
  height?: number
  material: string
  openings: InteriorOpening[]
}

/** Un sol : polygone quelconque. Un rond est un polygone a beaucoup de cotes. */
export interface InteriorSurface {
  id: string
  name: string
  /** Contour ferme, au moins 3 points, en metres. */
  pts: [number, number][]
  material: string
}

export interface InteriorProp {
  id: string
  assetId: string
  name: string
  x: number
  z: number
  rotation: number
}

export interface InteriorSpawnPoint {
  id: string
  name: string
  x: number
  z: number
  rotation: number
}

export interface InteriorExit {
  id: string
  name: string
  x: number
  z: number
  rotation: number
  target: InteriorTarget
}

export interface InteriorStairs {
  id: string
  name: string
  x: number
  z: number
  rotation: number
  width: number
  length: number
  targetFloorId: string
}

export interface InteriorFloor {
  id: string
  label: string
  elevation: number
  height: number
  walls: InteriorWall[]
  surfaces: InteriorSurface[]
  props: InteriorProp[]
  spawnPoints: InteriorSpawnPoint[]
  exits: InteriorExit[]
  stairs: InteriorStairs[]
}

export interface InteriorDefinition {
  id: string
  name: string
  type: InteriorType
  version: number
  defaultWallHeight: number
  defaultWallThickness: number
  floors: InteriorFloor[]
}

export interface InteriorValidationResult {
  interiors: InteriorDefinition[]
  errors: string[]
}

const interiorTypes = new Set<string>(INTERIOR_TYPES)
const openingKinds = new Set<string>(['passage', 'door', 'window'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function round2(value: number) {
  return Number(value.toFixed(2))
}

function round3(value: number) {
  return Number(value.toFixed(3))
}

function round4(value: number) {
  return Number(value.toFixed(4))
}

// --- Conversion des anciennes donnees ------------------------------------------------------

interface LegacyRoom {
  id: string
  x: number
  z: number
  w: number
  d: number
  name?: string
  floorMaterial?: string
}

/**
 * Convertit un etage ecrit avec l'ancien modele (pieces rectangulaires) vers murs + sols.
 *
 * Les 4 cotes de chaque piece deviennent des murs ; les murs colineaires qui se recouvrent sont
 * fusionnes, sinon deux pieces collees produiraient deux murs superposes sur leur arete commune.
 * Les anciens `removedWalls` (qui supprimaient tout un cote) sont convertis en larges ouvertures,
 * pour garder le meme aspect qu'avant tout en devenant modifiables.
 *
 * Un etage deja au nouveau format passe ici sans etre touche.
 */
function migrateFloor(value: Record<string, unknown>): Record<string, unknown> {
  const alreadyMigrated = Array.isArray(value.walls) || Array.isArray(value.surfaces)
  if (alreadyMigrated) return value

  const rooms = (Array.isArray(value.rooms) ? value.rooms : []).filter(isRecord) as unknown as LegacyRoom[]
  if (!rooms.length) {
    return { ...value, walls: [], surfaces: [], rooms: undefined, removedWalls: undefined, doors: undefined, windows: undefined }
  }

  const thickness = 0.18
  const rawWalls: WallLike[] = []
  const surfaces: InteriorSurface[] = []

  rooms.forEach((room, index) => {
    if (!validNumber(room.x) || !validNumber(room.z) || !validNumber(room.w) || !validNumber(room.d)) return
    const x2 = room.x + room.w
    const z2 = room.z + room.d
    rawWalls.push(
      { ax: room.x, az: room.z, bx: x2, bz: room.z, thickness },
      { ax: room.x, az: z2, bx: x2, bz: z2, thickness },
      { ax: room.x, az: room.z, bx: room.x, bz: z2, thickness },
      { ax: x2, az: room.z, bx: x2, bz: z2, thickness },
    )
    surfaces.push({
      id: `surface_${room.id ?? index}`,
      name: room.name ?? `Sol ${index + 1}`,
      pts: makeRectanglePolygon(room.x, room.z, room.w, room.d),
      material: room.floorMaterial ?? 'proto_floor',
    })
  })

  const walls: InteriorWall[] = mergeCollinearWalls(rawWalls).map((wall, index) => ({
    id: `wall_migre_${index + 1}`,
    name: `Mur ${index + 1}`,
    ax: round3(wall.ax),
    az: round3(wall.az),
    bx: round3(wall.bx),
    bz: round3(wall.bz),
    thickness,
    material: 'proto_wall',
    openings: [],
  }))

  // Les anciens murs supprimes deviennent de larges passages sur la portion concernee.
  const removedWalls = (Array.isArray(value.removedWalls) ? value.removedWalls : []).filter(isRecord)
  removedWalls.forEach((removed, index) => {
    const room = rooms.find((item) => item.id === removed.roomId)
    if (!room) return
    const side = removed.side
    const midpoint =
      side === 'top'
        ? { x: room.x + room.w / 2, z: room.z }
        : side === 'bottom'
          ? { x: room.x + room.w / 2, z: room.z + room.d }
          : side === 'left'
            ? { x: room.x, z: room.z + room.d / 2 }
            : { x: room.x + room.w, z: room.z + room.d / 2 }
    const span = side === 'top' || side === 'bottom' ? room.w : room.d

    let best: { wall: InteriorWall; distance: number; offset: number } | null = null
    for (const wall of walls) {
      const projection = projectOnWall(wall, midpoint)
      if (!best || projection.distance < best.distance) {
        best = { wall, distance: projection.distance, offset: projection.distanceAlong }
      }
    }
    if (!best || best.distance > 0.3) return
    best.wall.openings.push({
      id: `opening_migre_${index + 1}`,
      name: 'Passage',
      kind: 'passage',
      offset: round2(best.offset),
      width: round2(span),
      sillHeight: 0,
      topHeight: 2.4,
    })
  })

  // Anciennes portes et fenetres : elles deviennent des ouvertures du mur le plus proche.
  const legacyOpenings = [
    ...(Array.isArray(value.doors) ? value.doors : []).filter(isRecord).map((item) => ({ item, kind: 'door' as const })),
    ...(Array.isArray(value.windows) ? value.windows : []).filter(isRecord).map((item) => ({ item, kind: 'window' as const })),
  ]
  legacyOpenings.forEach(({ item, kind }, index) => {
    if (!validNumber(item.x) || !validNumber(item.z)) return
    const point = { x: item.x, z: item.z }
    let best: { wall: InteriorWall; distance: number; offset: number } | null = null
    for (const wall of walls) {
      const projection = projectOnWall(wall, point)
      if (!best || projection.distance < best.distance) {
        best = { wall, distance: projection.distance, offset: projection.distanceAlong }
      }
    }
    if (!best || best.distance > 0.6) return
    const sillHeight = kind === 'window' && validNumber(item.sillHeight) ? item.sillHeight : 0
    best.wall.openings.push({
      id: validId(item.id) ? item.id : `opening_migre_pf_${index + 1}`,
      name: typeof item.name === 'string' && item.name.trim() ? item.name : kind === 'door' ? 'Porte' : 'Fenetre',
      kind,
      offset: round2(best.offset),
      width: validNumber(item.width) && item.width > 0 ? round2(item.width) : 0.9,
      sillHeight: round2(sillHeight),
      topHeight: round2(kind === 'window' ? sillHeight + 1.2 : 2.1),
    })
  })

  return {
    ...value,
    walls,
    surfaces,
    rooms: undefined,
    removedWalls: undefined,
    doors: undefined,
    windows: undefined,
  }
}

// --- Validation ----------------------------------------------------------------------------

function validateOpening(value: unknown, label: string, wallLengthMeters: number, errors: string[]): InteriorOpening | null {
  if (!isRecord(value)) {
    errors.push(`${label} doit etre un objet.`)
    return null
  }
  if (!validId(value.id)) {
    errors.push(`${label}: id obligatoire.`)
    return null
  }
  const openingLabel = `${label}/${value.id}`
  const kind = typeof value.kind === 'string' && openingKinds.has(value.kind) ? (value.kind as InteriorOpeningKind) : null
  if (!kind) errors.push(`${openingLabel}: kind doit etre passage, door ou window.`)
  if (!validNumber(value.offset)) errors.push(`${openingLabel}: offset invalide.`)
  if (!validNumber(value.width) || value.width <= 0) errors.push(`${openingLabel}: width invalide.`)
  if (!validNumber(value.sillHeight) || value.sillHeight < 0) errors.push(`${openingLabel}: sillHeight invalide.`)
  if (!validNumber(value.topHeight) || value.topHeight <= 0) errors.push(`${openingLabel}: topHeight invalide.`)
  if (validNumber(value.sillHeight) && validNumber(value.topHeight) && value.topHeight <= value.sillHeight) {
    errors.push(`${openingLabel}: le haut de l'ouverture doit etre au-dessus de son bas.`)
  }
  if (validNumber(value.offset) && (value.offset < 0 || value.offset > wallLengthMeters + 0.01)) {
    errors.push(`${openingLabel}: l'ouverture est en dehors du mur.`)
  }
  if (!kind || !validNumber(value.offset) || !validNumber(value.width) || !validNumber(value.sillHeight) || !validNumber(value.topHeight)) {
    return null
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Ouverture',
    kind,
    offset: value.offset,
    width: value.width,
    sillHeight: value.sillHeight,
    topHeight: value.topHeight,
    target: isRecord(value.target) ? (value.target as unknown as InteriorTarget) : undefined,
  }
}

function validateWall(value: unknown, label: string, errors: string[]): InteriorWall | null {
  if (!isRecord(value)) {
    errors.push(`${label} doit etre un objet.`)
    return null
  }
  if (!validId(value.id)) {
    errors.push(`${label}: id obligatoire.`)
    return null
  }
  const wallLabel = `${label}/${value.id}`
  const coords = ['ax', 'az', 'bx', 'bz'] as const
  const missing = coords.filter((key) => !validNumber(value[key]))
  if (missing.length) errors.push(`${wallLabel}: coordonnees invalides (${missing.join(', ')}).`)
  if (!validNumber(value.thickness) || value.thickness <= 0) errors.push(`${wallLabel}: thickness invalide.`)
  if (value.height !== undefined && (!validNumber(value.height) || value.height <= 0)) {
    errors.push(`${wallLabel}: height invalide.`)
  }
  if (missing.length || !validNumber(value.thickness)) return null

  const wall: WallLike = {
    ax: value.ax as number,
    az: value.az as number,
    bx: value.bx as number,
    bz: value.bz as number,
    thickness: value.thickness,
  }
  const length = wallLength(wall)
  if (length < 0.05) {
    errors.push(`${wallLabel}: mur trop court (${length.toFixed(2)} m).`)
    return null
  }

  const openings = (Array.isArray(value.openings) ? value.openings : [])
    .map((opening, index) => validateOpening(opening, `${wallLabel}/opening[${index}]`, length, errors))
    .filter((opening): opening is InteriorOpening => opening !== null)

  return {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Mur',
    ax: wall.ax,
    az: wall.az,
    bx: wall.bx,
    bz: wall.bz,
    thickness: value.thickness,
    height: validNumber(value.height) ? value.height : undefined,
    material: typeof value.material === 'string' && value.material.trim() ? value.material : 'proto_wall',
    openings,
  }
}

function validateSurface(value: unknown, label: string, errors: string[]): InteriorSurface | null {
  if (!isRecord(value)) {
    errors.push(`${label} doit etre un objet.`)
    return null
  }
  if (!validId(value.id)) {
    errors.push(`${label}: id obligatoire.`)
    return null
  }
  const surfaceLabel = `${label}/${value.id}`
  if (!Array.isArray(value.pts) || value.pts.length < 3) {
    errors.push(`${surfaceLabel}: un sol demande au moins 3 points.`)
    return null
  }
  const pts: [number, number][] = []
  for (const point of value.pts) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every((coord) => validNumber(coord))) {
      errors.push(`${surfaceLabel}: point de contour invalide.`)
      return null
    }
    pts.push([point[0] as number, point[1] as number])
  }
  if (polygonArea(pts) < 0.01) {
    errors.push(`${surfaceLabel}: surface nulle, le contour est aplati.`)
    return null
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Sol',
    pts,
    material: typeof value.material === 'string' && value.material.trim() ? value.material : 'proto_floor',
  }
}

function validatePointItem(value: unknown, label: string, errors: string[]): boolean {
  if (!isRecord(value)) {
    errors.push(`${label} doit etre un objet.`)
    return false
  }
  if (!validId(value.id)) errors.push(`${label}: id obligatoire.`)
  if (typeof value.name !== 'string' || !value.name.trim()) errors.push(`${label}: name obligatoire.`)
  if (!validNumber(value.x)) errors.push(`${label}: x invalide.`)
  if (!validNumber(value.z)) errors.push(`${label}: z invalide.`)
  return validId(value.id) && typeof value.name === 'string' && validNumber(value.x) && validNumber(value.z)
}

function validateFloor(rawValue: unknown, interiorId: string, index: number, errors: string[]): InteriorFloor | null {
  if (!isRecord(rawValue)) {
    errors.push(`${interiorId}: floor[${index}] doit etre un objet.`)
    return null
  }
  const value = migrateFloor(rawValue)

  const id = value.id
  const label = `${interiorId}/${validId(id) ? id : `floor[${index}]`}`
  if (!validId(id)) errors.push(`${label}: id obligatoire.`)
  if (typeof value.label !== 'string' || !value.label.trim()) errors.push(`${label}: label obligatoire.`)
  if (!validNumber(value.elevation)) errors.push(`${label}: elevation invalide.`)
  if (!validNumber(value.height) || value.height <= 0) errors.push(`${label}: height invalide.`)

  if (!Array.isArray(value.walls)) errors.push(`${label}: walls doit etre une liste.`)
  if (!Array.isArray(value.surfaces)) errors.push(`${label}: surfaces doit etre une liste.`)

  const walls = (Array.isArray(value.walls) ? value.walls : [])
    .map((wall, wallIndex) => validateWall(wall, `${label}/wall[${wallIndex}]`, errors))
    .filter((wall): wall is InteriorWall => wall !== null)
  const surfaces = (Array.isArray(value.surfaces) ? value.surfaces : [])
    .map((surface, surfaceIndex) => validateSurface(surface, `${label}/surface[${surfaceIndex}]`, errors))
    .filter((surface): surface is InteriorSurface => surface !== null)

  const props = (Array.isArray(value.props) ? value.props : []).filter((prop, propIndex) => {
    const ok = validatePointItem(prop, `${label}/prop[${propIndex}]`, errors)
    if (ok && isRecord(prop) && !validId(prop.assetId)) errors.push(`${label}/prop[${propIndex}]: assetId obligatoire.`)
    return ok
  }) as unknown as InteriorProp[]

  const spawnPoints = (Array.isArray(value.spawnPoints) ? value.spawnPoints : []).filter((spawn, spawnIndex) =>
    validatePointItem(spawn, `${label}/spawn[${spawnIndex}]`, errors),
  ) as unknown as InteriorSpawnPoint[]

  const exits = (Array.isArray(value.exits) ? value.exits : []).filter((exit, exitIndex) => {
    const ok = validatePointItem(exit, `${label}/exit[${exitIndex}]`, errors)
    if (ok && isRecord(exit) && !isRecord(exit.target)) errors.push(`${label}/exit[${exitIndex}]: target obligatoire.`)
    return ok
  }) as unknown as InteriorExit[]

  const stairs = (Array.isArray(value.stairs) ? value.stairs : []).filter((stair, stairIndex) => {
    const ok = validatePointItem(stair, `${label}/stairs[${stairIndex}]`, errors)
    if (ok && isRecord(stair) && !validId(stair.targetFloorId)) {
      errors.push(`${label}/stairs[${stairIndex}]: targetFloorId obligatoire.`)
    }
    return ok
  }) as unknown as InteriorStairs[]

  if (!validId(id) || typeof value.label !== 'string' || !validNumber(value.elevation) || !validNumber(value.height)) {
    return null
  }

  return {
    id,
    label: value.label,
    elevation: value.elevation,
    height: value.height,
    walls,
    surfaces,
    props,
    spawnPoints,
    exits,
    stairs,
  }
}

function validateInterior(value: unknown, index: number, seenIds: Set<string>, errors: string[]): InteriorDefinition | null {
  if (!isRecord(value)) {
    errors.push(`interior[${index}] doit etre un objet.`)
    return null
  }

  const id = value.id
  const label = validId(id) ? id : `interior[${index}]`
  if (!validId(id)) {
    errors.push(`${label}: id obligatoire.`)
    return null
  }
  if (seenIds.has(id)) {
    errors.push(`${id}: id duplique.`)
    return null
  }
  seenIds.add(id)

  if (typeof value.name !== 'string' || !value.name.trim()) errors.push(`${id}: name obligatoire.`)
  if (typeof value.type !== 'string' || !interiorTypes.has(value.type)) errors.push(`${id}: type invalide.`)
  if (!validNumber(value.version) || value.version < 1) errors.push(`${id}: version invalide.`)
  if (!validNumber(value.defaultWallHeight) || value.defaultWallHeight <= 0) errors.push(`${id}: defaultWallHeight invalide.`)
  if (!validNumber(value.defaultWallThickness) || value.defaultWallThickness <= 0) {
    errors.push(`${id}: defaultWallThickness invalide.`)
  }
  if (!Array.isArray(value.floors) || value.floors.length === 0) errors.push(`${id}: floors doit contenir au moins un etage.`)

  const floors = Array.isArray(value.floors)
    ? value.floors
        .map((floor, floorIndex) => validateFloor(floor, id, floorIndex, errors))
        .filter((floor): floor is InteriorFloor => floor !== null)
    : []

  if (
    typeof value.name !== 'string' ||
    typeof value.type !== 'string' ||
    !interiorTypes.has(value.type) ||
    !validNumber(value.version) ||
    !validNumber(value.defaultWallHeight) ||
    !validNumber(value.defaultWallThickness) ||
    floors.length === 0
  ) {
    return null
  }

  return {
    id,
    name: value.name,
    type: value.type as InteriorType,
    version: value.version,
    defaultWallHeight: value.defaultWallHeight,
    defaultWallThickness: value.defaultWallThickness,
    floors,
  }
}

export function validateInteriors(value: unknown): InteriorValidationResult {
  const seenIds = new Set<string>()
  const errors: string[] = []
  if (!Array.isArray(value)) return { interiors: [], errors: ['interiors doit etre une liste.'] }

  const interiors = value
    .map((interior, index) => validateInterior(interior, index, seenIds, errors))
    .filter((interior): interior is InteriorDefinition => interior !== null)
  return { interiors, errors }
}

export function serializeInterior(interior: InteriorDefinition): InteriorDefinition {
  return {
    ...interior,
    id: interior.id.trim(),
    name: interior.name.trim(),
    defaultWallHeight: round2(interior.defaultWallHeight),
    defaultWallThickness: round2(interior.defaultWallThickness),
    floors: interior.floors.map((floor) => ({
      ...floor,
      id: floor.id.trim(),
      label: floor.label.trim(),
      elevation: round2(floor.elevation),
      height: round2(floor.height),
      walls: floor.walls.map((wall) => ({
        ...wall,
        id: wall.id.trim(),
        name: wall.name.trim(),
        ax: round3(wall.ax),
        az: round3(wall.az),
        bx: round3(wall.bx),
        bz: round3(wall.bz),
        thickness: round3(wall.thickness),
        height: wall.height === undefined ? undefined : round2(wall.height),
        openings: wall.openings.map((opening) => ({
          ...opening,
          id: opening.id.trim(),
          name: opening.name.trim(),
          offset: round3(opening.offset),
          width: round3(opening.width),
          sillHeight: round2(opening.sillHeight),
          topHeight: round2(opening.topHeight),
        })),
      })),
      surfaces: floor.surfaces.map((surface) => ({
        ...surface,
        id: surface.id.trim(),
        name: surface.name.trim(),
        pts: surface.pts.map(([x, z]) => [round3(x), round3(z)] as [number, number]),
      })),
      props: floor.props.map((prop) => ({
        ...prop,
        id: prop.id.trim(),
        name: prop.name.trim(),
        assetId: prop.assetId.trim(),
        x: round2(prop.x),
        z: round2(prop.z),
        rotation: round4(prop.rotation),
      })),
      spawnPoints: floor.spawnPoints.map((spawn) => ({
        ...spawn,
        id: spawn.id.trim(),
        name: spawn.name.trim(),
        x: round2(spawn.x),
        z: round2(spawn.z),
        rotation: round4(spawn.rotation),
      })),
      exits: floor.exits.map((exit) => ({
        ...exit,
        id: exit.id.trim(),
        name: exit.name.trim(),
        x: round2(exit.x),
        z: round2(exit.z),
        rotation: round4(exit.rotation),
      })),
      stairs: floor.stairs.map((stairs) => ({
        ...stairs,
        id: stairs.id.trim(),
        name: stairs.name.trim(),
        x: round2(stairs.x),
        z: round2(stairs.z),
        rotation: round4(stairs.rotation),
        width: round2(stairs.width),
        length: round2(stairs.length),
      })),
    })),
  }
}

export function serializeInteriors(interiors: InteriorDefinition[]): InteriorDefinition[] {
  return interiors.map(serializeInterior).sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Transforme un nom lisible en identifiant de fichier sur : "Kebab du Centre" -> "kebab_du_centre".
 * Les accents sont retires, tout le reste devient underscore. Sert d'`interiorId`, donc de nom
 * de fichier dans `src/data/interiors/`.
 */
export function slugifyInteriorId(label: string) {
  const slug = label
    // NFD separe la lettre de son accent, \p{Diacritic} enleve ensuite l'accent seul.
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'interieur'
}

/** Rend l'identifiant unique dans la liste donnee, en suffixant _2, _3... si besoin. */
export function uniqueInteriorId(base: string, interiors: InteriorDefinition[]) {
  const taken = new Set(interiors.map((interior) => interior.id))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base}_${index}`)) index += 1
  return `${base}_${index}`
}

/**
 * Pose les 4 murs et le sol d'une piece rectangulaire.
 *
 * La "piece" n'est plus une donnee : c'est ce raccourci. Une fois posee, chaque mur vit sa vie
 * (on peut en supprimer un seul, le percer, le deplacer) et le sol aussi.
 */
export function makeRoomShape(options: {
  idPrefix: string
  name: string
  x: number
  z: number
  w: number
  d: number
  thickness: number
}): { walls: InteriorWall[]; surface: InteriorSurface } {
  const { idPrefix, name, x, z, w, d, thickness } = options
  const x2 = x + w
  const z2 = z + d
  const corners: [number, number, number, number][] = [
    [x, z, x2, z],
    [x2, z, x2, z2],
    [x2, z2, x, z2],
    [x, z2, x, z],
  ]

  return {
    walls: corners.map(([ax, az, bx, bz], index) => ({
      id: `${idPrefix}_mur_${index + 1}`,
      name: `${name} — mur ${index + 1}`,
      ax: round3(ax),
      az: round3(az),
      bx: round3(bx),
      bz: round3(bz),
      thickness,
      material: 'proto_wall',
      openings: [],
    })),
    surface: {
      id: `${idPrefix}_sol`,
      name: `${name} — sol`,
      pts: makeRectanglePolygon(x, z, w, d),
      material: 'proto_floor',
    },
  }
}

/**
 * Fabrique un interieur pret a etre visite : une piece fermee, un point d'apparition du joueur
 * au centre, et une sortie qui ramene dehors.
 *
 * On ne cree PAS une coquille vide : un interieur sans mur ni sortie ne serait pas testable, et
 * le joueur y serait bloque. Le createur n'a plus qu'a redimensionner et meubler.
 */
export function makeInterior(options: {
  id: string
  name: string
  type: InteriorType
  /** POI de la carte qui ouvre cet interieur, pour que la sortie sache ou reposer le joueur. */
  markerId?: string
}): InteriorDefinition {
  const { id, name, type, markerId } = options
  const width = 6
  const depth = 5
  const thickness = 0.18
  const shape = makeRoomShape({
    idPrefix: `${id}_p1`,
    name: 'Piece principale',
    x: -width / 2,
    z: -depth / 2,
    w: width,
    d: depth,
    thickness,
  })

  // Une porte au milieu du mur du bas : par ou on entre, par ou on ressort.
  const entrance = shape.walls[2]
  entrance.openings.push({
    id: `${id}_porte_entree`,
    name: 'Entree',
    kind: 'door',
    offset: width / 2,
    width: 1,
    sillHeight: 0,
    topHeight: 2.1,
  })

  return {
    id,
    name,
    type,
    version: 2,
    defaultWallHeight: 2.7,
    defaultWallThickness: thickness,
    floors: [
      {
        id: 'rdc',
        label: 'RDC',
        elevation: 0,
        height: 2.7,
        walls: shape.walls,
        surfaces: [shape.surface],
        props: [],
        spawnPoints: [{ id: `spawn_${id}`, name: 'Arrivee', x: 0, z: 0, rotation: 0 }],
        exits: [
          {
            id: `exit_${id}`,
            name: 'Sortie',
            x: 0,
            z: depth / 2 - 0.6,
            rotation: 0,
            target: markerId ? { kind: 'exterior', markerId } : { kind: 'exterior' },
          },
        ],
        stairs: [],
      },
    ],
  }
}

// Tri par chemin de fichier : l'ordre de la liste reste le meme d'une machine a l'autre,
// donc l'editeur affiche toujours les interieurs dans le meme ordre.
const rawInteriors = Object.keys(interiorModules)
  .sort()
  .map((path) => interiorModules[path])

export const interiorValidation = validateInteriors(rawInteriors)
export const INTERIORS = interiorValidation.interiors
