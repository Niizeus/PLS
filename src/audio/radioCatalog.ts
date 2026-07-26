export type RadioStationId = 'R01' | 'R02' | 'R03' | 'R04' | 'R05'
export type RadioContentType = 'music' | 'jingle' | 'ad' | 'show'
export type RadioEpisodeMode = 'daily-sequence'

export interface RadioTrack {
  id: string
  title: string
  src: string
  contentType: RadioContentType
  /** Duree de reference pour construire une timeline coherente avant lecture des metadonnees. */
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
  style: string
  musicTracks: RadioTrack[]
  jingles: RadioTrack[]
  ads: RadioTrack[]
  scheduledPrograms: ScheduledRadioProgram[]
}

const DEFAULT_MUSIC_SECONDS = 180
const DEFAULT_SHORT_SECONDS = 15
const DEFAULT_AD_SECONDS = 30
const PODCAST_DU_SOIR_START = 18 * 60
const PODCAST_DU_SOIR_DURATION_MINUTES = 60
const GAME_SECONDS_PER_GAME_MINUTE = 2.5

function makeTracks(
  station: RadioStationId,
  contentType: RadioContentType,
  folder: string,
  token: string,
  count: number,
  durationSeconds: number,
): RadioTrack[] {
  return Array.from({ length: count }, (_, index) => {
    const trackNumber = String(index + 1).padStart(2, '0')
    const id = `${station}-${token}${trackNumber}`
    return {
      id,
      title: id,
      src: `/musique/radio/${station}/${folder}/${id}.wav`,
      contentType,
      durationSeconds,
    }
  })
}

function makePodcastDuSoir(station: RadioStationId): ScheduledRadioProgram {
  return {
    id: `${station}-podcast-du-soir`,
    title: 'Podcast du soir',
    folder: 'Podcast_Du_Soir',
    startMinute: PODCAST_DU_SOIR_START,
    durationMinutes: PODCAST_DU_SOIR_DURATION_MINUTES,
    episodeMode: 'daily-sequence',
    episodes: makeTracks(
      station,
      'show',
      'Emissions/Podcast_Du_Soir',
      'E',
      10,
      PODCAST_DU_SOIR_DURATION_MINUTES * GAME_SECONDS_PER_GAME_MINUTE,
    ),
  }
}

function makeStation(
  id: RadioStationId,
  name: string,
  shortName: string,
  style: string,
): RadioStation {
  return {
    id,
    name,
    shortName,
    style,
    musicTracks: makeTracks(id, 'music', 'Musiques', 'T', 5, DEFAULT_MUSIC_SECONDS),
    jingles: makeTracks(id, 'jingle', 'Jingles', 'J', 3, DEFAULT_SHORT_SECONDS),
    ads: makeTracks(id, 'ad', 'Publicites', 'P', 3, DEFAULT_AD_SECONDS),
    scheduledPrograms: [makePodcastDuSoir(id)],
  }
}

export const RADIO_STATIONS: RadioStation[] = [
  makeStation('R01', 'Radio Electro / Techno / Rave', 'R01 Electro', 'Electro, techno, rave'),
  makeStation('R02', 'Radio Chanson francaise old school', 'R02 Chanson', 'Chanson francaise old school'),
  makeStation('R03', 'Radio Rap', 'R03 Rap', 'Rap'),
  makeStation('R04', 'Radio Beauf Satirique', 'R04 Beauf', 'Radio beauf, reactionnaire et satirique'),
  makeStation('R05', 'Radio Alternative Commerciale', 'R05 Alternative', 'Alternative commerciale mondiale'),
]

export const RADIO_STATION_IDS = RADIO_STATIONS.map((station) => station.id) as RadioStationId[]

export function getRadioStation(id: RadioStationId): RadioStation {
  return RADIO_STATIONS.find((station) => station.id === id) ?? RADIO_STATIONS[0]
}

export function getStationPlayableTracks(station: RadioStation): RadioTrack[] {
  return [
    ...station.musicTracks,
    ...station.scheduledPrograms.flatMap((program) => program.episodes),
  ]
}