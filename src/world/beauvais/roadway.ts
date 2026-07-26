import { ROADS, terrainHeight } from './cityData'
import { isBlocked } from './collision'
import { isTerrainReady } from './terrain'

/**
 * 🛣️  LA CHAUSSÉE DE BEAUVAIS — un VOLUME, pas un décalque.
 *
 * Avant, une route était un ruban plat posé 3 cm au-dessus du terrain : de loin
 * ça passait, mais de près c'était de la peinture sur le sol. Une vraie route est
 * un ouvrage : on décaisse, on remblaie, on pose une chaussée ÉPAISSE, bordée
 * d'une bordure de trottoir en béton, et on rattrape le terrain naturel avec un
 * accotement en pente. C'est exactement ce que décrit ce fichier.
 *
 * Coupe en travers d'une rue (de gauche à droite) :
 *
 *      accotement    bordure          bitume          bordure   accotement
 *                   ┌──────┐                         ┌──────┐
 *      ╲            │      ├─────────────────────────┤      │            ╱
 *       ╲___________│      │                         │      │___________╱
 *   terrain naturel └──────┴─────────────────────────┴──────┘   terrain
 *
 * ⚠️ CE MODULE EST LA SOURCE UNIQUE DE LA CHAUSSÉE. Il sert à DEUX choses, et
 * c'est tout l'intérêt : la géométrie affichée (`Roads.tsx`) et la hauteur sur
 * laquelle on marche (`groundHeight()`) sortent des MÊMES chiffres. Sans ça, une
 * chaussée de 16 cm d'épaisseur, c'est un joueur qui a les pieds dans le bitume —
 * le bug historique du projet (voir `groundLayers.ts`).
 *
 * Trois décisions qui expliquent le code :
 *
 *  1. **Le dessus de la chaussée est PLAT en travers.** Une vraie route est
 *     nivelée : elle ne se tord pas pour épouser chaque bosse. On prend donc la
 *     hauteur du terrain la PLUS HAUTE autour du point (voir `topHeight`) et on
 *     ajoute l'épaisseur → la chaussée n'est jamais enterrée, et en dévers elle
 *     forme un petit remblai côté aval : c'est ce qui lui donne du volume.
 *
 *  2. **Cette hauteur ne dépend pas de l'orientation de la rue.** On échantillonne
 *     le terrain en croix (pas le long de la voie), donc deux rues qui se croisent
 *     trouvent la MÊME altitude au carrefour → pas de marche au croisement.
 *
 *  3. **Pas de bordure dans les carrefours.** Une bordure qui traverserait la rue
 *     perpendiculaire ferait un dos-d'âne en béton en plein croisement. On repère
 *     donc les points où une AUTRE voie passe (`junction`) et on y rabat bordure
 *     et accotement au ras du bitume — comme dans la vraie vie.
 */

/** Les cotes de l'ouvrage, en mètres. Tout le reste en découle. */
export const ROADWAY = {
  /**
   * En dessous de cette largeur, ce n'est pas une voie mais un trottoir, un
   * escalier ou un sentier (`footway` 2 m, `cycleway` 2 m, `path` 1,8 m,
   * `steps` 1,6 m). OSM en cartographie 1 671 rien qu'à Beauvais, et ils vont
   * jusqu'aux PORTES des immeubles : peints en bitume, ils donnaient l'impression
   * de routes qui s'arrêtent au pied des bâtiments. Les rues piétonnes du centre,
   * elles, sont des `pedestrian` de 5 m → elles passent le filtre et restent.
   */
  MIN_DRIVABLE_WIDTH: 2.5,
  /** Largeur mini d'une voie : OSM laisse parfois 0. */
  MIN_WIDTH: 3,
  /** Épaisseur de la chaussée au-dessus du point de terrain le plus haut. */
  THICKNESS: 0.16,
  /** Largeur de la bordure de trottoir, de chaque côté. */
  KERB_W: 0.35,
  /** Hauteur de la bordure au-dessus du bitume (une vraie bordure fait 12-15 cm). */
  KERB_H: 0.13,
  /** Largeur de l'accotement en pente qui rattrape le terrain naturel. */
  SHOULDER_W: 0.8,
  /** De combien l'accotement s'enfonce sous le terrain (pour ne pas laisser de jour). */
  EMBED: 0.3,
} as const

