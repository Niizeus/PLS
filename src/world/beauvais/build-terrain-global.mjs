// @ts-nocheck
/**
 * 🗺️  build-terrain-global.mjs — carte de relief GLOBALE de la commune (un seul fichier).
 *
 * Complément de build-terrain-ign.mjs. Le jeu a besoin d'une hauteur de sol
 * SYNCHRONE partout (routes, bâtiments, joueur se posent dessus dès le montage).
 * Charger 182 dalles 2 m d'un coup est fragile (un décodage qui rate = plus de sol)
 * et lourd. On produit donc UNE heightmap globale à 8 m (toute la commune, ~1 requête),
 * légère à charger et à échantillonner. Les dalles 2 m serviront au détail (phase 2).
 *
 * Sortie : public/terrain/global.png (+ champ `global` ajouté à index.json).
 * ▶️  node src/world/beauvais/build-terrain-global.mjs
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fromArrayBuffer } from 'geotiff'
import { PNG } from 'pngjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', '..', '..', 'public', 'terrain')

const E0 = 633317, N0 = 6926294, DATUM = 72, HSCALE = 0.01
const RES = 8 // mètres/nœud pour la carte globale
const AREA = { Emin: 626000, Emax: 640000, Nmin: 6921000, Nmax: 6934000 }
const WMS = 'https://data.geopf.fr/wms-r'
const LAYER = 'IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93'

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const W = (AREA.Emax - AREA.Emin) / RES + 1
  const H = (AREA.Nmax - AREA.Nmin) / RES + 1
  // BBOX élargie d'un demi-pas → nœuds aux coordonnées multiples de RES.
  const half = RES / 2
  const bbox = `${AREA.Emin - half},${AREA.Nmin - half},${AREA.Emax + half},${AREA.Nmax + half}`
  const url = `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${LAYER}&FORMAT=image/geotiff&STYLES=&CRS=EPSG:2154&BBOX=${bbox}&WIDTH=${W}&HEIGHT=${H}`
  console.log(`🗺️  Carte globale ${W}×${H} (${RES} m), toute la commune…`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`WMS ${res.status}`)
  const tif = await fromArrayBuffer(await res.arrayBuffer())
  const img = await tif.getImage()
  const data = (await img.readRasters())[0]

  // nodata → moyenne des valides.
  let sum = 0, k = 0
  for (const v of data) if (isFinite(v) && v > -1000) { sum += v; k++ }
  const mean = k ? sum / k : DATUM
  const png = new PNG({ width: W, height: H })
  let hmin = Infinity, hmax = -Infinity
  for (let i = 0; i < data.length; i++) {
    let v = data[i]
    if (!(isFinite(v) && v > -1000)) v = mean
    const h = v - DATUM
    if (h < hmin) hmin = h
    if (h > hmax) hmax = h
    const code = Math.max(0, Math.round(v / HSCALE))
    const idx = i * 4
    png.data[idx] = (code >> 16) & 255
    png.data[idx + 1] = (code >> 8) & 255
    png.data[idx + 2] = code & 255
    png.data[idx + 3] = 255
  }
  writeFileSync(join(OUT_DIR, 'global.png'), PNG.sync.write(png))

  // Patch index.json (créé par build-terrain-ign) avec le bloc `global`.
  const idxPath = join(OUT_DIR, 'index.json')
  const index = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : { origin: { E0, N0 }, datum: DATUM, hscale: HSCALE, tiles: [] }
  index.global = { file: 'global.png', res: RES, w: W, h: H, Emin: AREA.Emin, Nmax: AREA.Nmax, hmin: +hmin.toFixed(1), hmax: +hmax.toFixed(1) }
  writeFileSync(idxPath, JSON.stringify(index))
  console.log(`✅ global.png (${W}×${H}) écrit — relief ${hmin.toFixed(1)}..${hmax.toFixed(1)} m`)
}
main().catch((e) => { console.error('❌', e.message); process.exit(1) })
