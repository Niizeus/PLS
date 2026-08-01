import * as THREE from 'three'

/**
 * 🎨 facadeAtlas.ts — l'atlas de façades, dessiné PAR LE CODE.
 *
 * C'est lui qui fait la différence entre « un volume peint en aplat » et « un
 * bâtiment ». Fenêtres, portes, vitrines et appareillage vivent ici, en texture.
 *
 * ── Pourquoi en texture et pas en géométrie ─────────────────────────────────
 * Le centre-ville fait ~2 000 bâtiments streamés par tuiles de 180 m. Sortir
 * chaque fenêtre en relief multiplierait les triangles par dix et provoquerait des
 * à-coups au chargement de tuile. En texture, c'est gratuit pour le GPU.
 *
 * ── Pourquoi dessiné par le code et pas des PNG ─────────────────────────────
 * Des PNG seraient des binaires dans Git : illisibles en diff, impossibles à
 * fusionner à deux. Ici, changer la couleur d'une brique est une ligne de code
 * qu'on relit dans une pull request. Et c'est déterministe : même atlas partout.
 *
 * ── Comment l'atlas est organisé ────────────────────────────────────────────
 * L'atlas est une PILE DE BANDES horizontales, chacune sur toute la largeur :
 *
 *     ┌──────────────────────────────┐
 *     │ palette (aplats : toits...)  │  ← une case = une couleur unie
 *     ├──────────────────────────────┤
 *     │ brique-rouge — étage courant │  ← motif répétable horizontalement
 *     │ brique-rouge — rez-de-chaus. │
 *     │ crépi — étage courant        │
 *     │ ...                          │
 *     └──────────────────────────────┘
 *
 * Chaque bande occupe TOUTE la largeur et se raccorde à elle-même : on peut donc
 * répéter en U (`wrapS = RepeatWrapping`) autant de travées que le mur en compte,
 * pendant que V reste bloqué dans la bande (`wrapT = ClampToEdgeWrapping`).
 * L'enroulement est indépendant par axe — c'est ce qui permet UN SEUL matériau
 * pour toute la ville, murs et toits compris.
 */

/** Largeur de l'atlas. Une bande = une travée répétée `BAIES` fois. */
const LARGEUR = 512
const HAUTEUR_BANDE = 160
const BAIES = 4 // travées dessinées par bande (le motif se répète ensuite)

/**
 * Marge de mur nu en haut et en bas de chaque bande, en pixels.
 *
 * Elle sert DEUX choses à la fois :
 *  1. **L'allège et le linteau.** Une fenêtre ne touche jamais le plancher ni le
 *     plafond ; sans cette marge, les baies de deux étages se collaient et la
 *     façade devenait une grille.
 *  2. **La protection des mipmaps.** Les bandes sont empilées dans un seul atlas :
 *     à mesure que les niveaux de mipmap réduisent l'image, une bande finirait par
 *     se mélanger à sa voisine et on verrait une frange de la mauvaise couleur en
 *     haut de chaque mur. Ces pixels de mur nu absorbent le mélange.
 */
const MARGE = 22

/** Hauteur de la bande de palette, en pixels. */
const PALETTE_H = 32
/** Nombre de cases de couleur unie. */
const PALETTE_N = 16

/** Un style de façade : ce qui distingue une brique beauvaisienne d'un crépi 70s. */
interface Style {
  key: string
  /** Couleur du mur. */
  mur: string
  /** Couleur du mortier / des joints, ou `null` si façade lisse. */
  joint: string | null
  /** Couleur de la vitre. */
  vitre: string
  /** Encadrement de baie. */
  encadrement: string
  /** Volets, ou `null`. */
  volet: string | null
  /** Proportions de la baie, en fraction de la travée et de l'étage. */
  baieL: number
  baieH: number
  /** Rez-de-chaussée : vitrine commerciale, porte de garage, ou comme les étages. */
  rdc: 'vitrine' | 'garage' | 'normal' | 'porte'
}

/**
 * Les styles. Volontairement peu nombreux : mieux vaut six familles crédibles que
 * vingt approximatives. Les couleurs sont celles de Beauvais — brique rouge et
 * pierre claire dominent, l'ardoise et la tuile se partagent les toits.
 */
