import rawMarkers from './mapMarkers.json'

export const MAP_MARKER_TYPES = [
  'apartment',
  'shop',
  'bar',
  'work',
  'station',
  'town_hall',
  'police',
  'entrance',
  'exit',
  'blocked_exit',
  'roadworks',
  'npc',
  'test',
  'secret',
] as const

export const MAP_MARKER_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type MapMarkerType = (typeof MAP_MARKER_TYPES)[number]
export type MapMarkerDay = (typeof MAP_MARKER_DAYS)[number]

export interface MapMarkerOpeningHours {
  days: MapMarkerDay[]
  open: string
  close: string
}

export interface MapMarker {
  id: string
  name: string
  type: MapMarkerType
  position: {
    x: number
    z: number
  }
  color: string
  icon: string
  interactionRadius: number
  prompt: string
  visibleInGame: boolean
  visibleOnMap: boolean
  devOnly: boolean
  openingHours?: MapMarkerOpeningHours[]
  closedMessage?: string
  tags: string[]
}

export interface MapMarkerValidationResult {
  markers: MapMarker[]
  errors: string[]
}

const markerTypes = new Set<string>(MAP_MARKER_TYPES)
const markerDays = new Set<string>(MAP_MARKER_DAYS)
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function validateOpeningHours(value: unknown, markerId: string, errors: string[]): MapMarkerOpeningHours[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value)) {
    errors.push(`${markerId}: openingHours doit etre une liste.`)
    return undefined
  }

  const hours: MapMarkerOpeningHours[] = []
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`${markerId}: openingHours[${index}] doit etre un objet.`)
      return
    }
    const days = entry.days
    const open = entry.open
    const close = entry.close
    if (!Array.isArray(days) || !days.every((day) => typeof day === 'string' && markerDays.has(day))) {
      errors.push(`${markerId}: openingHours[${index}].days contient un jour invalide.`)
      return
    }
    if (typeof open !== 'string' || !TIME_RE.test(open)) {
      errors.push(`${markerId}: openingHours[${index}].open doit etre au format HH:mm.`)
      return
    }
    if (typeof close !== 'string' || !TIME_RE.test(close)) {
      errors.push(`${markerId}: openingHours[${index}].close doit etre au format HH:mm.`)
      return
    }
    hours.push({ days: days as MapMarkerDay[], open, close })
  })

  return hours
}