/** Demi-emprise totale d'une voie, bordure et accotement compris. */
const reach = (half: number) => half + ROADWAY.KERB_W + ROADWAY.SHOULDER_W

/** Côté d'une tuile de chaussée (m) — le même découpage que les bâtiments. */
export const ROADWAY_TILE = 180

/** Finesse de la découpe quand un segment entre dans un bâtiment (m). */
const CLIP_STEP = 1.5

/**
 * Pas de densification pour suivre le relief (m).
 *
 * Une rue d'OSM peut être un seul segment droit de 200 m. Posée sur un terrain
 * en pente, elle ferait un pont rectiligne au-dessus (ou sous) le sol. On coupe
 * donc les longs segments à la maille du relief (8 m) pour que la chaussée colle.
 */
const RELIEF_STEP = 8

/** Case de la grille spatiale (m) : sert à retrouver les voies sous un point. */
const CELL = 24

/** Un tronçon de chaussée prêt à être mis en volume par `Roads.tsx`. */
export interface RoadChunk {
  /** Demi-largeur du bitume (m). */
  half: number
  /** L'axe de la voie, par paquets de 3 : x, z, altitude du DESSUS du bitume. */
  pts: Float32Array
  /** 1 = carrefour à ce point → ni bordure ni accotement (voir décision n°3). */
  junction: Uint8Array
}

// --- État du module : construit une seule fois, à la première demande ---

let tiles: Map<string, RoadChunk[]> | null = null

// Les segments de toutes les voies, à plat, + la grille qui permet de les
// retrouver depuis un point du monde. C'est ce qui rend `roadwayHeightAt()`
// utilisable à chaque image.
let segCount = 0
let segA = new Float32Array(0) // départ : x, z, y
let segB = new Float32Array(0) // arrivée : x, z, y
let segHalf = new Float32Array(0)
let segRoad = new Int32Array(0)
let segJunction = new Uint8Array(0)
let cells: Map<string, number[]> = new Map()

const keyOf = (cx: number, cz: number) => cx + ':' + cz

/**
 * Construit le réseau si ce n'est pas déjà fait.
 *
 * ⚠️ Renvoie `false` — SANS RIEN METTRE EN CACHE — tant que le relief n'est pas
 * chargé. Construire sur un monde plat et le garder, c'est exactement le bug qui
 * avait cassé la version précédente (routes figées à l'altitude 0). `World.tsx`
 * attend `loadTerrain()`, donc en pratique on passe toujours ici après coup.
 */
function ensureBuilt(): boolean {
  if (tiles) return true
  if (!isTerrainReady()) return false
  build()
  return true
}

/** Coupe les segments trop longs pour que la chaussée puisse épouser le relief. */
function densify(pts: number[][]): number[][] {
  const out: number[][] = [pts[0]]
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / RELIEF_STEP)
    for (let k = 1; k <= steps; k++) {
      const t = k / steps
      out.push([ax + (bx - ax) * t, az + (bz - az) * t])
    }
  }
  return out
}

/**
 * Découpe une polyligne en morceaux qui ne traversent AUCUN bâtiment.
 *
 * Certaines voies d'OSM (allées de service, passages couverts) traversent
 * réellement des bâtiments ou finissent dedans. Comme le bâtiment est un bloc
 * plein posé sur la route, on voyait la chaussée y entrer et disparaître.
 *
 * On s'appuie sur `isBlocked()` — la MÊME fonction que celle qui arrête le
 * joueur. La chaussée est donc construite exactement là où on peut réellement
 * circuler, ni plus ni moins.
 *
 * Perf : le cas courant (segment loin de tout bâtiment) coûte 3 tests de grille
 * et n'ajoute aucun point. On n'affine qu'aux segments qui touchent vraiment un
 * bâtiment.
 */
