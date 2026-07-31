import type { CSSProperties } from 'react'
import type { WarmupProgress } from '../world/startupWarmup'
import { HUD } from './hudStyle'

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

/**
 * 🎨 Premier écran que voit le joueur : c'est lui qui donne le ton. Il suit donc
 * le même langage que le reste (encre + papier), en inversé — encre au fond,
 * papier dessus — pour ne pas éblouir avant même d'avoir lancé la partie.
 */
const wrapStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 3000,
  display: 'grid',
  placeItems: 'center',
  background: HUD.ink,
  color: HUD.paper,
  fontFamily: HUD.font,
}

const panelStyle: CSSProperties = {
  width: 'min(420px, calc(100vw - 48px))',
  display: 'grid',
  gap: 12,
}

const titleStyle: CSSProperties = {
  font: `900 62px ${HUD.font}`,
  lineHeight: 1,
  letterSpacing: 2,
  // Le titre est posé de travers, comme un logo tamponné sur la page.
  transform: 'rotate(-2deg)',
  color: '#ffd83d',
  WebkitTextStroke: `4px ${HUD.paper}`,
  paintOrder: 'stroke fill',
}

const labelStyle: CSSProperties = {
  minHeight: 22,
  color: HUD.paperShade,
  font: `800 14px ${HUD.font}`,
}

const barTrackStyle: CSSProperties = {
  height: 14,
  overflow: 'hidden',
  borderRadius: 999,
  background: 'rgba(247, 240, 225, 0.16)',
  border: `2px solid ${HUD.paper}`,
}

const barFillStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  transformOrigin: 'left center',
  background: '#ffd83d',
  transition: 'transform 220ms ease',
}

const metaStyle: CSSProperties = {
  color: HUD.paperShade,
  font: `800 12px ${HUD.mono}`,
}
