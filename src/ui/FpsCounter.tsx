import { useEffect, useRef, useState } from 'react'

/**
 * Compteur de FPS (images/seconde), pour vérifier qu'on tient nos 60.
 * On mesure via requestAnimationFrame = le vrai rythme d'affichage du navigateur.
 * Vert = 55+, orange = 30-54, rouge = <30.
 */
export default function FpsCounter() {
  const [fps, setFps] = useState(0)
  const frames = useRef(0)
  const last = useRef(performance.now())

  useEffect(() => {
    let raf = 0
    const loop = () => {
      frames.current++
      const now = performance.now()
      const elapsed = now - last.current
      // On rafraîchit l'affichage ~2 fois par seconde (plus stable à lire).
      if (elapsed >= 500) {
        setFps(Math.round((frames.current * 1000) / elapsed))
        frames.current = 0
        last.current = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const color = fps >= 55 ? '#5cf07a' : fps >= 30 ? '#f0c04a' : '#f05c5c'

  return (
    <div
      style={{
        position: 'fixed',
        // Sous la minimap (qui occupe le coin haut-droit).
        top: 184,
        right: 12,
        padding: '6px 10px',
        borderRadius: 8,
        background: 'rgba(15, 20, 34, 0.7)',
        color,
        font: '600 14px ui-monospace, monospace',
        letterSpacing: 0.5,
        pointerEvents: 'none',
      }}
    >
      {fps} FPS
    </div>
  )
}
