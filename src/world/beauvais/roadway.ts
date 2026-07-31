import { ROADS, CITY_GENERATED_AT, terrainHeight, type Road, type RoadClass } from './cityData'
import { isBlocked, forEachWallNear } from './collision'
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
   * Jusqu'ici la seule partie PLATE au bord de la chaussée était le dessus de la
   * bordure : 35 cm. Les 80 cm de `SHOULDER_W` sont une pente en terre qui
   * rattrape le terrain, pas un trottoir. Autrement dit, Beauvais n'avait
   * pratiquement pas de trottoir — et comme la sensation d'une ville tient au
   * rapport largeur de rue / hauteur de façade, les rues paraissaient étranglées
   * même quand leur bitume était à la bonne largeur.
   *
   * On mesure donc, en chaque point et de chaque côté, la distance réelle
   * jusqu'à la façade la plus proche, et on remplit l'espace disponible.
   *
   * ⚠️ Ça ne marche QUE parce que routes et bâtiments viennent maintenant du
   * même référentiel IGN. Avec les routes OSM décalées de 1 à 5 m, cette mesure
   * aurait donné des trottoirs de 6 m d'un côté et 0 de l'autre.
   */
  /** En dessous, on ne pose pas de trottoir : juste la bordure, comme avant. */
  WALK_MIN: 0.35,
  /**
   * ⚠️ Un trottoir a une largeur VOULUE, il ne remplit pas l'espace disponible.
   *
   * Première version : « on prend tout jusqu'à 4 m ». Résultat, dès qu'une
   * façade était un peu loin (carrefour, place, recul d'immeuble) chaque voie
   * posait 4 m de chaque côté, et les voies convergentes fusionnaient en grandes
   * plaques grises informes. Une vraie ville fait l'inverse : le trottoir a une
   * largeur de projet, et il ne RÉTRÉCIT que si la façade est trop proche.
   *
   * La largeur voulue suit le rang de la voie — une avenue a de vrais trottoirs,
   * une ruelle non.
   */
  WALK_TARGET_RATIO: 0.7, // × la demi-chaussée
  WALK_TARGET_MIN: 1.2,
  WALK_TARGET_MAX: 3,
  /**
   * Portée du sondage de façade (m).
   *
   * Volontairement plus large que le trottoir maximal : au-delà de
   * `WALK_TARGET_MAX` la largeur est plafonnée de toute façon, mais TOUCHER une
   * façade reste l'information utile — ça distingue « rue large » de « pas de
   * rue du tout ».
   *
   * Testé : réduire cette portée à la stricte largeur utile (~8 m) ne gagne rien
   * en temps de construction et fait retomber 18 % du centre-ville sur la valeur
   * par défaut au lieu de 11 %. Le coût est ailleurs (le balayage des murs), pas
   * dans le rayon.
   */
  WALK_PROBE: 16,
  /** Espace laissé libre au pied de la façade : on ne colle pas au mur. */
  WALK_GAP: 0.4,
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
  /** Largeur du trottoir gauche (m), mesurée jusqu'à la façade. */
  leftWalk: Float32Array
  /** Largeur du trottoir droit (m), mesurée jusqu'à la façade. */
  rightWalk: Float32Array
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
/**
 * Largeur de trottoir par segment — la contrepartie PHYSIQUE de ce que dessine
 * `Roads.tsx`. Sans elle, le joueur marcherait dans le vide au-delà de 35 cm du
 * bitume : c'est la règle « ce qu'on voit = ce qu'on touche » de ce module.
 */
let segLeftWalk = new Float32Array(0)
let segRightWalk = new Float32Array(0)
let segRun = new Int32Array(0)
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

function experimentalSurfacePolygonsNear(x: number, z: number): number[][][][] {
  if (!EXPERIMENTAL_SURFACE_TILES) return LEGACY_EXPERIMENTAL_SURFACE_POLYGONS

  const tx = Math.floor(x / EXPERIMENTAL_SURFACE_TILE_SIZE)
  const tz = Math.floor(z / EXPERIMENTAL_SURFACE_TILE_SIZE)
  const polygons: number[][][][] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const tile = EXPERIMENTAL_SURFACE_TILES[tx + dx + ':' + (tz + dz)]
      if (tile) polygons.push(...tile.polygons)
    }
  }
  return polygons
}

