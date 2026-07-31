import { useEffect, useState } from 'react'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { HUD, hardShadow, outline } from './hudStyle'

/**
 * 🪧 Le nom du quartier, affiché QUAND ON Y ENTRE — puis effacé.
 *
 * Avant, il était collé en permanence sous l'identité du joueur, en tout petit.
 * Or c'est une information qui n'a d'intérêt qu'**au moment où elle change** :
 * savoir qu'on entre dans un quartier, oui ; se le faire rappeler pendant vingt
 * minutes, non. En passager, il devient une vraie annonce (grande, lisible) et
 * il rend l'écran au jeu le reste du temps.
 *
 * Le joueur peut toujours savoir où il est à tout moment : c'est dans l'app
 * Santé du téléphone.
 */

/** Durée totale de l'animation — doit rester alignée sur `pls-toast` (index.css). */
const TOAST_MS = 3200

export default function ZoneToast() {
  const zoneName = usePlayerStore((s) => s.zoneName)
  const [shown, setShown] = useState<string | null>(null)

  useEffect(() => {
    if (!zoneName) return
    setShown(zoneName)
    const timer = setTimeout(() => setShown(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [zoneName])

  if (!shown) return null

  return (
    <div
      // `key` : réafficher deux fois le même quartier doit RELANCER l'animation.
      key={shown}
      style={{
        position: 'fixed',
        left: '50%',
        top: 74,
        padding: '7px 18px',
        borderRadius: 999,
        background: HUD.paper,
        border: outline,
        boxShadow: hardShadow,
        color: HUD.ink,
        font: `900 17px ${HUD.font}`,
        letterSpacing: 0.5,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        animation: `pls-toast ${TOAST_MS}ms ease forwards`,
      }}
    >
      📍 {shown}
    </div>
  )
}
