import { ROADS, CITY_GENERATED_AT, terrainHeight, type Road, type RoadClass } from './cityData'
import { isBlocked } from './collision'
import { isTerrainReady } from './terrain'
import roadSurfaceTest from './data/road-surface-test.json'

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
 *
 *  4. **Le trottoir n'est plus un ruban par rue, c'est le COMPLÉMENT du bitume.**
 *     Extrudé rue par rue, il se chevauchait à chaque croisement, et le seul moyen
 *     de s'en sortir était de le supprimer dans les carrefours : un trou à chaque
 *     intersection. Il est maintenant calculé hors-jeu comme un polygone unique
 *     (réseau élargi − chaussée − bâtiments, voir `debug-road-geometry.mjs`), et
 *     `roadwayHeightAt()` exprime la MÊME règle en distances. Il n'y a donc plus de
 *     cas particulier « carrefour » côté trottoir : le coin est juste par
 *     construction.
 */

/** Les cotes de l'ouvrage, en mètres. Tout le reste en découle. */
export const ROADWAY = {
  /**
   * Seuil hérité : en dessous de cette largeur, on supposait que ce n'était pas
   * une voie mais un trottoir, un escalier ou un sentier.
   *
   * ⚠️ Ce seuil est une DEVINETTE, et il se trompait dans les deux sens : il
   * gardait les sentiers larges et jetait les ruelles étroites bien réelles.
   * Depuis que les routes viennent de l'IGN, chaque voie porte une classe
   * explicite (`road.cls`) et les sentiers/escaliers sont déjà écartés à la
   * génération. Le seuil ne sert donc plus que de repli si `beauvais.json` a été
   * produit sans l'IGN — voir `isSurfaced()`.
   */
  MIN_DRIVABLE_WIDTH: 2.5,
  /** Largeur mini d'une voie : la donnée laisse parfois 0. */
  MIN_WIDTH: 3,
  /** Épaisseur de la chaussée au-dessus du point de terrain le plus haut. */
  THICKNESS: 0.16,
  /** Largeur de la bordure de trottoir, de chaque côté. */
  KERB_W: 0.35,
  /** Hauteur de la bordure au-dessus du bitume (une vraie bordure fait 12-15 cm). */
  KERB_H: 0.13,
  /** Ecart maxi entre deux bitumes paralleles pour les fondre en une seule chaussee. */
  PARALLEL_MERGE_GAP: 3.6,
  /** Recouvrement de bitume ajoute pour eviter une couture visible entre deux voies fusionnees. */
  PARALLEL_MERGE_OVERLAP: 0.25,
  /** Garde-fou : une fusion automatique ne doit pas avaler un vrai terre-plein large. */
  PARALLEL_MERGE_MAX_EXTRA: 3.4,
  /** Largeur de l'accotement en pente qui rattrape le terrain naturel. */
  SHOULDER_W: 0.8,
  /**
   * ── LE TROTTOIR ────────────────────────────────────────────────────────────
   *
   * Le dessus de bordure faisait 35 cm : ce n'est pas un trottoir. Comme la
   * sensation d'une ville tient au rapport largeur de rue / hauteur de façade, les
   * rues paraissaient étranglées même avec un bitume à la bonne largeur.
   *
   * ⚠️ **La largeur est un choix de PROJET, pas une mesure.** Une première
   * version sondait la distance à la façade la plus proche et remplissait
   * l'espace. Deux défauts, tous deux visibles en jeu : dès qu'une façade était
   * loin (place, recul d'immeuble) les voies convergentes posaient de grandes
   * plaques grises informes ; et deux voies voisines mesurant deux couloirs
   * différents ne tombaient pas d'accord sur l'emplacement du bord.
   *
   * La largeur suit donc le rang de la voie, et rien d'autre — une avenue a de
   * vrais trottoirs, une ruelle non. C'est `walkTarget()` plus bas. Le rabotage
   * par les bâtiments existe toujours, mais il se fait par soustraction de
   * polygones hors-jeu (`debug-road-geometry.mjs`), ce qui donne un bord net au
   * pied du mur au lieu d'une largeur moyennée.
   */
  WALK_TARGET_RATIO: 0.7, // × la demi-chaussée
  WALK_TARGET_MIN: 1.2,
  WALK_TARGET_MAX: 3,
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

/** Nombre de passes de lissage vertical sur les axes de route densifies. */
const HEIGHT_SMOOTH_PASSES = 2

/** Angle maxi entre deux axes pour les considerer comme la meme chaussee. */
const PARALLEL_DOT = 0.94

const MAJOR_HIGHWAYS = new Set(['motorway', 'trunk', 'primary', 'secondary'])
const SERVICE_SEPARATORS = new Set(['parking_aisle', 'driveway', 'drive-through'])

/** Case de la grille spatiale (m) : sert à retrouver les voies sous un point. */
const CELL = 24

type RoadSurfaceTile = {
  polygons: number[][][][]
}

type RoadSurfaceTest = {
  center: { x: number; z: number }
  radius: number
  polygons?: number[][][][]
  preview?: { polygons?: number[][][][] }
  tileSize?: number
  tiles?: Record<string, RoadSurfaceTile>
  walkTiles?: Record<string, RoadSurfaceTile>
  sourceCity?: { generatedAt: string | null; roadCount: number }
}

const ROAD_SURFACE_TEST = roadSurfaceTest as RoadSurfaceTest

/**
 * ⚠️ Garde-fou : la dalle de bitume est-elle bien celle des routes actuelles ?
 *
 * `road-surface-test.json` est DÉRIVÉ de `beauvais-buildings.json`. Régénérer la
 * ville sans relancer `npm run debug:roads` laisse la grande surface fusionnée
 * sur les ANCIENNES routes pendant que les rubans suivent les nouvelles. Comme
 * les rubans ne sont masqués que sous la surface réelle, chacun dépasse de son
 * côté : la ville se couvre de bouts de bitume en travers.
 *
 * C'est exactement ce qui est arrivé au passage des routes d'OSM à l'IGN — les
 * deux jeux sont décalés de 1 à 5 m, et seuls 84,5 % des axes tombaient encore
 * sur la dalle (99,5 % une fois régénérée). Le symptôme est spectaculaire mais
 * la cause est invisible dans le code : d'où cette alerte.
 */
function warnIfSurfaceStale() {
  const src = ROAD_SURFACE_TEST.sourceCity
  if (!src) {
    console.warn(
      "[roadway] road-surface-test.json a été généré avant l'ajout de l'empreinte ville. " +
        'Relance `npm run debug:roads` pour pouvoir vérifier sa fraîcheur.',
    )
    return
  }
  if (src.generatedAt === CITY_GENERATED_AT && src.roadCount === ROADS.length) return

  console.error(
    '[roadway] ⚠️ SURFACE DE ROUTE PÉRIMÉE — la dalle de bitume vient d’une autre version ' +
      `de la ville (${src.roadCount} routes, ${src.generatedAt}) que les rubans ` +
      `(${ROADS.length} routes, ${CITY_GENERATED_AT}). Des bouts de route vont dépasser ` +
      'partout. Corrige avec : npm run debug:roads',
  )
}
warnIfSurfaceStale()
const EXPERIMENTAL_SURFACE_HEIGHT_SAMPLE_RADIUS = 1.6
const EXPERIMENTAL_SURFACE_TILE_SIZE = ROAD_SURFACE_TEST.tileSize ?? ROADWAY_TILE
const EXPERIMENTAL_SURFACE_TILES = ROAD_SURFACE_TEST.tiles ?? null
/** Les trottoirs publiés par `npm run debug:roads`. Absents d'un fichier antérieur. */
const EXPERIMENTAL_WALK_TILES = ROAD_SURFACE_TEST.walkTiles ?? null
const LEGACY_EXPERIMENTAL_SURFACE_POLYGONS = ROAD_SURFACE_TEST.polygons ?? ROAD_SURFACE_TEST.preview?.polygons ?? []

/** Un tronçon de chaussée prêt à être mis en volume par `Roads.tsx`. */
export interface GroundSampleOffset {
  x: number
  z: number
}

export interface RoadChunk {
  /** Demi-largeur du bitume (m). */
  half: number
  /** L'axe de la voie, par paquets de 3 : x, z, altitude du DESSUS du bitume. */
  pts: Float32Array
  /** 1 = carrefour à ce point → ni bordure ni accotement (voir décision n°3). */
  junction: Uint8Array
  /** Extension de bitume sur le cote gauche quand une voie parallele est fusionnee. */
  leftMerge: Float32Array
  /** Extension de bitume sur le cote droit quand une voie parallele est fusionnee. */
  rightMerge: Float32Array
  /** Classe d'usage IGN → décide du revêtement dans `Roads.tsx`. */
  cls?: RoadClass
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
let segLeftMerge = new Float32Array(0)
let segRightMerge = new Float32Array(0)
let segRun = new Int32Array(0)
let segRoad = new Int32Array(0)
let segJunction = new Uint8Array(0)
/**
 * 1 = ce segment est sous la dalle de bitume, donc bitume ET trottoir sont déjà
 * décrits par les polygones publiés. Le profil analytique n'a plus rien à y dire.
 */
let segPaved = new Uint8Array(0)
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

function pointInRing(x: number, z: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const zi = ring[i][1]
    const xj = ring[j][0]
    const zj = ring[j][1]
    const crosses = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/**
 * 🔎 Un index de polygones par tuile, avec la BOÎTE ENGLOBANTE de chacun.
 *
 * ⚠️ La boîte n'est pas un raffinement, c'est ce qui rend ces tests utilisables à
 * chaque image. `roadwayHeightAt()` interroge deux couches de polygones, et un
 * point hors trottoir doit balayer les 9 tuiles voisines EN ENTIER avant de
 * pouvoir répondre non — le cas le plus fréquent est donc le plus cher. Mesuré sur
 * 106 666 points : **67 µs par appel** sans boîte, **3,4 µs avec**. Vingt fois.
 *
 * Quatre comparaisons éliminent la quasi-totalité des candidats avant le lancer de
 * rayon. L'index se construit en 77 ms, une seule fois.
 */
interface PolygonIndex {
  polys: number[][][][]
  /** x0, z0, x1, z1 par polygone, à plat. */
  bounds: Float64Array
}

function buildPolygonIndex(
  tiles: Record<string, RoadSurfaceTile> | null,
): Map<string, PolygonIndex> | null {
  if (!tiles) return null
  const index = new Map<string, PolygonIndex>()
  for (const key of Object.keys(tiles)) {
    const polys = tiles[key].polygons
    const bounds = new Float64Array(polys.length * 4)
    for (let i = 0; i < polys.length; i++) {
      let x0 = Infinity
      let z0 = Infinity
      let x1 = -Infinity
      let z1 = -Infinity
      for (const [x, z] of polys[i][0]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (z < z0) z0 = z
        if (z > z1) z1 = z
      }
      bounds[i * 4] = x0
      bounds[i * 4 + 1] = z0
      bounds[i * 4 + 2] = x1
      bounds[i * 4 + 3] = z1
    }
    index.set(key, { polys, bounds })
  }
  return index
}

/** Le point tombe-t-il dans un polygone de cette couche ? (trous compris) */
function insideIndexedLayer(index: Map<string, PolygonIndex> | null, x: number, z: number): boolean {
  if (!index) return false
  const tx = Math.floor(x / EXPERIMENTAL_SURFACE_TILE_SIZE)
  const tz = Math.floor(z / EXPERIMENTAL_SURFACE_TILE_SIZE)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const tile = index.get(tx + dx + ':' + (tz + dz))
      if (!tile) continue
      const { polys, bounds } = tile
      for (let i = 0; i < polys.length; i++) {
        const b = i * 4
        if (x < bounds[b] || x > bounds[b + 2] || z < bounds[b + 1] || z > bounds[b + 3]) continue
        const poly = polys[i]
        if (!pointInRing(x, z, poly[0])) continue
        let inHole = false
        for (let k = 1; k < poly.length; k++) {
          if (pointInRing(x, z, poly[k])) {
            inHole = true
            break
          }
        }
        if (!inHole) return true
      }
    }
  }
  return false
}

const SURFACE_INDEX = buildPolygonIndex(EXPERIMENTAL_SURFACE_TILES)
const WALK_INDEX = buildPolygonIndex(EXPERIMENTAL_WALK_TILES)

function insideExperimentalSurface(x: number, z: number): boolean {
  if (!EXPERIMENTAL_SURFACE_TILES) {
    // Repli : un fichier d'avant le découpage en tuiles, avec une seule zone d'essai.
    const dx = x - ROAD_SURFACE_TEST.center.x
    const dz = z - ROAD_SURFACE_TEST.center.z
    if (Math.hypot(dx, dz) > ROAD_SURFACE_TEST.radius + 8) return false
    for (const poly of LEGACY_EXPERIMENTAL_SURFACE_POLYGONS) {
      const outer = poly[0]
      if (!outer || !pointInRing(x, z, outer)) continue
      let inHole = false
      for (const hole of poly.slice(1)) {
        if (pointInRing(x, z, hole)) {
          inHole = true
          break
        }
      }
      if (!inHole) return true
    }
    return false
  }
  return insideIndexedLayer(SURFACE_INDEX, x, z)
}

function experimentalSurfaceTopHeight(x: number, z: number): number {
  const r = EXPERIMENTAL_SURFACE_HEIGHT_SAMPLE_RADIUS
  let h = terrainHeight(x, z)
  h = Math.max(h, terrainHeight(x + r, z), terrainHeight(x - r, z))
  h = Math.max(h, terrainHeight(x, z + r), terrainHeight(x, z - r))
  h = Math.max(h, terrainHeight(x + r, z + r), terrainHeight(x - r, z - r))
  h = Math.max(h, terrainHeight(x + r, z - r), terrainHeight(x - r, z + r))
  return h + ROADWAY.THICKNESS
}

function experimentalSurfaceHeightAt(x: number, z: number): number {
  if (!insideExperimentalSurface(x, z)) return -Infinity
  return experimentalSurfaceTopHeight(x, z)
}

/**
 * 🚶 Le TROTTOIR, lu sur les mêmes polygones que ceux qui sont dessinés.
 *
 * ⚠️ C'est le seul moyen d'être exact. Un trottoir n'existe pas partout où la
 * géométrie le permettrait : deux vetos le suppriment hors-jeu (terre-plein entre
 * voies parallèles, absence de bâti — voir `debug-road-geometry.mjs`). Une règle de
 * distance, si fidèle soit-elle, ne peut pas les rejouer sans dupliquer tout le
 * raisonnement, et la moindre divergence redonne des **trottoirs invisibles** : le
 * joueur bute sur une marche de 13 cm en rase campagne, là où l'écran ne montre que
 * de l'herbe. C'était le bug historique de ce module.
 *
 * On paie donc un test point-dans-polygone, sur le même index à boîtes englobantes
 * que le bitume : **3,4 µs par appel** mesurés sur 106 666 points, dans le cas le
 * plus défavorable (hors trottoir, donc sans sortie anticipée).
 */
function insideExperimentalWalk(x: number, z: number): boolean {
  return insideIndexedLayer(WALK_INDEX, x, z)
}

function experimentalWalkHeightAt(x: number, z: number): number {
  if (!insideExperimentalWalk(x, z)) return -Infinity
  // Même échantillonnage que le bitume, relevé de la bordure : c'est ce que fait
  // `buildRoadSurfaceBuffers(polygones, KERB_H)` côté rendu.
  return experimentalSurfaceTopHeight(x, z) + ROADWAY.KERB_H
}

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
function smoothRoadTops(pts: number[][], half: number): number[] {
  const raw = pts.map(([x, z]) => topHeight(x, z, half))
  let smooth = raw.slice()
  for (let pass = 0; pass < HEIGHT_SMOOTH_PASSES; pass++) {
    const next = smooth.slice()
    for (let i = 1; i < smooth.length - 1; i++) {
      const eased = smooth[i - 1] * 0.25 + smooth[i] * 0.5 + smooth[i + 1] * 0.25
      next[i] = Math.max(raw[i], eased)
    }
    smooth = next
  }
  return smooth
}

/**
 * 🚶 LARGEUR DU TROTTOIR — une fonction du RANG DE LA VOIE, et rien d'autre.
 *
 * ⚠️ C'est le miroir EXACT de `walkTarget()` dans `debug-road-geometry.mjs`, qui
 * découpe les polygones affichés. Les deux doivent donner le même nombre pour la
 * même voie, sinon on marche à côté du trottoir qu'on voit. Toute modification se
 * fait des deux côtés, dans le même commit.
 *
 * ── Pourquoi ce n'est plus mesuré jusqu'à la façade ─────────────────────────
 * La version précédente lançait une perpendiculaire, cherchait le premier mur de
 * chaque côté et remplissait l'espace, puis lissait le résultat le long de la rue.
 * L'intention était bonne, mais elle imposait la largeur au TRACÉ, alors que c'est
 * la largeur qui doit être un choix de projet. Deux voies voisines mesuraient deux
 * couloirs différents et ne tombaient pas d'accord sur l'emplacement du bord.
 *
 * Le rabotage par les bâtiments n'a pas disparu — il a changé de place. Il se fait
 * maintenant par SOUSTRACTION de polygones, hors-jeu, ce qui donne un bord net au
 * pied du mur au lieu d'une largeur moyennée. Et la physique n'a pas besoin de le
 * refaire : un bâtiment est déjà un volume plein, on ne peut pas y entrer.
 */
function walkTarget(half: number): number {
  const wanted = half * ROADWAY.WALK_TARGET_RATIO
  if (wanted < ROADWAY.WALK_TARGET_MIN) return ROADWAY.WALK_TARGET_MIN
  if (wanted > ROADWAY.WALK_TARGET_MAX) return ROADWAY.WALK_TARGET_MAX
  return wanted
}

/** Bord extérieur du trottoir, mesuré depuis l'axe de la voie. */
export function walkOuterReach(half: number): number {
  return half + ROADWAY.KERB_W + walkTarget(half)
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
  /** Bitume ajoute cote gauche pour fondre les voies paralleles proches. */
  leftMerge: Float32Array
  /** Bitume ajoute cote droit pour fondre les voies paralleles proches. */
  rightMerge: Float32Array
  source: Road
}

function build() {
  const t0 = performance.now()

  // --- 1. Les axes : filtrage piéton, découpe aux bâtiments, densification ---
  const runs: Run[] = []
  for (let r = 0; r < ROADS.length; r++) {
    const road = ROADS[r]
    if (!isSurfaced(road)) continue
    const half = Math.max(ROADWAY.MIN_WIDTH, road.w) / 2
    for (const run of clipToOutside(road.pts)) {
      const dense = densify(run)
      if (dense.length < 2) continue
      const pts: number[] = []
      const heights = smoothRoadTops(dense, half)
      for (let i = 0; i < dense.length; i++) {
        const [x, z] = dense[i]
        pts.push(x, z, heights[i])
      }
      runs.push({
        half,
        road: r,
        pts,
        flags: new Uint8Array(dense.length),
        leftMerge: new Float32Array(dense.length),
        rightMerge: new Float32Array(dense.length),
        source: road,
      })
    }
  }

  // --- 2. Segments + grille spatiale (pour retrouver la voie sous un point) ---
  let total = 0
  for (const run of runs) total += run.pts.length / 3 - 1
  segCount = total
  segA = new Float32Array(total * 3)
  segB = new Float32Array(total * 3)
  segHalf = new Float32Array(total)
  segLeftMerge = new Float32Array(total)
  segRightMerge = new Float32Array(total)
  segRun = new Int32Array(total)
  segRoad = new Int32Array(total)
  segJunction = new Uint8Array(total)
  segPaved = new Uint8Array(total)
  cells = new Map()

  let s = 0
  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const run = runs[runIndex]
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
      segRun[s] = runIndex
      segRoad[s] = run.road

      // On range le segment dans TOUTES les cases que son emprise touche
      // (bordure et accotement compris) → une seule case à consulter à la lecture.
      const pad = Math.max(reach(run.half), run.half + ROADWAY.PARALLEL_MERGE_MAX_EXTRA)
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

  markParallelMerges(runs)

  /**
   * Quels segments sont couverts par les dalles ?
   *
   * ⚠️ Là où elles règnent, le calcul analytique ci-dessous doit se TAIRE. Sinon il
   * ajoute une bordure et un trottoir de son cru par-dessus — y compris sur les
   * côtés que les vetos ont supprimés, et on retrouve les trottoirs invisibles.
   *
   * Le test porte sur le milieu du segment : les segments font quelques mètres
   * après densification, et la dalle est bâtie sur ces mêmes axes.
   */
  for (let i = 0; i < total; i++) {
    const mx = (segA[i * 3] + segB[i * 3]) / 2
    const mz = (segA[i * 3 + 1] + segB[i * 3 + 1]) / 2
    segPaved[i] = insideExperimentalSurface(mx, mz) ? 1 : 0
  }

  // --- 3. Les carrefours : ou une AUTRE voie passe, on n'a pas le droit de bordure ---
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
    for (let i = 0; i < n - 1; i++) {
      segJunction[s + i] = run.flags[i] || run.flags[i + 1]
      segLeftMerge[s + i] = Math.max(run.leftMerge[i], run.leftMerge[i + 1])
      segRightMerge[s + i] = Math.max(run.rightMerge[i], run.rightMerge[i + 1])
    }
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
    leftMerge: run.leftMerge.slice(from, to + 1),
    rightMerge: run.rightMerge.slice(from, to + 1),
    cls: run.source.cls,
  }
  let list = tiles!.get(tile)
  if (!list) tiles!.set(tile, (list = []))
  list.push(chunk)
}

