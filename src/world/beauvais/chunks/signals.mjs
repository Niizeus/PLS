// @ts-nocheck
/**
 * ⚖️  signals.mjs — quels indices on écoute, et à quel point.
 *
 * Le classement d'un bâtiment ne repose sur AUCUNE source unique : on l'a mesuré au
 * lot 1, le meilleur attribut disponible (`usage_1`) n'est exploitable que sur 59 %
 * de la zone. Il faut donc un FAISCEAU d'indices, chacun avec son poids.
 *
 * Ce fichier contient trois choses, et rien d'autre :
 *   1. comment LIRE chaque signal dans un passeport ;
 *   2. combien il PÈSE ;
 *   3. comment mesurer l'ACCORD entre la valeur réelle et ce qu'un archétype attend.
 *
 * Les attentes, elles, sont dans `archetypes.json`. Les règles de décision (seuils,
 * signaux exclusifs, confiance) sont dans `classify.mjs`. Trois fichiers, trois rôles.
 *
 * ▶️  Pour régler le classifieur, c'est ici qu'on touche aux poids — un seul endroit.
 */

/**
 * Poids de chaque signal. Calibrés sur les taux de remplissage RÉELS mesurés au
 * lot 1 (voir `docs/08-CHUNKFORGE.md`), pas sur ce qu'on espérait.
 *
 * Principe : un signal pèse lourd s'il est à la fois DISCRIMINANT et FIABLE.
 * Sa rareté ne le pénalise pas — un signal absent ne vote simplement pas.
 */
export const WEIGHTS = {
  // ── Attributs IGN : très parlants, mais lacunaires ────────────────────────
  usage1: 3.0, // 59 % utile (« Indifférencié » compte comme absent)
  annee: 3.0, // 44 % — le meilleur séparateur d'époque quand il est là
  etages: 2.5, // 55 %
  logements: 2.0, // 55 % — sépare maison et collectif d'un seul chiffre
  usage2: 1.5, // 21 %
  murMat: 1.0, // 19 %
  nature: 1.5, // 2 % — rare, mais voir les règles exclusives de classify.mjs

  // ── OSM : les contours sont nus, les POI portent tout ─────────────────────
  poiCommerce: 2.5, // preuve directe d'un rez-de-chaussée commercial
  poiPublic: 2.5, // école, mairie, équipement
  osmBuilding: 0.5, // 99 % de « yes » : quasi muet, gardé pour les 1 % qui parlent
  osmHistoric: 2.5, // rare mais décisif
  osmName: 0.5, // un bâtiment nommé est rarement un pavillon

  // ── Mesuré : les seuls signaux présents partout ───────────────────────────
  h: 1.5,
  rm: 0.8, // 30 %
  pitch: 1.0, // 83 %

  // ── Géométrie : 100 % de couverture, donc la colonne vertébrale ───────────
  area: 1.5,
  width: 1.0,
  elongation: 0.8,
  compactness: 0.5,
  orthogonality: 0.5,
  vertices: 0.3,

  // ── Contexte ─────────────────────────────────────────────────────────────
  sharedRatio: 2.0, // mitoyenneté : sépare le tissu ancien du pavillonnaire
  roadDist: 0.8,
  roadClass: 0.8,
  builtRatio50: 0.6,
  zone: 0.5,

  // ── Signaux exclusifs (traités à part dans classify.mjs) ──────────────────
  legere: 2.0,
}

/**
 * ⚠️ `usage_1 = Indifférencié` couvre 35 % de la zone. Ce n'est pas une catégorie,
 * c'est un « on ne sait pas ». Le traiter comme une valeur ferait voter un signal
 * vide — et gonflerait artificiellement la confiance. On le lit comme ABSENT.
 */
const VIDE = new Set(['Indifférencié', 'Indifférenciée', 'Indéterminé'])

/** Comment aller chercher chaque signal dans un passeport. `null` = absent. */
export const READERS = {
  usage1: (p) => (VIDE.has(p.ign?.usage1) ? null : p.ign?.usage1 ?? null),
  usage2: (p) => (VIDE.has(p.ign?.usage2) ? null : p.ign?.usage2 ?? null),
  annee: (p) => p.ign?.annee ?? null,
  etages: (p) => p.ign?.etages ?? null,
  logements: (p) => p.ign?.logements ?? null,
  murMat: (p) => p.ign?.murMat ?? null,
  nature: (p) => p.ign?.nature ?? null,
  legere: (p) => (p.ign?.legere ? 'true' : null),

  // Un POI de commerce/artisanat contenu dans l'emprise.
  poiCommerce: (p) =>
    p.osm?.pois?.some((x) => ['shop', 'craft'].includes(x.k) || COMMERCE_AMENITY.has(x.v))
      ? 'true'
      : p.osm?.pois
        ? 'false'
        : null,
  poiPublic: (p) => (p.osm?.pois?.some((x) => PUBLIC_AMENITY.has(x.v)) ? 'true' : null),
  osmBuilding: (p) => p.osm?.building ?? null,
  osmHistoric: (p) => (p.osm?.historic || p.osm?.heritage ? 'true' : null),
  osmName: (p) => (p.osm?.name ? 'true' : null),

  h: (p) => p.h ?? null,
  rm: (p) => p.rm ?? null,
  pitch: (p) => p.pitch ?? null,

  area: (p) => p.geom?.area ?? null,
  width: (p) => p.geom?.width ?? null,
  elongation: (p) => p.geom?.elongation ?? null,
  compactness: (p) => p.geom?.compactness ?? null,
  orthogonality: (p) => p.geom?.orthogonality ?? null,
  vertices: (p) => p.geom?.vertices ?? null,

  sharedRatio: (p) => p.ctx?.sharedRatio ?? null,
  roadDist: (p) => p.ctx?.roadDist ?? null,
  roadClass: (p) => p.ctx?.roadClass ?? null,
  builtRatio50: (p) => p.ctx?.builtRatio50 ?? null,
  zone: (p) => p.ctx?.zone ?? null,
}

