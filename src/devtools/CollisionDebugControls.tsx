import { useEffect, type CSSProperties } from 'react'
import { useCollisionDebugStore } from './collisionDebugStore'

export default function CollisionDebugControls() {
  const enabled = useCollisionDebugStore((state) => state.enabled)

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== 'F8' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return
      event.preventDefault()
      useCollisionDebugStore.getState().toggle()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!import.meta.env.DEV || !enabled) return null

  return (
    <div style={wrapStyle}>
      <div style={titleStyle}>COLLISIONS F8</div>
      <div>
        <span style={{ color: '#67e8f9' }}>cyan</span> terrain Rapier
      </div>
      <div>
        <span style={{ color: '#f472b6' }}>rose</span> route physique
      </div>
      <div>
        <span style={{ color: '#fb923c' }}>orange</span> murs/batiments
      </div>
    </div>
  )
}

const wrapStyle: CSSProperties = {
  position: 'fixed',
  left: 18,
  bottom: 18,
  zIndex: 1200,
  pointerEvents: 'none',
  display: 'grid',
  gap: 3,
  minWidth: 190,
  padding: '9px 11px',
  borderRadius: 7,
  border: '1px solid rgba(103,232,249,0.55)',
  background: 'rgba(10,18,28,0.9)',
  color: '#e0f2fe',
  font: '700 12px system-ui, sans-serif',
  boxShadow: '0 12px 34px rgba(0,0,0,0.32)',
}

const titleStyle: CSSProperties = {
  color: '#67e8f9',
  fontSize: 11,
  letterSpacing: 0,
}
