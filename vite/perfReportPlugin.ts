import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export const PERF_REPORT_ENDPOINT = '/__pls/perf-report'
const PERF_REPORT_DIR = path.join('public', 'dev', 'perf-reports')
const MAX_BODY_BYTES = 8_000_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeName(value: unknown): string {
  const raw = typeof value === 'string' && value.trim() ? value : `pls-perf-${Date.now()}`
  return raw.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120)
}

export default function perfReportPlugin(): Plugin {
  let root = ''

  return {
    name: 'pls-perf-report',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(PERF_REPORT_ENDPOINT, (req, res) => {
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
            res.end('Rapport trop volumineux')
            return
          }

          try {
            const parsed = JSON.parse(body) as unknown
            if (!isRecord(parsed)) throw new Error('objet JSON attendu')
            if (parsed.schemaVersion !== 1) throw new Error('schemaVersion 1 attendu')

            const file = path.join(PERF_REPORT_DIR, `${safeName(parsed.id)}.json`)
            const target = path.join(root, file)
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, JSON.stringify(parsed, null, 2) + '\n', 'utf8')

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file }))
          } catch (error) {
            res.statusCode = 400
            res.end(`Rapport invalide : ${(error as Error).message}`)
          }
        })
      })
    },
  }
}
