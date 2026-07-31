import rawData from './data/beauvais-buildings.json'
import { sampleHeight } from './terrain'

/**
 * 🗃️  Source unique des données de Beauvais (chargée une seule fois, en synchrone).
 *
 * Ce module lit le fichier compact généré depuis OpenStreetMap et le rend
 * exploitable partout :
 *  - la ville 3D (Beauvais.tsx) extrude les bâtiments en blocs,
 *  - les routes (Roads.tsx) tracent les voies à plat,
 *  - les collisions (collision.ts) empêchent d'entrer dans les bâtiments,
 *  - la minimap et la carte (ui/) dessinent tout ça vu du dessus.
 * Tout le monde importe d'ICI → pas de duplication, pas de divergence.
 *
 * ⚠️ La hauteur du sol ne vit PAS ici : elle vient de `terrain.ts` (relief LiDAR
 * de l'IGN). Ce module se contente de la ré-exporter via `terrainHeight()`, qui
 * reste le point de passage unique de tout le jeu.
 */

/**
 * Un bâtiment, avec son contour projeté en mètres [x, z] et son centre.
 *
 * Les hauteurs viennent de la **BD TOPO de l'IGN** (mesurées, pas devinées) :
 * voir `bdtopo.mjs`. Le toit est décrit par deux nombres seulement — sa hauteur
 * et son orientation — et c'est `Beauvais.tsx` qui en construit la géométrie.
 * Stocker les triangles dans le JSON l'aurait fait tripler de volume.
 */
export interface Building {
  /** Hauteur des MURS, du sol à la gouttière (m). */
  h: number
  pts: number[][]
  /** Monument (cathedral / church / chapel) → look légèrement distinct. */
  kind?: string
  /** Hauteur du toit, de la gouttière au faîtage (m). Absent = toit plat. */
  rh?: number
  /** Orientation du faîtage, en radians. Absent = toit plat. */
  ra?: number
  /** Matériau de toiture : 't' tuile, 'a' ardoise, 'z' zinc, 'b' béton. */
  rm?: string
  /** 1 si la hauteur est mesurée par l'IGN ; absent si elle reste estimée. */
  bdtopo?: number
  cx: number
  cz: number
}

/** Un espace vert : contour [x, z] ; `wood` = boisé (on y sème des arbres). */
export interface Green {
  pts: number[][]
  wood?: number
}

/**
 * Classe d'usage d'une voie — l'information qu'une largeur seule ne porte pas.
 *
 * Une rue piétonne et une rue de quartier peuvent faire la même largeur : ce qui
 * les sépare, c'est l'accès, pas les mètres. Le champ vient directement de
 * `acces_vehicule_leger` / `nature` de l'IGN (voir `bdtopoRoads.mjs`).
 */
export type RoadClass = 'drivable' | 'pedestrian' | 'service' | 'track'

/** Une route : largeur (m), polyligne [x, z] et metadonnees utiles au rendu. */
export interface Road {
  w: number
  pts: number[][]
  /** `cleabs` IGN (chaîne) — ou identifiant OSM (nombre) sur les données de repli. */
  id?: string | number
  cls?: RoadClass
  /** `true` en tissu urbain → trottoir plutôt qu'accotement. */
  urban?: boolean
  highway?: string
  name?: string
  ref?: string
  lanes?: number
  oneway?: boolean
  service?: string
  junction?: string
  bridge?: boolean
  tunnel?: boolean
  layer?: number
}

/** Un plan d'eau : contour [x, z]. */
export interface Water {
  pts: number[][]
}

/** L'emprise totale de la ville, en mètres monde. */
export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

interface RawCity {
  /** Horodatage du build : sert d'empreinte aux fichiers dérivés de celui-ci. */
  generatedAt?: string
  origin: { lat: number; lon: number }
  bounds: Bounds
  buildings: {
    h: number
    pts: number[][]
    kind?: string
    rh?: number
    ra?: number
    rm?: string
    bdtopo?: number
  }[]
  roads: Road[]
  waters: { pts: number[][] }[]
  greens: { pts: number[][]; wood?: number }[]
  trees: number[][]
  lamps: number[][]
}

