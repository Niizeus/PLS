// @ts-nocheck
/**
 * 🏔️  build-terrain-ign.mjs — TERRAIN depuis le LiDAR HD de l'IGN (le vrai relief).
 *
 * Remplace la grille Open-Meteo (~90 m lissé) par le MNT LiDAR HD (sol nu, 0,5 m natif,
 * ici échantillonné à 2 m). Voir le plan complet dans docs/06-CAP-GRAPHIQUE-IGN.md.
 *
 * Repère : **Lambert-93 local** — la cathédrale (E0,N0) est l'origine (0,0),
 *   x = E − E0   (est +)
 *   z = −(N − N0) (sud +, comme le reste du jeu : le nord s'éloigne en z négatif)
 * → aucune reprojection tordue : le MNT (déjà en Lambert-93) se pose par simple translation.
 *
 * Sortie : public/terrain/<tx>_<tz>.png  (heightmap, hauteur encodée en RGB) + index.json.
 *   Une dalle = 1 km, 501×501 nœuds à 2 m (bords partagés → pas de couture).
 *
 * ▶️  Valider la chaîne sur 3×3 dalles (centre-ville) :  VALIDATE=1 node src/world/beauvais/build-terrain-ign.mjs
 * ▶️  Toute la commune (~182 dalles, ~180 Mo, long) :    node src/world/beauvais/build-terrain-ign.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fromArrayBuffer } from 'geotiff'
import { PNG } from 'pngjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', '..', '..', 'public', 'terrain')

// ── Origine Lambert-93 = cathédrale Saint-Pierre (cf. docs/06) ────────────────
const E0 = 633317, N0 = 6926294
const DATUM = 72 // altitude (m) du sol à la cathédrale → centre-ville ≈ 0 (comme avant)

const RES = 2 // mètres entre deux nœuds
const TILE = 1000 // côté d'une dalle (m)
const NODES = TILE / RES + 1 // 501 nœuds (bords inclus → partagés entre dalles voisines)
const HSCALE = 0.01 // pas d'encodage hauteur (1 cm)

const WMS = 'https://data.geopf.fr/wms-r'
const LAYER = 'IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93'

// Emprise commune (Lambert-93), dérivée des bornes du jeu + marge d'1 dalle.
const FULL = { Emin: 626000, Emax: 640000, Nmin: 6921000, Nmax: 6934000 }
// Validation : 3×3 dalles autour du centre-ville.
const VALID = { Emin: 632000, Emax: 635000, Nmin: 6925000, Nmax: 6928000 }
const AREA = process.env.VALIDATE ? VALID : FULL

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Télécharge une dalle MNT (501×501 nœuds à 2 m) et renvoie un Float32Array, ou null. */
async function fetchTile(E, N, tries = 4) {
  // BBOX élargie d'1 m de chaque côté → nœuds aux mètres pairs, bords partagés (0 couture).
  const bbox = `${E - 1},${N - 1},${E + TILE + 1},${N + TILE + 1}`
  const url = `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${LAYER}&FORMAT=image/geotiff&STYLES=&CRS=EPSG:2154&BBOX=${bbox}&WIDTH=${NODES}&HEIGHT=${NODES}`
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const buf = await res.arrayBuffer()
        const tif = await fromArrayBuffer(buf)
        const img = await tif.getImage()
        return (await img.readRasters())[0]
      }
      if (res.status === 429) { await sleep(20000); continue }
      if (res.status >= 500) { await sleep(4000); continue }
      return null // 400 = souvent hors couverture
    } catch (e) {
      await sleep(3000)
    }
  }
  return null
}

/** Remplace les nodata (<-1000) par la moyenne des valides (dalle bord de commune). */
function fillNodata(data) {
  let sum = 0, k = 0, nod = 0
  for (const v of data) { if (isFinite(v) && v > -1000) { sum += v; k++ } }
  const mean = k ? sum / k : DATUM
  for (let i = 0; i < data.length; i++) if (!(isFinite(data[i]) && data[i] > -1000)) { data[i] = mean; nod++ }
  return { nod, allNodata: k === 0 }
}

async function main() {
  // On NE supprime PAS le dossier (les serveurs Vite le surveillent → EPERM sous
  // Windows) : on le crée si besoin et on efface les anciens PNG un par un.
  mkdirSync(OUT_DIR, { recursive: true })
  if (existsSync(OUT_DIR)) {
    for (const f of readdirSync(OUT_DIR)) {
      if (f.endsWith('.png')) { try { unlinkSync(join(OUT_DIR, f)) } catch { /* watcher : on ignore */ } }
    }
  }

  const tilesE = []
  for (let E = AREA.Emin; E < AREA.Emax; E += TILE) tilesE.push(E)
  const tilesN = []
  for (let N = AREA.Nmin; N < AREA.Nmax; N += TILE) tilesN.push(N)
  const total = tilesE.length * tilesN.length
  console.log(`🏔️  Terrain LiDAR HD : ${total} dalles (${process.env.VALIDATE ? 'VALIDATION 3×3' : 'commune'}), 2 m, Lambert-93 local`)

  const index = { origin: { E0, N0 }, datum: DATUM, res: RES, tile: TILE, nodes: NODES, hscale: HSCALE, tiles: [] }
  let done = 0, kept = 0
  for (const E of tilesE) {
    for (const N of tilesN) {
      done++
      const data = await fetchTile(E, N)
      if (!data) { console.log(`   [${done}/${total}] E${E} N${N} — indisponible (hors couverture ?)`); continue }
      const { nod, allNodata } = fillNodata(data)
      if (allNodata) { console.log(`   [${done}/${total}] E${E} N${N} — 100% nodata, ignorée`); continue }

      // Indices de dalle (km) et coordonnées locales du coin (x = E−E0, z = −(N+TILE−N0)).
      const tx = Math.round(E / TILE)
      const tz = Math.round(N / TILE)
      // Encode l'altitude absolue → RGB (précision 1 cm). pngjs stocke .data en
      // RGBA (4 octets/pixel), d'où le pas de 4 + alpha opaque.
      const png = new PNG({ width: NODES, height: NODES })
      let hmin = Infinity, hmax = -Infinity
      for (let i = 0; i < data.length; i++) {
        const h = data[i] - DATUM
        if (h < hmin) hmin = h
        if (h > hmax) hmax = h
        const code = Math.max(0, Math.round(data[i] / HSCALE)) // altitude absolue en cm (≥0)
        const idx = i * 4
        png.data[idx] = (code >> 16) & 255
        png.data[idx + 1] = (code >> 8) & 255
        png.data[idx + 2] = code & 255
        png.data[idx + 3] = 255
      }
      const file = `${tx}_${tz}.png`
      writeFileSync(join(OUT_DIR, file), PNG.sync.write(png))
      index.tiles.push({ tx, tz, file, hmin: +hmin.toFixed(1), hmax: +hmax.toFixed(1), nod })
      kept++
      console.log(`   [${done}/${total}] E${E} N${N} → ${file}  h[${hmin.toFixed(1)}..${hmax.toFixed(1)}] nodata ${nod}`)
      await sleep(300)
    }
  }
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index))
  console.log(`✅ ${kept}/${total} dalles écrites dans ${OUT_DIR}`)
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
