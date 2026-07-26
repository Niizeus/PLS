// @ts-nocheck
/**
 * 🏠 roofs.mjs — dans quel SENS coule un toit ?
 *
 * Ce module tourne HORS du jeu, appelé par `build-beauvais.mjs`. La BD TOPO nous
 * donne la HAUTEUR du toit (voir `bdtopo.mjs`) mais pas son ORIENTATION. Or c'est
 * l'orientation qui décide de tout : un toit dont le faîtage est mis en travers
 * donne une ville qui « sonne faux » sans qu'on sache pourquoi.
 *
 * La règle d'architecture qu'on applique — et qui est la vraie règle :
 *
 *   👉 **le faîtage est parallèle aux façades LIBRES**, jamais aux murs mitoyens.
 *
 * Une maison de ville est étroite sur rue et profonde dans la parcelle : ses murs
 * mitoyens sont ses côtés LONGS. Prendre bêtement le plus long côté mettrait donc
 * le faîtage perpendiculaire à la rue — l'inverse de la réalité. En ne regardant
 * que les façades libres (rue + arrière), on retombe sur le bon sens, et une
 * maison isolée garde naturellement son faîtage dans sa longueur.
 *
 * On écrit un seul nombre par bâtiment : `ra`, l'angle du faîtage en radians.
 * La géométrie du toit, elle, est construite dans le jeu (`Beauvais.tsx`) : ça
 * évite de stocker des milliers de triangles dans le JSON.
 */

const SHARE_DIST = 1.0 // deux murs à moins d'1 m l'un de l'autre = mitoyens
const EDGE_CELL = 8 // côté d'une case de l'index des murs, en mètres
const BIN = (5 * Math.PI) / 180 // largeur d'un secteur d'orientation (5°)

/**
 * Plafond de pente. La BD TOPO mesure le point le PLUS HAUT du toit : une cheminée,
 * une lucarne ou un clocheton suffit à faire croire à un toit démesuré. Résultat
 * brut sur Beauvais : pente médiane 31° (parfaitement crédible), mais 11 % des
 * toits dépassaient 60°, jusqu'à 79° — des toits en pointe d'aiguille.
 *
 * On plafonne donc à 55°, ce qui laisse passer tous les toits normaux (un comble
 * français classique tourne entre 35° et 45°). Les MONUMENTS, eux, ont droit à
 * leurs flèches : une église pointue, c'est justement ce qu'on veut voir.
 */
const MAX_PITCH = Math.tan((55 * Math.PI) / 180)
const MAX_PITCH_LANDMARK = Math.tan((80 * Math.PI) / 180)