function insideExperimentalSurface(x: number, z: number): boolean {
  if (!EXPERIMENTAL_SURFACE_TILES) {
    const dx = x - ROAD_SURFACE_TEST.center.x
    const dz = z - ROAD_SURFACE_TEST.center.z
    if (Math.hypot(dx, dz) > ROAD_SURFACE_TEST.radius + 8) return false
  }

  for (const poly of experimentalSurfacePolygonsNear(x, z)) {
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
 * Distance aux façades de part et d'autre de (x, z), le long de la normale.
 *
 * On lance une vraie DROITE perpendiculaire plutôt que de chercher le bâtiment
 * le plus proche : ce qu'on veut est la largeur du COULOIR de rue en travers,
 * pas la distance à un pignon situé derrière nous.
 *
 * Les deux côtés sont résolus en UNE seule passe : c'est la même droite, seul le
 * signe de `t` change. Balayer deux fois les murs voisins doublait le temps de
 * construction pour rien (2,2 s → 1,1 s sur toute la commune).
 *
 * `out` reçoit [gauche, droite], `Infinity` si rien n'est touché dans la portée
 * — cas normal en périphérie, où l'appelant pose alors la largeur voulue sans
 * contrainte.
 */
function facadeDistances(
  x: number,
  z: number,
  dx: number,
  dz: number,
  probe: number,
  out: [number, number],
): void {
  // (`probe` reste un paramètre : c'est le seul réglage qu'on ait eu besoin de
  // faire varier pour arbitrer qualité/temps, et le garder explicite évite de
  // refaire l'expérience à l'aveugle.)
  let pos = Infinity
  let neg = Infinity

  forEachWallNear(x, z, probe, (ax, az, bx, bz) => {
    // Intersection droite / segment, résolue par déterminant. `denom` nul = mur
    // parallèle à la droite : il ne borne aucun des deux côtés.
    const ex = bx - ax
    const ez = bz - az
    const denom = dx * ez - dz * ex
    if (denom === 0) return

    const px = ax - x
    const pz = az - z
    const t = (px * ez - pz * ex) / denom // distance signée le long de la droite
    const abs = t < 0 ? -t : t
    if (abs >= (t >= 0 ? pos : neg)) return

    const u = (px * dz - pz * dx) / -denom // position sur le mur, 0..1
    if (u < 0 || u > 1) return

    if (t >= 0) pos = abs
    else neg = abs
  })

  out[0] = pos
  out[1] = neg
}

/**
 * Largeur de trottoir VOULUE pour une voie, avant contrainte par les façades.
 *
 * Proportionnelle au rang de la voie : une avenue mérite de vrais trottoirs, une
 * ruelle non. C'est cette largeur qu'on obtient partout où la place existe.
 */
function walkTarget(half: number): number {
  const wanted = half * ROADWAY.WALK_TARGET_RATIO
  if (wanted < ROADWAY.WALK_TARGET_MIN) return ROADWAY.WALK_TARGET_MIN
  if (wanted > ROADWAY.WALK_TARGET_MAX) return ROADWAY.WALK_TARGET_MAX
  return wanted
}

/**
 * Largeur de trottoir retenue : la largeur voulue, rabotée si la façade est trop
 * proche.
 *
 * `reachOut` = demi-chaussée + bordure : c'est là que commence le trottoir.
 * `hit` infini = aucune façade en vue → rien ne contraint, on pose la largeur
 * voulue.
 */
function walkWidthFrom(hit: number, reachOut: number, target: number): number {
  if (!Number.isFinite(hit)) return target

  const free = hit - reachOut - ROADWAY.WALK_GAP
  if (free <= ROADWAY.WALK_MIN) return ROADWAY.WALK_MIN
  return Math.min(free, target)
}

/**
 * Lisse les largeurs de trottoir le long de la voie.
 *
 * Sans ça, un simple décrochement de façade (un porche, un recul d'immeuble)
 * ferait un trottoir en dents de scie. Une vraie ville a des trottoirs qui
 * s'élargissent progressivement.
 */
function smoothWalk(values: Float32Array, passes = 2): void {
  if (values.length < 3) return
  const tmp = new Float32Array(values.length)
  for (let p = 0; p < passes; p++) {
    tmp[0] = values[0]
    tmp[values.length - 1] = values[values.length - 1]
    for (let i = 1; i < values.length - 1; i++) {
      tmp[i] = (values[i - 1] + values[i] * 2 + values[i + 1]) / 4
    }
    values.set(tmp)
  }
}

/**
 * Mesure le trottoir de chaque côté, tout le long d'un axe densifié.
 *
 * La normale est prise sur le segment courant : deux points voisins suffisent à
 * l'orienter, et on la réutilise pour les deux côtés (gauche = +, droite = −).
 */
function measureWalks(dense: number[][], half: number): { leftWalk: Float32Array; rightWalk: Float32Array } {
  const n = dense.length
  const leftWalk = new Float32Array(n)
  const rightWalk = new Float32Array(n)
  const reachOut = half + ROADWAY.KERB_W
  const target = walkTarget(half)
  const hits: [number, number] = [0, 0]

  for (let i = 0; i < n; i++) {
    const a = dense[Math.max(0, i - 1)]
    const b = dense[Math.min(n - 1, i + 1)]
    let dx = b[0] - a[0]
    let dz = b[1] - a[1]
    const len = Math.hypot(dx, dz) || 1
    dx /= len
    dz /= len

    const [x, z] = dense[i]
    facadeDistances(x, z, -dz, dx, ROADWAY.WALK_PROBE, hits)
    leftWalk[i] = walkWidthFrom(hits[0], reachOut, target)
    rightWalk[i] = walkWidthFrom(hits[1], reachOut, target)
  }

  smoothWalk(leftWalk)
  smoothWalk(rightWalk)
  return { leftWalk, rightWalk }
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
  /** Largeur du trottoir de chaque cote (m). Rempli juste apres la densification. */
  leftWalk: Float32Array
  rightWalk: Float32Array
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
        ...measureWalks(dense, half),
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
  segLeftWalk = new Float32Array(total)
  segRightWalk = new Float32Array(total)
  segRun = new Int32Array(total)
  segRoad = new Int32Array(total)
  segJunction = new Uint8Array(total)
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
      // Moyenne des deux extrémités : le trottoir varie continûment le long du
      // segment, alors que la fusion de chaussée est un « au moins l'un des deux ».
      segLeftWalk[s + i] = (run.leftWalk[i] + run.leftWalk[i + 1]) / 2
      segRightWalk[s + i] = (run.rightWalk[i] + run.rightWalk[i + 1]) / 2
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
    leftWalk: run.leftWalk.slice(from, to + 1),
    rightWalk: run.rightWalk.slice(from, to + 1),
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
 * C'est la contrepartie exacte de la géométrie construite par `Roads.tsx` :
 * bitume plat, marche de bordure, puis accotement qui redescend vers le terrain.
 * Aux carrefours (pas de bordure), seule la surface du bitume compte.
 */
export function roadwayHeightAt(x: number, z: number): number {
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
    const d = Math.hypot(x - (ax + ex * t), z - (az + ez * t))

    const half = segHalf[i]
    const maxMergedReach = half + Math.max(segLeftMerge[i], segRightMerge[i])
    const maxWalkReach = reach(half) + Math.max(segLeftWalk[i], segRightWalk[i])
    if (d > Math.max(maxWalkReach, maxMergedReach)) continue

    // Altitude du dessus du bitume, interpolée le long du segment.
    const top = segA[i * 3 + 2] + (segB[i * 3 + 2] - segA[i * 3 + 2]) * t

    const nx = -ez / elen
    const nz = ex / elen
    const signedSide = (x - (ax + ex * t)) * nx + (z - (az + ez * t)) * nz
    const mergeExtra = signedSide >= 0 ? segLeftMerge[i] : segRightMerge[i]

    let y: number
    if (d <= half || (mergeExtra > 0 && d <= half + mergeExtra)) {
      y = top
    } else if (segJunction[i]) {
      continue // carrefour : ni bordure ni accotement, c'est la voie d'en face qui décide
    } else {
      // Le trottoir est PLAT, à la hauteur de la bordure : bordure + la largeur
      // mesurée jusqu'à la façade. Ces deux lignes doivent rester le miroir
      // exact de `section()` dans `Roads.tsx`, sinon on remarche dans le vide.
      const walk = signedSide >= 0 ? segLeftWalk[i] : segRightWalk[i]
      const walkOut = half + ROADWAY.KERB_W + walk

      if (d <= walkOut) {
        y = top + ROADWAY.KERB_H // bordure ou trottoir : même niveau
      } else {
        // Accotement : on redescend en pente vers le terrain naturel.
        const u = Math.min(1, (d - walkOut) / ROADWAY.SHOULDER_W)
        y = (top + ROADWAY.KERB_H) * (1 - u) + terrainHeight(x, z) * u
      }
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
