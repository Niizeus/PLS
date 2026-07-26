import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * 📻 Plugin Vite : scanne `public/musique/radio/` et fabrique le catalogue radio.
 *
 * Pourquoi un plugin plutôt qu'une liste écrite à la main : on veut pouvoir déposer
 * un `.wav` dans un dossier de radio et l'entendre en jeu, quel que soit son nom.
 * Le navigateur ne sait pas lister un dossier — c'est donc Vite (côté Node) qui lit
 * le disque et expose le résultat via le module virtuel `virtual:pls-radio-manifest`.
 *
 * En dev, le plugin surveille le dossier : ajouter/supprimer un fichier recharge la page.
 * Au build, le scan est figé dans le bundle (les fichiers de `public/` sont copiés tels quels).
 */

export const RADIO_MANIFEST_MODULE_ID = 'virtual:pls-radio-manifest'
const RESOLVED_ID = '\0' + RADIO_MANIFEST_MODULE_ID

/** Formats lisibles par la balise <audio> des navigateurs modernes. */
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac', '.webm'])

/** Sous-dossiers reconnus dans une station. `Emissions` est traité à part (un sous-dossier par émission). */
const MUSIC_FOLDER = 'Musiques'
const JINGLE_FOLDER = 'Jingles'
const AD_FOLDER = 'Publicites'
const SHOW_FOLDER = 'Emissions'

export interface RadioManifestFile {
  /** Nom de fichier brut, ex. `BreatBite 01.wav`. */
  fileName: string
  /** URL servie par Vite, déjà encodée (espaces et accents compris). */
  src: string
  /** Titre lisible déduit du nom de fichier. */
  title: string
  /**
   * Durée en secondes, lue ICI, côté Node, au moment du scan. `0` = inconnue.
   *
   * Avant, le navigateur téléchargeait les métadonnées de TOUS les fichiers
   * d'une station au premier zap, juste pour connaître leur durée. C'était lent,
   * et surtout la grille de programmation ne pouvait pas afficher « 3 parties,
   * 6 min 12 » sans avoir tout chargé. Les `.wav` donnent leur durée dans leur
   * en-tête, donc en 10 lignes et sans aucune dépendance ; les autres formats
   * restent sondés par le navigateur en secours.
   */
  durationSeconds: number
}

/**
 * Un ÉPISODE : une diffusion, découpée en une ou plusieurs PARTIES qui
 * s'enchaînent. Voir `listEpisodes` pour la règle de rangement.
 */
export interface RadioManifestEpisode {
  /** Nom du sous-dossier, ou chaîne vide si les fichiers sont posés à la racine de l'émission. */
  folder: string
  title: string
  parts: RadioManifestFile[]
}

export interface RadioManifestProgram {
  /** Nom du dossier de l'émission, ex. `Podcast_Du_Soir`. */
  folder: string
  /** Titre lisible déduit du nom de dossier. */
  title: string
  episodes: RadioManifestEpisode[]
}

export interface RadioManifestStation {
  /** Identifiant `RXX` extrait du nom de dossier. */
  id: string
  /** Nom réel du dossier sur le disque, ex. `R01_TekRadz`. */
  folder: string
  musiques: RadioManifestFile[]
  jingles: RadioManifestFile[]
  publicites: RadioManifestFile[]
  programmes: RadioManifestProgram[]
}

export function scanRadioFolder(radioRoot: string, publicDir: string): RadioManifestStation[] {
  if (!fs.existsSync(radioRoot)) return []

  return listDirectories(radioRoot)
    .map((folder) => {
      // Le dossier peut s'appeler `R01`, `R01_TekRadz`, `R01 - TekRadz`… seul le préfixe compte.
      const id = /^(R\d{2})/i.exec(folder)?.[1]?.toUpperCase()
      if (!id) return null

      const stationDir = path.join(radioRoot, folder)
      return {
        id,
        folder,
        musiques: listAudioFiles(path.join(stationDir, MUSIC_FOLDER), publicDir),
        jingles: listAudioFiles(path.join(stationDir, JINGLE_FOLDER), publicDir),
        publicites: listAudioFiles(path.join(stationDir, AD_FOLDER), publicDir),
        programmes: listPrograms(path.join(stationDir, SHOW_FOLDER), publicDir),
      } satisfies RadioManifestStation
    })
    .filter((station): station is RadioManifestStation => station !== null)
    .sort((a, b) => a.id.localeCompare(b.id))
}

function listPrograms(showsDir: string, publicDir: string): RadioManifestProgram[] {
  if (!fs.existsSync(showsDir)) return []
  return listDirectories(showsDir)
    .map((folder) => ({
      folder,
      title: toReadableTitle(folder),
      episodes: listEpisodes(path.join(showsDir, folder), publicDir),
    }))
    .filter((program) => program.episodes.length > 0)
}

/**
 * 🎙️ Les ÉPISODES d'une émission, et leurs PARTIES.
 *
 * Il manquait un niveau : le code prenait chaque fichier d'une émission pour un
 * épisode à part, un par jour. Trois fichiers `ZoneLibrePartie (1..3)` étaient
 * donc diffusés à trois jours d'intervalle, alors que ce sont visiblement les
 * trois morceaux d'une même émission. D'où les émissions « entrecoupées de
 * musique ».
 *
 * La règle, choisie pour marcher avec ce qui est DÉJÀ rangé sur le disque :
 *
 *  - le dossier contient des **fichiers**    → un seul épisode, ces fichiers en
 *    sont les parties, dans l'ordre naturel ;
 *  - le dossier contient des **sous-dossiers** → un sous-dossier = un épisode,
 *    et ses fichiers en sont les parties.
 *
 * Les deux peuvent cohabiter : les fichiers à la racine forment alors l'épisode
 * n°1, et chaque sous-dossier ajoute un épisode.
 */
