/**
 * 📐 footprintField.ts — « à quelle profondeur suis-je dans ce bâtiment ? »
 *
 * Outil de géométrie 2D, sans rapport avec la 3D ni avec React. Il sert à
 * fabriquer des volumes EMBOÎTÉS à partir d'un seul contour : on calcule, sur une
 * grille, la distance de chaque point au bord de l'emprise, puis on redécoupe des
 * contours « plus petits » à l'intérieur.
 *
 *   emprise réelle  →  contour à 7 m du bord  →  contour à 14 m du bord
 *   (les chapelles)    (les bas-côtés)          (le vaisseau central)
 *
 * C'est exactement la façon dont une cathédrale est bâtie : des masses de plus en
 * plus hautes au fur et à mesure qu'on s'approche du centre. Et comme tout part de
 * l'emprise OpenStreetMap, la silhouette reste celle du VRAI bâtiment (y compris
 * le chevet arrondi) — on ne dessine rien à la main.
 *
 * Deux fonctions publiques :
 *  - `buildDistanceField` : la grille de distances (calculée une fois) ;
 *  - `marchingSquares`    : le contour « ligne de niveau zéro » d'une fonction
 *    quelconque, ce qui permet de croiser la distance avec d'autres formes.
 */

/** Une grille de valeurs régulièrement espacées, échantillonnable partout. */
export interface Field {
  /** Pas de la grille, en mètres. */
  step: number
  /** Coordonnées monde du nœud (0, 0). */
  x0: number
  z0: number
  /** Nombre de nœuds en x et en z. */
  nx: number
  nz: number
  values: Float32Array
}

/** Une boîte englobante en mètres monde. */
export interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Boîte englobante d'un contour, éventuellement élargie de `pad` mètres. */
export function boundsOf(pts: number[][], pad = 0): Box {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad }
}

/**
 * Renvoie le contour dans le sens « anti-horaire » (aire signée positive).
 *
 * C'est LA convention de tout le rendu : dans ce sens, la normale sortante d'un
 * segment (dx, dz) vaut (dz, −dx). Sans ça, un mur sur deux serait retourné et on
 * verrait à travers.
 */
export function orientRing(pts: number[][]): number[][] {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    area += x1 * z2 - x2 * z1
  }
  return area < 0 ? pts.slice().reverse() : pts
}

/**
 * Champ de distance SIGNÉE d'un contour : positif dedans (= à quelle profondeur),
 * négatif dehors.
 *
 * À réserver aux bâtiments qu'on ne construit qu'une fois (un monument), pas aux
 * 34 000 maisons de la ville : c'est chaque nœud de la grille contre chaque
 * segment du contour. On limite quand même la casse en écartant d'un test très
 * bête (la boîte du segment est-elle déjà plus loin que le meilleur trouvé ?) la
 * grande majorité des segments — sur une emprise de 200 segments, ça divise le
 * temps par cinq.
 */