const STYLES: Style[] = [
  {
    key: 'brique-ancienne',
    mur: '#9e4a30',
    joint: '#7d3826',
    vitre: '#232c36',
    encadrement: '#e3d8c2',
    volet: '#5d7a5c',
    baieL: 0.5,
    baieH: 0.62,
    rdc: 'porte',
  },
  {
    key: 'brique-reconstruction',
    mur: '#b35f38',
    joint: '#9a4f2d',
    vitre: '#28323d',
    encadrement: '#ece3d2',
    volet: null,
    baieL: 0.56,
    baieH: 0.66,
    rdc: 'normal',
  },
  {
    key: 'pierre-commerce',
    mur: '#d6c9a8',
    joint: '#c0b18d',
    vitre: '#232d38',
    encadrement: '#8d8367',
    volet: null,
    baieL: 0.54,
    baieH: 0.66,
    rdc: 'vitrine',
  },
  {
    key: 'crepi',
    mur: '#ddd2ba',
    joint: null,
    vitre: '#2e3945',
    encadrement: '#b9ab8e',
    volet: '#7d5f3f',
    baieL: 0.5,
    baieH: 0.56,
    rdc: 'garage',
  },
  {
    key: 'beton',
    mur: '#c2beb2',
    joint: null,
    vitre: '#303c49',
    encadrement: '#959083',
    volet: null,
    baieL: 0.68,
    baieH: 0.6,
    rdc: 'normal',
  },
  {
    key: 'tole',
    mur: '#8f9298',
    joint: '#7d8087',
    vitre: '#454f5a',
    encadrement: '#7d8087',
    baieL: 0.2,
    baieH: 0.25,
    volet: null,
    rdc: 'garage',
  },
  {
    key: 'pierre-noble',
    mur: '#c3bba8',
    joint: '#ada492',
    vitre: '#2a3440',
    encadrement: '#a8a08d',
    volet: null,
    baieL: 0.34,
    baieH: 0.68,
    rdc: 'porte',
  },
]

/** Couleurs unies de la palette, dans l'ordre des cases. */
const PALETTE = [
  '#a8452c', // 0 tuile
  '#454c58', // 1 ardoise
  '#8e949c', // 2 zinc
  '#8a8781', // 3 béton / terrasse
  '#8d3a25', // 4 tuile sombre (variation)
  '#5c6470', // 5 ardoise claire
  '#9e4a30', // 6 pignon brique ancienne
  '#b35f38', // 7 pignon brique reconstruction
  '#d6c9a8', // 8 pignon pierre
  '#ddd2ba', // 9 pignon crépi
  '#c2beb2', // 10 pignon béton
  '#8f9298', // 11 pignon tôle
  '#c3bba8', // 12 pignon pierre noble
  '#6f6a5e', // 13 soubassement
  '#3a3f47', // 14 ombre / sol
  '#d8cdb8', // 15 réserve
]

export const PALETTE_INDEX = {
  tuile: 0,
  ardoise: 1,
  zinc: 2,
  beton: 3,
  tuileSombre: 4,
  ardoiseClaire: 5,
  soubassement: 13,
} as const

/**
 * Les trois registres d'une façade.
 *
 * ⚠️ C'est LE point qui séparait « un mur percé de trous » d'un bâtiment. Une façade
 * ne se lit pas comme une grille uniforme du sol au toit : elle a un **socle** (plus
 * massif, souvent en pierre, avec les portes et les vitrines), un **corps** (les
 * étages répétés) et un **couronnement** (dernier niveau + corniche). Sans cette
 * hiérarchie, un immeuble de six étages ressemble à un tableur.
 */
export type Registre = 'socle' | 'courant' | 'attique'

const REGISTRES: Registre[] = ['socle', 'courant', 'attique']

export function bande(styleKey: string, registre: Registre) {
  const i = STYLES.findIndex((s) => s.key === styleKey)
  return (i < 0 ? 0 : i) * REGISTRES.length + REGISTRES.indexOf(registre)
}

const NB_BANDES = STYLES.length * REGISTRES.length
const HAUTEUR = PALETTE_H + NB_BANDES * HAUTEUR_BANDE

/**
 * Coordonnées V d'une bande, légèrement rentrées.
 *
 * ⚠️ Le demi-pixel de marge n'est pas un détail : sans lui, le filtrage échantillonne
 * la bande voisine sur la dernière ligne et on voit une frange de la mauvaise
 * couleur en haut ou en bas de chaque mur.
 */