/** Marque les cotes interieurs des voies OSM paralleles pour en faire une chaussee continue. */
function markParallelMerges(runs: Run[]) {
  for (const run of runs) {
    const n = run.pts.length / 3
    for (let i = 0; i < n; i++) {
      const pi = Math.max(0, i - 1)
      const ni = Math.min(n - 1, i + 1)
      markParallelMergeAt(
        runs,
        run,
        i,
        run.pts[i * 3],
        run.pts[i * 3 + 1],
        run.pts[ni * 3] - run.pts[pi * 3],
        run.pts[ni * 3 + 1] - run.pts[pi * 3 + 1],
      )
    }
  }
}

function hasRoadMeta(road: Road): boolean {
  return Boolean(
    road.highway || road.name || road.ref || road.service || road.junction ||
      road.lanes || road.oneway || road.bridge || road.tunnel || road.layer,
  )
}

function cleanRoadLabel(value?: string): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function roadIdentity(road: Road): string {
  return cleanRoadLabel(road.name || road.ref)
}

function sameKnownRoad(a: Road, b: Road): boolean {
  const ai = roadIdentity(a)
  const bi = roadIdentity(b)
  return ai.length > 0 && ai === bi
}

function roadLayer(road: Road): number {
  return (road.layer ?? 0) + (road.bridge ? 10 : 0) - (road.tunnel ? 10 : 0)
}

