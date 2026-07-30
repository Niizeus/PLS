import type { CSSProperties } from 'react'
import type { WarmupProgress } from '../world/startupWarmup'

interface LoadingScreenProps {
  progress: WarmupProgress
}

export default function LoadingScreen({ progress }: LoadingScreenProps) {
  const ratio = progress.total > 0 ? progress.done / progress.total : 0
  return (
    <div style={wrapStyle}>
      <div style={panelStyle}>
        <div style={titleStyle}>PLS</div>
        <div style={labelStyle}>{progress.label}</div>
        <div style={barTrackStyle}>
          <div style={{ ...barFillStyle, transform: `scaleX(${Math.max(0.04, ratio)})` }} />
        </div>
        <div style={metaStyle}>
          {progress.done}/{progress.total}
        </div>
      </div>
    </div>
  )
}

const wrapStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 3000,
  display: 'grid',
  placeItems: 'center',
  background: '#10131a',
  color: '#eef2ff',
  fontFamily: 'system-ui, sans-serif',
}

const panelStyle: CSSProperties = {
  width: 'min(420px, calc(100vw - 48px))',
  display: 'grid',
  gap: 12,
}

const titleStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  letterSpacing: 0,
}

const labelStyle: CSSProperties = {
  minHeight: 22,
  color: '#cbd5e1',
  fontSize: 14,
  fontWeight: 700,
}

const barTrackStyle: CSSProperties = {
  height: 8,
  overflow: 'hidden',
  borderRadius: 4,
  background: '#263044',
}

const barFillStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  transformOrigin: 'left center',
  background: '#38bdf8',
}

const metaStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 12,
  fontWeight: 700,
}
