import { forEachWallNear, isBlocked } from '../world/beauvais/collision'

/**
 * 🚧 COLLISIONS DE DÉPLACEMENT — cercle (piéton) et boîte orientée (véhicule).
 *
 * ## Pourquoi ce fichier a été refait
 *
 * L'ancienne version approximait le corps par une poignée de POINTS testés avec
 * `isBlocked()`. Deux défauts qui se voyaient en jeu :
 *
 *  1. **Des trous.** Les points de la voiture étaient espacés de 1,6 m : un coin
 *     de bâtiment pouvait passer entre deux points, donc au travers de la caisse.
 *  2. **Pas de normale.** `isBlocked()` répond « dedans / dehors » : impossible
 *     de savoir de combien on est rentré ni où est le mur. Le glissement se
 *     faisait donc en testant X puis Z séparément → le long d'une façade en
 *     biais, on avançait EN ESCALIER (X passe, Z bloque, X passe…), ce qui
 *     produisait les micro-saccades que la caméra amplifiait ensuite.
 *
 * ## Comment ça marche maintenant
 *
 * On teste le corps contre les **arêtes de mur** (`forEachWallNear`). On obtient
 * une distance exacte et une normale, d'où trois choses gratuites :
 *
 *  - **dépénétration** : on repousse exactement de la profondeur de chevauchement ;
 *  - **glissement vectoriel** : comme on ne retire que la composante NORMALE du
 *    déplacement, la composante le long du mur survit → on longe une façade en
 *    douceur, à n'importe quel angle ;
 *  - **normale de contact** rendue à l'appelant → la physique des véhicules peut
 *    répondre correctement à un choc (frôlement vs impact de face).
 *
 * Le déplacement est découpé en sous-pas plus petits que le corps, ce qui rend
 * la traversée de mur impossible même à 210 km/h.
 *
 * ⚠️ Ce module utilise des variables au niveau du fichier comme brouillon
 * (`posX`, `bestDepth`…) au lieu d'objets alloués : il tourne plusieurs fois par
 * image, et allouer ici ferait travailler le ramasse-miettes en pleine partie.
 * Conséquence : **ces fonctions ne sont pas réentrantes** — on ne peut pas en
 * appeler une pendant qu'une autre tourne. En pratique on les appelle l'une
 * après l'autre depuis `useFrame`, donc ça va.
 */

export interface MoveResult {
  x: number
  z: number
  /** Vrai si un mur a repoussé le corps pendant le déplacement. */
  hit: boolean
  /**
   * Normale du contact dominant (unitaire, dirigée du mur VERS le corps).
   * `0, 0` s'il n'y a eu aucun contact. C'est elle qui permet de distinguer un
   * frôlement (normale presque perpendiculaire à la vitesse) d'un choc de face.
   */
  normalX: number
  normalZ: number
  /** Profondeur totale corrigée (m) : jauge la violence du contact. */
  push: number
}

/** Nombre de passes de dépénétration : 3 suffit pour se dégager d'un angle. */
const RESOLVE_PASSES = 4

/** Si on est enfermé dans un bâtiment, on cherche la sortie dans ces rayons. */
const ESCAPE_RADII = [4, 12, 30]

/** Marge laissée en sortant d'un bâtiment, pour ne pas ressortir collé au mur. */
const ESCAPE_MARGIN = 0.05

// --- Brouillon partagé (voir l'avertissement en tête de fichier) ---

let posX = 0
let posZ = 0

/** Meilleure correction trouvée pendant la passe en cours. */
let bestDepth = 0
let bestNX = 0
let bestNZ = 0

/** Forme testée : cercle si `probeRadius > 0`, sinon boîte orientée. */
let probeRadius = 0
let boxUX = 0 // axe « avant » de la boîte
let boxUZ = 0
let boxRX = 0 // axe « droite » de la boîte
let boxRZ = 0
let boxHalfL = 0
let boxHalfW = 0

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Déplace un CERCLE (le piéton) de (dx, dz) en glissant le long des murs.
 */
export function moveCircle(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
): MoveResult {
  probeRadius = radius
  return sweep(x, z, dx, dz, radius * 0.5, resolveCircle, radius)
}