export function vDeBande(bande: number): [number, number] {
  const y0 = PALETTE_H + bande * HAUTEUR_BANDE
  return [(y0 + 0.5) / HAUTEUR, (y0 + HAUTEUR_BANDE - 0.5) / HAUTEUR]
}

/** Coordonnées UV du centre d'une case de palette : pour peindre un aplat. */
export function uvPalette(index: number): [number, number] {
  const largeurCase = LARGEUR / PALETTE_N
  const u = ((index + 0.5) * largeurCase) / LARGEUR
  const v = PALETTE_H / 2 / HAUTEUR
  return [u, v]
}

// ─────────────────────────────────────────────────────────────────────────────
// DESSIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Une baie, dessinée pour qu'elle se lise comme un TROU et pas comme un autocollant.
 *
 * Quatre éléments, et c'est le premier qui fait tout le travail :
 *  1. **l'embrasure** — une ombre portée en haut et à gauche de l'ouverture. C'est
 *     elle qui donne l'épaisseur du mur ; sans elle la fenêtre est plate ;
 *  2. **l'encadrement** clair, qui détache la baie du mur ;
 *  3. **le verre** en deux tons — plus sombre en haut, plus clair en bas, comme un
 *     ciel qui s'y reflète ;
 *  4. **l'appui** saillant sous la baie, qui l'assoit.
 */
function baie(
  ctx: CanvasRenderingContext2D,
  s: Style,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // 1. Embrasure : l'ombre de l'épaisseur du mur.
  ctx.fillStyle = 'rgba(0,0,0,0.30)'
  ctx.fillRect(x - 4, y - 4, w + 8, h + 6)

  // 2. Encadrement.
  ctx.fillStyle = s.encadrement
  ctx.fillRect(x - 3, y - 3, w + 6, h + 5)

  // 3. Verre, en deux tons.
  ctx.fillStyle = s.vitre
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.09)'
  ctx.fillRect(x, y + h * 0.55, w, h * 0.45)
  // Ombre interne en haut : le tableau de la fenêtre.
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(x, y, w, 3)
  ctx.fillRect(x, y, 2, h)

  // Meneau et traverse : deux traits fins suffisent à faire lire « fenêtre ».
  ctx.fillStyle = 'rgba(255,255,255,0.13)'
  ctx.fillRect(x + w / 2 - 1, y, 2, h)
  ctx.fillRect(x, y + h * 0.42, w, 1)

  // 4. Appui saillant.
  ctx.fillStyle = s.encadrement
  ctx.fillRect(x - 6, y + h + 2, w + 12, 4)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fillRect(x - 6, y + h + 6, w + 12, 2)

  if (s.volet) {
    const vw = w * 0.26
    ctx.fillStyle = s.volet
    ctx.fillRect(x - 3 - vw, y - 3, vw, h + 5)
    ctx.fillRect(x + w + 3, y - 3, vw, h + 5)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    for (let ly = y; ly < y + h; ly += 5) {
      ctx.fillRect(x - 3 - vw, ly, vw, 1)
      ctx.fillRect(x + w + 3, ly, vw, 1)
    }
  }
}

/** Appareillage du mur : lits de briques ou de pierres, discrets mais indispensables. */
function appareillage(ctx: CanvasRenderingContext2D, s: Style, yBande: number) {
  if (!s.joint) return
  ctx.fillStyle = s.joint
  const lit = s.key === 'tole' ? 6 : 10
  for (let by = 0; by < HAUTEUR_BANDE; by += lit) {
    ctx.fillRect(0, yBande + by, LARGEUR, 1)
    if (s.key === 'tole') continue
    // Joints verticaux décalés d'un lit sur deux : sinon on lit une grille.
    const decal = (by / lit) % 2 === 0 ? 0 : 10
    for (let bx = decal; bx < LARGEUR; bx += 20) ctx.fillRect(bx, yBande + by, 1, lit)
  }
}

/**
 * Dessine une bande de façade.
 *
 * Le `registre` décide de tout : c'est lui qui donne à l'immeuble son socle, son
 * corps et son couronnement au lieu d'une grille uniforme.
 */
