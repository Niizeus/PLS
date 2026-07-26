import { useEffect, useRef, useState } from 'react'
import { HUD, panel } from './hudStyle'

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
    // Position gérée par la colonne droite du HUD (`Hud.tsx`).
    <div
      style={{
        ...panel,
        padding: '5px 10px',
        color,
        font: `600 13px ${HUD.mono}`,
        letterSpacing: 0.5,
      }}
    >
      {fps} FPS
    </div>
  )
}