const data = rawData as unknown as RawCity

export const ORIGIN = data.origin
export const BOUNDS: Bounds = data.bounds
export const ROADS: Road[] = data.roads ?? []
/** Horodatage du build de la ville — sert à repérer une donnée dérivée périmée. */
export const CITY_GENERATED_AT: string | null = data.generatedAt ?? null
export const WATERS: Water[] = data.waters ?? []
export const GREENS: Green[] = data.greens ?? []
export const TREES: number[][] = data.trees ?? []
export const LAMPS: number[][] = data.lamps ?? []

// On calcule le centre de chaque bâtiment une fois pour toutes.
export const BUILDINGS: Building[] = data.buildings.map((b) => {
  let sx = 0
  let sz = 0
  for (const [x, z] of b.pts) {
    sx += x
    sz += z
  }
  const n = b.pts.length || 1
  return {
    h: b.h,
    pts: b.pts,
    kind: b.kind,
    rh: b.rh,
    ra: b.ra,
    rm: b.rm,
    bdtopo: b.bdtopo,
    cx: sx / n,
    cz: sz / n,
  }
})

/**
 * Altitude du sol au point monde (x, z), en mètres.
 *
 * 👉 C'EST LE POINT DE PASSAGE UNIQUE de la hauteur du sol dans tout le jeu :
 * le joueur, le scooter, les bâtiments, les routes, les arbres, les lampadaires
 * et les objets au sol passent tous par ici. Personne ne calcule sa hauteur
 * dans son coin — c'est ce qui garantit que rien ne flotte ni ne s'enfonce.
 *
 * Le relief réel (LiDAR HD de l'IGN) vit dans `terrain.ts`. Il est chargé UNE
 * fois avant tout affichage : cette fonction est donc figée pour toute la
 * partie. Tant que la carte n'est pas chargée (ou si elle échoue), elle renvoie
 * 0 et le monde est plat — voir l'avertissement en tête de `terrain.ts`.
 */
export function terrainHeight(x: number, z: number): number {
  return sampleHeight(x, z)
}

/** Test "le point (x,z) est-il à l'intérieur de ce contour ?" (lancer de rayon). */
export function pointInFootprint(x: number, z: number, pts: number[][]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]
    const [xj, zj] = pts[j]
    const crosses = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/**
 * Cherche un point de spawn DÉGAGÉ devant la cathédrale (à l'origine 0,0).
 *
 * On teste des points sur des anneaux autour de la cathédrale, on écarte ceux qui
 * tombent dans un bâtiment, et on garde celui qui est le PLUS OUVERT (le plus loin
 * du bâtiment le plus proche) : c'est typiquement le parvis, donc "devant".
 */
function findSpawn(): { x: number; z: number } {
  // Pré-filtre : seuls les bâtiments proches de l'origine peuvent gêner.
  const near = BUILDINGS.filter((b) => b.cx * b.cx + b.cz * b.cz < 200 * 200)

  let best = { x: 0, z: 0 }
  let bestOpenness = -1

  for (let r = 18; r <= 70; r += 3) {
    const steps = Math.round((2 * Math.PI * r) / 4)
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r

      // Distance au sommet de bâtiment le plus proche + test "dans un bâtiment ?".
      let nearest = Infinity
      let inside = false
      for (const b of near) {
        if ((x - b.cx) ** 2 + (z - b.cz) ** 2 > 3600) continue
        if (pointInFootprint(x, z, b.pts)) {
          inside = true
          break
        }
        for (const [px, pz] of b.pts) {
          const d2 = (x - px) ** 2 + (z - pz) ** 2
          if (d2 < nearest) nearest = d2
        }
      }
      if (inside) continue
      if (nearest > bestOpenness) {
        bestOpenness = nearest
        best = { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }
      }
    }
  }
  return best
}

/** Point où faire apparaître le joueur : dégagé, devant la cathédrale. */
export const SPAWN = findSpawn()
