import type { CSSProperties } from 'react'

/**
 * Styles partages du panneau `F2`.
 *
 * Tout est en styles inline (pas de CSS global) pour que l'outil dev reste
 * autonome et n'entre jamais en conflit avec le style du jeu.
 */

export const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  pointerEvents: 'auto',
  background: 'rgba(3,7,18,0.42)',
}

export const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 18,
  right: 18,
  bottom: 18,
  width: 'min(1120px, calc(100vw - 36px))',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  border: '1px solid rgba(148,163,184,0.34)',
  borderRadius: 10,
  background: 'rgba(15,23,42,0.97)',
  color: '#e5e7eb',
  fontFamily: 'system-ui, sans-serif',
  boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
  overflow: 'hidden',
}

export const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '14px 16px',
  borderBottom: '1px solid rgba(148,163,184,0.22)',
}

export const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 900 }
export const subtitleStyle: CSSProperties = { marginTop: 3, fontSize: 12, color: '#94a3b8' }

export const tabsStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '10px 12px',
  borderBottom: '1px solid rgba(148,163,184,0.18)',
  overflowX: 'auto',
  alignItems: 'center',
}

export const tabStyle: CSSProperties = {
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(148,163,184,0.25)',
  borderRadius: 6,
  padding: '7px 10px',
  background: 'rgba(30,41,59,0.8)',
  color: '#cbd5e1',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export const activeTabStyle: CSSProperties = {
  ...tabStyle,
  background: '#eab308',
  borderColor: '#facc15',
  color: '#111827',
  fontWeight: 800,
}

export const bodyStyle: CSSProperties = { overflow: 'hidden', display: 'grid', minHeight: 0 }

/** Deux colonnes : les reglages a gauche, l'aide contextuelle a droite. */
export const splitBodyStyle: CSSProperties = {
  ...bodyStyle,
  gridTemplateColumns: 'minmax(0, 1fr) 300px',
}

export const scrollAreaStyle: CSSProperties = { overflow: 'auto', padding: 14, minHeight: 0 }

export const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 10,
}

export const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 10,
  borderRadius: 6,
  background: 'rgba(30,41,59,0.72)',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(148,163,184,0.18)',
}

export const modifiedFieldStyle: CSSProperties = {
  ...fieldStyle,
  borderColor: 'rgba(234,179,8,0.55)',
  background: 'rgba(52,44,20,0.6)',
}

export const fieldTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 750,
}

export const numberInputStyle: CSSProperties = {
  width: 82,
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 5,
  background: '#020617',
  color: '#e5e7eb',
  padding: '4px 6px',
  font: '12px ui-monospace, monospace',
}

export const helpStyle: CSSProperties = { color: '#94a3b8', fontSize: 11, lineHeight: 1.3 }

export const metaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  fontSize: 11,
  color: '#94a3b8',
  fontFamily: 'ui-monospace, monospace',
}

export const footerStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: 12,
  borderTop: '1px solid rgba(148,163,184,0.18)',
}

export const buttonStyle: CSSProperties = {
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(234,179,8,0.48)',
  borderRadius: 6,
  background: 'rgba(113,63,18,0.7)',
  color: '#fef3c7',
  padding: '7px 10px',
  fontWeight: 750,
  cursor: 'pointer',
}

export const ghostButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: 'rgba(148,163,184,0.3)',
  background: 'rgba(30,41,59,0.8)',
  color: '#cbd5e1',
}

export const smallButtonStyle: CSSProperties = { ...buttonStyle, padding: '5px 9px' }

export const iconButtonStyle: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 5,
  background: 'rgba(15,23,42,0.9)',
  color: '#cbd5e1',
  padding: '2px 7px',
  fontSize: 12,
  cursor: 'pointer',
  lineHeight: 1.4,
}

export const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: 'rgba(248,113,113,0.58)',
  background: 'rgba(127,29,29,0.82)',
  color: '#fee2e2',
}

export const activeToggleStyle: CSSProperties = {
  ...ghostButtonStyle,
  background: '#eab308',
  borderColor: '#facc15',
  color: '#111827',
  fontWeight: 800,
}

export const actionRowStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
}

export const readoutStyle: CSSProperties = {
  gridColumn: '1 / -1',
  padding: 10,
  borderRadius: 6,
  background: 'rgba(2,6,23,0.7)',
  color: '#f8fafc',
  fontWeight: 850,
}

export const searchInputStyle: CSSProperties = {
  flex: '1 1 160px',
  minWidth: 120,
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 6,
  background: '#020617',
  color: '#e5e7eb',
  padding: '6px 9px',
  fontSize: 12,
}

export const selectStyle: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 6,
  background: '#020617',
  color: '#e5e7eb',
  padding: '6px 8px',
  fontSize: 12,
  width: '100%',
}

export const groupCardStyle: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 8,
  background: 'rgba(2,6,23,0.4)',
  marginBottom: 12,
  overflow: 'hidden',
}

export const groupHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 12px',
  border: 'none',
  background: 'rgba(30,41,59,0.7)',
  color: '#e5e7eb',
  cursor: 'pointer',
  textAlign: 'left',
}

export const groupHighlightStyle: CSSProperties = {
  ...groupHeaderStyle,
  background: 'rgba(113,63,18,0.75)',
}

export const groupBodyStyle: CSSProperties = { padding: 12, display: 'grid', gap: 10 }

export const badgeStyle: CSSProperties = {
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(148,163,184,0.3)',
  padding: '1px 7px',
  fontSize: 10,
  fontWeight: 800,
  color: '#cbd5e1',
}

export const warnBadgeStyle: CSSProperties = {
  ...badgeStyle,
  borderColor: 'rgba(234,179,8,0.5)',
  background: 'rgba(113,63,18,0.5)',
  color: '#fde68a',
}

export const helpPanelStyle: CSSProperties = {
  borderLeft: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(2,6,23,0.55)',
  padding: 14,
  overflow: 'auto',
  fontSize: 12,
  lineHeight: 1.45,
  color: '#cbd5e1',
  minHeight: 0,
}

export const noticeStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid rgba(234,179,8,0.45)',
  background: 'rgba(113,63,18,0.4)',
  color: '#fde68a',
  fontSize: 12,
  marginBottom: 12,
}

export const jsonBoxStyle: CSSProperties = { display: 'grid', gap: 10 }

export const textareaStyle: CSSProperties = {
  minHeight: 420,
  resize: 'vertical',
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 6,
  background: '#020617',
  color: '#dbeafe',
  padding: 12,
  font: '12px ui-monospace, monospace',
  lineHeight: 1.5,
}

export const errorStyle: CSSProperties = { color: '#fecaca', fontSize: 12, fontWeight: 700 }
export const infoStyle: CSSProperties = { color: '#bbf7d0', fontSize: 12, fontWeight: 700 }
