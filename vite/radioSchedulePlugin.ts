import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * 🗓️ Plugin Vite : permet à la page Régie d'ENREGISTRER la grille sur le disque.
 *
 * Une page web ne peut pas écrire dans le projet toute seule. Comme c'est déjà
 * Vite (côté Node) qui lit le dossier des radios, c'est lui qui écrit le
 * planning : la Régie envoie la grille ici, et le fichier
 * `src/data/radioSchedule.json` est réécrit.
 *
 * ⚠️ **Uniquement en développement.** Ce point d'entrée n'existe que dans
 * `npm run dev` : il n'est pas embarqué dans le jeu compilé, et il n'y a donc
 * rien à écrire sur le disque du joueur.
 */

export const SCHEDULE_ENDPOINT = '/__pls/radio-schedule'
const SCHEDULE_FILE = path.join('src', 'data', 'radioSchedule.json')

/** Garde-fou : au-delà, c'est que quelque chose ne va pas — on refuse d'écrire. */
const MAX_BODY_BYTES = 2_000_000

export default function radioSchedulePlugin(): Plugin {
  let root = ''

  return {
    name: 'pls-radio-schedule',
    apply: 'serve',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use(SCHEDULE_ENDPOINT, (req, res) => {
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
            res.end('Grille trop volumineuse')
            return
          }

          try {
            const parsed = JSON.parse(body)
            if (!parsed || !Array.isArray(parsed.slots)) throw new Error('format inattendu')

            const target = path.join(root, SCHEDULE_FILE)
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, JSON.stringify(parsed, null, 2) + '\n', 'utf8')

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, slots: parsed.slots.length }))
          } catch (error) {
            res.statusCode = 400
            res.end(`Grille invalide : ${(error as Error).message}`)
          }
        })
      })
    },
  }
}
