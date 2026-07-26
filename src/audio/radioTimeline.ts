import { getDayNumber, getMinuteOfDay, MINUTES_PER_DAY, REAL_SECONDS_PER_GAME_DAY } from '../gameplay/time/gameTimeStore'
import type { RadioEpisode, RadioStation, RadioTrack, ScheduledRadioProgram } from './radioCatalog'

/**
 * 📻 OÙ EN EST UNE STATION, À UN INSTANT DONNÉ.
 *
 * Principe fondateur, à ne pas casser : la position est **calculée** depuis
 * l'horloge, jamais mémorisée. Une station tourne donc toute seule même quand
 * personne ne l'écoute — on descend de voiture cinq minutes, on remonte, et la
 * chanson a avancé. Comme une vraie radio.
 */

export type RadioTimelineContent = 'music' | 'show'

export interface RadioTimelinePosition {
  track: RadioTrack
  offsetSeconds: number
  content: RadioTimelineContent
  label: string
  programId?: string
  /** Temps restant sur cette piste (s) : sert à enchaîner AVANT la fin. */
  remainingSeconds: number
}

/** 1 jour de jeu = 1 heure réelle, donc 1 minute de jeu = 2,5 secondes réelles. */
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
  const available = new Map(availableTracks.map((track) => [track.id, track]))

  const active = getActiveProgram(station, totalGameMinutes, available)
  if (active) {
    const position = getProgramPosition(active, totalGameMinutes)
    if (position) return position
  }

  return getMusicPosition(station, totalGameMinutes, availableTracks)
}

// ---------------------------------------------------------------------------
// Émissions
// ---------------------------------------------------------------------------

interface ActiveProgram {
  program: ScheduledRadioProgram
  episode: RadioEpisode
}

/**
 * L'émission en cours, s'il y en a une.
 *
 * ⚠️ Le créneau **n'est pas** une durée fixe d'une heure. Une heure de jeu ne
 * vaut que 2 min 30 réelles : une émission de quinze minutes y serait tranchée
 * net. Un créneau dure donc **ce que dure vraiment l'épisode du jour**, sans
 * jamais mordre sur l'émission suivante.
 */
function getActiveProgram(
  station: RadioStation,
  totalGameMinutes: number,
  available: Map<string, RadioTrack>,
): ActiveProgram | null {
  const minuteOfDay = getMinuteOfDay(totalGameMinutes)

  for (let i = 0; i < station.scheduledPrograms.length; i++) {
    const program = station.scheduledPrograms[i]
    const episode = episodeOfTheDay(program, totalGameMinutes, available)
    if (!episode) continue

    // Longueur réelle de l'épisode, convertie en minutes de jeu.
    let lengthMinutes = episode.durationSeconds / GAME_SECONDS_PER_GAME_MINUTE
    // Une émission ne déborde jamais sur la suivante : c'est elle qui prend l'antenne.
    const next = station.scheduledPrograms[i + 1]
    if (next) lengthMinutes = Math.min(lengthMinutes, next.startMinute - program.startMinute)

    if (getSlotOffsetMinutes(minuteOfDay, program.startMinute) < lengthMinutes) {
      return { program, episode }
    }
  }

  return null
}

/** Un épisode par jour, dans l'ordre ; passé le dernier, la liste boucle. */
function episodeOfTheDay(
  program: ScheduledRadioProgram,
  totalGameMinutes: number,
  available: Map<string, RadioTrack>,
): RadioEpisode | null {
  const episodes: RadioEpisode[] = []
  for (const episode of program.episodes) {
    const parts = episode.parts
      .map((part) => available.get(part.id))
      .filter((part): part is RadioTrack => part !== undefined)
    if (parts.length === 0) continue
    episodes.push({
      ...episode,
      parts,
      durationSeconds: parts.reduce((sum, part) => sum + Math.max(1, part.durationSeconds), 0),
    })
  }
  if (episodes.length === 0) return null

  const dayIndex = getDayNumber(totalGameMinutes) - 1
  return episodes[dayIndex % episodes.length]
}

/**
 * La PARTIE en cours de l'épisode, et où on en est dedans.
 *
 * C'est le correctif principal : avant, chaque fichier d'une émission était pris
 * pour un épisode à part, diffusé un jour différent. Les trois parties d'une
 * même émission étaient donc étalées sur trois jours, séparées par de la
 * musique — d'où l'impression d'émissions entrecoupées. On les enchaîne
 * maintenant bout à bout.
 *
 * L'ancien code faisait aussi `offset % durée`, ce qui faisait BOUCLER une
 * émission plus courte que son créneau. Ici, quand l'épisode est fini, on rend
 * `null` et la station repasse en musique.
 */
function getProgramPosition(active: ActiveProgram, totalGameMinutes: number): RadioTimelinePosition | null {
  const { program, episode } = active
  const slotOffsetMinutes = getSlotOffsetMinutes(getMinuteOfDay(totalGameMinutes), program.startMinute)
  let cursor = slotOffsetMinutes * GAME_SECONDS_PER_GAME_MINUTE

  for (let i = 0; i < episode.parts.length; i++) {
    const part = episode.parts[i]
    const duration = Math.max(1, part.durationSeconds)
    if (cursor < duration) {
      return {
        track: part,
        offsetSeconds: cursor,
        content: 'show',
        // « La Zone Libre (2/3) » : on voit où on en est de l'émission.
        label: episode.parts.length > 1 ? `${program.title} (${i + 1}/${episode.parts.length})` : program.title,
        programId: program.id,
        remainingSeconds: duration - cursor,
      }
    }
    cursor -= duration
  }

  return null
}

// ---------------------------------------------------------------------------
// Musique
// ---------------------------------------------------------------------------

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
      return {
        track,
        offsetSeconds: cursor,
        content: 'music',
        label: track.title,
        remainingSeconds: duration - cursor,
      }
    }
    cursor -= duration
  }

  const first = musicTracks[0]
  return {
    track: first,
    offsetSeconds: 0,
    content: 'music',
    label: first.title,
    remainingSeconds: Math.max(1, first.durationSeconds),
  }
}

/**
 * Garde l'ordre du catalogue mais renvoie la version sondee des morceaux : c'est elle qui
 * porte la duree reelle du fichier, indispensable pour placer le curseur de la timeline.
 */
function filterAvailable(tracks: RadioTrack[], availableTracks: RadioTrack[]): RadioTrack[] {
  const availableById = new Map(availableTracks.map((track) => [track.id, track]))
  return tracks.map((track) => availableById.get(track.id)).filter((track): track is RadioTrack => track !== undefined)
}

function getSlotOffsetMinutes(minuteOfDay: number, startMinute: number): number {
  return (minuteOfDay - startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY
}
