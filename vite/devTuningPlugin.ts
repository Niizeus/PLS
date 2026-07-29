import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export const DEV_TUNING_ENDPOINT = '/__pls/dev-tuning'
const DEV_TUNING_FILE = path.join('public', 'dev', 'dev-tuning.json')
const MAX_BODY_BYTES = 250_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default function devTuningPlugin(): Plugin {
  let root = ''

  return {
    name: 'pls-dev-tuning',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(DEV_TUNING_ENDPOINT, (req, res) => {
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
            res.end('JSON trop volumineux')
            return
          }

          try {
            const parsed = JSON.parse(body)
            if (!isRecord(parsed)) throw new Error('objet JSON attendu')

            const target = path.join(root, DEV_TUNING_FILE)
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, JSON.stringify(parsed, null, 2) + '\n', 'utf8')

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: DEV_TUNING_FILE }))
          } catch (error) {
            res.statusCode = 400
            res.end(`Reglages invalides : ${(error as Error).message}`)
          }
        })
      })
    },
  }
}
