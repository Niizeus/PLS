import path from 'node:path'
import type { Plugin } from 'vite'
import { DestructiveWriteError, hasForceHeader, writeDataFile } from './plsDataFile'

/**
 * ✋ Enregistre les corrections d'archétype faites a la main dans ChunkForge.
 *
 * Ce fichier est la MEMOIRE HUMAINE du classement : `classify.mjs` le relit a chaque
 * passage et laisse toujours gagner la valeur ecrite ici. Il n'est jamais reecrit par
 * un script — on peut donc relancer la collecte et le classement autant de fois qu'on
 * veut sans perdre une seule correction. C'est exactement le role de
 * `road-overrides.json` pour les routes.
 *
 * Voir `docs/08-CHUNKFORGE.md`.
 */

export const CHUNK_OVERRIDES_ENDPOINT = '/__pls/chunk-overrides'
const OVERRIDES_FILE = path.join('src', 'world', 'beauvais', 'data', 'chunk-overrides.json')
const MAX_BODY_BYTES = 2_000_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Verifie la forme AVANT d'ecrire. Un fichier d'overrides casse serait pire qu'absent :
 * `classify.mjs` planterait a chaque lancement, et on ne saurait pas pourquoi.
 */
function normalizeOverrides(value: unknown) {
  if (!isRecord(value)) throw new Error('objet { "<id>": { archetype } } attendu')

  const out: Record<string, { archetype: string; note?: string; at?: string }> = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!id.trim()) throw new Error('identifiant vide')
    if (!isRecord(entry)) throw new Error(`${id} : objet attendu`)
    if (typeof entry.archetype !== 'string' || !entry.archetype.trim()) {
      throw new Error(`${id} : archetype obligatoire`)
    }
    out[id] = {
      archetype: entry.archetype,
      ...(typeof entry.note === 'string' && entry.note.trim() ? { note: entry.note } : {}),
      ...(typeof entry.at === 'string' ? { at: entry.at } : {}),
    }
  }
  return out
}

export default function chunkOverridesPlugin(): Plugin {
  let root = ''

  return {
    name: 'pls-chunk-overrides',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(CHUNK_OVERRIDES_ENDPOINT, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST attendu')
          return
        }

        let body = ''
        let tooBig = false
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8')
          if (body.length > MAX_BODY_BYTES) {
            tooBig = true
            req.destroy()
          }
        })

        req.on('end', () => {
          if (tooBig) {
            res.statusCode = 413
            res.end('Fichier trop volumineux')
            return
          }

          try {
            const overrides = normalizeOverrides(JSON.parse(body))
            writeDataFile({
              root,
              relativePath: OVERRIDES_FILE,
              content: overrides,
              itemCount: Object.keys(overrides).length,
              countExisting: (parsed) => (isRecord(parsed) ? Object.keys(parsed).length : 0),
              force: hasForceHeader(req.headers),
              label: 'les corrections d\'archetype',
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, count: Object.keys(overrides).length }))
          } catch (error) {
            res.statusCode = error instanceof DestructiveWriteError ? 409 : 400
            res.end(
              error instanceof DestructiveWriteError
                ? error.message
                : `Corrections invalides : ${(error as Error).message}`,
            )
          }
        })
      })
    },
  }
}
