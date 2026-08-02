import { getDayNumber, getMinuteOfDay } from '../gameplay/time/gameTimeStore'
import type { RadioEpisodeSegment, RadioStation, RadioStationId, RadioTrack } from './radioCatalog'
import { getStationProgramming, type RadioStationProgramming } from './radioProgramming'
import { getSlot } from './radioSchedule'

/**
 * 📡 L'ANTENNE — une station qui émet en permanence, pour tout le monde.
 *
 * ## Le principe
 *
 * Une station **existe indépendamment de ses auditeurs**. Elle diffuse, qu'on
 * l'écoute ou non. La voiture, le magasin, le bar ne sont que des **récepteurs**
 * branchés dessus : ils demandent « qu'est-ce qui passe, là, maintenant ? » et
 * se calent dessus.
 *
 * C'est ce qui donne l'effet recherché : on sort de la voiture en pleine
 * chanson, on entre dans un magasin réglé sur la même station, et c'est **la
 * même chanson au même instant**.
 *
 * ## Pourquoi le TEMPS RÉEL, et pas le temps du jeu
 *
 * C'est LE point qui avait tout cassé. L'antenne avançait avec l'heure du jeu,
 * qui progresse par `requestAnimationFrame` avec un pas plafonné : elle prend du
 * retard à chaque à-coup et **gèle** quand la fenêtre passe en arrière-plan. Un
 * fichier audio, lui, avance en temps réel. L'écart grandissait donc sans fin, et
 * le récepteur repositionnait le lecteur toutes les 250 ms pour rattraper — ce
 * qui annulait le chargement du fichier à chaque fois. Plus aucune musique ne
 * démarrait.
 *
 * Ici l'antenne avance sur la **même horloge que les fichiers audio** : le temps
 * réel. L'écart ne peut plus apparaître, donc on ne se replace qu'**une seule
 * fois**, au moment où on allume le poste.
 *
 * L'heure du JEU ne sert plus qu'à lire la grille de la Régie : elle dit *quand*
 * une émission prend l'antenne, jamais *où on en est* dans un fichier.
 *
 * ## Pas de minuteur : l'antenne rattrape son retard
 *
 * Rien ne tourne en tâche de fond. Quand un récepteur interroge l'antenne après
 * six minutes d'absence, elle déroule d'un coup ce qui « s'est passé » — deux
 * morceaux et on est à 40 s du troisième. Le résultat est identique à une
 * antenne qui n'aurait jamais cessé, et ça ne coûte rien quand personne n'écoute.
 */

export type BroadcastKind = 'music' | 'jingle' | 'show' | 'ads'

export interface BroadcastItem {
  track: RadioTrack
  kind: BroadcastKind
  /** Ce qu'affiche le tableau de bord. */
  label: string
}

export interface BroadcastPosition {
  item: BroadcastItem
  /** Où en est le morceau à l'instant demandé, en secondes. */
  offsetSeconds: number
}

/**
 * Au-delà, on ne déroule pas l'historique : on rallume simplement l'antenne.
 * Évite de parcourir des milliers de morceaux après une très longue absence.
 */
const MAX_CATCH_UP_MS = 6 * 60 * 60 * 1000
/** Garde-fou contre une boucle infinie si des durées étaient aberrantes. */
const MAX_STEPS = 2000

interface Antenna {
  item: BroadcastItem | null
  /** Heure RÉELLE (ms) à laquelle le morceau en cours a commencé. */
  startedAtMs: number
  /** Ordre de passage courant de la playlist, et où on en est. */
  order: RadioTrack[]
  cursor: number
  /** Rotation des jingles de la station. */
  jingleOrder: RadioTrack[]
  jingleCursor: number
  /** Nombre de vrais morceaux joues depuis le dernier jingle. */
  musicSinceJingle: number
  /** Nombre de vrais morceaux joues depuis la derniere coupure pub automatique. */
  musicSinceAd: number
  /** Nombre de pubs restantes dans la coupure automatique en cours. */
  adsInBreakLeft: number
  /** Parties restantes de l'émission en cours. */
  parts: RadioEpisodeSegment[]
  showTitle: string
  partIndex: number
  partCount: number
  /** Émissions déjà passées à l'antenne (clé `jour|heure|émission`). */
  aired: Set<string>
  adCursor: number
}

/** Une antenne par station, partagée par TOUS les récepteurs. */
const antennas = new Map<RadioStationId, Antenna>()

function getAntenna(id: RadioStationId): Antenna {
  let antenna = antennas.get(id)
  if (!antenna) {
    antenna = {
      item: null,
      startedAtMs: 0,
      order: [],
      cursor: 0,
      jingleOrder: [],
      jingleCursor: 0,
      musicSinceJingle: 0,
      musicSinceAd: 0,
      adsInBreakLeft: 0,
      parts: [],
      showTitle: '',
      partIndex: 0,
      partCount: 0,
      aired: new Set(),
      adCursor: 0,
    }
    antennas.set(id, antenna)
  }
  return antenna
}

