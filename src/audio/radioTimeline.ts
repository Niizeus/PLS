import { getDayNumber, getMinuteOfDay, MINUTES_PER_DAY, REAL_SECONDS_PER_GAME_DAY } from '../gameplay/time/gameTimeStore'
import type { RadioStation, RadioTrack, ScheduledRadioProgram } from './radioCatalog'

export type RadioTimelineContent = 'music' | 'show'

export interface RadioTimelinePosition {
  track: RadioTrack
  offsetSeconds: number
  content: RadioTimelineContent
  label: string
  programId?: string
}

const GAME_SECONDS_PER_GAME_MINUTE = REAL_SECONDS_PER_GAME_DAY / MINUTES_PER_DAY

const STATION_SEED_OFFSETS_SECONDS: Record<string, number> = {
  R01: 11,
  R02: 47,
  R03: 83,
  R04: 131,
  R05: 179,
}

export function getRadioTimelinePosition(
  station: RadioStation,
  totalGameMinutes: number,
  availableTracks: RadioTrack[],
): RadioTimelinePosition | null {
  const activeProgram = getActiveProgram(station, totalGameMinutes)
  if (activeProgram) {
    const position = getProgramPosition(activeProgram, totalGameMinutes, availableTracks)
    if (position) return position
  }

  return getMusicPosition(station, totalGameMinutes, availableTracks)
}

function getActiveProgram(station: RadioStation, totalGameMinutes: number): ScheduledRadioProgram | null {
  const minuteOfDay = getMinuteOfDay(totalGameMinutes)
  return station.scheduledPrograms.find((program) => isMinuteInSlot(minuteOfDay, program.startMinute, program.durationMinutes)) ?? null
}

function getProgramPosition(
  program: ScheduledRadioProgram,
  totalGameMinutes: number,
  availableTracks: RadioTrack[],
): RadioTimelinePosition | null {
  const availableEpisodes = filterAvailable(program.episodes, availableTracks)
  if (availableEpisodes.length === 0) return null

  const dayIndex = getDayNumber(totalGameMinutes) - 1
  const episode = availableEpisodes[dayIndex % availableEpisodes.length]
  const slotOffsetMinutes = getSlotOffsetMinutes(getMinuteOfDay(totalGameMinutes), program.startMinute)
  const slotOffsetSeconds = slotOffsetMinutes * GAME_SECONDS_PER_GAME_MINUTE
  const offsetSeconds = slotOffsetSeconds % Math.max(1, episode.durationSeconds)

  return {
    track: episode,
    offsetSeconds,
    content: 'show',
    label: program.title,
    programId: program.id,
  }
}

function getMusicPosition(
  station: RadioStation,
  totalGameMinutes: number,
  availableTracks: RadioTrack[],
): RadioTimelinePosition | null {
  const musicTracks = filterAvailable(station.musicTracks, availableTracks)
  if (musicTracks.length === 0) return null

  const totalDuration = musicTracks.reduce((sum, track) => sum + Math.max(1, track.durationSeconds), 0)
  if (totalDuration <= 0) return null

  const seedOffset = STATION_SEED_OFFSETS_SECONDS[station.id] ?? 0
  let cursor = (Math.floor(totalGameMinutes * GAME_SECONDS_PER_GAME_MINUTE) + seedOffset) % totalDuration

  for (const track of musicTracks) {
    const duration = Math.max(1, track.durationSeconds)
    if (cursor < duration) {
      return { track, offsetSeconds: cursor, content: 'music', label: track.title }
    }
    cursor -= duration
  }

  return { track: musicTracks[0], offsetSeconds: 0, content: 'music', label: musicTracks[0].title }
}

/**
 * Garde l'ordre du catalogue mais renvoie la version sondee des morceaux : c'est elle qui
 * porte la duree reelle du fichier, indispensable pour placer le curseur de la timeline.
 */
function filterAvailable(tracks: RadioTrack[], availableTracks: RadioTrack[]): RadioTrack[] {
  const availableById = new Map(availableTracks.map((track) => [track.id, track]))
  return tracks.map((track) => availableById.get(track.id)).filter((track): track is RadioTrack => track !== undefined)
}

function isMinuteInSlot(minuteOfDay: number, startMinute: number, durationMinutes: number): boolean {
  const endMinute = (startMinute + durationMinutes) % MINUTES_PER_DAY
  if (durationMinutes >= MINUTES_PER_DAY) return true
  if (startMinute < endMinute) return minuteOfDay >= startMinute && minuteOfDay < endMinute
  return minuteOfDay >= startMinute || minuteOfDay < endMinute
}

function getSlotOffsetMinutes(minuteOfDay: number, startMinute: number): number {
  return (minuteOfDay - startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY
}