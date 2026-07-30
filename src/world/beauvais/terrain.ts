/**
 * 🏔️  LE RELIEF DE BEAUVAIS — source unique de la hauteur du sol.
 *
 * Les altitudes viennent du **LiDAR HD de l'IGN** (modèle numérique de terrain
 * officiel), pré-téléchargées hors-jeu dans `public/terrain/global.png` par
 * `build-terrain-global.mjs`. C'est le vrai relief de la commune : la vallée du
 * Thérain, les coteaux de Saint-Just, la butte de la cathédrale.
 *
 * ⚠️ ARCHITECTURE — À LIRE AVANT DE TOUCHER À CE FICHIER.
 *
 * La version précédente du jeu a été cassée par un relief chargé en DEUX temps
 * (une carte grossière, puis des dalles fines qui arrivaient pendant la partie).
 * Tout le décor construit sa géométrie une seule fois au montage : si la hauteur
 * du sol change après coup, les routes et les pelouses « plongent » sous le sol.
 *
 * Les trois règles qui empêchent ça de revenir :
 *
 *  1. **UNE seule carte.** Un fichier, une résolution (8 m). Pas de deuxième
 *     niveau de détail qui viendrait contredire le premier.
 *  2. **Chargée AVANT tout affichage.** `World.tsx` attend `loadTerrain()` avant
 *     de monter quoi que ce soit → `terrainHeight()` est figée pour toute la
 *     partie, et tout le monde lit la même hauteur, quel que soit l'ordre
 *     d'exploration.
 *  3. **Une seule façon d'échantillonner.** `sampleHeight()` ci-dessous renvoie
 *     EXACTEMENT la surface affichée par `Ground.tsx`, parce que les deux
 *     utilisent le même découpage en triangles (voir le commentaire de
 *     `sampleHeight`). C'est vérifié par un test, pas par confiance.
 */

export interface HeightMap {
  /** Pas de la grille, en mètres (8 m). */
  res: number
  /** Nombre de nœuds en largeur / hauteur. */
  w: number
  h: number
  /** Coordonnées monde du nœud (0, 0). Le nœud (i, j) est en x0 + i·res, z0 + j·res. */
  x0: number
  z0: number
  /** Altitudes en mètres (relatives au datum), taille w×h, rangée 0 = nord. */
  heights: Float32Array
}

let map: HeightMap | null = null
let loading: Promise<void> | null = null

export const getHeightMap = (): HeightMap | null => map
export const isTerrainReady = () => map !== null

/**
 * Charge la carte de relief. Idempotent : appelable plusieurs fois sans risque.
 *
 * En cas d'échec (fichier absent, décodage impossible) on n'explose pas : la carte
 * reste `null`, `terrainHeight()` renvoie 0 partout et le jeu tourne à plat.
 * Mieux vaut un monde plat qu'un écran noir.
 */
export function loadTerrain(): Promise<void> {
  if (loading) return loading
  loading = (async () => {
    try {
      const index = await (await fetch('/terrain/index.json')).json()
      const g = index.global
      if (!g) throw new Error('index.json sans bloc "global" (lance build-terrain-global.mjs)')

      const bitmap = await createImageBitmap(await (await fetch(`/terrain/${g.file}`)).blob())
      const canvas = new OffscreenCanvas(g.w, g.h)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('pas de contexte 2d pour décoder la heightmap')
      ctx.drawImage(bitmap, 0, 0)
      const rgba = ctx.getImageData(0, 0, g.w, g.h).data

      // L'altitude est encodée sur 3 octets (R,G,B) : code = altitude / hscale.
      const heights = new Float32Array(g.w * g.h)
      for (let i = 0; i < heights.length; i++) {
        const code = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]
        heights[i] = code * index.hscale - index.datum
      }

      // Grille IGN (Lambert-93) → repère du jeu : x = E − E0, z = N0 − N.
      map = {
        res: g.res,
        w: g.w,
        h: g.h,
        x0: g.Emin - index.origin.E0,
        z0: index.origin.N0 - g.Nmax,
        heights,
      }
      console.info(`[relief] carte ${g.w}×${g.h} chargée (${g.res} m, ${g.hmin}..${g.hmax} m)`)
    } catch (e) {
      console.warn('[relief] indisponible → le monde reste plat.', e)
    }
  })()
  return loading
}

/**
 * Altitude du sol au point monde (x, z), en mètres. 0 si la carte n'est pas là.
 *
 * ⚠️ CETTE FONCTION DOIT RENVOYER EXACTEMENT LA SURFACE AFFICHÉE.
 *
 * Le sol affiché est fait de TRIANGLES plats : chaque case de la grille est
 * coupée en deux le long de la diagonale b–c. On échantillonne donc le plan du
 * BON triangle (interpolation barycentrique), et surtout PAS une interpolation
 * bilinéaire : celle-ci décrit une surface courbée qui passe au-dessus ou en
 * dessous des triangles → c'est ce qui faisait s'enfoncer les routes et le
 * joueur dans les pentes dans l'ancienne version.
 *
 * Découpage, identique à `Ground.tsx` :
 *   a = (i0, j0)   b = (i1, j0)
 *   c = (i0, j1)   d = (i1, j1)
 * triangles (a, c, b) puis (b, c, d) → la diagonale relie b et c, donc
 * tx + tz ≤ 1 tombe dans le triangle a,b,c et le reste dans b,c,d.
 */
export function sampleHeight(x: number, z: number): number {
  const m = map
  if (!m) return 0

  // Position dans la grille, bornée au bord (le monde ne s'arrête pas à la carte).
  let fi = (x - m.x0) / m.res
  let fj = (z - m.z0) / m.res
  fi = Math.min(m.w - 1, Math.max(0, fi))
  fj = Math.min(m.h - 1, Math.max(0, fj))

  const i0 = Math.floor(fi)
  const j0 = Math.floor(fj)
  const i1 = Math.min(i0 + 1, m.w - 1)
  const j1 = Math.min(j0 + 1, m.h - 1)
  const tx = fi - i0
  const tz = fj - j0

  const hh = m.heights
  const hA = hh[j0 * m.w + i0]
  const hB = hh[j0 * m.w + i1]
  const hC = hh[j1 * m.w + i0]
  const hD = hh[j1 * m.w + i1]

  if (tx + tz <= 1) return hA + (hB - hA) * tx + (hC - hA) * tz
  return hD + (hB - hD) * (1 - tz) + (hC - hD) * (1 - tx)
}