function clipToOutside(pts: number[][]): number[][][] {
  const runs: number[][][] = []
  let current: number[][] = []

  const step = (p: number[], inside: boolean) => {
    if (inside) {
      if (current.length > 1) runs.push(current)
      current = []
    } else {
      current.push(p)
    }
  }

  step(pts[0], isBlocked(pts[0][0], pts[0][1]))

  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const midX = (ax + bx) / 2
    const midZ = (az + bz) / 2

    // Cas courant : ni les extrémités ni le milieu ne sont dans un bâtiment.
    if (!isBlocked(ax, az) && !isBlocked(bx, bz) && !isBlocked(midX, midZ)) {
      step(pts[i + 1], false)
      continue
    }

    // Segment à cheval sur un mur : on l'affine pour couper au ras du bâtiment.
    const length = Math.hypot(bx - ax, bz - az)
    const count = Math.max(2, Math.ceil(length / CLIP_STEP))
    for (let k = 1; k <= count; k++) {
      const t = k / count
      const x = ax + (bx - ax) * t
      const z = az + (bz - az) * t
      step([x, z], isBlocked(x, z))
    }
  }

  if (current.length > 1) runs.push(current)
  return runs
}

/**
 * Altitude du DESSUS du bitume au point (x, z), pour une voie de demi-largeur `half`.
 *
 * On prend le terrain le plus haut sur une croix de rayon `half` autour du point,
 * puis on ajoute l'épaisseur de la chaussée. Deux conséquences voulues :
 *  - la chaussée n'est JAMAIS enterrée, même quand la rue longe un coteau ;
 *  - l'échantillonnage étant en croix (axes du monde) et non le long de la voie,
 *    deux rues qui se croisent obtiennent la même altitude au carrefour.
 */
function topHeight(x: number, z: number, half: number): number {
  const r = Math.max(half, 1)
  let h = terrainHeight(x, z)
  h = Math.max(h, terrainHeight(x + r, z), terrainHeight(x - r, z))
  h = Math.max(h, terrainHeight(x, z + r), terrainHeight(x, z - r))
  return h + ROADWAY.THICKNESS
}

/** Un axe de voie prêt à l'emploi (entre deux bâtiments), pendant la construction. */
interface Run {
  half: number
  /** Index de la route d'origine : sert à ne pas se prendre soi-même pour un carrefour. */
  road: number
  /** x, z, altitude du dessus du bitume, par point. */
  pts: number[]
  /** 1 = carrefour à ce point. Rempli à l'étape 3. */
  flags: Uint8Array
}