/**
 * Cette voie mérite-t-elle une vraie surface au sol ?
 *
 * Avec les données IGN, la réponse est portée par la donnée : une ruelle de 3 m
 * est une rue et reçoit son bitume, un sentier n'existe déjà plus dans le
 * fichier. On accepte donc TOUTES les classes — y compris `pedestrian` et
 * `track`, qui sont de vraies surfaces, simplement pas en enrobé (le matériau
 * est choisi dans `Roads.tsx`).
 *
 * Le repli sur la largeur ne concerne qu'un `beauvais.json` généré sans l'IGN.
 */
function isSurfaced(road: Road): boolean {
  if (road.cls) return true
  return road.w > ROADWAY.MIN_DRIVABLE_WIDTH
}

function isLinkRoad(road: Road): boolean {
  return Boolean(road.highway?.endsWith('_link'))
}

function isMajorRoad(road: Road): boolean {
  return Boolean(road.highway && MAJOR_HIGHWAYS.has(road.highway)) || (road.lanes ?? 0) >= 4
}

function isSeparatedCarriageway(a: Road, b: Road): boolean {
  return sameKnownRoad(a, b) && Boolean(a.oneway && b.oneway) && (isMajorRoad(a) || isMajorRoad(b))
}

function shouldMergeParallel(run: Run, other: Run, gap: number): boolean {
  const a = run.source
  const b = other.source
  if (!hasRoadMeta(a) && !hasRoadMeta(b)) return true
  if (roadLayer(a) !== roadLayer(b)) return false
  if (isLinkRoad(a) !== isLinkRoad(b)) return false

  const aService = a.service ?? ''
  const bService = b.service ?? ''
  if (aService || bService) {
    if (aService !== bService) return false
    if (SERVICE_SEPARATORS.has(aService)) return false
  }

  const ai = roadIdentity(a)
  const bi = roadIdentity(b)
  if (ai && bi && ai !== bi) return false
  if (isSeparatedCarriageway(a, b) && gap > 1.2) return false
  if (sameKnownRoad(a, b)) return true
  if (isMajorRoad(a) || isMajorRoad(b)) return gap <= 1.2
  if (a.highway && b.highway && a.highway === b.highway) return gap <= 3.2
  return gap <= 2.4
}

