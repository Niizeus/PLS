import { useEffect, useRef, useState } from 'react'
import { HUD, panel } from './hudStyle'

/**
 * Compteur de FPS (images/seconde), pour vérifier qu'on tient nos 60.
 * On mesure via requestAnimationFrame = le vrai rythme d'affichage du navigateur.
 * Vert = 55+, orange = 30-54, rouge = <30.
 *
 * ⚠️ **Outil de développement, invisible en jeu.** C'est une information qui ne
 * concerne que nous : à l'écran, elle occupait autant de place qu'une jauge de
 * vie. Elle n'est donc rendue qu'en `npm run dev` — la version jouable ne
 * l'affiche pas du tout (le composant sort avant même de brancher sa boucle).
 */
export default function FpsCounter() {
  const [fps, setFps] = useState(0)
  const frames = useRef(0)
  const last = useRef(performance.now())

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
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

  if (!import.meta.env.DEV) return null

  const color = fps >= 55 ? '#2f7d32' : fps >= 30 ? '#a4680b' : '#b32217'

  return (
    // Position gérée par la colonne droite du HUD (`Hud.tsx`).
    <div
      style={{
        ...panel,
        padding: '3px 9px',
        color,
        font: `800 11px ${HUD.mono}`,
        letterSpacing: 0.4,
        opacity: 0.85,
      }}
    >
      {fps} FPS
    </div>
  )
}