/**
 * Ce que la station diffuse à l'instant `nowMs`, et où on en est dedans.
 *
 * @param nowMs        heure réelle (`Date.now()`), la même pour tous les récepteurs
 * @param gameMinutes  heure du JEU, uniquement pour lire la grille de la Régie
 */
export function getBroadcast(
  station: RadioStation,
  available: RadioTrack[],
  nowMs: number,
  gameMinutes: number,
): BroadcastPosition | null {
  const antenna = getAntenna(station.id)
  const has = new Set(available.map((track) => track.id))
  const keep = (tracks: RadioTrack[]) => tracks.filter((track) => track && has.has(track.id))

  const music = keep(station.musicTracks)
  const jingles = keep(station.jingles)
  const ads = keep(station.ads)
  const programming = getStationProgramming(station.id)

  // --- Une émission doit-elle prendre l'antenne ? ---
  const show = dueShow(station, antenna, gameMinutes, keep)
  if (show) {
    antenna.parts = show.parts
    antenna.showTitle = show.title
    antenna.partCount = show.parts.length
    antenna.partIndex = 0
    antenna.item = nextShowSegment(station, antenna, music, jingles, ads, gameMinutes)
    antenna.startedAtMs = nowMs
  }

  // --- Rien encore diffusé, ou absence trop longue : on (r)allume ---
  if (!antenna.item || nowMs - antenna.startedAtMs > MAX_CATCH_UP_MS) {
    antenna.item = nextItem(station, antenna, music, jingles, ads, gameMinutes, programming)
    antenna.startedAtMs = nowMs
  }

  // --- On déroule ce qui s'est passé depuis la dernière fois ---
  let steps = 0
  while (antenna.item && steps++ < MAX_STEPS) {
    const length = Math.max(1, antenna.item.track.durationSeconds) * 1000
    if (nowMs - antenna.startedAtMs < length) break
    antenna.startedAtMs += length
    antenna.item = nextItem(station, antenna, music, jingles, ads, gameMinutes, programming)
  }

  if (!antenna.item) return null
  return { item: antenna.item, offsetSeconds: Math.max(0, (nowMs - antenna.startedAtMs) / 1000) }
}

/**
 * Coupe le morceau en cours et passe au suivant.
 * Sert quand un fichier se révèle illisible : sans ça l'antenne resterait
 * bloquée dessus, donc muette.
 */
export function skipCurrent(station: RadioStation, available: RadioTrack[], nowMs: number, gameMinutes: number) {
  const antenna = getAntenna(station.id)
  const has = new Set(available.map((track) => track.id))
  const keep = (tracks: RadioTrack[]) => tracks.filter((track) => track && has.has(track.id))
  antenna.item = nextItem(
    station,
    antenna,
    keep(station.musicTracks),
    keep(station.jingles),
    keep(station.ads),
    gameMinutes,
    getStationProgramming(station.id),
  )
  antenna.startedAtMs = nowMs
}

// ---------------------------------------------------------------------------

function dueShow(
  station: RadioStation,
  antenna: Antenna,
  gameMinutes: number,
  keep: (tracks: RadioTrack[]) => RadioTrack[],
): { parts: RadioEpisodeSegment[]; title: string } | null {
  const hour = Math.floor(getMinuteOfDay(gameMinutes) / 60)
  const dayNumber = getDayNumber(gameMinutes)
  const slot = getSlot(station.id, (dayNumber - 1) % 7, hour)
  if (slot?.kind !== 'show' || !slot.show) return null

  // Une émission ne prend l'antenne qu'UNE fois par créneau, sinon elle
  // repartirait du début à chaque interrogation pendant toute son heure.
  const key = `${dayNumber}|${hour}|${slot.show}`
  if (antenna.aired.has(key)) return null

  const program = station.scheduledPrograms.find((p) => p.folder === slot.show)
  if (!program) return null

  const episodes = program.episodes
    .map((episode) => {
      const parts = keep(episode.parts)
      const allowed = new Set(parts.map((track) => track.id))
      const segments = episode.segments.filter((segment) => segment.kind !== 'take' || (segment.track && allowed.has(segment.track.id)))
      return { ...episode, parts, segments }
    })
    .filter((episode) => episode.parts.length > 0 && episode.segments.length > 0)
  if (episodes.length === 0) return null

  antenna.aired.add(key)
  // Un épisode par jour de jeu, dans l'ordre, puis la liste boucle.
  const episode = episodes[(dayNumber - 1) % episodes.length]
  return { parts: episode.segments.slice(), title: program.title }
}