function markParallelMergeAt(runs: Run[], run: Run, point: number, x: number, z: number, dx: number, dz: number) {
  const len = Math.hypot(dx, dz) || 1
  const ux = dx / len
  const uz = dz / len
  const nx = -uz
  const nz = ux
  const cx = Math.floor(x / CELL)
  const cz = Math.floor(z / CELL)
  const seen = new Set<number>()

  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gz = cz - 1; gz <= cz + 1; gz++) {
      const list = cells.get(keyOf(gx, gz))
      if (!list) continue
      for (const seg of list) {
        if (seen.has(seg) || segRoad[seg] === run.road) continue
        seen.add(seg)

        const ax = segA[seg * 3]
        const az = segA[seg * 3 + 1]
        const bx = segB[seg * 3]
        const bz = segB[seg * 3 + 1]
        const ex = bx - ax
        const ez = bz - az
        const elen = Math.hypot(ex, ez) || 1
        if (Math.abs((ex * ux + ez * uz) / elen) < PARALLEL_DOT) continue

        let t = ((x - ax) * ex + (z - az) * ez) / (elen * elen)
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const closestX = ax + ex * t
        const closestZ = az + ez * t
        const side = (closestX - x) * nx + (closestZ - z) * nz
        const centerDistance = Math.hypot(x - closestX, z - closestZ)
        const gap = centerDistance - run.half - segHalf[seg]
        if (gap > ROADWAY.PARALLEL_MERGE_GAP) continue
        if (centerDistance < Math.min(run.half, segHalf[seg]) * 0.35) continue
        const other = runs[segRun[seg]]
        if (!other || !shouldMergeParallel(run, other, gap)) continue

        const extra = Math.min(
          ROADWAY.PARALLEL_MERGE_MAX_EXTRA,
          Math.max(ROADWAY.KERB_W + ROADWAY.SHOULDER_W, gap / 2 + ROADWAY.PARALLEL_MERGE_OVERLAP),
        )
        if (side >= 0) run.leftMerge[point] = Math.max(run.leftMerge[point], extra)
        else run.rightMerge[point] = Math.max(run.rightMerge[point], extra)
      }
    }
  }
}

