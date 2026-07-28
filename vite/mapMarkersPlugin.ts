import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export const MAP_MARKERS_ENDPOINT = '/__pls/map-markers'
const MAP_MARKERS_FILE = path.join('src', 'data', 'mapMarkers.json')
const MAX_BODY_BYTES = 500_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeMarkers(value: unknown) {
  if (!Array.isArray(value)) throw new Error('liste de points attendue')
  const ids = new Set<string>()

  return value
    .map((marker, index) => {
      if (!isRecord(marker)) throw new Error(`marker[${index}] doit etre un objet`)
      const id = marker.id
      if (typeof id !== 'string' || id.trim() === '') throw new Error(`marker[${index}] sans id`)
      if (ids.has(id)) throw new Error(`id duplique: ${id}`)
      ids.add(id)
      return marker
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

export default function mapMarkersPlugin(): Plugin {
  let root = ''

  return {
    name: 'pls-map-markers',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(MAP_MARKERS_ENDPOINT, (req, res) => {
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
            const markers = normalizeMarkers(JSON.parse(body))
            const target = path.join(root, MAP_MARKERS_FILE)
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, JSON.stringify(markers, null, 2) + '\n', 'utf8')

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, markers: markers.length }))
          } catch (error) {
            res.statusCode = 400
            res.end(`Points invalides : ${(error as Error).message}`)
          }
        })
      })
    },
  }
}
