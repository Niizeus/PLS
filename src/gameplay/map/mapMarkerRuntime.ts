import { type MapMarker, type MapMarkerDay } from '../../data/mapMarkers'
import { getDayIndex, getMinuteOfDay } from '../time/gameTimeStore'

const DAY_BY_INDEX: MapMarkerDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export interface MapMarkerAvailability {
  isOpen: boolean
  label: string
  closedReason: string
}

export function isRuntimeMapMarker(marker: MapMarker): boolean {
  return marker.visibleInGame && (!marker.devOnly || import.meta.env.DEV)
}

export function isRuntimeMapMarkerOnMap(marker: MapMarker): boolean {
  return marker.visibleOnMap && (!marker.devOnly || import.meta.env.DEV)
}

export function getMapMarkerAvailability(marker: MapMarker, totalMinutes: number): MapMarkerAvailability {
  if (!marker.openingHours?.length) {
    return { isOpen: true, label: 'Disponible', closedReason: '' }
  }

  const day = DAY_BY_INDEX[getDayIndex(totalMinutes)]
  const minuteOfDay = getMinuteOfDay(totalMinutes)
  const todayHours = marker.openingHours.filter((entry) => entry.days.includes(day))

  for (const entry of todayHours) {
    const open = parseTime(entry.open)
    const close = parseTime(entry.close)
    if (open == null || close == null) continue

    const openNow =
      close >= open
        ? minuteOfDay >= open && minuteOfDay < close
        : minuteOfDay >= open || minuteOfDay < close
    if (openNow) return { isOpen: true, label: `${entry.open}-${entry.close}`, closedReason: '' }
  }

  const next = todayHours[0]
  return {
    isOpen: false,
    label: next ? `Ferme (${next.open}-${next.close})` : 'Ferme aujourd hui',
    closedReason: marker.closedMessage?.trim() || 'Ce lieu est ferme pour le moment.',
  }
}

export function formatMarkerAction(marker: MapMarker, availability: MapMarkerAvailability): string {
  if (!availability.isOpen) return availability.closedReason
  return marker.prompt.trim() || `Interaction avec ${marker.name}`
}

function parseTime(value: string): number | null {
  const [rawHour, rawMinute] = value.split(':')
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}
