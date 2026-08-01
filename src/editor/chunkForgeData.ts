/**
 * 🪪 chunkForgeData.ts — le contrat de données du module ChunkForge.
 *
 * Ce fichier ne fait que DÉCRIRE et CHARGER. Le dessin est dans `chunkForgeDraw.ts`,
 * l'interface dans `ChunkForge.tsx` — un fichier, une responsabilité.
 *
 * ⚠️ Ces types doivent rester en phase avec ce qu'écrivent les scripts hors-jeu
 * `chunks/collect-chunk.mjs` (lot 1) et `chunks/classify.mjs` (lot 2). Si un champ
 * change là-bas, il change ici. Voir `docs/08-CHUNKFORGE.md`.
 */

/** Un indice qui a voté pour l'archétype retenu, avec sa contribution chiffrée. */
export interface Evidence {
  signal: string
  value: string | number
  accord?: number
  contrib?: number | null
  text: string
}

/** Le passeport d'un bâtiment, tel que le lot 2 le laisse. */
export interface Passport {
  id: string
  cx: number
  cz: number
  seed: number
  pts: number[][]
  holes?: number[][][]
  h?: number
  rh?: number
  ra?: number
  rm?: string
  kind?: string
  pitch?: number

  geom: {
    area: number
    perimeter: number
    width: number
    length: number
    elongation: number | null
    compactness: number | null
    rectFill: number | null
    orthogonality: number | null
    vertices: number
  }
  ign: {
    usage1?: string
    usage2?: string
    annee?: number
    anneeInconnueAncien?: number
    etages?: number
    logements?: number
    murMat?: string
    toitMat?: string
    nature?: string
    legere?: number
  }
  osm: {
    building?: string
    name?: string
    addr?: string
    historic?: string
    pois?: { k: string; v: string; name?: string }[]
  }
  ctx: {
    sharedSides: number
    sharedLen: number
    sharedRatio: number
    neighbours50: number
    builtRatio50: number
    roadDist?: number
    roadClass?: string
    roadWidth?: number
    roadName?: string
    zone?: string
  }

  archetype: string
  confidence: number
  accord?: number
  evidence: Evidence[]
  runnerUp?: [string, number] | null
  impact: number
  /** Emprise aberrante : éclat de découpe OSM, à réparer plutôt qu'à classer. */
  suspect?: 'eclat' | 'micro'
  /** Tranché par une règle exclusive (église, monument…). */
  exclusive?: string
  /** Confiance plafonnée faute d'usage et de date. */
  capped?: number
  /** Proposé sans aucune preuve d'appartenance. */
  devine?: number
  /** Aligné sur le voisinage, ou confirmé par lui. */
  consensus?: 'confirme' | 'adopte'
  consensusVoisins?: number
  /** Déjà tranché à la main. */
  reviewed?: number
}

export interface ChunkFile {
  chunk: string
  box: { minX: number; maxX: number; minZ: number; maxZ: number }
  count: number
  classifiedAt?: string
  passports: Passport[]
}

/** Une famille de bâtiments, telle que l'humain doit la lire. */
export interface Famille {
  key: string
  /** Nom technique (code, doc). */
  name: string
  /** Nom sans ambiguïté, montré à l'écran. */
  label: string
  /** Le test de décision, en une phrase. */
  critere: string
  color: string
}

/**
 * Couleurs des familles.
 *
 * Choisies pour se distinguer À CÔTÉ les unes des autres sur le plan, pas pour être
 * jolies isolément : c'est un outil de lecture. Les familles proches par le sens
 * (les trois pavillons) partagent une teinte, avec des clartés différentes.
 */
const COLORS: Record<string, string> = {
  'maison-ville-brique': '#c96f4a',
  'immeuble-centre-commerce': '#e8b84b',
  'pan-de-bois': '#8d5a3b',
  'reconstruction-brique': '#d9534f',
  'pavillon-brique': '#7fa86b',
  'pavillon-crepi': '#a8c78e',
  'pavillon-recent': '#c8dfb4',
  dependance: '#5c6470',
  'petit-collectif': '#5b8db8',
  'grand-ensemble': '#3f6b96',
  hangar: '#8a7fa8',
  'commerce-peripherie': '#b58fc4',
  'equipement-public': '#4fae9c',
  religieux: '#d4a0c4',
  monument: '#f0e2a0',
  inconnu: '#3a3f4a',
}

export const COULEUR_INCONNU = COLORS.inconnu

/**
 * Charge le chunk classé et les familles.
 *
 * ⚠️ Import DYNAMIQUE : `centre-ville.classified.json` pèse plusieurs Mo. L'inclure
 * statiquement alourdirait le démarrage de l'éditeur entier alors que la plupart des
 * sessions n'ouvrent jamais ce module. On ne paie qu'en ouvrant l'onglet.
 */
export async function loadChunk(nom = 'centre-ville'): Promise<{
  chunk: ChunkFile
  familles: Famille[]
}> {
  const [chunkMod, archMod] = await Promise.all([
    import(`../world/beauvais/data/chunks/${nom}.classified.json`),
    import('../world/beauvais/chunks/archetypes.json'),
  ])
  const chunk = (chunkMod.default ?? chunkMod) as ChunkFile
  const arch = (archMod.default ?? archMod) as {
    archetypes: { key: string; name: string; label?: string; critere?: string }[]
  }

  const familles: Famille[] = arch.archetypes.map((a) => ({
    key: a.key,
    name: a.name,
    label: a.label ?? a.name,
    critere: a.critere ?? '',
    color: COLORS[a.key] ?? COULEUR_INCONNU,
  }))
  return { chunk, familles }
}

/** Seuils de confiance — les mêmes que `classify.mjs`. Un seul sens partout. */
export const SEUIL_SUR = 0.8
export const SEUIL_VALIDER = 0.55

export function couleurConfiance(c: number): string {
  if (c >= SEUIL_SUR) return '#6bbf6b'
  if (c >= SEUIL_VALIDER) return '#e8b84b'
  return '#e07b7b'
}
