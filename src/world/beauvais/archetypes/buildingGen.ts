import * as THREE from 'three'
import { terrainHeight } from '../cityData'
import { orientRing } from '../footprintField'
import {
  FACADES_TEXTUREES,
  PALETTE_INDEX,
  bande,
  couleurMur,
  couleurPalette,
  uvPalette,
  vDeBande,
} from './facadeAtlas'

/**
 * 🏗️ buildingGen.ts — un passeport devient un bâtiment.
 *
 * Successeur de `buildingMesh.ts` pour les bâtiments d'un chunk classé. La
 * différence tient en un mot : ici on connaît l'ARCHÉTYPE, donc on sait à quoi le
 * bâtiment doit ressembler, et pas seulement quelle taille il fait.
 *
 * Trois choses que l'ancien générateur ne pouvait pas faire :
 *  - **des étages** : le mur est découpé en niveaux, un rez-de-chaussée distinct
 *    et des étages courants, au lieu d'une seule surface lisse ;
 *  - **des travées régulières** : le rythme des travées découle de la vraie
 *    longueur du mur, donc deux immeubles voisins n'ont pas le même découpage.
 *
 * ⚠️ **Les ouvertures dessinées sont coupées.** `FACADES_TEXTUREES` vaut `false`
 * (voir `facadeAtlas.ts`) : les murs sortent en APLATS cel-shading, sans fenêtre.
 * L'atlas produisait des grilles de rectangles sombres qui n'évoquaient pas
 * Beauvais. Les UV restent calculées — elles ne coûtent rien et attendent une
 * vraie méthode de génération de façades. Ce sont les couleurs de sommet qui
 * portent le rendu : socle plus sombre, corps, couronnement plus clair, pignons
 * et toits sur les aplats de la palette.
 *
 * Le toit reprend la méthode éprouvée de `buildingMesh.ts` : on ne stocke aucun
 * triangle, la pente se déduit de la distance au faîtage. Les triangles de toit
 * sont peints avec un aplat de l'atlas — un seul matériau pour toute la ville.
 */

/** Hauteur d'un niveau, en mètres. Sert quand l'IGN ne donne pas le nombre d'étages. */
const HAUTEUR_NIVEAU = 3

/** Largeur visée d'une travée, en mètres. Une fenêtre tous les ~3 m se lit bien. */
const LARGEUR_TRAVEE = 3.2

/** Jamais moins que ça, sinon le bâtiment devient une galette illisible. */
const HAUTEUR_MINI = 2.4

/**
 * Profondeur enterrée. Un bâtiment est un bloc à fond plat posé sur un terrain en
 * pente : sans cette jupe, le coin aval décolle du sol. Reprise telle quelle de
 * `buildingMesh.ts` — c'est invisible et ça marche sur toutes les pentes.
 */
const JUPE = 8

/** Ce qu'un passeport doit fournir au générateur. */
export interface GenBuilding {
  pts: number[][]
  h?: number
  rh?: number
  ra?: number
  rm?: string
  cx: number
  cz: number
  archetype: string
  ign?: { etages?: number }
  /**
   * Identifiant de la RUE (petit entier, calculé hors-jeu depuis son nom).
   *
   * C'est lui qui donne sa cohérence à une rue : tous les bâtiments qui la bordent
   * reçoivent la même teinte de base. Une ville réelle n'est pas un semis de
   * couleurs au hasard — une rue a été bâtie à une époque, avec les mêmes briques.
   */
  rue?: number
}

/** Style de façade et matériau de toit par archétype. */
interface Recette {
  style: string
  /** Case de palette du toit, si le matériau réel n'est pas connu. */
  toit: number
  /** Le rez-de-chaussée est-il traité à part ? */
  rdc: boolean
}