function build() {
  const t0 = performance.now()

  // --- 1. Les axes : filtrage piéton, découpe aux bâtiments, densification ---
  const runs: Run[] = []
  for (let r = 0; r < ROADS.length; r++) {
    const road = ROADS[r]
    if (road.w <= ROADWAY.MIN_DRIVABLE_WIDTH) continue
    const half = Math.max(ROADWAY.MIN_WIDTH, road.w) / 2
    for (const run of clipToOutside(road.pts)) {
      const dense = densify(run)
      if (dense.length < 2) continue
      const pts: number[] = []
      for (const [x, z] of dense) pts.push(x, z, topHeight(x, z, half))
      runs.push({ half, road: r, pts, flags: new Uint8Array(dense.length) })
    }
  }

  // --- 2. Segments + grille spatiale (pour retrouver la voie sous un point) ---
  let total = 0
  for (const run of runs) total += run.pts.length / 3 - 1
  segCount = total
  segA = new Float32Array(total * 3)
  segB = new Float32Array(total * 3)
  segHalf = new Float32Array(total)
  segRoad = new Int32Array(total)
  segJunction = new Uint8Array(total)
  cells = new Map()

  let s = 0
  for (const run of runs) {
    const n = run.pts.length / 3
    for (let i = 0; i < n - 1; i++) {
      const ax = run.pts[i * 3]
      const az = run.pts[i * 3 + 1]
      const bx = run.pts[(i + 1) * 3]
      const bz = run.pts[(i + 1) * 3 + 1]
      segA[s * 3] = ax
      segA[s * 3 + 1] = az
      segA[s * 3 + 2] = run.pts[i * 3 + 2]
      segB[s * 3] = bx
      segB[s * 3 + 1] = bz
      segB[s * 3 + 2] = run.pts[(i + 1) * 3 + 2]
      segHalf[s] = run.half
      segRoad[s] = run.road

      // On range le segment dans TOUTES les cases que son emprise touche
      // (bordure et accotement compris) → une seule case à consulter à la lecture.
      const pad = reach(run.half)
      const cx0 = Math.floor((Math.min(ax, bx) - pad) / CELL)
      const cx1 = Math.floor((Math.max(ax, bx) + pad) / CELL)
      const cz0 = Math.floor((Math.min(az, bz) - pad) / CELL)
      const cz1 = Math.floor((Math.max(az, bz) + pad) / CELL)
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const key = keyOf(cx, cz)
          let list = cells.get(key)
          if (!list) cells.set(key, (list = []))
          list.push(s)
        }
      }
      s++
    }
  }

  // --- 3. Les carrefours : où une AUTRE voie passe, on n'a pas le droit de bordure ---
  s = 0
  for (const run of runs) {
    const n = run.pts.length / 3
    for (let i = 0; i < n; i++) {
      const pi = Math.max(0, i - 1)
      const ni = Math.min(n - 1, i + 1)
      run.flags[i] = crossedByOther(
        run.pts[i * 3],
        run.pts[i * 3 + 1],
        run.pts[ni * 3] - run.pts[pi * 3],
        run.pts[ni * 3 + 1] - run.pts[pi * 3 + 1],
        run.road,
      )
        ? 1
        : 0
    }
    // Un segment est « dans un carrefour » dès qu'une de ses extrémités l'est :
    // c'est ce que lit `roadwayHeightAt()`, qui raisonne par segment. La géométrie,
    // elle, garde le repère par POINT → la bordure s'éteint en biseau, pas d'un coup.
    for (let i = 0; i < n - 1; i++) segJunction[s + i] = run.flags[i] || run.flags[i + 1]
    s += n - 1
  }

  // --- 4. Découpage en tuiles, pour ne construire que ce qui est autour du joueur ---
  tiles = new Map()
  for (const run of runs) {
    const n = run.pts.length / 3
    let start = 0
    let tile = tileOf(run.pts[0], run.pts[1])
    for (let i = 1; i < n; i++) {
      const t = tileOf(run.pts[i * 3], run.pts[i * 3 + 1])
      if (t === tile) continue
      // Le point i ferme le tronçon courant ET ouvre le suivant : aucun segment
      // n'est perdu, aucun n'est dessiné deux fois.
      pushChunk(tile, run, start, i)
      start = i
      tile = t
    }
    pushChunk(tile, run, start, n - 1)
  }

  console.info(
    `[chaussée] ${runs.length} tronçons, ${segCount} segments, ${tiles.size} tuiles ` +
      `(${Math.round(performance.now() - t0)} ms)`,
  )
}

const tileOf = (x: number, z: number) =>
  keyOf(Math.floor(x / ROADWAY_TILE), Math.floor(z / ROADWAY_TILE))

/** Range dans une tuile les points `from..to` (inclus) d'un axe de voie. */
function pushChunk(tile: string, run: Run, from: number, to: number) {
  if (to - from + 1 < 2) return
  const chunk: RoadChunk = {
    half: run.half,
    pts: new Float32Array(run.pts.slice(from * 3, (to + 1) * 3)),
    junction: run.flags.slice(from, to + 1),
  }
  let list = tiles!.get(tile)
  if (!list) tiles!.set(tile, (list = []))
  list.push(chunk)
}

/**
 * Une autre voie passe-t-elle sur ce point ? (→ c'est un carrefour)
 *
 * On ignore les voies quasi PARALLÈLES : une rue dédoublée dans OSM (deux sens
 * séparés, contre-allée) n'est pas un carrefour, et lui supprimer ses bordures
 * sur toute sa longueur serait absurde. Au-delà de ~25° d'écart, en revanche,
 * les deux chaussées se croisent vraiment.
 */
