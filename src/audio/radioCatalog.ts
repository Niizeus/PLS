import { RADIO_MANIFEST } from 'virtual:pls-radio-manifest'
import authoredShowsFile from '../data/radioShows.json'
import type { RadioManifestFile, RadioManifestStation } from '../../vite/radioManifestPlugin'

export type RadioStationId = 'R01' | 'R02' | 'R03' | 'R04' | 'R05'
export type RadioContentType = 'music' | 'jingle' | 'ad' | 'show'

export interface RadioTrack {
  id: string
  title: string
  src: string
  contentType: RadioContentType
  /** Duree en secondes. Mesuree au scan quand c'est possible, sinon estimee puis corrigee. */
  durationSeconds: number
  /** Vrai quand la duree a ete MESUREE : inutile de sonder le fichier au chargement. */
  durationKnown: boolean
}

export type RadioEpisodeSegmentKind = 'take' | 'music_break' | 'jingle' | 'ad' | 'silence'

export interface RadioEpisodeSegment {
  id: string
  kind: RadioEpisodeSegmentKind
  title: string
  track?: RadioTrack
  durationSeconds?: number
}

/**
 * Un ÉPISODE : une diffusion, faite d'une ou plusieurs PARTIES qui s'enchaînent.
 *
 * Ce niveau manquait : chaque fichier d'une émission était pris pour un épisode
 * à part, diffusé un jour différent. Trois fichiers `ZoneLibrePartie (1..3)`
 * étaient donc étalés sur trois jours au lieu de s'enchaîner — c'est ce qui
 * donnait des émissions « entrecoupées de musique ».
 */
export interface RadioEpisode {
  id: string
  title: string
  parts: RadioTrack[]
  segments: RadioEpisodeSegment[]
  /** Durée totale des parties (s). `0` tant qu'aucune durée n'est connue. */
  durationSeconds: number
}

export interface ScheduledRadioProgram {
  id: string
  title: string
  folder: string
  episodes: RadioEpisode[]
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

interface AuthoredShowSegment {
  kind?: RadioEpisodeSegmentKind
  title?: string
  fileName?: string
  durationSeconds?: number
}

interface AuthoredShowEpisode {
  folder?: string
  title?: string
  segments?: AuthoredShowSegment[]
}

interface AuthoredShow {
  stationId?: string
  folder?: string
  title?: string
  episodes?: AuthoredShowEpisode[]
}

const AUTHORED_SHOWS = ((authoredShowsFile as { shows?: AuthoredShow[] }).shows ?? []) as AuthoredShow[]


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
  fallbackSeconds: number,
): RadioTrack[] {
  return files.map((file) => ({
    // L'identifiant suit le fichier, pas sa position : renommer un voisin ne casse rien.
    id: `${stationId}/${category}/${file.fileName}`,
    title: file.title,
    src: file.src,
    contentType,
    // La durée vient du scan quand le format le permet (voir radioManifestPlugin) ;
    // sinon on garde une estimation, corrigée plus tard par le sondage navigateur.
    durationSeconds: file.durationSeconds > 0 ? file.durationSeconds : fallbackSeconds,
    /** Vrai quand la durée est mesurée, donc fiable. */
    durationKnown: file.durationSeconds > 0,
  }))
}

function authoredShow(stationId: RadioStationId, folder: string): AuthoredShow | undefined {
  return AUTHORED_SHOWS.find((show) => show.stationId === stationId && show.folder === folder)
}

function authoredEpisode(show: AuthoredShow | undefined, folder: string, index: number): AuthoredShowEpisode | undefined {
  if (!show?.episodes?.length) return undefined
  return show.episodes.find((episode) => (episode.folder || '') === folder) ?? show.episodes[index]
}

function toEpisodeSegments(
  episode: AuthoredShowEpisode | undefined,
  tracks: RadioTrack[],
): RadioEpisodeSegment[] {
  if (!episode?.segments?.length) {
    return tracks.map((track, index) => ({
      id: `${track.id}|${index}`,
      kind: 'take',
      title: track.title,
      track,
    }))
  }

  const byFileName = new Map(tracks.map((track) => [track.id.split('/').at(-1) ?? track.id, track]))
  return episode.segments
    .map((segment, index): RadioEpisodeSegment | null => {
      const kind = segment.kind ?? 'take'
      if (kind === 'take') {
        const track = segment.fileName ? byFileName.get(segment.fileName) : undefined
        if (!track) return null
        return {
          id: `${track.id}|${index}`,
          kind,
          title: segment.title || track.title,
          track,
        } satisfies RadioEpisodeSegment
      }
      return {
        id: `break|${kind}|${index}`,
        kind,
        title: segment.title || kind,
        durationSeconds: segment.durationSeconds,
      } satisfies RadioEpisodeSegment
    })
    .filter((segment): segment is RadioEpisodeSegment => segment !== null)
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
    scheduledPrograms: (manifest?.programmes ?? []).map((program) => {
      const authored = authoredShow(id, program.folder)
      return {
        id: `${id}/Emissions/${program.folder}`,
        title: authored?.title || program.title,
        folder: program.folder,
        episodes: program.episodes.map((episode, index) => {
        const authoredEp = authoredEpisode(authored, episode.folder, index)
        const category = `Emissions/${program.folder}${episode.folder ? '/' + episode.folder : ''}`
        const parts = toTracks(id, 'show', category, episode.parts, DEFAULT_SHOW_SECONDS)
        return {
          id: `${id}/${category}`,
          title: authoredEp?.title || episode.title,
          parts,
          segments: toEpisodeSegments(authoredEp, parts),
          durationSeconds: parts.reduce((sum, part) => sum + part.durationSeconds, 0),
        }
      }),
      }
    }),
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

/**
 * Tout ce qu'une station peut diffuser.
 *
 * ⚠️ Les jingles et les publicités en font partie : ils étaient scannés sur le
 * disque, exposés dans le catalogue… et jamais rendus jouables. Du code mort.
 * La grille de programmation (étape suivante) pourra les placer.
 */
export function getStationPlayableTracks(station: RadioStation): RadioTrack[] {
  return [
    ...station.musicTracks,
    ...station.jingles,
    ...station.ads,
    ...station.scheduledPrograms.flatMap((program) => program.episodes.flatMap((episode) => episode.parts)),
  ]
}
