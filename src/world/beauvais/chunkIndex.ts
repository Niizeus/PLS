import chunk from './data/chunks/centre-ville.json'
import type { Building } from './cityData'

/**
 * 📦 chunkIndex.ts — quel bâtiment appartient à un chunk classé, et à quelle famille.
 *
 * Le jeu ne charge PAS le gros fichier de travail du lot 2 (plusieurs Mo d'emprises,
 * d'indices et de mesures) : il n'en a pas besoin, il a déjà les emprises dans
 * `beauvais-buildings.json`. Il charge l'index publié — 66 Ko — qui dit seulement,
 * pour chaque position : « famille, nombre d'étages ».
 *
 * La jointure se fait sur le CENTROÏDE arrondi au décimètre. Les deux fichiers
 * dérivent des mêmes emprises, donc la clé tombe juste — et si un jour elle ne
 * tombait plus, le bâtiment retomberait simplement sur l'ancien rendu au lieu de
 * disparaître. C'est le comportement qu'on veut : une donnée manquante dégrade,
 * elle ne casse pas.
 *
 * Voir `docs/08-CHUNKFORGE.md`.
 */

interface ChunkFichier {
  chunk: string
  box: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** clé positionnelle → `[archetype, étages, idRue]` (0 = inconnu) */
  index: Record<string, (string | number)[]>
}

// TypeScript infère du JSON un type littéral énorme (une propriété par bâtiment) :
// on passe par `unknown` pour lui donner la forme utile, qui est la même pour tous.
const DONNEES = chunk as unknown as ChunkFichier

export const CHUNK_BOX = DONNEES.box
export const CHUNK_NOM = DONNEES.chunk

const cle = (cx: number, cz: number) => `${Math.round(cx * 10)}:${Math.round(cz * 10)}`

export interface ChunkInfo {
  archetype: string
  etages?: number
  /** Identifiant de la rue : donne sa teinte commune à toute une voie. */
  rue?: number
}

/**
 * La famille d'un bâtiment, ou `null` s'il n'appartient à aucun chunk publié.
 *
 * `null` veut dire « rends-le à l'ancienne » : hors du centre-ville, et pour les
 * monuments (exclus de l'index parce qu'ils auront leur modèle fait main au lot 6).
 */
export function chunkInfo(b: Building): ChunkInfo | null {
  const entree = DONNEES.index[cle(b.cx, b.cz)]
  if (!entree || typeof entree[0] !== 'string') return null
  // `etages = 0` veut dire « l'IGN ne le dit pas » : on laisse le générateur le
  // déduire de la hauteur plutôt que de lui imposer un bâtiment sans étage.
  const etages = typeof entree[1] === 'number' && entree[1] > 0 ? entree[1] : undefined
  return {
    archetype: entree[0],
    etages,
    rue: typeof entree[2] === 'number' ? entree[2] : undefined,
  }
}

/** Le bâtiment est-il dans l'emprise d'un chunk publié ? */
export function dansChunk(cx: number, cz: number) {
  return cx >= CHUNK_BOX.minX && cx <= CHUNK_BOX.maxX && cz >= CHUNK_BOX.minZ && cz <= CHUNK_BOX.maxZ
}
