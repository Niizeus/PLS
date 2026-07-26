import type { CSSProperties } from 'react'

/**
 * 🎨 hudStyle.ts — le vocabulaire visuel COMMUN de l'interface.
 *
 * Avant, chaque bloc du HUD avait ses propres valeurs : trois fonds différents
 * (`rgba(15,20,34,.7)`, `.72`, `rgba(10,15,28,.78)`), des rayons de 8 ou 10, des
 * bordures présentes ici et absentes là. Ça se voyait : l'écran ressemblait à des
 * vignettes collées les unes à côté des autres plutôt qu'à une seule interface.
 *
 * Tout le monde pioche maintenant ici. Pour changer le look du jeu entier, c'est
 * ce fichier qu'on modifie — un seul endroit.
 */

export const HUD = {
  /** Marge par rapport au bord de l'écran. Toutes les colonnes s'y alignent. */
  edge: 12,
  /** Espace entre deux blocs d'une même colonne. */
  gap: 8,
  radius: 10,
  bg: 'rgba(12, 17, 30, 0.72)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  shadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
  text: '#e6ecf5',
  textDim: '#aeb8c8',
  accent: '#93c5fd',
  font: 'system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
} as const

/** Le fond commun à tous les panneaux du HUD. */
export const panel: CSSProperties = {
  padding: '10px 12px',
  borderRadius: HUD.radius,
  background: HUD.bg,
  border: HUD.border,
  boxShadow: HUD.shadow,
  // Le flou fait "reposer" le panneau sur la 3D au lieu de flotter par-dessus :
  // c'est ce qui donne le sentiment d'une interface intégrée au jeu.
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: HUD.text,
  font: `13px ${HUD.font}`,
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

/** Le look d'une touche du clavier, partout pareil. */
export const kbd: CSSProperties = {
  justifySelf: 'start',
  padding: '1px 7px',
  borderRadius: 5,
  background: 'rgba(43, 53, 80, 0.9)',
  border: '1px solid rgba(69, 85, 127, 0.9)',
  font: `600 12px ${HUD.mono}`,
  color: HUD.text,
  whiteSpace: 'nowrap',
}

/** Petit titre de section, en capitales discrètes. */
export const sectionLabel: CSSProperties = {
  font: `800 10px ${HUD.font}`,
  letterSpacing: 0.8,
  color: HUD.textDim,
  textTransform: 'uppercase',
}
