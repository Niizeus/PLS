import { RADIO_MANIFEST } from 'virtual:pls-radio-manifest'
import type { RadioManifestFile, RadioManifestStation } from '../../vite/radioManifestPlugin'

export type RadioStationId = 'R01' | 'R02' | 'R03' | 'R04' | 'R05'
export type RadioContentType = 'music' | 'jingle' | 'ad' | 'show'
export type RadioEpisodeMode = 'daily-sequence'

export interface RadioTrack {
  id: string
  title: string
  src: string
  contentType: RadioContentType
  /** Duree de reference. Remplacee par la vraie duree des que le fichier est sonde (RadioAudioSystem). */
  durationSeconds: number
}

export interface ScheduledRadioProgram {
  id: string
  title: string
  folder: string
  startMinute: number
  durationMinutes: number
  episodeMode: RadioEpisodeMode
  episodes: RadioTrack[]
}

export interface RadioStation {
  id: RadioStationId
  name: string
  shortName: string
  slogan: string
  style: string
  /** Nom du dossier sur le disque, utile pour les messages d'erreur et la doc. */
  folder: string
  musicTracks: RadioTrack[]
  jingles: RadioTrack[]
  ads: RadioTrack[]
  scheduledPrograms: ScheduledRadioProgram[]
}

const DEFAULT_MUSIC_SECONDS = 180
const DEFAULT_SHORT_SECONDS = 15
const DEFAULT_AD_SECONDS = 30
const DEFAULT_SHOW_SECONDS = 150

/** Premiere emission du soir a 18h00 (temps du jeu) ; les suivantes s'enchainent par tranches d'une heure. */
const EVENING_PROGRAMS_START_MINUTE = 18 * 60
const PROGRAM_SLOT_MINUTES = 60

/**
 * Identite des cinq stations, telle que definie dans
 * `docs/Documentations RADIO/Identite des radios du jeu.pdf`.
 *
 * Seuls ces libelles sont ecrits en dur : tout le contenu audio est detecte sur disque.
 */
interface RadioStationIdentity {
  name: string
  shortName: string
  slogan: string
  style: string
  /** Nom de dossier attendu dans `public/musique/radio/`. */
  folder: string
}

const STATION_IDENTITIES: Record<RadioStationId, RadioStationIdentity> = {
  R01: {
    name: 'TekRadz',
    shortName: 'TekRadz',
    slogan: 'Libre dans les ondes, libre dans les corps.',
    style: 'Tekno underground, hardtek, tribe, acid',
    folder: 'R01_TekRadz',
  },
  R02: {
    name: 'Franchon',
    shortName: 'Franchon',
    slogan: 'Toute la musique francaise, rien que la musique francaise.',
    style: 'Chanson francaise, variete, pop et rock francais',
    folder: 'R02_Franchon',
  },
  R03: {
    name: 'NRV',
    shortName: 'NRV',
    slogan: 'Le rap ne dort jamais.',
    style: 'Rap, boom bap, trap, drill, clashs',
    folder: 'R03_NRV',
  },
  R04: {
    name: 'Lys France',
    shortName: 'Lys France',
    slogan: 'La France comme vous avez peur qu\'elle disparaisse.',
    style: 'Info reactionnaire satirique, variete identitaire ringarde',
    folder: 'R04_Lys_France',
  },
  R05: {
    name: 'Alterz',
    shortName: 'Alterz',
    slogan: 'Tous les sons que tout le monde ecoute.',
    style: 'Pop internationale, tubes commerciaux, electro-pop',
    folder: 'R05_Alterz',
  },
}

export const RADIO_STATION_IDS = Object.keys(STATION_IDENTITIES) as RadioStationId[]

function isKnownStationId(id: string): id is RadioStationId {
  return id in STATION_IDENTITIES
}

function toTracks(
  stationId: RadioStationId,
  contentType: RadioContentType,
  category: string,
  files: RadioManifestFile[],
  durationSeconds: number,
): RadioTrack[] {
  return files.map((file) => ({
    // L'identifiant suit le fichier, pas sa position : renommer un voisin ne casse rien.
    id: `${stationId}/${category}/${file.fileName}`,
    title: file.title,
    src: file.src,
    contentType,
    durationSeconds,
  }))
}

function toStation(id: RadioStationId, manifest: RadioManifestStation | undefined): RadioStation {
  const identity = STATION_IDENTITIES[id]

  return {
    id,
    name: identity.name,
    shortName: identity.shortName,
    slogan: identity.slogan,
    style: identity.style,
    folder: manifest?.folder ?? identity.folder,
    musicTracks: toTracks(id, 'music', 'Musiques', manifest?.musiques ?? [], DEFAULT_MUSIC_SECONDS),
    jingles: toTracks(id, 'jingle', 'Jingles', manifest?.jingles ?? [], DEFAULT_SHORT_SECONDS),
    ads: toTracks(id, 'ad', 'Publicites', manifest?.publicites ?? [], DEFAULT_AD_SECONDS),
    scheduledPrograms: (manifest?.programmes ?? []).map((program, index) => ({
      id: `${id}/Emissions/${program.folder}`,
      title: program.title,
      folder: program.folder,
      startMinute: EVENING_PROGRAMS_START_MINUTE + index * PROGRAM_SLOT_MINUTES,
      durationMinutes: PROGRAM_SLOT_MINUTES,
      episodeMode: 'daily-sequence',
      episodes: toTracks(id, 'show', `Emissions/${program.folder}`, program.episodes, DEFAULT_SHOW_SECONDS),
    })),
  }
}

/**
 * Les cinq stations existent toujours, meme sans un seul fichier audio : on peut zapper
 * dessus et le tableau de bord affiche leur nom. Une station vide reste simplement muette.
 */
export const RADIO_STATIONS: RadioStation[] = RADIO_STATION_IDS.map((id) =>
  toStation(
    id,
    RADIO_MANIFEST.find((station) => isKnownStationId(station.id) && station.id === id),
  ),
)

export function getRadioStation(id: RadioStationId): RadioStation {
  return RADIO_STATIONS.find((station) => station.id === id) ?? RADIO_STATIONS[0]
}

export function getStationPlayableTracks(station: RadioStation): RadioTrack[] {
  return [
    ...station.musicTracks,
    ...station.scheduledPrograms.flatMap((program) => program.episodes),
  ]
}