function validateMarker(value: unknown, index: number, seenIds: Set<string>, errors: string[]): MapMarker | null {
  if (!isRecord(value)) {
    errors.push(`marker[${index}] doit etre un objet.`)
    return null
  }

  const id = value.id
  const name = value.name
  const type = value.type
  const position = value.position
  const color = value.color
  const icon = value.icon
  const interactionRadius = value.interactionRadius
  const prompt = value.prompt
  const visibleInGame = value.visibleInGame
  const visibleOnMap = value.visibleOnMap
  const devOnly = value.devOnly
  const closedMessage = value.closedMessage
  const tags = value.tags

  const markerLabel = typeof id === 'string' && id ? id : `marker[${index}]`
  const hasValidName = typeof name === 'string' && name.trim() !== ''
  const hasValidType = typeof type === 'string' && markerTypes.has(type)
  if (typeof id !== 'string' || id.trim() === '') {
    errors.push(`${markerLabel}: id obligatoire.`)
    return null
  }
  if (seenIds.has(id)) {
    errors.push(`${id}: id duplique.`)
    return null
  }
  seenIds.add(id)

  if (!hasValidName) errors.push(`${id}: name obligatoire.`)
  if (!hasValidType) errors.push(`${id}: type invalide.`)
  if (!isRecord(position)) errors.push(`${id}: position obligatoire.`)
  const x = isRecord(position) ? position.x : undefined
  const z = isRecord(position) ? position.z : undefined
  const hasValidX = typeof x === 'number' && Number.isFinite(x)
  const hasValidZ = typeof z === 'number' && Number.isFinite(z)
  const hasValidColor = typeof color === 'string' && COLOR_RE.test(color)
  const hasValidIcon = typeof icon === 'string' && icon.trim() !== ''
  const hasValidRadius = typeof interactionRadius === 'number' && interactionRadius > 0
  if (!hasValidX) errors.push(`${id}: position.x invalide.`)
  if (!hasValidZ) errors.push(`${id}: position.z invalide.`)
  if (!hasValidColor) errors.push(`${id}: color doit etre #RRGGBB.`)
  if (!hasValidIcon) errors.push(`${id}: icon obligatoire.`)
  if (!hasValidRadius) {
    errors.push(`${id}: interactionRadius doit etre positif.`)
  }
  if (typeof prompt !== 'string') errors.push(`${id}: prompt doit etre une chaine.`)
  if (typeof visibleInGame !== 'boolean') errors.push(`${id}: visibleInGame doit etre booleen.`)
  if (typeof visibleOnMap !== 'boolean') errors.push(`${id}: visibleOnMap doit etre booleen.`)
  if (typeof devOnly !== 'boolean') errors.push(`${id}: devOnly doit etre booleen.`)
  if (closedMessage != null && typeof closedMessage !== 'string') {
    errors.push(`${id}: closedMessage doit etre une chaine.`)
  }
  if (!isStringArray(tags)) errors.push(`${id}: tags doit etre une liste de chaines.`)

  const openingHours = validateOpeningHours(value.openingHours, id, errors)

  if (
    !hasValidName ||
    !hasValidType ||
    !hasValidX ||
    !hasValidZ ||
    !hasValidColor ||
    !hasValidIcon ||
    !hasValidRadius ||
    typeof prompt !== 'string' ||
    typeof visibleInGame !== 'boolean' ||
    typeof visibleOnMap !== 'boolean' ||
    typeof devOnly !== 'boolean' ||
    !isStringArray(tags)
  ) {
    return null
  }

  return {
    id,
    name,
    type: type as MapMarkerType,
    position: { x, z },
    color,
    icon,
    interactionRadius,
    prompt,
    visibleInGame,
    visibleOnMap,
    devOnly,
    openingHours,
    closedMessage: typeof closedMessage === 'string' ? closedMessage : undefined,
    tags,
  }
}

export function validateMapMarkers(value: unknown): MapMarkerValidationResult {
  const errors: string[] = []
  const seenIds = new Set<string>()
  if (!Array.isArray(value)) {
    return { markers: [], errors: ['mapMarkers.json doit contenir une liste.'] }
  }

  const markers = value
    .map((marker, index) => validateMarker(marker, index, seenIds, errors))
    .filter((marker): marker is MapMarker => marker !== null)

  return { markers, errors }
}

export function sortMapMarkers(markers: MapMarker[]): MapMarker[] {
  return [...markers].sort((a, b) => a.id.localeCompare(b.id))
}

export function serializeMapMarkers(markers: MapMarker[]): MapMarker[] {
  return sortMapMarkers(markers).map((marker) => {
    const serialized: MapMarker = {
      id: marker.id.trim(),
      name: marker.name.trim(),
      type: marker.type,
      position: {
        x: Number(marker.position.x.toFixed(2)),
        z: Number(marker.position.z.toFixed(2)),
      },
      color: marker.color,
      icon: marker.icon.trim() || marker.type,
      interactionRadius: Number(marker.interactionRadius.toFixed(2)),
      prompt: marker.prompt,
      visibleInGame: marker.visibleInGame,
      visibleOnMap: marker.visibleOnMap,
      devOnly: marker.devOnly,
      tags: [...new Set(marker.tags.map((tag) => tag.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    }

    if (marker.openingHours?.length) {
      serialized.openingHours = marker.openingHours.map((entry) => ({
        days: [...entry.days],
        open: entry.open,
        close: entry.close,
      }))
    }
    if (marker.closedMessage?.trim()) {
      serialized.closedMessage = marker.closedMessage.trim()
    }

    return serialized
  })
}

export const mapMarkerValidation = validateMapMarkers(rawMarkers as unknown)
export const MAP_MARKERS = mapMarkerValidation.markers
