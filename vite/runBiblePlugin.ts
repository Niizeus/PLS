import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export const RUN_BIBLE_ENDPOINT = '/__pls/run-bible'
const RUN_BIBLE_FILE = path.join('src', 'data', 'runBible.json')
const MAX_BODY_BYTES = 2_000_000

export default function runBiblePlugin(): Plugin {
  let root = ''

  return {
    name: 'pls-run-bible',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(RUN_BIBLE_ENDPOINT, (req, res) => {
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
            res.end('Run bible trop volumineuse')
            return
          }

          try {
            const parsed = JSON.parse(body)
            if (!isRunBibleFile(parsed)) throw new Error('format inattendu')

            const target = path.join(root, RUN_BIBLE_FILE)
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, JSON.stringify(parsed, null, 2) + '\n', 'utf8')

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (error) {
            res.statusCode = 400
            res.end(`Run bible invalide : ${(error as Error).message}`)
          }
        })
      })
    },
  }
}

function isRunBibleFile(value: unknown): value is {
  version: number
  settings: unknown
  endings: unknown[]
  paths: unknown[]
  events: unknown[]
  entities: unknown[]
} {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.version === 'number' &&
    Array.isArray(candidate.endings) &&
    Array.isArray(candidate.paths) &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.entities)
  )
}
