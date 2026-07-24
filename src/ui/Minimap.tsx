import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { SPAWN } from '../world/beauvais/cityData'
import { drawBuildings, drawPlayer, type MapView } from './mapDraw'

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
      // Bâtiments proches uniquement (perf) + un peu de marge sur le rayon.
      drawBuildings(ctx, view, { fill: '#d8cdb8', cullRadius: VIEW_RADIUS + 30 })
      // Le joueur, au centre.
      drawPlayer(ctx, view, px, pz, angle, 6)

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        overflow: 'hidden',
        border: '3px solid rgba(15, 20, 34, 0.85)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
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
