import type { CSSProperties } from 'react'
import { HUD } from '../hudStyle'

/**
 * 🎨 phoneStyle.ts — le vocabulaire visuel du TÉLÉPHONE.
 *
 * Même principe que `hudStyle.ts` (dont il reprend la police et les couleurs de
 * texte) : un seul endroit pour changer le look de tout le téléphone.
 *
 * Pourquoi un fichier séparé du HUD ? Parce que le téléphone n'est PAS un
 * panneau du HUD : c'est un objet du monde, avec sa coque, son écran et ses
 * propres règles (coins très arrondis, fond opaque, ombre portée franche). Le
 * mélanger à `hudStyle.ts` aurait pollué les deux.
 */

export const PHONE = {
  /** Dimensions de la coque, en pixels écran. Ratio ≈ celui d'un vrai tel. */
  width: 272,
  height: 556,
  /** Épaisseur de la coque autour de l'écran. */
  bezel: 9,
  radiusShell: 36,
  radiusScreen: 28,

  font: HUD.font,
  mono: HUD.mono,

  /** Couleurs de l'écran (l'intérieur du téléphone). */
  screenBg: '#0e1424',
  text: '#eef3fb',
  textDim: '#98a4bb',
  accent: '#7dd3fc',
  /** Fond des tuiles/cartes affichées dans une application. */
  card: 'rgba(148, 163, 184, 0.10)',
  cardBorder: '1px solid rgba(148, 163, 184, 0.16)',
  /** Couleur des éléments « pas encore branchés ». */
  muted: '#64748b',

  /** Durée de l'animation d'entrée/sortie (ms). Partagée avec le composant. */
  animMs: 220,
} as const

/** La coque : dégradé métal sombre + liseré clair qui simule la tranche. */
export const shell: CSSProperties = {
  width: PHONE.width,
  height: PHONE.height,
  padding: PHONE.bezel,
  borderRadius: PHONE.radiusShell,
  background: 'linear-gradient(155deg, #3a4363 0%, #1b2136 42%, #0c1020 100%)',
  border: '1px solid rgba(190, 205, 235, 0.22)',
  boxShadow: [
    '0 24px 60px rgba(0, 0, 0, 0.55)', // l'ombre portée : le tel flotte devant la 3D
    '0 2px 0 rgba(255, 255, 255, 0.10) inset', // reflet du haut de la tranche
    '0 -2px 0 rgba(0, 0, 0, 0.35) inset', // ombre du bas de la tranche
  ].join(', '),
  // Le téléphone, LUI, est cliquable (le reste du HUD ne l'est pas).
  pointerEvents: 'auto',
  color: PHONE.text,
  font: `13px ${PHONE.font}`,
}

/** L'écran : ce qui se trouve à l'intérieur de la coque. */
export const screen: CSSProperties = {
  position: 'relative',
  height: '100%',
  borderRadius: PHONE.radiusScreen,
  overflow: 'hidden',
  background: PHONE.screenBg,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto', // barre d'état / contenu / barre du bas
}

/** Une carte d'information dans une application. */
export const card: CSSProperties = {
  padding: '9px 11px',
  borderRadius: 12,
  background: PHONE.card,
  border: PHONE.cardBorder,
}

/** Petit titre de section à l'intérieur d'une app. */
export const appSectionLabel: CSSProperties = {
  font: `800 10px ${PHONE.font}`,
  letterSpacing: 0.9,
  color: PHONE.textDim,
  textTransform: 'uppercase',
}

/** La zone défilante d'une application (le contenu sous l'en-tête). */
export const appScroll: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  padding: '4px 12px 14px',
  overflowY: 'auto',
  overscrollBehavior: 'contain', // le défilement ne « fuit » pas vers la page
}