function crossedByOther(x: number, z: number, dx: number, dz: number, road: number): boolean {
  const list = cells.get(keyOf(Math.floor(x / CELL), Math.floor(z / CELL)))
  if (!list) return false
  const len = Math.hypot(dx, dz) || 1
  const ux = dx / len
  const uz = dz / len

  for (const i of list) {
    if (segRoad[i] === road) continue
    const ax = segA[i * 3]
    const az = segA[i * 3 + 1]
    const bx = segB[i * 3]
    const bz = segB[i * 3 + 1]
    const ex = bx - ax
    const ez = bz - az
    const elen = Math.hypot(ex, ez) || 1
    // Voies quasi parallèles → ce n'est pas un croisement.
    if (Math.abs((ex * ux + ez * uz) / elen) > 0.9) continue
    // Le point tombe-t-il sur le bitume de l'autre voie (bordure comprise) ?
    if (distToSegment(x, z, ax, az, ex, ez, elen) < segHalf[i] + ROADWAY.KERB_W) return true
  }
  return false
}

/** Distance du point (x, z) au segment (ax, az) + (ex, ez), de longueur `elen`. */
function distToSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  ex: number,
  ez: number,
  elen: number,
): number {
  let t = ((x - ax) * ex + (z - az) * ez) / (elen * elen)
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(x - (ax + ex * t), z - (az + ez * t))
}

/**
 * Altitude de la CHAUSSÉE au point (x, z), ou `-Infinity` s'il n'y a pas de route.
 *
 * C'est la contrepartie exacte de la géométrie construite par `Roads.tsx` :
 * bitume plat, marche de bordure, puis accotement qui redescend vers le terrain.
 * Aux carrefours (pas de bordure), seule la surface du bitume compte.
 */
export function roadwayHeightAt(x: number, z: number): number {
  if (!ensureBuilt()) return -Infinity
  const list = cells.get(keyOf(Math.floor(x / CELL), Math.floor(z / CELL)))
  if (!list) return -Infinity

  let best = -Infinity
  for (const i of list) {
    const ax = segA[i * 3]
    const az = segA[i * 3 + 1]
    const ex = segB[i * 3] - ax
    const ez = segB[i * 3 + 1] - az
    const elen = Math.hypot(ex, ez) || 1

    let t = ((x - ax) * ex + (z - az) * ez) / (elen * elen)
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const d = Math.hypot(x - (ax + ex * t), z - (az + ez * t))

    const half = segHalf[i]
    if (d > reach(half)) continue

    // Altitude du dessus du bitume, interpolée le long du segment.
    const top = segA[i * 3 + 2] + (segB[i * 3 + 2] - segA[i * 3 + 2]) * t

    let y: number
    if (d <= half) {
      y = top
    } else if (segJunction[i]) {
      continue // carrefour : ni bordure ni accotement, c'est la voie d'en face qui décide
    } else if (d <= half + ROADWAY.KERB_W) {
      y = top + ROADWAY.KERB_H // on est sur la bordure
    } else {
      // Accotement : on redescend en pente vers le terrain naturel.
      const u = (d - half - ROADWAY.KERB_W) / ROADWAY.SHOULDER_W
      y = (top + ROADWAY.KERB_H) * (1 - u) + terrainHeight(x, z) * u
    }
    if (y > best) best = y
  }
  return best
}

/**
 * 🚶 LA SURFACE SUR LAQUELLE ON MARCHE, en mètres.
 *
 * 👉 C'est ce que doit lire TOUT CE QUI SE DÉPLACE ou se pose au sol : le joueur,
 * le scooter, les objets, les lampadaires. `terrainHeight()` (cityData.ts), lui,
 * reste le RELIEF NU — celui sur lequel on CONSTRUIT le décor.
 *
 * La distinction est née le jour où la chaussée a pris de l'épaisseur : marcher
 * sur `terrainHeight()` au milieu d'une rue, c'est avoir les pieds 16 cm dans le
 * bitume. Ici on prend simplement le plus haut des deux — donc hors des routes,
 * `groundHeight()` vaut exactement `terrainHeight()`.
 */
export function groundHeight(x: number, z: number): number {
  const road = roadwayHeightAt(x, z)
  const ground = terrainHeight(x, z)
  return road > ground ? road : ground
}

/** Les tronçons de chaussée rangés par tuile. Vide tant que le relief n'est pas là. */
export function roadwayTiles(): Map<string, RoadChunk[]> {
  if (!ensureBuilt()) return new Map()
  return tiles!
}