/**
 * Déplace une BOÎTE ORIENTÉE (un véhicule) de (dx, dz) en glissant le long des murs.
 *
 * `rotationY` suit la convention du jeu : l'avant du véhicule pointe vers
 * `(sin(rotationY), cos(rotationY))`.
 */
export function moveBox(
  x: number,
  z: number,
  dx: number,
  dz: number,
  rotationY: number,
  halfLength: number,
  halfWidth: number,
): MoveResult {
  probeRadius = 0
  boxUX = Math.sin(rotationY)
  boxUZ = Math.cos(rotationY)
  boxRX = Math.cos(rotationY)
  boxRZ = -Math.sin(rotationY)
  boxHalfL = halfLength
  boxHalfW = halfWidth
  // Un sous-pas plus court que la plus petite dimension : une arête de mur ne
  // peut pas se glisser entre deux poses successives sans être vue.
  const step = Math.min(halfLength, halfWidth) * 0.8
  return sweep(x, z, dx, dz, step, resolveBox, Math.hypot(halfLength, halfWidth))
}

// ---------------------------------------------------------------------------
// Balayage : on avance par sous-pas, et on se dégage après chacun
// ---------------------------------------------------------------------------

function sweep(
  x: number,
  z: number,
  dx: number,
  dz: number,
  maxStep: number,
  resolve: () => boolean,
  escapeReach: number,
): MoveResult {
  posX = x
  posZ = z

  const distance = Math.hypot(dx, dz)
  const steps = Math.max(1, Math.ceil(distance / Math.max(maxStep, 0.02)))
  const sx = dx / steps
  const sz = dz / steps

  // Normale de contact : on somme les normales pondérées par leur profondeur,
  // pour que le mur le plus « subi » l'emporte dans un angle.
  let sumNX = 0
  let sumNZ = 0
  let push = 0

  for (let i = 0; i < steps; i++) {
    posX += sx
    posZ += sz

    for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
      if (!resolve()) break
      sumNX += bestNX * bestDepth
      sumNZ += bestNZ * bestDepth
      push += bestDepth
    }
  }

  // Filet de sécurité : si on s'est retrouvé au cœur d'un bâtiment (spawn,
  // descente de véhicule, relief qui bouge), on ressort par le mur le plus proche.
  escapeIfInside(escapeReach)

  const length = Math.hypot(sumNX, sumNZ)
  return {
    x: posX,
    z: posZ,
    hit: push > 0,
    normalX: length > 1e-6 ? sumNX / length : 0,
    normalZ: length > 1e-6 ? sumNZ / length : 0,
    push,
  }
}

// ---------------------------------------------------------------------------
// Cercle contre mur
// ---------------------------------------------------------------------------

function resolveCircle(): boolean {
  bestDepth = 0
  forEachWallNear(posX, posZ, probeRadius, circleProbe)
  if (bestDepth <= 0) return false
  posX += bestNX * bestDepth
  posZ += bestNZ * bestDepth
  return true
}

function circleProbe(ax: number, az: number, bx: number, bz: number) {
  const ex = bx - ax
  const ez = bz - az
  const len2 = ex * ex + ez * ez
  if (len2 < 1e-12) return

  // Point du mur le plus proche du centre du cercle.
  let t = ((posX - ax) * ex + (posZ - az) * ez) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = posX - (ax + ex * t)
  const dz = posZ - (az + ez * t)
  const d2 = dx * dx + dz * dz
  if (d2 >= probeRadius * probeRadius) return

  const d = Math.sqrt(d2)
  let nx: number
  let nz: number
  let depth: number
  if (d > 1e-6) {
    nx = dx / d
    nz = dz / d
    depth = probeRadius - d
  } else {
    // Centre pile SUR l'arête : on sort perpendiculairement au mur.
    const len = Math.sqrt(len2)
    nx = -ez / len
    nz = ex / len
    depth = probeRadius
  }
  if (depth > bestDepth) {
    bestDepth = depth
    bestNX = nx
    bestNZ = nz
  }
}

// ---------------------------------------------------------------------------
// Boîte orientée contre mur (théorème de l'axe séparateur, en 2D)
// ---------------------------------------------------------------------------