const RECETTES: Record<string, Recette> = {
  'maison-ville-brique': { style: 'brique-ancienne', toit: PALETTE_INDEX.tuile, rdc: true },
  'pan-de-bois': { style: 'brique-ancienne', toit: PALETTE_INDEX.ardoise, rdc: true },
  'reconstruction-brique': { style: 'brique-reconstruction', toit: PALETTE_INDEX.tuile, rdc: true },
  'immeuble-centre-commerce': { style: 'pierre-commerce', toit: PALETTE_INDEX.ardoise, rdc: true },
  'pavillon-brique': { style: 'brique-ancienne', toit: PALETTE_INDEX.tuile, rdc: false },
  'pavillon-crepi': { style: 'crepi', toit: PALETTE_INDEX.tuile, rdc: false },
  'pavillon-recent': { style: 'crepi', toit: PALETTE_INDEX.tuileSombre, rdc: false },
  dependance: { style: 'crepi', toit: PALETTE_INDEX.tuileSombre, rdc: true },
  'petit-collectif': { style: 'beton', toit: PALETTE_INDEX.beton, rdc: true },
  'grand-ensemble': { style: 'beton', toit: PALETTE_INDEX.beton, rdc: false },
  hangar: { style: 'tole', toit: PALETTE_INDEX.zinc, rdc: true },
  'commerce-peripherie': { style: 'beton', toit: PALETTE_INDEX.beton, rdc: true },
  'equipement-public': { style: 'pierre-noble', toit: PALETTE_INDEX.ardoise, rdc: true },
  religieux: { style: 'pierre-noble', toit: PALETTE_INDEX.ardoise, rdc: false },
  monument: { style: 'pierre-noble', toit: PALETTE_INDEX.ardoise, rdc: false },
  inconnu: { style: 'crepi', toit: PALETTE_INDEX.tuile, rdc: false },
}

/** Le matériau réel de la BD TOPO prime sur celui de la recette, quand il existe. */
const TOIT_REEL: Record<string, number> = {
  t: PALETTE_INDEX.tuile,
  a: PALETTE_INDEX.ardoise,
  z: PALETTE_INDEX.zinc,
  b: PALETTE_INDEX.beton,
}

/** Aplat de pignon assorti à chaque style de mur. */
const PIGNON: Record<string, number> = {
  'brique-ancienne': 6,
  'brique-reconstruction': 7,
  'pierre-commerce': 8,
  crepi: 9,
  beton: 10,
  tole: 11,
  'pierre-noble': 12,
}