export function buildDistanceField(pts: number[][], step: number, pad: number): Field {
  const box = boundsOf(pts, pad)
  const nx = Math.ceil((box.maxX - box.minX) / step) + 1
  const nz = Math.ceil((box.maxZ - box.minZ) / step) + 1
  const values = new Float32Array(nx * nz)

  // Segments à plat dans des tableaux typés : plus rapide à parcourir, et on
  // garde la boîte englobante de chacun pour le test d'écartement.
  const m = pts.length
  const ax = new Float64Array(m)
  const az = new Float64Array(m)
  const ex = new Float64Array(m)
  const ez = new Float64Array(m)
  const inv = new Float64Array(m)
  const bx0 = new Float64Array(m)
  const bx1 = new Float64Array(m)
  const bz0 = new Float64Array(m)
  const bz1 = new Float64Array(m)
  for (let i = 0; i < m; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % m]
    ax[i] = x1
    az[i] = z1
    ex[i] = x2 - x1
    ez[i] = z2 - z1
    const l2 = ex[i] * ex[i] + ez[i] * ez[i]
    inv[i] = l2 > 0 ? 1 / l2 : 0
    bx0[i] = Math.min(x1, x2)
    bx1[i] = Math.max(x1, x2)
    bz0[i] = Math.min(z1, z2)
    bz1[i] = Math.max(z1, z2)
  }

  /** Distance² du point (x, z) au segment k. */
  const seg = (k: number, x: number, z: number) => {
    let t = ((x - ax[k]) * ex[k] + (z - az[k]) * ez[k]) * inv[k]
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const px = ax[k] + t * ex[k] - x
    const pz = az[k] + t * ez[k] - z
    return px * px + pz * pz
  }

  // Le segment le plus proche change rarement d'un nœud au suivant : on garde le
  // gagnant précédent et on s'en sert comme point de départ. Le test d'écartement
  // devient alors efficace dès le premier segment, au lieu de ne servir qu'à la
  // fin du tour — c'est ce qui fait passer le calcul de ~200 ms à ~30 ms.
  let hint = 0

  const crossings: number[] = []

  for (let j = 0; j < nz; j++) {
    const z = box.minZ + j * step

    // Dedans ou dehors ? On règle toute la LIGNE d'un coup : on relève les
    // endroits où le contour croise cette ligne, et on alterne à chaque passage.
    // (Le faire point par point coûterait un tour de contour complet par nœud.)
    crossings.length = 0
    for (let k = 0; k < m; k++) {
      const z1 = az[k]
      const z2 = az[k] + ez[k]
      if (z1 > z !== z2 > z) crossings.push(ax[k] + (ex[k] * (z - z1)) / ez[k])
    }
    crossings.sort((p, q) => p - q)
    let passed = 0

    for (let i = 0; i < nx; i++) {
      const x = box.minX + i * step
      while (passed < crossings.length && crossings[passed] <= x) passed++
      const isInside = (crossings.length - passed) % 2 === 1
      let best = seg(hint, x, z)
      for (let k = 0; k < m; k++) {
        // Distance minimale à la boîte du segment : si elle dépasse déjà le
        // meilleur candidat, inutile de calculer la vraie distance.
        const ox = x < bx0[k] ? bx0[k] - x : x > bx1[k] ? x - bx1[k] : 0
        const oz = z < bz0[k] ? bz0[k] - z : z > bz1[k] ? z - bz1[k] : 0
        if (ox * ox + oz * oz >= best) continue
        const d2 = seg(k, x, z)
        if (d2 < best) {
          best = d2
          hint = k
        }
      }
      const d = Math.sqrt(best)
      values[j * nx + i] = isInside ? d : -d
    }
  }
  return { step, x0: box.minX, z0: box.minZ, nx, nz, values }
}

/**
 * Adoucit le champ (moyenne 3×3, répétée `passes` fois).
 *
 * ⚠️ Ce n'est pas cosmétique. Une emprise OSM est hérissée de décrochements d'un
 * mètre (contreforts, chapelles, escaliers). En la rétrécissant on les garde tous,
 * et le contour intérieur devient une dentelle en zigzag : la triangulation d'un
 * tel contour part en vrille et laisse des trous dans les toits. Lisser le champ
 * avant d'en tirer un contour supprime les détails plus petits que ~1 m par passe
 * et garde la forme d'ensemble — c'est aussi plus juste architecturalement : un
 * vaisseau central ne reproduit pas les hoquets des chapelles.
 */
export function smoothField(f: Field, passes: number): void {
  const tmp = new Float32Array(f.values.length)
  for (let p = 0; p < passes; p++) {
    tmp.set(f.values)
    for (let j = 1; j < f.nz - 1; j++) {
      for (let i = 1; i < f.nx - 1; i++) {
        let s = 0
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += tmp[(j + dj) * f.nx + i + di]
        f.values[j * f.nx + i] = s / 9
      }
    }
  }
}

/** Valeur du champ en (x, z), interpolée entre les 4 nœuds voisins. */
export function sampleField(f: Field, x: number, z: number): number {
  let fi = (x - f.x0) / f.step
  let fj = (z - f.z0) / f.step
  fi = fi < 0 ? 0 : fi > f.nx - 1 ? f.nx - 1 : fi
  fj = fj < 0 ? 0 : fj > f.nz - 1 ? f.nz - 1 : fj
  const i0 = Math.floor(fi)
  const j0 = Math.floor(fj)
  const i1 = Math.min(i0 + 1, f.nx - 1)
  const j1 = Math.min(j0 + 1, f.nz - 1)
  const tx = fi - i0
  const tz = fj - j0
  const a = f.values[j0 * f.nx + i0]
  const b = f.values[j0 * f.nx + i1]
  const c = f.values[j1 * f.nx + i0]
  const d = f.values[j1 * f.nx + i1]
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz
}

// Pour chaque configuration de coins « au-dessus de zéro », les arêtes de la case
// que la ligne de niveau traverse. Table classique du « marching squares ».
// Arêtes : 0 = bas, 1 = droite, 2 = haut, 3 = gauche.
const MS_TABLE: Record<number, number[][]> = {
  1: [[3, 0]],
  2: [[0, 1]],
  3: [[3, 1]],
  4: [[1, 2]],
  5: [
    [3, 0],
    [1, 2],
  ],
  6: [[0, 2]],
  7: [[3, 2]],
  8: [[2, 3]],
  9: [[2, 0]],
  10: [
    [0, 1],
    [2, 3],
  ],
  11: [[2, 1]],
  12: [[1, 3]],
  13: [[1, 0]],
  14: [[0, 3]],
}

