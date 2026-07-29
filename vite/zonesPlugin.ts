import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export const ZONES_ENDPOINT = '/__pls/zones'
const ZONES_FILE = path.join('src', 'data', 'zones.json')
const MAX_BODY_BYTES = 500_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeZones(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.zones)) throw new Error('objet { zones: [...] } attendu')
  const ids = new Set<string>()
  const zones = value.zones.map((zone, index) => {
    if (!isRecord(zone)) throw new Error(`zone[${index}] doit etre un objet`)
    if (typeof zone.id !== 'string' || !zone.id.trim()) throw new Error(`zone[${index}] sans id`)
    if (ids.has(zone.id)) throw new Error(`id duplique: ${zone.id}`)
    ids.add(zone.id)
    if (typeof zone.name !== 'string' || !zone.name.trim()) throw new Error(`${zone.id}: name obligatoire`)
    if (typeof zone.color !== 'string' || !zone.color.trim()) throw new Error(`${zone.id}: color obligatoire`)
    if (!Array.isArray(zone.pts) || zone.pts.length < 3) throw new Error(`${zone.id}: au moins 3 points`)
    for (const point of zone.pts) {
      if (!Array.isArray(point) || point.length !== 2 || !point.every((coord) => typeof coord === 'number' && Number.isFinite(coord))) {
        throw new Error(`${zone.id}: point invalide`)
      }
    }
    return zone
  })
  return { _comment: typeof value._comment === 'string' ? value._comment : undefined, zones }
}

export default function zonesPlugin(): Plugin {
  let root = ''

  return {
    name: 'pls-zones',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(ZONES_ENDPOINT, (req, res) => {
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
            const zones = normalizeZones(JSON.parse(body))
            const target = path.join(root, ZONES_FILE)
            fs.writeFileSync(target, JSON.stringify(zones, null, 2) + '\n', 'utf8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, zones: zones.zones.length }))
          } catch (error) {
            res.statusCode = 400
            res.end(`Quartiers invalides : ${(error as Error).message}`)
          }
        })
      })
    },
  }
}