function dessinerBande(ctx: CanvasRenderingContext2D, s: Style, yBande: number, registre: Registre) {
  const L = LARGEUR / BAIES // largeur d'une travée, en pixels
  const y = yBande + MARGE // zone utile : les marges restent en mur nu
  const H = HAUTEUR_BANDE - 2 * MARGE

  ctx.fillStyle = s.mur
  ctx.fillRect(0, yBande, LARGEUR, HAUTEUR_BANDE)
  appareillage(ctx, s, yBande)

  // ── SOCLE : plus sombre, assis sur un soubassement. C'est ce contraste de
  // valeur qui fait « poser » le bâtiment au sol au lieu de le laisser flotter.
  if (registre === 'socle') {
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.fillRect(0, yBande, LARGEUR, HAUTEUR_BANDE)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.fillRect(0, yBande + HAUTEUR_BANDE - 14, LARGEUR, 14) // soubassement
  }

  // ── COURONNEMENT : la corniche. Une simple ligne claire en surplomb, mais elle
  // termine la façade — sans elle un immeuble s'arrête net, comme coupé au couteau.
  if (registre === 'attique') {
    ctx.fillStyle = s.encadrement
    ctx.fillRect(0, yBande + 3, LARGEUR, 6)
    ctx.fillStyle = 'rgba(0,0,0,0.30)'
    ctx.fillRect(0, yBande + 9, LARGEUR, 4)
  }

  // ── Bandeau d'étage, dans la marge basse : le rythme horizontal des rues.
  if (registre !== 'socle') {
    ctx.fillStyle = s.encadrement
    ctx.globalAlpha = 0.4
    ctx.fillRect(0, yBande + HAUTEUR_BANDE - 5, LARGEUR, 3)
    ctx.globalAlpha = 1
  }

  for (let i = 0; i < BAIES; i++) {
    const cx = i * L + L / 2

    // ── Le rez-de-chaussée ne ressemble jamais aux étages : c'est là que se
    // jouent la vitrine, la porte cochère, le garage.
    if (registre === 'socle' && s.rdc === 'vitrine') {
      const w = L * 0.76
      const h = H * 0.66
      const x = cx - w / 2
      const yy = y + H - h - 10
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(x - 5, yy - 5, w + 10, h + 10)
      ctx.fillStyle = '#2a2f36'
      ctx.fillRect(x - 3, yy - 3, w + 6, h + 6)
      ctx.fillStyle = s.vitre
      ctx.fillRect(x, yy, w, h)
      // Reflet oblique : sans lui, une vitrine se lit comme un trou noir.
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.beginPath()
      ctx.moveTo(x, yy + h)
      ctx.lineTo(x + w * 0.5, yy)
      ctx.lineTo(x + w * 0.78, yy)
      ctx.lineTo(x + w * 0.28, yy + h)
      ctx.closePath()
      ctx.fill()
      // Bandeau d'enseigne, au-dessus.
      ctx.fillStyle = s.encadrement
      ctx.fillRect(x - 5, yy - 18, w + 10, 12)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(x - 5, yy - 7, w + 10, 2)
      continue
    }

    if (registre === 'socle' && s.rdc === 'garage') {
      const w = L * 0.68
      const h = H * 0.72
      const x = cx - w / 2
      const yy = y + H - h
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(x - 3, yy - 3, w + 6, h + 3)
      ctx.fillStyle = '#7d7468'
      ctx.fillRect(x, yy, w, h)
      ctx.fillStyle = 'rgba(0,0,0,0.16)'
      for (let ry = yy + 4; ry < yy + h; ry += 7) ctx.fillRect(x, ry, w, 2)
      continue
    }

    if (registre === 'socle' && s.rdc === 'porte') {
      // Une porte une travée sur deux, une fenêtre sinon : c'est le rythme d'une
      // rue de maisons de ville.
      if (i % 2 === 1) {
        const w = L * 0.32
        const h = H * 0.8
        const x = cx - w / 2
        const yy = y + H - h
        ctx.fillStyle = 'rgba(0,0,0,0.32)'
        ctx.fillRect(x - 5, yy - 5, w + 10, h + 5)
        ctx.fillStyle = s.encadrement
        ctx.fillRect(x - 3, yy - 3, w + 6, h + 3)
        ctx.fillStyle = '#5b4636'
        ctx.fillRect(x, yy, w, h)
        ctx.fillStyle = 'rgba(255,255,255,0.10)'
        ctx.fillRect(x + w * 0.18, yy + h * 0.1, w * 0.64, h * 0.24)
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(x + w * 0.18, yy + h * 0.42, w * 0.64, h * 0.42)
        continue
      }
    }

    // ── Baie ordinaire. Proportions PORTRAIT : une fenêtre française est plus
    // haute que large. Carrée, elle donne un air de bureau moderne à tout.
    const w = L * s.baieL
    const h = Math.min(H * 0.86, w * 1.55)
    baie(ctx, s, cx - w / 2, y + (H - h) / 2 - 2, w, h)
  }
}