function listEpisodes(programDir: string, publicDir: string): RadioManifestEpisode[] {
  const episodes: RadioManifestEpisode[] = []

  const loose = listAudioFiles(programDir, publicDir)
  if (loose.length > 0) {
    episodes.push({ folder: '', title: toReadableTitle(path.basename(programDir)), parts: loose })
  }

  for (const folder of listDirectories(programDir)) {
    const parts = listAudioFiles(path.join(programDir, folder), publicDir)
    if (parts.length > 0) episodes.push({ folder, title: toReadableTitle(folder), parts })
  }

  return episodes
}

function listDirectories(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'fr'))
}

function listAudioFiles(dir: string, publicDir: string): RadioManifestFile[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    // Tri naturel : `T2` passe avant `T10`, sinon l'ordre de la playlist paraît aléatoire.
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' }))
    .map((fileName) => ({
      fileName,
      src: toPublicUrl(path.join(dir, fileName), publicDir),
      title: toReadableTitle(fileName.replace(/\.[^.]+$/, '')),
      durationSeconds: readAudioDuration(path.join(dir, fileName)),
    }))
}

/**
 * Durée d'un fichier audio, en secondes. `0` si on ne sait pas la lire ici.
 *
 * Seul le `.wav` est décodé : son en-tête donne tout ce qu'il faut, donc ça ne
 * coûte ni dépendance ni décodage. Les formats compressés (`.mp3`, `.ogg`…)
 * renvoient 0 et restent sondés par le navigateur, comme avant — voir
 * `probeTrack` dans `RadioAudioSystem.tsx`.
 */
function readAudioDuration(filePath: string): number {
  if (path.extname(filePath).toLowerCase() !== '.wav') return 0

  try {
    // L'en-tête tient très largement dans les premiers kilo-octets : inutile de
    // charger un fichier de 50 Mo pour lire deux nombres.
    const handle = fs.openSync(filePath, 'r')
    const header = Buffer.alloc(8192)
    const read = fs.readSync(handle, header, 0, header.length, 0)
    fs.closeSync(handle)
    if (read < 44 || header.toString('ascii', 0, 4) !== 'RIFF') return 0

    // Un WAV est une suite de blocs : 4 lettres de nom, 4 octets de taille,
    // puis le contenu. On cherche `fmt ` (qui donne le débit) et `data`
    // (qui donne le volume d'audio). durée = octets de son / octets par seconde.
    let byteRate = 0
    let offset = 12
    while (offset + 8 <= read) {
      const chunkId = header.toString('ascii', offset, offset + 4)
      const chunkSize = header.readUInt32LE(offset + 4)
      if (chunkId === 'fmt ' && offset + 16 <= read) byteRate = header.readUInt32LE(offset + 12)
      if (chunkId === 'data') return byteRate > 0 ? chunkSize / byteRate : 0
      // Les blocs sont alignés sur un nombre pair d'octets.
      offset += 8 + chunkSize + (chunkSize % 2)
    }
    return 0
  } catch {
    return 0
  }
}

function toPublicUrl(absolutePath: string, publicDir: string): string {
  const relative = path.relative(publicDir, absolutePath).split(path.sep).join('/')
  // Chaque segment est encodé séparément pour ne pas transformer les `/` en `%2F`.
  return '/' + relative.split('/').map(encodeURIComponent).join('/')
}

/** `Podcast_Du_Soir` → `Podcast Du Soir`, `R01-T01 Hartetek` → `Hartetek`. */
function toReadableTitle(rawName: string): string {
  const withoutId = rawName.replace(/^R\d{2}[-_ ]?[A-Z]?\d{2}[-_ ]*/i, '')
  const cleaned = (withoutId || rawName).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').replace(/^[-\s]+|[-\s]+$/g, '')
  return cleaned || rawName
}

export default function radioManifestPlugin(): Plugin {
  let publicDir = ''
  let radioRoot = ''

  const buildModule = () => {
    const stations = scanRadioFolder(radioRoot, publicDir)
    return `export const RADIO_MANIFEST = ${JSON.stringify(stations, null, 2)}\nexport default RADIO_MANIFEST\n`
  }

  return {
    name: 'pls-radio-manifest',
    configResolved(config) {
      publicDir = config.publicDir
      radioRoot = path.join(publicDir, 'musique', 'radio')
    },
    resolveId(id) {
      return id === RADIO_MANIFEST_MODULE_ID ? RESOLVED_ID : null
    },
    load(id) {
      return id === RESOLVED_ID ? buildModule() : null
    },
    configureServer(server) {
      server.watcher.add(radioRoot)

      // Chokidar et Vite ne s'accordent pas sur le separateur selon l'OS : on normalise avant de comparer.
      const normalize = (value: string) => value.split(path.sep).join('/').toLowerCase()
      const watchedRoot = normalize(radioRoot)

      const invalidate = (changedPath: string) => {
        if (!normalize(changedPath).startsWith(watchedRoot)) return
        const module = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (module) server.moduleGraph.invalidateModule(module)
        // Le catalogue est lu à l'import : un rechargement complet est plus sûr qu'un HMR partiel.
        server.ws.send({ type: 'full-reload' })
      }

      server.watcher.on('add', invalidate)
      server.watcher.on('unlink', invalidate)
      server.watcher.on('addDir', invalidate)
      server.watcher.on('unlinkDir', invalidate)
    },
  }
}