/** `amenity` qui valent un commerce (le reste des amenity est public ou neutre). */
const COMMERCE_AMENITY = new Set([
  'restaurant', 'bar', 'cafe', 'fast_food', 'pub', 'bank', 'pharmacy',
  'bureau_de_change', 'nightclub', 'ice_cream', 'internet_cafe', 'fuel',
])

/** `amenity` qui trahissent un équipement public. */
const PUBLIC_AMENITY = new Set([
  'school', 'college', 'university', 'kindergarten', 'townhall', 'police',
  'fire_station', 'hospital', 'clinic', 'library', 'courthouse', 'public_building',
  'community_centre', 'theatre', 'post_office', 'prison',
])

/**
 * Accord d'une valeur NUMÉRIQUE avec un intervalle attendu.
 *
 * Dedans → +1. Puis on décroît linéairement sur une marge de tolérance, jusqu'à -1.
 * La décroissance douce est importante : un bâtiment de 1963 n'est pas « pas du tout »
 * de la Reconstruction, il est juste un peu tard. Un mur net produirait des sauts de
 * classement absurdes de part et d'autre d'une borne arbitraire.
 */
function accordNumeric(v, spec) {
  const [min, max] = spec.range
  const soft = spec.soft ?? Math.max((max - min) * 0.3, 1e-6)
  if (v >= min && v <= max) return 1
  const d = v < min ? min - v : v - max
  return Math.max(-1, 1 - (2 * d) / soft)
}

/** Accord d'une valeur CATÉGORIELLE : lu dans le tableau, 0 si non listée. */
function accordCategory(v, spec) {
  const key = String(v)
  if (key in spec) return spec[key]
  if ('_else' in spec) return spec._else
  return 0 // valeur inconnue de l'archétype : pas d'information, pas de pénalité
}

/**
 * Un archétype a-t-il le DROIT de concourir pour ce bâtiment ?
 *
 * ⚠️ Correctif majeur du lot 2. Sans ce filtre, un archétype dont les signaux
 * définissants sont absents du bâtiment ne vote que sur ses signaux secondaires —
 * et devient donc PLUS FACILE à satisfaire qu'un archétype bien renseigné.
 * Mesuré : `pan-de-bois` remportait 232 bâtiments (il devrait y en avoir ~27),
 * `monument` 41 et `religieux` 36, en gagnant sur la seule forme, sans la moindre
 * preuve d'ancienneté ni de statut.
 *
 * La règle correspond à la façon dont un humain raisonne : on ne décrète pas
 * « maison à pan de bois » sans le moindre indice que le bâtiment soit ancien.
 *
 * `requires` liste des signaux dont AU MOINS UN doit être présent ET en accord.
 */
const REQ_ACCORD = 0.5

export function meetsRequirements(passport, archetype) {
  const req = archetype.requires
  if (!req || !req.length) return true
  for (const signal of req) {
    const read = READERS[signal]
    if (!read) continue
    const v = read(passport)
    if (v == null) continue
    const spec = archetype.expects?.[signal]
    if (!spec) return true // exigé mais sans attente chiffrée : la présence suffit
    const accord = spec.range ? accordNumeric(v, spec) : accordCategory(v, spec)
    if (accord >= REQ_ACCORD) return true
  }
  return false
}

/**
 * Confronte un passeport à UN archétype.
 *
 * Renvoie un accord moyen pondéré, dans [-1, +1], et la liste des indices qui ont
 * voté. On divise par le poids RÉELLEMENT engagé (et non par le total possible) :
 * sans ça, un archétype qui décrit beaucoup de champs serait systématiquement
 * désavantagé face à un archétype vague, dès qu'un bâtiment est mal renseigné.
 */
export function evaluate(passport, archetype) {
  let sum = 0
  let engaged = 0
  const evidence = []

  for (const [signal, spec] of Object.entries(archetype.expects ?? {})) {
    const read = READERS[signal]
    const w = WEIGHTS[signal]
    if (!read || !w) continue // signal inconnu : on l'ignore plutôt que de planter
    const v = read(passport)
    if (v == null) continue // absent du bâtiment : ne vote pas

    const accord = spec.range ? accordNumeric(v, spec) : accordCategory(v, spec)
    sum += w * accord
    engaged += w
    if (Math.abs(accord) >= 0.25) {
      const sign = accord > 0 ? '+' : ''
      evidence.push({
        signal,
        value: v,
        accord: Math.round(accord * 100) / 100,
        contrib: Math.round(w * accord * 100) / 100,
        text: `${signal}=${v} (${sign}${(w * accord).toFixed(1)})`,
      })
    }
  }

  if (engaged === 0) return { accord: 0, engaged: 0, evidence: [] }
  evidence.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib))
  return { accord: sum / engaged, engaged, evidence }
}