let texture: THREE.CanvasTexture | null = null

/**
 * L'atlas, construit une seule fois et partagé par toute la ville.
 *
 * ── Le filtrage, et pourquoi il compte plus qu'on ne croit ──────────────────
 * Premier jet : `NearestFilter` partout et `generateMipmaps = false`, pour « le
 * trait net du cel-shading ». Résultat en jeu : à dix mètres, chaque fenêtre
 * tombait entre deux texels et la façade se désintégrait en tirets scintillants.
 * C'est le repliement de spectre classique — sans mipmap, une texture minifiée
 * n'échantillonne qu'un pixel sur N au lieu de faire la moyenne.
 *
 * Réglage retenu :
 *  - `magFilter = NearestFilter` → de près, l'arête reste franche (look BD) ;
 *  - `minFilter = LinearMipmapLinearFilter` → de loin, les fenêtres fondent
 *    proprement dans le mur au lieu de grésiller ;
 *  - `anisotropy` → les façades vues en biais, c'est-à-dire presque toutes dans
 *    une rue, restent lisibles au lieu de se brouiller.
 */
export function facadeAtlas(): THREE.CanvasTexture {
  if (texture) return texture

  const canvas = document.createElement('canvas')
  canvas.width = LARGEUR
  canvas.height = HAUTEUR
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D indisponible : impossible de construire l\'atlas de façades')

  // Palette d'aplats.
  const largeurCase = LARGEUR / PALETTE_N
  for (let i = 0; i < PALETTE_N; i++) {
    ctx.fillStyle = PALETTE[i] ?? '#ff00ff'
    ctx.fillRect(i * largeurCase, 0, largeurCase, PALETTE_H)
  }

  // Bandes de façade : socle, étage courant et couronnement, pour chaque style.
  STYLES.forEach((s, i) => {
    REGISTRES.forEach((r, k) => {
      dessinerBande(ctx, s, PALETTE_H + (i * REGISTRES.length + k) * HAUTEUR_BANDE, r)
    })
  })

  texture = new THREE.CanvasTexture(canvas)
  // U se répète (une travée après l'autre), V reste dans sa bande.
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export const STYLE_KEYS = STYLES.map((s) => s.key)

// ─────────────────────────────────────────────────────────────────────────────
// 🚫 INTERRUPTEUR — les façades texturées sont DÉSACTIVÉES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tant que ceci vaut `false`, AUCUNE fenêtre dessinée n'apparaît en jeu : les
 * bâtiments sont rendus en aplats cel-shading (voir `buildingGen.ts`).
 *
 * Pourquoi : l'atlas produisait des grilles de fenêtres régulières sur toute la
 * hauteur des volumes. Sur un bâtiment long (lycée, grand ensemble), le résultat
 * ne ressemble pas à Beauvais — c'est un damier de rectangles sombres, sans
 * hiérarchie ni identité. Le défaut n'est pas dans le réglage des couleurs, il
 * est dans la méthode : une texture répétée à l'identique sur chaque travée ne
 * peut pas produire une façade.
 *
 * Le code de l'atlas est CONSERVÉ, pas supprimé : la palette d'aplats (toits,
 * pignons, soubassements) reste la référence de couleurs, et l'aperçu
 * `src/devtools/atlasPreview.ts` continue de fonctionner pour expérimenter hors
 * jeu. Ne repasse ce drapeau à `true` que le jour où une vraie méthode de
 * génération de façades est validée en jeu.
 */
export const FACADES_TEXTUREES = false

/** Couleur de mur d'un style, pour le rendu en aplats. */
export function couleurMur(styleKey: string): string {
  return (STYLES.find((s) => s.key === styleKey) ?? STYLES[0]).mur
}

/** Couleur d'une case de palette, pour le rendu en aplats. */
export function couleurPalette(index: number): string {
  return PALETTE[index] ?? '#ff00ff'
}
