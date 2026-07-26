import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { SPAWN } from '../world/beauvais/cityData'
import { buildingsNear } from '../world/beauvais/collision'
import { drawBuildings, drawPlayer, type MapView } from './mapDraw'
import { HUD } from './hudStyle'

/**
 * Minimap ronde en haut à droite : vue du dessus centrée sur le joueur, nord en haut.
 *
 * On dessine dans un <canvas> via une boucle d'animation (requestAnimationFrame) :
 * ça vit HORS de React (pas de re-render), on lit juste la position du joueur dans
 * le store à chaque image. C'est le même principe que la logique de jeu.
 */

const SIZE = 160 // diamètre de la minimap en pixels
const VIEW_RADIUS = 110 // rayon du monde affiché (mètres) autour du joueur

export default function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scale = SIZE / 2 / VIEW_RADIUS
    let raf = 0

    const render = () => {
      // Position + orientation du joueur (repli sur le spawn tant qu'il n'existe pas).
      const player = usePlayerStore.getState().playerObject
      const px = player ? player.position.x : SPAWN.x
      const pz = player ? player.position.z : SPAWN.z
      const angle = player ? player.rotation.y : 0

      const view: MapView = { centerX: px, centerZ: pz, scale, w: SIZE, h: SIZE }

      ctx.clearRect(0, 0, SIZE, SIZE)
      // Fond (le sol de la ville).
      ctx.fillStyle = '#6f7563'
      ctx.fillRect(0, 0, SIZE, SIZE)
      // Bâtiments proches uniquement, récupérés via la grille spatiale (rapide).
      const near = buildingsNear(px, pz, VIEW_RADIUS + 30)
      drawBuildings(ctx, view, '#d8cdb8', near)
      // Le joueur, au centre.
      drawPlayer(ctx, view, px, pz, angle, 6)

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      // Position gérée par la colonne droite du HUD (`Hud.tsx`).
      style={{
        position: 'relative',
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `3px solid ${HUD.bg}`,
        boxShadow: HUD.shadow,
        pointerEvents: 'none',
      }}
    >
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: 'block' }} />
      {/* Repère nord. */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          font: '700 11px system-ui, sans-serif',
          color: '#fff',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        N
      </div>
    </div>
  )
}