/**
 * Une autre voie passe-t-elle sur ce point ? (c'est un carrefour)
 *
 * On ignore les voies quasi paralleles : une rue dedoublee dans OSM (deux sens
 * separes, contre-allee) n'est pas un carrefour, et lui supprimer ses bordures
 * sur toute sa longueur serait absurde. Au-dela de ~25 degres d'ecart, en revanche,
 * les deux chaussees se croisent vraiment.
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
 * C'est la contrepartie exacte de la géométrie affichée : bitume plat, marche de
 * bordure, trottoir plat, puis accotement qui redescend vers le terrain.
 *
 * ── La règle du trottoir, et pourquoi elle est écrite comme ça ──────────────
 * Le trottoir affiché est un POLYGONE, calculé hors-jeu par soustraction :
 * réseau élargi − chaussée − bâtiments. On ne peut pas rejouer une soustraction de
 * polygones à chaque image, mais on n'en a pas besoin — la même règle s'exprime en
 * distances :
 *
 *   - dans la dalle de bitume (`experimentalSurfaceHeightAt`) → on est sur la
 *     chaussée, on sort tout de suite. C'est le terme « − chaussée » ;
 *   - sinon, en deçà de `walkOuterReach(half)` d'un axe → on est sur le trottoir.
 *     C'est le terme « réseau élargi » ;
 *   - le terme « − bâtiments » n'a pas d'équivalent ici, et c'est voulu : un
 *     bâtiment est déjà un volume plein, on ne peut pas marcher dedans.
 *
 * ⚠️ Il n'y a plus de cas particulier « carrefour ». C'en était un avant, parce que
 * les rubans par rue se chevauchaient ; le polygone fusionné rend le coin juste par
 * construction, et la physique doit dire la même chose — sinon le joueur retombe au
 * niveau du bitume sur des coins où le trottoir est bien dessiné.
 */