function hash01(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * La teinte d'un bâtiment : celle de SA RUE, plus un léger écart qui lui est propre.
 *
 * Multipliée par la texture d'atlas (le matériau combine `map` et `vertexColors`),
 * elle donne deux choses qu'un atlas seul ne peut pas donner :
 *
 *  - **la cohérence de rue** — les bâtiments d'une même voie partagent une teinte,
 *    parce qu'une rue a été bâtie à une époque, avec les mêmes briques. C'est ce qui
 *    fait qu'une ville paraît construite plutôt que semée au hasard ;
 *  - **la variété de bâtiment** — un écart de quelques pourcents d'une maison à
 *    l'autre, sans quoi une rangée entière devient un seul aplat où l'on ne
 *    distingue plus les maisons.
 *
 * Les valeurs restent proches de 1 : on module, on ne repeint pas. Au-delà de ±12 %,
 * la ville vire au patchwork.
 */
function teinte(b: GenBuilding): [number, number, number] {
  // Teinte de la rue : chaud ↔ froid, clair ↔ sombre.
  const r = b.rue ?? 0
  const chaud = 0.5 + 0.5 * Math.sin(r * 2.399) // ~[0,1]
  const clair = 0.5 + 0.5 * Math.sin(r * 5.117 + 1.3)

  // Écart propre au bâtiment, plus petit d'un ordre de grandeur.
  const jitter = (hash01(b.cx, b.cz) - 0.5) * 0.05

  const v = 0.94 + clair * 0.06 + jitter
  return [
    Math.min(1, v * (0.97 + chaud * 0.05)),
    Math.min(1, v),
    Math.min(1, v * (1.02 - chaud * 0.06)),
  ]
}

/**
 * Construit le volume complet d'un bâtiment classé.
 *
 * Renvoie une géométrie NON INDEXÉE, avec `position` et `uv` — les normales sont
 * recalculées à la fin pour obtenir des facettes franches (le rendu cartoon veut
 * des arêtes nettes, pas un lissage).
 */
export function buildFromArchetype(b: GenBuilding): THREE.BufferGeometry | null {
  const ring = orientRing(b.pts)
  if (!ring || ring.length < 3) return null

  const recette = RECETTES[b.archetype] ?? RECETTES.inconnu
  const sol = terrainHeight(b.cx, b.cz)
  const hMur = Math.max(HAUTEUR_MINI, b.h ?? HAUTEUR_MINI)
  const gouttiere = sol + hMur

  // --- Combien de niveaux ? L'IGN quand il le dit, sinon la hauteur le trahit.
  const niveaux = Math.max(1, b.ign?.etages ?? Math.round(hMur / HAUTEUR_NIVEAU))
  const hNiveau = hMur / niveaux

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const [tr, tg, tb] = teinte(b)

  /**
   * L'aplat d'une surface, modulé par la teinte de rue.
   *
   * En mode texturé, l'atlas portait la couleur et le sommet ne faisait que la
   * moduler ; sans atlas, c'est le sommet qui doit porter la couleur ENTIÈRE,
   * sinon tout le bâtiment sort blanc. `THREE.Color` convertit l'hexa sRGB en
   * linéaire, comme `buildingMesh.ts` — indispensable pour que deux tons proches
   * restent distinguables à l'écran.
   *
   * `facteur` sert la hiérarchie du volume : socle assis, couronnement allégé.
   */
  const TAMPON = new THREE.Color()
  const aplat = (hex: string, facteur = 1): [number, number, number] => {
    if (FACADES_TEXTUREES) return [tr, tg, tb]
    TAMPON.set(hex)
    return [
      Math.min(1, TAMPON.r * tr * facteur),
      Math.min(1, TAMPON.g * tg * facteur),
      Math.min(1, TAMPON.b * tb * facteur),
    ]
  }

  let couleur: [number, number, number] = [tr, tg, tb]

  const pousser = (x: number, y: number, z: number, u: number, v: number) => {
    positions.push(x, y, z)
    uvs.push(u, v)
    colors.push(couleur[0], couleur[1], couleur[2])
  }

  /**
   * Un quad vertical, découpé en deux triangles.
   *
   * ⚠️ L'ORDRE DES SOMMETS N'EST PAS ARBITRAIRE : `bas-gauche → haut-gauche →
   * haut-droit`, exactement comme `buildingMesh.ts`. Le contour sort d'`orientRing`
   * dans un sens connu, et cet ordre-là est celui qui tourne les normales vers
   * l'EXTÉRIEUR.
   *
   * L'inverse (`bas-gauche → bas-droit → …`) paraît tout aussi naturel à écrire,
   * mais retourne toutes les façades : le culling supprime alors la face visible,
   * on voit l'intérieur du bâtiment, et l'éclairage arrive par-derrière — la ville
   * devient plate et terne, sans différence entre une façade au soleil et une à
   * l'ombre. C'était le cas au premier jet.
   */
  const quad = (
    a: number[],
    c: number[],
    y0: number,
    y1: number,
    u0: number,
    u1: number,
    v0: number,
    v1: number,
  ) => {
    pousser(a[0], y0, a[1], u0, v0)
    pousser(a[0], y1, a[1], u0, v1)
    pousser(c[0], y1, c[1], u1, v1)
    pousser(a[0], y0, a[1], u0, v0)
    pousser(c[0], y1, c[1], u1, v1)
    pousser(c[0], y0, c[1], u1, v0)
  }

  // --- Profil de toit : la hauteur en un point ne dépend que de sa distance au
  // faîtage. Même raisonnement que buildingMesh.ts, voir docs/04.
  const rh = b.rh ?? 0
  let nx = 0
  let nz = 0
  let smin = 0
  let smax = 0
  if (rh > 0 && b.ra != null) {
    nx = -Math.sin(b.ra)
    nz = Math.cos(b.ra)
    smin = Infinity
    smax = -Infinity
    for (const [x, z] of ring) {
      const s = x * nx + z * nz
      if (s < smin) smin = s
      if (s > smax) smax = s
    }
  }
  const demi = (smax - smin) / 2
  const monteeToit = (p: number[]) => {
    if (rh <= 0 || demi <= 0.5) return 0
    const s = p[0] * nx + p[1] * nz
    const milieu = (smin + smax) / 2
    return rh * (1 - Math.abs(s - milieu) / demi)
  }

  // Les trois registres de la façade : socle, corps, couronnement.
  const V = {
    socle: vDeBande(bande(recette.style, 'socle')),
    courant: vDeBande(bande(recette.style, 'courant')),
    attique: vDeBande(bande(recette.style, 'attique')),
  }

  /**
   * Quel registre pour le niveau `n` ?
   *
   * Le socle n'existe que si l'archétype le prévoit (un pavillon isolé n'a pas de
   * rez-de-chaussée commercial). Le couronnement demande au moins trois niveaux :
   * sur une maison basse, une corniche marquée écraserait la façade.
   */
  const registreDe = (n: number) => {
    if (n === 0 && recette.rdc) return V.socle
    if (n === niveaux - 1 && niveaux >= 3) return V.attique
    return V.courant
  }

  /**
   * Les aplats des trois registres.
   *
   * Sans fenêtres, c'est ce SEUL écart de valeur qui empêche un immeuble d'être
   * un parallélépipède uni : le socle, plus sombre, pose le bâtiment au sol ; le
   * couronnement, plus clair, l'arrête au lieu de le couper net. Les écarts sont
   * volontairement faibles (±10 %) — au-delà, la façade se lit comme trois
   * bâtiments empilés.
   */
  const mur = couleurMur(recette.style)
  const APLAT = {
    socle: aplat(mur, 0.86),
    courant: aplat(mur),
    attique: aplat(mur, 1.08),
  }
  const aplatDe = (n: number) => {
    if (n === 0 && recette.rdc) return APLAT.socle
    if (n === niveaux - 1 && niveaux >= 3) return APLAT.attique
    return APLAT.courant
  }

  // --- LES MURS, niveau par niveau. C'est ce découpage qui permet un
  // rez-de-chaussée différent des étages, donc une vraie rue commerçante.
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const c = ring[(i + 1) % ring.length]
    const longueur = Math.hypot(c[0] - a[0], c[1] - a[1])
    if (longueur < 0.4) continue // micro-décrochement : rien à y dessiner

    // Nombre entier de travées : une demi-fenêtre au coin se verrait tout de suite.
    const travees = Math.max(1, Math.round(longueur / LARGEUR_TRAVEE))

    for (let n = 0; n < niveaux; n++) {
      const y0 = sol + n * hNiveau
      const y1 = sol + (n + 1) * hNiveau
      const [v0, v1] = registreDe(n)
      couleur = aplatDe(n)
      quad(a, c, y0, y1, 0, travees, v0, v1)
    }

    // --- Le pignon : le triangle entre la gouttière et le rampant du toit.
    // Sans lui, on voit l'intérieur du bâtiment sous chaque toit en pente.
    const ma = monteeToit(a)
    const mc = monteeToit(c)
    if (ma > 0.01 || mc > 0.01) {
      const casePignon = PIGNON[recette.style] ?? 9
      const [pu, pv] = uvPalette(casePignon)
      couleur = aplat(couleurPalette(casePignon))
      // Si le faîtage traverse ce mur, on insère un sommet à la crête : sinon la
      // ligne du haut coupe le pignon en biseau au lieu de culminer.
      const sA = a[0] * nx + a[1] * nz
      const sC = c[0] * nx + c[1] * nz
      const milieu = (smin + smax) / 2
      const traverse = (sA - milieu) * (sC - milieu) < 0
      const points: number[][] = traverse
        ? [a, [a[0] + ((c[0] - a[0]) * (milieu - sA)) / (sC - sA), a[1] + ((c[1] - a[1]) * (milieu - sA)) / (sC - sA)], c]
        : [a, c]

      for (let k = 0; k + 1 < points.length; k++) {
        const p0 = points[k]
        const p1 = points[k + 1]
        const h0 = gouttiere + monteeToit(p0)
        const h1 = gouttiere + monteeToit(p1)
        // Même sens que `quad` : bas-gauche → haut-gauche → haut-droit.
        pousser(p0[0], gouttiere, p0[1], pu, pv)
        pousser(p0[0], h0, p0[1], pu, pv)
        pousser(p1[0], h1, p1[1], pu, pv)
        pousser(p0[0], gouttiere, p0[1], pu, pv)
        pousser(p1[0], h1, p1[1], pu, pv)
        pousser(p1[0], gouttiere, p1[1], pu, pv)
      }
    }

    // --- La jupe enterrée, pour ne pas décoller du sol en pente.
    const [su, sv] = uvPalette(PALETTE_INDEX.soubassement)
    couleur = aplat(couleurPalette(PALETTE_INDEX.soubassement))
    pousser(a[0], sol - JUPE, a[1], su, sv)
    pousser(a[0], sol, a[1], su, sv)
    pousser(c[0], sol, c[1], su, sv)
    pousser(a[0], sol - JUPE, a[1], su, sv)
    pousser(c[0], sol, c[1], su, sv)
    pousser(c[0], sol - JUPE, c[1], su, sv)
  }

  // --- LE TOIT. On triangule l'emprise en éventail et on monte chaque sommet
  // selon sa distance au faîtage. Une teinte est tirée de la position pour que
  // deux toits voisins ne soient pas rigoureusement identiques.
  const caseToit = (b.rm ? TOIT_REEL[b.rm] : undefined) ?? recette.toit
  const variante = hash01(b.cx, b.cz) < 0.35 && caseToit === PALETTE_INDEX.tuile
    ? PALETTE_INDEX.tuileSombre
    : caseToit
  const [tu, tv] = uvPalette(variante)
  // Nuance propre au toit, graine décalée pour qu'elle ne suive pas celle du mur :
  // sans elle, un quartier entier de tuiles devient un seul aplat orange où l'on ne
  // distingue plus les maisons les unes des autres.
  couleur = aplat(couleurPalette(variante), 0.92 + hash01(b.cx + 41.3, b.cz + 19.7) * 0.16)

  // ⚠️ Vraie triangulation, PAS un éventail depuis le premier sommet. Un éventail
  // ne vaut que pour un contour convexe ; or les emprises de centre ancien sont
  // massivement en L ou en U. Avec l'éventail, des triangles se posaient HORS de
  // l'emprise et les bâtiments apparaissaient comme des plaques plates débordant
  // sur la rue. Même méthode que `buildingMesh.ts`.
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z))
  let faces: number[][]
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, [])
  } catch {
    return null // contour dégénéré (auto-intersecté) : on laisse tomber ce bâtiment
  }

  for (const [i0, i1, i2] of faces) {
    const t = [ring[i0], ring[i1], ring[i2]]
    // La face doit regarder le CIEL : si la normale pointe vers le bas, on inverse
    // deux sommets. Sinon le toit est noir, éclairé par en dessous.
    const ax = t[1][0] - t[0][0]
    const az = t[1][1] - t[0][1]
    const bx = t[2][0] - t[0][0]
    const bz = t[2][1] - t[0][1]
    const ordre = ax * bz - az * bx > 0 ? [0, 2, 1] : [0, 1, 2]
    for (const k of ordre) {
      const p = t[k]
      pousser(p[0], gouttiere + monteeToit(p), p[1], tu, tv)
    }
  }

  if (positions.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals() // non indexé → facettes franches, look cartoon
  return geo
}
