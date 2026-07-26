import type { CSSProperties } from 'react'
import type { RadioSlotKind } from '../audio/radioSchedule'

/** Styles de la Régie, sortis du composant pour qu'il reste lisible. */

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export const KIND_LABELS: Record<RadioSlotKind, string> = {
  show: 'Émission',
  music: 'Musique',
  ads: 'Publicités',
  off: 'Antenne coupée',
}

export const KIND_COLORS: Record<RadioSlotKind, string> = {
  show: 'rgba(56,189,248,0.35)',
  music: 'rgba(34,197,94,0.18)',
  ads: 'rgba(249,115,22,0.28)',
  off: 'rgba(100,116,139,0.32)',
}

export const page: CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  padding: 20,
  background: '#0b1220',
  color: '#e2e8f0',
  fontFamily: 'system-ui, sans-serif',
}

export const toolbar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 14,
  flexWrap: 'wrap',
}

const cellBase: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.22)',
  padding: 0,
  width: 150,
  height: 34,
}

export const CELL = {
  head: {
    ...cellBase,
    height: 'auto',
    padding: '6px 4px',
    background: 'rgba(148,163,184,0.12)',
    font: '700 12px system-ui, sans-serif',
    color: '#e2e8f0',
  } as CSSProperties,

  hour: {
    ...cellBase,
    width: 52,
    textAlign: 'center',
    background: 'rgba(148,163,184,0.08)',
    font: '600 11px ui-monospace, monospace',
    color: '#94a3b8',
  } as CSSProperties,

  cell: cellBase,

  button: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: '600 11px system-ui, sans-serif',
    cursor: 'pointer',
    padding: '0 6px',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as CSSProperties,

  palette: {
    position: 'absolute',
    zIndex: 10,
    top: '100%',
    left: 0,
    minWidth: 190,
    display: 'grid',
    background: '#111c2f',
    border: '1px solid rgba(148,163,184,0.4)',
    borderRadius: 6,
    boxShadow: '0 10px 26px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  } as CSSProperties,

  option: {
    padding: '7px 10px',
    border: 'none',
    background: 'transparent',
    color: '#e2e8f0',
    font: '600 12px system-ui, sans-serif',
    textAlign: 'left',
    cursor: 'pointer',
  } as CSSProperties,
}