/**
 * Extrait les contours fermés de la région où `at(x, z) >= 0`.
 *
 * On échantillonne la fonction sur une grille, puis on relie les petits segments
 * trouvés dans chaque case pour former des anneaux. `at` peut être n'importe quoi :
 * un champ de distance, une forme analytique, ou un mélange des deux (c'est comme
 * ça que la cathédrale croise son emprise réelle avec un plan en croix).
 */
export function marchingSquares(
  box: Box,
  step: number,
  at: (x: number, z: number) => number,
): number[][][] {
  const nx = Math.ceil((box.maxX - box.minX) / step) + 1
  const nz = Math.ceil((box.maxZ - box.minZ) / step) + 1
  const v = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) v[j * nx + i] = at(box.minX + i * step, box.minZ + j * step)
  }

  type Seg = [number[], number[]]
  const segs: Seg[] = []
  const lerp = (x1: number, z1: number, v1: number, x2: number, z2: number, v2: number) => {
    const t = v1 === v2 ? 0.5 : v1 / (v1 - v2)
    return [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]
  }

  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const x0 = box.minX + i * step
      const z0 = box.minZ + j * step
      const x1 = x0 + step
      const z1 = z0 + step
      // Coins de la case, dans l'ordre : bas-gauche, bas-droite, haut-droite, haut-gauche.
      const c0 = v[j * nx + i]
      const c1 = v[j * nx + i + 1]
      const c2 = v[(j + 1) * nx + i + 1]
      const c3 = v[(j + 1) * nx + i]
      const idx = (c0 > 0 ? 1 : 0) | (c1 > 0 ? 2 : 0) | (c2 > 0 ? 4 : 0) | (c3 > 0 ? 8 : 0)
      if (idx === 0 || idx === 15) continue
      const edge = [
        () => lerp(x0, z0, c0, x1, z0, c1),
        () => lerp(x1, z0, c1, x1, z1, c2),
        () => lerp(x1, z1, c2, x0, z1, c3),
        () => lerp(x0, z1, c3, x0, z0, c0),
      ]
      for (const [a, b] of MS_TABLE[idx]) segs.push([edge[a](), edge[b]()])
    }
  }

  // Chaînage : on suit les segments de proche en proche jusqu'à revenir au départ.
  const key = (p: number[]) => p[0].toFixed(3) + ',' + p[1].toFixed(3)
  const byStart = new Map<string, Seg[]>()
  for (const s of segs) {
    const k = key(s[0])
    let list = byStart.get(k)
    if (!list) byStart.set(k, (list = []))
    list.push(s)
  }

  const used = new Set<Seg>()
  const rings: number[][][] = []
  for (const start of segs) {
    if (used.has(start)) continue
    const ring: number[][] = [start[0]]
    let cur: Seg | undefined = start
    while (cur && !used.has(cur)) {
      used.add(cur)
      ring.push(cur[1])
      cur = (byStart.get(key(cur[1])) ?? []).find((s) => !used.has(s))
    }
    if (ring.length > 8) rings.push(ring)
  }
  return rings
}

/**
 * Allège un contour en supprimant les points qui n'apportent rien : ceux qui sont
 * à moins de `tol` mètres du segment formé par leurs deux voisins. Le marching
 * squares en produit un par case ; on divise typiquement leur nombre par trois
 * sans que la forme bouge.
 */
export function simplifyRing(ring: number[][], tol: number): number[][] {
  let pts = ring
  // Le chaînage ferme l'anneau en répétant le premier point : on l'enlève.
  if (pts.length > 1) {
    const [ax, az] = pts[0]
    const [bx, bz] = pts[pts.length - 1]
    if (Math.abs(ax - bx) < 1e-6 && Math.abs(az - bz) < 1e-6) pts = pts.slice(0, -1)
  }

  let changed = true
  while (changed && pts.length > 8) {
    changed = false
    const out: number[][] = []
    // On ne supprime jamais deux points de suite dans la même passe : sinon un
    // arrondi entier peut disparaître d'un coup et l'arête devient une corde.
    let justRemoved = false
    for (let i = 0; i < pts.length; i++) {
      const [px, pz] = pts[(i - 1 + pts.length) % pts.length]
      const [x, z] = pts[i]
      const [nx, nz] = pts[(i + 1) % pts.length]
      const dx = nx - px
      const dz = nz - pz
      const len = Math.hypot(dx, dz)
      const dev = len > 1e-6 ? Math.abs((x - px) * dz - (z - pz) * dx) / len : 0
      if (!justRemoved && dev < tol) {
        justRemoved = true
        changed = true
        continue
      }
      justRemoved = false
      out.push(pts[i])
    }
    pts = out
  }
  return pts
}
