import appartChibrux from './interiors/appart_chibrux.json'

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

export interface InteriorRoom {
  id: string
  name: string
  x: number
  z: number
  w: number
  d: number
  floorMaterial: string
  wallMaterial: string
}

export type InteriorWallSide = 'top' | 'bottom' | 'left' | 'right'

export interface InteriorRemovedWall {
  id: string
  roomId: string
  side: InteriorWallSide
}

export interface InteriorDoor {
  id: string
  name: string
  x: number
  z: number
  rotation: number
  width: number
  target?: InteriorTarget
}

export interface InteriorWindow {
  id: string
  name: string
  x: number
  z: number
  rotation: number
  width: number
  sillHeight: number
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
  rooms: InteriorRoom[]
  removedWalls: InteriorRemovedWall[]
  doors: InteriorDoor[]
  windows: InteriorWindow[]
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validateRectItem(value: unknown, label: string, errors: string[]): boolean {
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

function validateFloor(value: unknown, interiorId: string, index: number, errors: string[]): InteriorFloor | null {
  if (!isRecord(value)) {
    errors.push(`${interiorId}: floor[${index}] doit etre un objet.`)
    return null
  }

  const id = value.id
  const label = `${interiorId}/${validId(id) ? id : `floor[${index}]`}`
  if (!validId(id)) errors.push(`${label}: id obligatoire.`)
  if (typeof value.label !== 'string' || !value.label.trim()) errors.push(`${label}: label obligatoire.`)
  if (!validNumber(value.elevation)) errors.push(`${label}: elevation invalide.`)
  if (!validNumber(value.height) || value.height <= 0) errors.push(`${label}: height invalide.`)

  const rooms = Array.isArray(value.rooms) ? value.rooms : []
  const removedWalls = Array.isArray(value.removedWalls) ? value.removedWalls : []
  const doors = Array.isArray(value.doors) ? value.doors : []
  const windows = Array.isArray(value.windows) ? value.windows : []
  const props = Array.isArray(value.props) ? value.props : []
  const spawnPoints = Array.isArray(value.spawnPoints) ? value.spawnPoints : []
  const exits = Array.isArray(value.exits) ? value.exits : []
  const stairs = Array.isArray(value.stairs) ? value.stairs : []

  if (!Array.isArray(value.rooms)) errors.push(`${label}: rooms doit etre une liste.`)
  if (value.removedWalls !== undefined && !Array.isArray(value.removedWalls)) errors.push(`${label}: removedWalls doit etre une liste.`)
  if (!Array.isArray(value.doors)) errors.push(`${label}: doors doit etre une liste.`)
  if (!Array.isArray(value.windows)) errors.push(`${label}: windows doit etre une liste.`)
  if (!Array.isArray(value.props)) errors.push(`${label}: props doit etre une liste.`)
  if (!Array.isArray(value.spawnPoints)) errors.push(`${label}: spawnPoints doit etre une liste.`)
  if (!Array.isArray(value.exits)) errors.push(`${label}: exits doit etre une liste.`)
  if (!Array.isArray(value.stairs)) errors.push(`${label}: stairs doit etre une liste.`)

  rooms.forEach((room, roomIndex) => {
    if (!validateRectItem(room, `${label}/room[${roomIndex}]`, errors) || !isRecord(room)) return
    if (!validNumber(room.w) || room.w <= 0) errors.push(`${label}/${room.id}: w invalide.`)
    if (!validNumber(room.d) || room.d <= 0) errors.push(`${label}/${room.id}: d invalide.`)
  })

  removedWalls.forEach((wall, wallIndex) => {
    if (!isRecord(wall)) {
      errors.push(`${label}/removedWall[${wallIndex}] doit etre un objet.`)
      return
    }
    if (!validId(wall.id)) errors.push(`${label}/removedWall[${wallIndex}]: id obligatoire.`)
    if (!validId(wall.roomId)) errors.push(`${label}/${wall.id}: roomId obligatoire.`)
    if (wall.side !== 'top' && wall.side !== 'bottom' && wall.side !== 'left' && wall.side !== 'right') {
      errors.push(`${label}/${wall.id}: side invalide.`)
    }
  })

  doors.forEach((door, doorIndex) => {
    if (!validateRectItem(door, `${label}/door[${doorIndex}]`, errors) || !isRecord(door)) return
    if (!validNumber(door.rotation)) errors.push(`${label}/${door.id}: rotation invalide.`)
    if (!validNumber(door.width) || door.width <= 0) errors.push(`${label}/${door.id}: width invalide.`)
  })

  windows.forEach((windowItem, windowIndex) => {
    if (!validateRectItem(windowItem, `${label}/window[${windowIndex}]`, errors) || !isRecord(windowItem)) return
    if (!validNumber(windowItem.rotation)) errors.push(`${label}/${windowItem.id}: rotation invalide.`)
    if (!validNumber(windowItem.width) || windowItem.width <= 0) errors.push(`${label}/${windowItem.id}: width invalide.`)
  })

  props.forEach((prop, propIndex) => {
    if (!validateRectItem(prop, `${label}/prop[${propIndex}]`, errors) || !isRecord(prop)) return
    if (!validId(prop.assetId)) errors.push(`${label}/${prop.id}: assetId obligatoire.`)
    if (!validNumber(prop.rotation)) errors.push(`${label}/${prop.id}: rotation invalide.`)
  })

  spawnPoints.forEach((spawn, spawnIndex) => {
    if (!validateRectItem(spawn, `${label}/spawn[${spawnIndex}]`, errors) || !isRecord(spawn)) return
    if (!validNumber(spawn.rotation)) errors.push(`${label}/${spawn.id}: rotation invalide.`)
  })

  exits.forEach((exit, exitIndex) => {
    if (!validateRectItem(exit, `${label}/exit[${exitIndex}]`, errors) || !isRecord(exit)) return
    if (!validNumber(exit.rotation)) errors.push(`${label}/${exit.id}: rotation invalide.`)
    if (!isRecord(exit.target)) errors.push(`${label}/${exit.id}: target obligatoire.`)
  })

  stairs.forEach((stair, stairIndex) => {
    if (!validateRectItem(stair, `${label}/stairs[${stairIndex}]`, errors) || !isRecord(stair)) return
    if (!validNumber(stair.rotation)) errors.push(`${label}/${stair.id}: rotation invalide.`)
    if (!validNumber(stair.width) || stair.width <= 0) errors.push(`${label}/${stair.id}: width invalide.`)
    if (!validNumber(stair.length) || stair.length <= 0) errors.push(`${label}/${stair.id}: length invalide.`)
    if (!validId(stair.targetFloorId)) errors.push(`${label}/${stair.id}: targetFloorId obligatoire.`)
  })

  if (!validId(id) || typeof value.label !== 'string' || !validNumber(value.elevation) || !validNumber(value.height)) {
    return null
  }

  return value as unknown as InteriorFloor
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
      rooms: floor.rooms.map((room) => ({
        ...room,
        id: room.id.trim(),
        name: room.name.trim(),
        x: round2(room.x),
        z: round2(room.z),
        w: round2(room.w),
        d: round2(room.d),
      })),
      removedWalls: (floor.removedWalls ?? []).map((wall) => ({
        id: wall.id.trim(),
        roomId: wall.roomId.trim(),
        side: wall.side,
      })),
      doors: floor.doors.map((door) => ({
        ...door,
        id: door.id.trim(),
        name: door.name.trim(),
        x: round2(door.x),
        z: round2(door.z),
        rotation: round4(door.rotation),
        width: round2(door.width),
      })),
      windows: floor.windows.map((windowItem) => ({
        ...windowItem,
        id: windowItem.id.trim(),
        name: windowItem.name.trim(),
        x: round2(windowItem.x),
        z: round2(windowItem.z),
        rotation: round4(windowItem.rotation),
        width: round2(windowItem.width),
        sillHeight: round2(windowItem.sillHeight),
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

function round2(value: number) {
  return Number(value.toFixed(2))
}

function round4(value: number) {
  return Number(value.toFixed(4))
}

export const INTERIORS = validateInteriors([appartChibrux]).interiors
