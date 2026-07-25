/**
 * 🏔️  Terrain LiDAR HD — chargement + échantillonnage de hauteur (repère Lambert-93 local).
 *
 * On charge UNE carte de relief globale de la commune (public/terrain/global.png, ~8 m),
 * produite hors-jeu par build-terrain-global.mjs. Léger (un fichier), robuste (pas de
 * chargement de 182 dalles d'un coup), et surtout couvre TOUTE la ville → `lidarHeight`
 * répond partout, ce qui permet aux routes/bâtiments/joueur de se poser au bon niveau.
 *
 * Repère : x = E − E0, z = −(N − N0), origine = cathédrale (cf. docs/06-CAP-GRAPHIQUE-IGN.md).
 * (Les dalles 2 m détaillées existent aussi mais serviront à une phase « détail » ultérieure.)
 */

interface GlobalMap {
  res: number
  w: number
  h: number
  Emin: number
  Nmax: number
  E0: number
  N0: number
  heights: Float32Array // relatives au datum, taille w×h, ligne 0 = nord (Nmax)
}

let global: GlobalMap | null = null
let ready = false
let loading: Promise<void> | null = null
const readyCbs: (() => void)[] = []

export const isLidarReady = () => ready
export const onLidarReady = (cb: () => void) => {
  if (ready) cb()
  else readyCbs.push(cb)
}
export const getGlobalMap = () => global

/** Charge la carte de relief globale (idempotent). */
export function loadLidarTerrain(): Promise<void> {
  if (loading) return loading
  loading = (async () => {
    try {
      const index = await (await fetch('terrain/index.json')).json()
      if (!index.global) throw new Error('index.json sans bloc "global" (lance build-terrain-global.mjs)')
      const g = index.global
      const res = await fetch(`terrain/${g.file}`)
      const bmp = await createImageBitmap(await res.blob())
      const cv = new OffscreenCanvas(g.w, g.h)
      const ctx = cv.getContext('2d')!
      ctx.drawImage(bmp, 0, 0)
      const rgba = ctx.getImageData(0, 0, g.w, g.h).data
      const heights = new Float32Array(g.w * g.h)
      const datum = index.datum, hscale = index.hscale
      for (let i = 0; i < heights.length; i++) {
        const code = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]
        heights[i] = code * hscale - datum
      }
      global = { res: g.res, w: g.w, h: g.h, Emin: g.Emin, Nmax: g.Nmax, E0: index.origin.E0, N0: index.origin.N0, heights }
      ready = true
      readyCbs.splice(0).forEach((cb) => cb())
      console.info(`[LiDAR] carte globale ${g.w}×${g.h} chargée (${g.res} m)`)
    } catch (e) {
      console.warn('[LiDAR] terrain global indisponible → repli ancienne grille.', e)
    }
  })()
  return loading
}

/**
 * Hauteur du sol (relative au datum) au point monde (x, z), ou `undefined` si non couvert
 * (le jeu retombe alors sur l'ancienne grille). Interpolation bilinéaire.
 */
export function lidarHeight(x: number, z: number): number | undefined {
  const g = global
  if (!ready || !g) return undefined
  const Ecoord = x + g.E0
  const Ncoord = g.N0 - z
  const fi = (Ecoord - g.Emin) / g.res
  const fj = (g.Nmax - Ncoord) / g.res
  if (fi < 0 || fj < 0 || fi > g.w - 1 || fj > g.h - 1) return undefined
  const i0 = Math.floor(fi), j0 = Math.floor(fj)
  const i1 = Math.min(g.w - 1, i0 + 1), j1 = Math.min(g.h - 1, j0 + 1)
  const tX = fi - i0, tZ = fj - j0
  const hh = g.heights
  const top = hh[j0 * g.w + i0] * (1 - tX) + hh[j0 * g.w + i1] * tX
  const bot = hh[j1 * g.w + i0] * (1 - tX) + hh[j1 * g.w + i1] * tX
  return top * (1 - tZ) + bot * tZ
}
