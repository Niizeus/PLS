import type { CSSProperties } from 'react'

/**
 * 🎨 hudStyle.ts — le vocabulaire visuel COMMUN de l'interface.
 *
 * ── Le parti pris : le HUD est dessiné, comme le reste du jeu ───────────────
 *
 * Avant, tous les blocs étaient des rectangles gris-bleu translucides avec un
 * flou d'arrière-plan. Ça avait deux défauts :
 *  1. **aucune hiérarchie** — le compteur FPS avait exactement le même poids
 *     visuel que la barre de vie ;
 *  2. **aucun rapport avec le jeu** — la 3D est en cell-shading, avec des
 *     contours noirs francs et des aplats de couleur, et l'interface avait
 *     l'esthétique d'un outil de développement.
 *
 * Le HUD parle donc maintenant la même langue que la 3D : **papier crème,
 * contour d'encre épais, ombre portée DURE (sans flou), aplats francs**. Une
 * ombre floue, ça n'existe pas dans une case de BD — c'est ce détail-là qui
 * fait basculer l'ensemble du côté « dessiné ».
 *
 * Pour changer le look du jeu entier, c'est ce fichier qu'on modifie.
 */

/**
 * ✍️ La police du jeu.
 *
 * `PLS Comic` est déclarée dans `src/index.css` et chargée depuis
 * `public/fonts/`. Tant que le fichier n'est pas là, on retombe sur des polices
 * système : le HUD reste lisible et bien mis en page, il perd juste son grain.
 */
const DISPLAY_FONT = "'PLS Comic', 'Trebuchet MS', system-ui, sans-serif"

export const HUD = {
  /** Marge par rapport au bord de l'écran. Toutes les colonnes s'y alignent. */
  edge: 14,
  /** Espace entre deux blocs d'une même colonne. */
  gap: 10,
  radius: 14,

  /** L'encre : le noir des contours. Le même trait que les `<Outlines>` de la 3D. */
  ink: '#161a24',
  /** Le papier : le fond crème des panneaux. */
  paper: '#f7f0e1',
  /** Papier assombri : fond des jauges vides, séparateurs. */
  paperShade: '#d8cfba',

  text: '#161a24',
  textDim: '#6b6252',
  accent: '#2563eb',

  font: DISPLAY_FONT,
  mono: "ui-monospace, 'Cascadia Mono', monospace",

  /** Couleurs des vitaux, en aplats francs (elles servent aussi aux effets). */
  vitals: {
    health: '#e63946',
    hunger: '#f4820a',
    thirst: '#2e9fd8',
    mental: '#9b5de5',
  },
} as const

/** Le contour d'encre, épais. C'est LUI qui fait tenir tout le style. */
export const outline = `3px solid ${HUD.ink}`
/** Version fine, pour les petits éléments (touches, pastilles). */
export const outlineThin = `2px solid ${HUD.ink}`
/** L'ombre portée DURE, décalée : jamais de flou. */
export const hardShadow = `4px 4px 0 ${HUD.ink}`
export const hardShadowSmall = `3px 3px 0 ${HUD.ink}`

/** Le fond commun à tous les panneaux du HUD. */
export const panel: CSSProperties = {
  padding: '9px 12px',
  borderRadius: HUD.radius,
  background: HUD.paper,
  border: outline,
  boxShadow: hardShadow,
  color: HUD.text,
  font: `700 13px ${HUD.font}`,
}

/** Une colonne de panneaux collée à un bord de l'écran. */
export function column(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'fixed',
    top: HUD.edge,
    [side]: HUD.edge,
    display: 'grid',
    gap: HUD.gap,
    justifyItems: side === 'right' ? 'end' : 'start',
    pointerEvents: 'none',
  }
}

/**
 * Une légère inclinaison, comme un élément posé à la main sur la page.
 *
 * ⚠️ À utiliser avec parcimonie et à très faible angle (1 à 2°) : au-delà, le
 * texte devient fatigant à lire et les bords crénelés se voient.
 */
export function tilt(degrees: number): CSSProperties {
  return { transform: `rotate(${degrees}deg)` }
}

/** Le look d'une touche du clavier, partout pareil. */
export const kbd: CSSProperties = {
  justifySelf: 'start',
  padding: '1px 7px',
  borderRadius: 6,
  background: HUD.ink,
  border: outlineThin,
  font: `800 12px ${HUD.mono}`,
  color: HUD.paper,
  whiteSpace: 'nowrap',
}

/** Petit titre de section, en capitales discrètes. */
export const sectionLabel: CSSProperties = {
  font: `800 10px ${HUD.font}`,
  letterSpacing: 1,
  color: HUD.textDim,
  textTransform: 'uppercase',
}

/**
 * Texte posé DIRECTEMENT sur la 3D (sans panneau) : il lui faut un contour
 * d'encre, sinon il devient illisible dès qu'il passe sur un mur clair.
 */
export const inkStroke: CSSProperties = {
  color: HUD.paper,
  WebkitTextStroke: `3px ${HUD.ink}`,
  paintOrder: 'stroke fill',
}