function nextItem(
  station: RadioStation,
  antenna: Antenna,
  music: RadioTrack[],
  jingles: RadioTrack[],
  ads: RadioTrack[],
  gameMinutes: number,
  programming: RadioStationProgramming,
): BroadcastItem | null {
  // 1. Une émission est en cours : on suit sa structure segment par segment.
  if (antenna.parts.length > 0) {
    const showItem = nextShowSegment(station, antenna, music, jingles, ads, gameMinutes)
    if (showItem) return showItem
  }

  const hour = Math.floor(getMinuteOfDay(gameMinutes) / 60)
  const slot = getSlot(station.id, (getDayNumber(gameMinutes) - 1) % 7, hour)

  // 2. Antenne coupée : il ne reste que le souffle du poste.
  if (slot?.kind === 'off') return null

  // 3. Plage de publicité (on retombe sur la musique si la station n'en a pas).
  if (slot?.kind === 'ads' && ads.length > 0) {
    return nextAd(antenna, ads)
  }

  // 4. Coupure pub automatique, selon la politique de la station.
  if (programming.ads.enabled && ads.length > 0) {
    if (antenna.adsInBreakLeft > 0) return nextAd(antenna, ads)
    if (programming.ads.musicInterval > 0 && antenna.musicSinceAd >= programming.ads.musicInterval) {
      antenna.adsInBreakLeft = Math.max(1, programming.ads.maxPerBreak)
      antenna.musicSinceAd = 0
      return nextAd(antenna, ads)
    }
  }

  // 5. Sinon, et par défaut : playlist musicale avec habillage configurable.
  if (music.length === 0) return null
  if (
    programming.jingles.enabled &&
    programming.jingles.musicInterval > 0 &&
    antenna.musicSinceJingle >= programming.jingles.musicInterval &&
    jingles.length > 0
  ) {
    return nextJingle(station, antenna, jingles, gameMinutes)
  }

  return nextMusic(station, antenna, music, gameMinutes)
}

function nextShowSegment(
  station: RadioStation,
  antenna: Antenna,
  music: RadioTrack[],
  jingles: RadioTrack[],
  ads: RadioTrack[],
  gameMinutes: number,
): BroadcastItem | null {
  let guard = 0
  while (antenna.parts.length > 0 && guard++ < 20) {
    const segment = antenna.parts.shift()!
    antenna.partIndex++
    const label =
      antenna.partCount > 1 ? `${antenna.showTitle} (${antenna.partIndex}/${antenna.partCount})` : antenna.showTitle

    if (segment.kind === 'take' && segment.track) return { track: segment.track, kind: 'show', label }
    if (segment.kind === 'music_break' && music.length > 0) return nextMusic(station, antenna, music, gameMinutes)
    if (segment.kind === 'jingle' && jingles.length > 0) return nextJingle(station, antenna, jingles, gameMinutes)
    if (segment.kind === 'ad' && ads.length > 0) return nextAd(antenna, ads)
  }
  return null
}

function nextMusic(
  station: RadioStation,
  antenna: Antenna,
  music: RadioTrack[],
  gameMinutes: number,
): BroadcastItem {
  if (antenna.cursor >= antenna.order.length) {
    // Playlist mélangée, puis tournée depuis un point de départ aléatoire :
    // entrer dans un véhicule ne retombe pas toujours sur le même premier titre,
    // mais aucun morceau ne repasse tant qu'on n'a pas fait le tour.
    antenna.order = randomStart(shuffle(music, seedOf(`${station.id}|${getDayNumber(gameMinutes)}`)))
    antenna.cursor = 0
  }
  const track = antenna.order[antenna.cursor++]
  antenna.musicSinceJingle++
  antenna.musicSinceAd++
  return { track, kind: 'music', label: track.title }
}

function nextAd(antenna: Antenna, ads: RadioTrack[]): BroadcastItem {
  const track = ads[antenna.adCursor++ % ads.length]
  antenna.adsInBreakLeft = Math.max(0, antenna.adsInBreakLeft - 1)
  return { track, kind: 'ads', label: track.title }
}

function nextJingle(
  station: RadioStation,
  antenna: Antenna,
  jingles: RadioTrack[],
  gameMinutes: number,
): BroadcastItem {
  if (antenna.jingleCursor >= antenna.jingleOrder.length) {
    antenna.jingleOrder = shuffle(jingles, seedOf(`${station.id}|jingles|${getDayNumber(gameMinutes)}`))
    antenna.jingleCursor = 0
  }
  const track = antenna.jingleOrder[antenna.jingleCursor++]
  antenna.musicSinceJingle = 0
  return { track, kind: 'jingle', label: track.title }
}

function randomStart<T>(items: T[]): T[] {
  if (items.length <= 1) return items
  const start = Math.floor(Math.random() * items.length)
  return [...items.slice(start), ...items.slice(0, start)]
}

/** Mélange de Fisher-Yates, avec un hasard REPRODUCTIBLE (même graine = même ordre). */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice()
  let state = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0
    const j = state % (i + 1)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function seedOf(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
