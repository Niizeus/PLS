import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

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
            const target = path.join(root, INTERIORS_DIR, safeInteriorFileName(id))
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, JSON.stringify(interior, null, 2) + '\n', 'utf8')

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, id }))
          } catch (error) {
            res.statusCode = 400
            res.end(`Interieur invalide : ${(error as Error).message}`)
          }
        })
      })
    },
  }
}
