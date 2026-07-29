import fs from 'node:fs'
import path from 'node:path'

/**
 * 🛡️  Ecriture protegee des fichiers de donnees edites depuis l'editeur PLS.
 *
 * Contexte : les plugins Vite de l'editeur ecrasaient les JSON de `src/data/` sans aucun
 * filet. Une mauvaise manip a suffi pour que `mapMarkers.json` reparte a `[]` et que
 * l'appartement de Chibrux perde toutes ses pieces, sans trace et sans avertissement.
 *
 * Ce module ajoute deux garde-fous, partages par tous les plugins de l'editeur :
 *
 *  1. **Copie de secours** : avant chaque ecrasement, l'ancien contenu est copie dans
 *     `src/data/.backups/`, horodate. Les 20 dernieres versions de chaque fichier sont
 *     gardees, les plus vieilles sont effacees. Ce dossier est ignore par Git : c'est un
 *     filet local, pas un historique a partager (ca, c'est le boulot des commits).
 *  2. **Refus des ecrasements destructeurs** : si la sauvegarde vide un fichier qui
 *     contenait des donnees, on repond 409 au lieu d'ecrire. L'editeur demande alors une
 *     confirmation explicite a l'humain et rejoue la requete avec l'en-tete `x-pls-force`.
 */

const BACKUP_DIR = path.join('src', 'data', '.backups')
const BACKUPS_KEPT = 20

/** En-tete envoye par l'editeur quand l'humain a confirme un ecrasement destructeur. */
export const FORCE_HEADER = 'x-pls-force'

export class DestructiveWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DestructiveWriteError'
  }
}

function timestamp() {
  // 2026-07-29T18-04-12 : triable a l'oeil et valide comme nom de fichier sous Windows.
  return new Date().toISOString().slice(0, 19).replace(/:/g, '-')
}

/** Copie l'etat actuel du fichier dans `.backups/`, puis elague les plus anciennes copies. */
function backupExisting(root: string, target: string) {
  if (!fs.existsSync(target)) return

  const backupDir = path.join(root, BACKUP_DIR)
  fs.mkdirSync(backupDir, { recursive: true })

  const base = path.basename(target, '.json')
  fs.copyFileSync(target, path.join(backupDir, `${base}.${timestamp()}.json`))

  const previous = fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith(`${base}.`) && name.endsWith('.json'))
    .sort()
  for (const stale of previous.slice(0, Math.max(0, previous.length - BACKUPS_KEPT))) {
    fs.rmSync(path.join(backupDir, stale), { force: true })
  }
}

interface WriteDataFileOptions {
  /** Racine du projet (config.root de Vite). */
  root: string
  /** Chemin du fichier relatif a la racine, ex: path.join('src', 'data', 'zones.json'). */
  relativePath: string
  /** Contenu deja normalise, serialise en JSON indente. */
  content: unknown
  /**
   * Combien d'elements "utiles" contient la nouvelle version (POI, quartiers, objets d'un
   * interieur...). Sert uniquement a detecter un ecrasement destructeur.
   */
  itemCount: number
  /** Compte les elements utiles d'une version deja sur le disque. */
  countExisting: (parsed: unknown) => number
  /** `true` quand l'humain a confirme dans l'editeur (en-tete x-pls-force). */
  force: boolean
  /** Nom lisible pour les messages, ex: "points d'interet". */
  label: string
}

/**
 * Ecrit un fichier de donnees de l'editeur.
 * Leve `DestructiveWriteError` si l'ecriture viderait un fichier non vide sans confirmation.
 */
export function writeDataFile({
  root,
  relativePath,
  content,
  itemCount,
  countExisting,
  force,
  label,
}: WriteDataFileOptions) {
  const target = path.join(root, relativePath)

  if (!force && itemCount === 0 && fs.existsSync(target)) {
    let existingCount = 0
    try {
      existingCount = countExisting(JSON.parse(fs.readFileSync(target, 'utf8')))
    } catch {
      existingCount = 0 // fichier deja illisible : rien de precieux a proteger
    }
    if (existingCount > 0) {
      throw new DestructiveWriteError(
        `Cette sauvegarde viderait ${label} : ${existingCount} element(s) sur le disque, 0 dans l'editeur.`,
      )
    }
  }

  backupExisting(root, target)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(content, null, 2) + '\n', 'utf8')
}

/**
 * Supprime un fichier de donnees de l'editeur, apres l'avoir copie dans `.backups/`.
 *
 * La copie de secours n'est pas un detail : supprimer un interieur efface un travail qui peut
 * representer des heures, et l'editeur n'a pas de corbeille. Renvoie `false` si le fichier
 * n'existait pas — cas normal d'un interieur cree mais jamais sauvegarde.
 */
export function deleteDataFile({ root, relativePath }: { root: string; relativePath: string }) {
  const target = path.join(root, relativePath)
  if (!fs.existsSync(target)) return false
  backupExisting(root, target)
  fs.rmSync(target, { force: true })
  return true
}

/** Le client a-t-il confirme l'ecrasement ? */
export function hasForceHeader(headers: Record<string, string | string[] | undefined>) {
  const value = headers[FORCE_HEADER]
  return (Array.isArray(value) ? value[0] : value) === '1'
}
