import path from 'node:path'
import type { Plugin } from 'vite'
import { DestructiveWriteError, hasForceHeader, writeDataFile } from './plsDataFile'

export const INTERIORS_ENDPOINT = '/__pls/interiors'
const INTERIORS_DIR = path.join('src', 'data', 'interiors')
const MAX_BODY_BYTES = 2_000_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeInteriorFileName(id: string) {
  const safe = id.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
  if (!safe) throw new Error('id interieur vide')
  return `${safe}.json`
}

/**
 * Compte ce qu'un interieur contient vraiment (pieces, portes, fenetres, props, spawns,
 * sorties, escaliers), tous etages confondus. Un interieur avec des etages mais aucun
 * contenu compte pour 0 : c'est la coquille vide qu'on veut eviter d'ecrire par accident.
 */
function countInteriorItems(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.floors)) return 0
  const lists = ['rooms', 'doors', 'windows', 'props', 'spawnPoints', 'exits', 'stairs'] as const
  return value.floors.reduce((total: number, floor: unknown) => {
    if (!isRecord(floor)) return total
    return total + lists.reduce((sum, key) => sum + (Array.isArray(floor[key]) ? floor[key].length : 0), 0)
  }, 0)
}

function normalizeInterior(value: unknown) {
  if (!isRecord(value)) throw new Error('interieur attendu')
  const id = value.id
  if (typeof id !== 'string' || id.trim() === '') throw new Error('id interieur obligatoire')
  if (typeof value.name !== 'string' || value.name.trim() === '') throw new Error('nom interieur obligatoire')
  if (!Array.isArray(value.floors) || value.floors.length === 0) throw new Error('au moins un etage attendu')
  return { id: id.trim(), interior: value }
}

export default function interiorsPlugin(): Plugin {
  let root = ''

  return {
    name: 'pls-interiors',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(INTERIORS_ENDPOINT, (req, res) => {
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
            res.end('Interieur trop volumineux')
            return
          }

          try {
            const { id, interior } = normalizeInterior(JSON.parse(body))
            writeDataFile({
              root,
              relativePath: path.join(INTERIORS_DIR, safeInteriorFileName(id)),
              content: interior,
              itemCount: countInteriorItems(interior),
              countExisting: countInteriorItems,
              force: hasForceHeader(req.headers),
              label: `l'interieur ${id}`,
            })

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, id }))
          } catch (error) {
            res.statusCode = error instanceof DestructiveWriteError ? 409 : 400
            res.end(
              error instanceof DestructiveWriteError
                ? error.message
                : `Interieur invalide : ${(error as Error).message}`,
            )
          }
        })
      })
    },
  }
}