/** Distance du point p au segment [a, b]. */
function distToSegment(p, a, b) {
  const vx = b[0] - a[0]
  const vz = b[1] - a[1]
  const len2 = vx * vx + vz * vz
  let t = len2 > 0 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = p[0] - (a[0] + t * vx)
  const dz = p[1] - (a[1] + t * vz)
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Calcule `ra` (angle du faîtage) pour chaque bâtiment qui a un toit en pente.
 * Modifie les bâtiments sur place. Renvoie un petit rapport chiffré.
 */
export function computeRidgeAngles(buildings) {
  // --- 1. On range TOUS les murs dans une grille, pour trouver vite les voisins.
  // Un mur = [pointA, pointB, indexDuBâtiment]. On indexe par les cases que le
  // mur traverse (ses deux extrémités suffisent : les murs sont courts).
  const grid = new Map()
  const push = (key, edge) => {
    let list = grid.get(key)
    if (!list) grid.set(key, (list = []))
    list.push(edge)
  }

  for (let bi = 0; bi < buildings.length; bi++) {
    const pts = buildings[bi].pts
    if (pts.length < 3) continue
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const edge = [a, b, bi]
      const k1 = Math.floor(a[0] / EDGE_CELL) + ':' + Math.floor(a[1] / EDGE_CELL)
      const k2 = Math.floor(b[0] / EDGE_CELL) + ':' + Math.floor(b[1] / EDGE_CELL)
      push(k1, edge)
      if (k2 !== k1) push(k2, edge)
    }
  }

  const neighbours = (a, b) => {
    const out = new Set()
    for (const p of [a, b]) {
      const cx = Math.floor(p[0] / EDGE_CELL)
      const cz = Math.floor(p[1] / EDGE_CELL)
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const list = grid.get(cx + i + ':' + (cz + j))
          if (list) for (const e of list) out.add(e)
        }
      }
    }
    return out
  }

  let sloped = 0
  let withFree = 0
  let allShared = 0
  let capped = 0

  for (let bi = 0; bi < buildings.length; bi++) {
    const b = buildings[bi]
    if (!(b.rh > 0)) continue // toit plat : pas de faîtage à orienter
    const pts = b.pts
    if (pts.length < 3) continue
    sloped++

    // --- 2. Pour chaque mur, est-il mitoyen ? Puis on cumule les longueurs par
    // secteur d'orientation. Un secteur = une direction de façade (à 5° près).
    // On tient DEUX comptes : les murs libres, et tous les murs (pour le repli).
    const free = new Map()
    const all = new Map()
    let anyFree = false

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const c = pts[(i + 1) % pts.length]
      const dx = c[0] - a[0]
      const dz = c[1] - a[1]
      const len = Math.hypot(dx, dz)
      if (len < 0.5) continue // micro-décrochement : il ne dit rien de l'orientation

      // Orientation ramenée dans [0, π[ : un mur n'a pas de sens, juste une direction.
      let ang = Math.atan2(dz, dx)
      if (ang < 0) ang += Math.PI
      if (ang >= Math.PI) ang -= Math.PI
      const bin = Math.floor(ang / BIN)

      all.set(bin, (all.get(bin) ?? 0) + len)

      // Mitoyen = un mur d'un AUTRE bâtiment colle à ce mur sur toute sa longueur.
      // On teste les deux extrémités : ça attrape aussi le cas où le voisin a
      // découpé sa façade en plusieurs tronçons.
      let shared = false
      for (const [ea, eb, ebi] of neighbours(a, c)) {
        if (ebi === bi) continue
        if (distToSegment(a, ea, eb) < SHARE_DIST && distToSegment(c, ea, eb) < SHARE_DIST) {
          shared = true
          break
        }
      }
      if (!shared) {
        free.set(bin, (free.get(bin) ?? 0) + len)
        anyFree = true
      }
    }

    // --- 3. Le secteur qui totalise le plus de façade libre gagne. Si le bâtiment
    // est entièrement mitoyen (cœur d'îlot), on se rabat sur tous ses murs.
    const source = anyFree ? free : all
    if (anyFree) withFree++
    else allShared++
    if (source.size === 0) continue

    let bestBin = 0
    let bestLen = -1
    for (const [bin, len] of source) {
      if (len > bestLen) {
        bestLen = len
        bestBin = bin
      }
    }

    // --- 4. Moyenne fine à l'intérieur du secteur gagnant (et de ses deux voisins),
    // pondérée par la longueur. On passe par l'angle DOUBLE : c'est la façon
    // correcte de moyenner des directions (0° et 179° doivent se moyenner à ~0°,
    // pas à 90°).
    let sumSin = 0
    let sumCos = 0
    for (let d = -1; d <= 1; d++) {
      const bin = (bestBin + d + 36) % 36
      const len = source.get(bin)
      if (!len) continue
      const ang = (bin + 0.5) * BIN
      sumSin += len * Math.sin(2 * ang)
      sumCos += len * Math.cos(2 * ang)
    }
    let ra = 0.5 * Math.atan2(sumSin, sumCos)
    if (ra < 0) ra += Math.PI

    b.ra = Math.round(ra * 1000) / 1000

    // --- 5. Plafond de pente. `D` est la demi-profondeur du bâtiment mesurée
    // PERPENDICULAIREMENT au faîtage : c'est exactement la distance que le rampant
    // doit parcourir, donc la pente vaut rh / D.
    const nx = -Math.sin(ra)
    const nz = Math.cos(ra)
    let smin = Infinity
    let smax = -Infinity
    for (const [x, z] of pts) {
      const s = x * nx + z * nz
      if (s < smin) smin = s
      if (s > smax) smax = s
    }
    const D = (smax - smin) / 2
    if (D > 0.5) {
      const max = D * (b.kind ? MAX_PITCH_LANDMARK : MAX_PITCH)
      if (b.rh > max) {
        b.rh = Math.round(max * 10) / 10
        capped++
      }
    }
  }

  return { sloped, withFree, allShared, capped }
}