export function roadwayHeightAt(x: number, z: number): number {
  if (!ensureBuilt()) return -Infinity
  const experimentalTop = experimentalSurfaceHeightAt(x, z)
  if (experimentalTop !== -Infinity) return experimentalTop
  const walkTop = experimentalWalkHeightAt(x, z)
  if (walkTop !== -Infinity) return walkTop
  const list = cells.get(keyOf(Math.floor(x / CELL), Math.floor(z / CELL)))
  if (!list) return -Infinity

  let best = -Infinity
  for (const i of list) {
    // Sous les dalles, tout a déjà été dit par les deux tests ci-dessus.
    if (segPaved[i]) continue
    const ax = segA[i * 3]
    const az = segA[i * 3 + 1]
    const ex = segB[i * 3] - ax
    const ez = segB[i * 3 + 1] - az
    const elen = Math.hypot(ex, ez) || 1

    let t = ((x - ax) * ex + (z - az) * ez) / (elen * elen)
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const d = Math.hypot(x - (ax + ex * t), z - (az + ez * t))

    const half = segHalf[i]
    const maxMergedReach = half + Math.max(segLeftMerge[i], segRightMerge[i])
    const walkOut = walkOuterReach(half)
    if (d > Math.max(walkOut + ROADWAY.SHOULDER_W, maxMergedReach)) continue

    // Altitude du dessus du bitume, interpolée le long du segment.
    const top = segA[i * 3 + 2] + (segB[i * 3 + 2] - segA[i * 3 + 2]) * t

    const nx = -ez / elen
    const nz = ex / elen
    const signedSide = (x - (ax + ex * t)) * nx + (z - (az + ez * t)) * nz
    const mergeExtra = signedSide >= 0 ? segLeftMerge[i] : segRightMerge[i]

    let y: number
    if (d <= half || (mergeExtra > 0 && d <= half + mergeExtra)) {
      y = top
    } else if (d <= walkOut) {
      y = top + ROADWAY.KERB_H // bordure ou trottoir : même niveau
    } else {
      // Accotement : on redescend en pente vers le terrain naturel. Il n'est plus
      // dessiné que par les rubans (bandes 0 et 6 de `Roads.tsx`), mais il reste
      // indispensable ici : sans lui, le bord du trottoir serait une marche franche
      // de ~30 cm, et une marche dans une fonction de hauteur fait sauter les
      // véhicules qui la franchissent.
      const u = Math.min(1, (d - walkOut) / ROADWAY.SHOULDER_W)
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
/** Altitude du bitume uniquement, sans bordure ni accotement. */
export function drivableRoadHeightAt(x: number, z: number): number {
  if (!ensureBuilt()) return -Infinity
  const experimentalTop = experimentalSurfaceHeightAt(x, z)
  if (experimentalTop !== -Infinity) return experimentalTop
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
    const closestX = ax + ex * t
    const closestZ = az + ez * t
    const d = Math.hypot(x - closestX, z - closestZ)
    const half = segHalf[i]
    const nx = -ez / elen
    const nz = ex / elen
    const signedSide = (x - closestX) * nx + (z - closestZ) * nz
    const mergeExtra = signedSide >= 0 ? segLeftMerge[i] : segRightMerge[i]
    if (d > half + mergeExtra) continue

    const top = segA[i * 3 + 2] + (segB[i * 3 + 2] - segA[i * 3 + 2]) * t
    if (top > best) best = top
  }
  return best
}

/**
 * 🚗 Surface physique pour les véhicules : l'assiette moyenne sous les roues.
 *
 * ⚠️ Chaque point de contact pèse PAREIL, qu'il trouve du bitume ou non — un
 * point qui sort de la chaussée retombe sur le terrain nu au lieu de DISPARAÎTRE
 * de la moyenne. C'est le point important : avant, on ne comptait que les points
 * posés sur du bitume, donc le diviseur changeait dès qu'une roue quittait la
 * route (5 échantillons puis 4…) et la hauteur SAUTAIT d'un coup. Le lissage
 * derrière rattrapait ensuite le saut sur plusieurs images : c'est ce qui faisait
 * "flotter" la voiture en bord de route, et ce que la caméra donnait à voir.
 */
export function vehicleGroundHeight(x: number, z: number, offsets: GroundSampleOffset[] = []): number {
  let sum = 0
  let count = 0

  const sample = (sx: number, sz: number) => {
    const road = drivableRoadHeightAt(sx, sz)
    sum += road !== -Infinity ? road : terrainHeight(sx, sz)
    count++
  }

  sample(x, z)
  for (const offset of offsets) sample(x + offset.x, z + offset.z)

  return sum / count
}

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