/**
 * Deux formes convexes ne se touchent PAS s'il existe un axe sur lequel leurs
 * projections ne se chevauchent pas. Pour une boîte contre un segment, trois
 * axes suffisent : les deux axes de la boîte et la normale du segment. Si les
 * trois se chevauchent, le plus PETIT chevauchement donne la correction
 * minimale à appliquer pour séparer les deux formes.
 */
function resolveBox(): boolean {
  bestDepth = 0
  forEachWallNear(posX, posZ, Math.hypot(boxHalfL, boxHalfW), boxProbe)
  if (bestDepth <= 0) return false
  posX += bestNX * bestDepth
  posZ += bestNZ * bestDepth
  return true
}

/** Axe candidat en cours d'examen, pour éviter d'allouer un objet de retour. */
let axisOverlap = 0
let axisSign = 0

function boxProbe(ax: number, az: number, bx: number, bz: number) {
  const ex = bx - ax
  const ez = bz - az
  const len = Math.hypot(ex, ez)
  if (len < 1e-6) return

  let depth = Infinity
  let nx = 0
  let nz = 0

  // Axe 1 et 2 : les faces de la boîte. Axe 3 : la normale du mur.
  for (let a = 0; a < 3; a++) {
    const axX = a === 0 ? boxUX : a === 1 ? boxRX : -ez / len
    const axZ = a === 0 ? boxUZ : a === 1 ? boxRZ : ex / len
    testAxis(axX, axZ, ax, az, bx, bz)
    if (axisOverlap <= 0) return // axe séparateur trouvé : pas de contact
    if (axisOverlap < depth) {
      depth = axisOverlap
      nx = axX * axisSign
      nz = axZ * axisSign
    }
  }

  if (depth > bestDepth) {
    bestDepth = depth
    bestNX = nx
    bestNZ = nz
  }
}

function testAxis(nx: number, nz: number, ax: number, az: number, bx: number, bz: number) {
  const center = posX * nx + posZ * nz
  const reach = boxHalfL * Math.abs(boxUX * nx + boxUZ * nz) + boxHalfW * Math.abs(boxRX * nx + boxRZ * nz)
  const pa = ax * nx + az * nz
  const pb = bx * nx + bz * nz
  const segMin = pa < pb ? pa : pb
  const segMax = pa < pb ? pb : pa

  const high = Math.min(center + reach, segMax)
  const low = Math.max(center - reach, segMin)
  axisOverlap = high - low
  // Sens de la poussée : toujours du mur VERS le centre de la boîte.
  axisSign = center >= (segMin + segMax) * 0.5 ? 1 : -1
}

// ---------------------------------------------------------------------------
// Filet de sécurité : sortir d'un bâtiment où on n'aurait jamais dû être
// ---------------------------------------------------------------------------

let escapeBestD2 = Infinity
let escapeX = 0
let escapeZ = 0

function escapeIfInside(reach: number) {
  if (!isBlocked(posX, posZ)) return

  for (const radius of ESCAPE_RADII) {
    escapeBestD2 = Infinity
    forEachWallNear(posX, posZ, radius, escapeProbe)
    if (escapeBestD2 === Infinity) continue

    const dx = escapeX - posX
    const dz = escapeZ - posZ
    const d = Math.sqrt(escapeBestD2)
    if (d < 1e-6) return
    // On vise l'autre côté du mur le plus proche, plus la place qu'occupe le corps.
    const out = (d + reach + ESCAPE_MARGIN) / d
    posX += dx * out
    posZ += dz * out
    return
  }
}

function escapeProbe(ax: number, az: number, bx: number, bz: number) {
  const ex = bx - ax
  const ez = bz - az
  const len2 = ex * ex + ez * ez
  if (len2 < 1e-12) return

  let t = ((posX - ax) * ex + (posZ - az) * ez) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = ax + ex * t
  const qz = az + ez * t
  const d2 = (posX - qx) * (posX - qx) + (posZ - qz) * (posZ - qz)
  if (d2 < escapeBestD2) {
    escapeBestD2 = d2
    escapeX = qx
    escapeZ = qz
  }
}
