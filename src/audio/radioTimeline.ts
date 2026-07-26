import {
  getDayIndex,
  getDayNumber,
  getMinuteOfDay,
  MINUTES_PER_DAY,
  REAL_SECONDS_PER_GAME_DAY,
} from '../gameplay/time/gameTimeStore'
import type { RadioEpisode, RadioStation, RadioTrack, ScheduledRadioProgram } from './radioCatalog'
import { findShowOnAir, getSlot, nextShowHour } from './radioSchedule'

/**
 * 📻 OÙ EN EST UNE STATION, À UN INSTANT DONNÉ.
 *
 * Principe fondateur, à ne pas casser : la position est **calculée** depuis
 * l'horloge, jamais mémorisée. Une station tourne donc toute seule même quand
 * personne ne l'écoute — on descend de voiture cinq minutes, on remonte, et la
 * chanson a avancé. Comme une vraie radio.
 */

export type RadioTimelineContent = 'music' | 'show' | 'ads'

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
  const day = getDayIndex(totalGameMinutes)
  const hour = Math.floor(getMinuteOfDay(totalGameMinutes) / 60)

  // Antenne coupée : il ne reste que le souffle du poste.
  if (getSlot(station.id, day, hour)?.kind === 'off') return null

  const active = getActiveProgram(station, totalGameMinutes, available)
  if (active) {
    const position = getProgramPosition(active, totalGameMinutes)
    if (position) return position
  }

  if (getSlot(station.id, day, hour)?.kind === 'ads') {
    const position = getRotationPosition(station.ads, 'ads', station.id, totalGameMinutes, availableTracks)
    if (position) return position
  }

  return getRotationPosition(station.musicTracks, 'music', station.id, totalGameMinutes, availableTracks)
}

// ---------------------------------------------------------------------------
// Émissions
// ---------------------------------------------------------------------------

interface ActiveProgram {
  program: ScheduledRadioProgram
  episode: RadioEpisode
  /** Minute du jour à laquelle l'émission a pris l'antenne. */
  startMinute: number
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
  const day = getDayIndex(totalGameMinutes)
  const minuteOfDay = getMinuteOfDay(totalGameMinutes)
  const hour = Math.floor(minuteOfDay / 60)

  // Quelle émission a l'antenne d'après la grille ? On remonte dans la journée,
  // car une émission posée à 18h peut encore jouer à 21h (voir radioSchedule.ts).
  const onAir = findShowOnAir(station.id, day, hour)
  if (!onAir) return null

  const program = station.scheduledPrograms.find((p) => p.folder === onAir.show)
  if (!program) return null

  const episode = episodeOfTheDay(program, totalGameMinutes, available)
  if (!episode) return null

  const startMinute = onAir.startHour * 60
  // Longueur réelle de l'épisode, convertie en minutes de jeu.
  let lengthMinutes = episode.durationSeconds / GAME_SECONDS_PER_GAME_MINUTE
  // Une émission ne déborde ni sur la suivante, ni sur le lendemain.
  const nextHour = nextShowHour(station.id, day, onAir.startHour)
  if (nextHour !== null) lengthMinutes = Math.min(lengthMinutes, nextHour * 60 - startMinute)
  lengthMinutes = Math.min(lengthMinutes, MINUTES_PER_DAY - startMinute)

  if (minuteOfDay - startMinute >= lengthMinutes) return null

  return { program, episode, startMinute }
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
  const { program, episode, startMinute } = active
  let cursor = (getMinuteOfDay(totalGameMinutes) - startMinute) * GAME_SECONDS_PER_GAME_MINUTE

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

/**
 * 🎲 La playlist, MÉLANGÉE différemment chaque jour.
 *
 * On voulait « ne pas rejouer un morceau joué récemment ». Un historique
 * casserait la propriété la plus précieuse du système : la station tourne toute
 * seule sans auditeur, parce que sa position se CALCULE. Mémoriser ce qui a été
 * joué obligerait quelqu'un à écouter pour que ça avance.
 *
 * On mélange donc la playlist avec un tirage reproductible, dont la graine est
 * (jour, station). C'est plus fort qu'un historique de trois titres :
 *
 *  - **aucune répétition** tant qu'on n'a pas fait le tour de la playlist ;
 *  - un **ordre différent chaque jour**, et différent d'une station à l'autre ;
 *  - et ça reste calculable depuis l'heure seule.
 */
function getRotationPosition(
  catalogue: RadioTrack[],
  content: RadioTimelineContent,
  stationId: string,
  totalGameMinutes: number,
  availableTracks: RadioTrack[],
): RadioTimelinePosition | null {
  const tracks = filterAvailable(catalogue, availableTracks)
  if (tracks.length === 0) return null

  const totalDuration = tracks.reduce((sum, track) => sum + Math.max(1, track.durationSeconds), 0)
  if (totalDuration <= 0) return null

  const dayNumber = getDayNumber(totalGameMinutes)
  const ordered = shuffleWithSeed(tracks, hashSeed(`${stationId}|${content}|${dayNumber}`))

  const seedOffset = STATION_SEED_OFFSETS_SECONDS[stationId] ?? 0
  let cursor = (Math.floor(totalGameMinutes * GAME_SECONDS_PER_GAME_MINUTE) + seedOffset) % totalDuration

  for (const track of ordered) {
    const duration = Math.max(1, track.durationSeconds)
    if (cursor < duration) {
      return { track, offsetSeconds: cursor, content, label: track.title, remainingSeconds: duration - cursor }
    }
    cursor -= duration
  }

  const first = ordered[0]
  return {
    track: first,
    offsetSeconds: 0,
    content,
    label: first.title,
    remainingSeconds: Math.max(1, first.durationSeconds),
  }
}

/** Mélange de Fisher-Yates, mais avec un hasard REPRODUCTIBLE (même graine = même ordre). */
function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const out = items.slice()
  let state = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    // Générateur congruentiel simple : largement suffisant pour brasser une playlist.
    state = (state * 1664525 + 1013904223) >>> 0
    const j = state % (i + 1)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function hashSeed(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Garde l'ordre du catalogue mais renvoie la version sondee des morceaux : c'est elle qui
 * porte la duree reelle du fichier, indispensable pour placer le curseur de la timeline.
 */
function filterAvailable(tracks: RadioTrack[], availableTracks: RadioTrack[]): RadioTrack[] {
  const availableById = new Map(availableTracks.map((track) => [track.id, track]))
  return tracks.map((track) => availableById.get(track.id)).filter((track): track is RadioTrack => track !== undefined)
}
