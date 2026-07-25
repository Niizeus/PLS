// @ts-nocheck
/**
 * 🗻 refine-terrain.mjs — RE-GÉNÈRE UNIQUEMENT le relief, plus fin.
 *
 * Le relief d'origine (build-beauvais.mjs) était une grille 32×32 sur ~8 km,
 * soit ~268 m entre deux points : beaucoup trop grossier (la côte Saint-Jean, la
 * vallée du Thérain, les berges du lac étaient lissées). Ce script :
 *   1. relit le fichier compact existant (bounds, origine),
 *   2. ré-échantillonne l'altitude Open-Meteo sur une grille PLUS FINE couvrant
 *      TOUTE la ville (bâtiments + lac du Canada au nord, avant hors-grille),
 *   3. remplace CHIRURGICALEMENT le seul champ "terrain" du JSON (le reste — les
 *      34 000 bâtiments, routes… — ne bouge pas d'un octet → diff Git minimal).
 *
 * ▶️  Lancer (nécessite internet, ~2-4 min) :
 *       node src/world/beauvais/refine-terrain.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = join(__dirname, 'data', 'beauvais-buildings.json')

// Résolution cible : ~110 m entre points (vs 268 m avant) → 2,4× plus fin.
const TERRAIN_COLS = 110
const PAD = 150 // marge autour des bâtiments (m)
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'

const EARTH_RADIUS = 6378137
const deg2rad = (d) => (d * Math.PI) / 180
const rad2deg = (r) => (r * 180) / Math.PI
const round1 = (v) => Math.round(v * 10) / 10
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Lecture du fichier existant (texte brut, pour patch chirurgical) ──────────
const text = readFileSync(FILE, 'utf8')
const data = JSON.parse(text)
const ORIGIN = data.origin
const B = data.bounds

/** (x, z) mètres → (lat, lon), autour de l'origine (cathédrale). */
function unproject(x, z) {
  const lat = ORIGIN.lat - rad2deg(z / EARTH_RADIUS)
  const lon = ORIGIN.lon + rad2deg(x / (EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))))
  return { lat, lon }
}

async function fetchElevations(lats, lons, tries = 5) {
  const url = `${ELEVATION_URL}?latitude=${lats.join(',')}&longitude=${lons.join(',')}`
  for (let t = 0; t < tries; t++) {
    const res = await fetch(url)
    if (res.ok) return (await res.json()).elevation
    if (res.status === 429) {
      console.log('   (rate-limit 429 → pause 65 s)')
      await sleep(65000)
      continue
    }
    throw new Error(`Open-Meteo a répondu ${res.status}`)
  }
  throw new Error('Open-Meteo : trop de 429 (rate limit)')
}

async function main() {
  // Grille carrée (COLS×COLS) couvrant toute l'étendue des bâtiments + marge.
  const x0 = B.minX - PAD
  const z0 = B.minZ - PAD
  const dx = (B.maxX - B.minX + 2 * PAD) / (TERRAIN_COLS - 1)
  const dz = (B.maxZ - B.minZ + 2 * PAD) / (TERRAIN_COLS - 1)

  const lats = []
  const lons = []
  for (let j = 0; j < TERRAIN_COLS; j++) {
    for (let i = 0; i < TERRAIN_COLS; i++) {
      const { lat, lon } = unproject(x0 + i * dx, z0 + j * dz)
      lats.push(+lat.toFixed(6))
      lons.push(+lon.toFixed(6))
    }
  }

  const total = lats.length
  console.log(`🗻 Relief fin : ${TERRAIN_COLS}×${TERRAIN_COLS} = ${total} points (~${Math.round(dx)} m/point)`)
  const elev = []
  for (let k = 0; k < total; k += 100) {
    const part = await fetchElevations(lats.slice(k, k + 100), lons.slice(k, k + 100))
    elev.push(...part)
    process.stdout.write(`\r   ${elev.length}/${total} points…`)
    await sleep(1500) // on reste poli avec l'API gratuite
  }
  console.log('')

  // Datum = altitude à la cathédrale → le centre-ville reste ~0 (comme avant).
  const [baseElev] = await fetchElevations([ORIGIN.lat], [ORIGIN.lon])
  const h = elev.map((v) => round1(v - baseElev))
  const min = Math.min(...h)
  const max = Math.max(...h)
  console.log(`   relief : ${min} m à ${max} m (datum cathédrale = 0)`)

  const terrain = { cols: TERRAIN_COLS, x0: round1(x0), z0: round1(z0), dx: round1(dx), dz: round1(dz), h }

  // Patch chirurgical : on ne remplace QUE le champ "terrain" (pas de brace
  // imbriquée dedans → regex sûre), tout le reste du fichier est préservé.
  const re = /"terrain":\{[^{}]*\}/
  if (!re.test(text)) throw new Error('Champ "terrain" introuvable dans le JSON.')
  const patched = text.replace(re, `"terrain":${JSON.stringify(terrain)}`)
  writeFileSync(FILE, patched)
  console.log(`✅ terrain mis à jour dans ${FILE} (le reste inchangé).`)
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
