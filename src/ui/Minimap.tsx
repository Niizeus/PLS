import { useEffect, useRef } from 'react'
import { MAP_MARKERS } from '../data/mapMarkers'
import { useDestinationStore } from '../gameplay/map/destinationStore'
import { isRuntimeMapMarkerOnMap } from '../gameplay/map/mapMarkerRuntime'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { SPAWN } from '../world/beauvais/cityData'
import { buildingsNear } from '../world/beauvais/collision'
import { drawBuildings, drawMapMarkers, drawPlayer, type MapView } from './mapDraw'
import { HUD, hardShadow, outline } from './hudStyle'

/**
 * Minimap ronde en haut à droite : vue du dessus centrée sur le joueur, nord en haut.
 *
 * On dessine dans un <canvas> via une boucle d'animation (requestAnimationFrame) :
 * ça vit HORS de React (pas de re-render), on lit juste la position du joueur dans
 * le store à chaque image. C'est le même principe que la logique de jeu.
 */

const SIZE = 160 // diamètre de la minimap en pixels
const VIEW_RADIUS = 110 // rayon du monde affiché (mètres) autour du joueur
const visibleMapMarkers = MAP_MARKERS.filter(isRuntimeMapMarkerOnMap)

/** Couleur de la destination : un doré qui ne ressemble à aucun autre repère. */
const DESTINATION_COLOR = '#fbbf24'

/**
 * Dessine la destination choisie depuis le téléphone.
 *
 * Deux cas, et c'est tout l'intérêt : si elle est **dans le champ** de la
 * minimap, on pose un losange dessus ; si elle est **hors champ** (le plus
 * souvent), on plaque une flèche sur le bord du disque, dans sa direction. On
 * sait donc toujours vers où marcher, même à l'autre bout de la ville.
 */
function drawDestination(ctx: CanvasRenderingContext2D, px: number, pz: number, scale: number) {
  const destination = useDestinationStore.getState().destination
  if (!destination) return

  const dx = destination.x - px
  const dz = destination.z - pz
  const distance = Math.hypot(dx, dz)
  const center = SIZE / 2

  ctx.save()
  ctx.fillStyle = DESTINATION_COLOR
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.lineWidth = 1.5

  if (distance * scale < center - 12) {
    // Dans le champ : un losange sur le point.
    const x = center + dx * scale
    const y = center + dz * scale
    ctx.beginPath()
    ctx.moveTo(x, y - 6)
    ctx.lineTo(x + 5, y)
    ctx.lineTo(x, y + 6)
    ctx.lineTo(x - 5, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    // Hors champ : une flèche collée au bord, orientée vers la destination.
    const angle = Math.atan2(dz, dx)
    const radius = center - 11
    ctx.translate(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(7, 0)
    ctx.lineTo(-5, 5)
    ctx.lineTo(-5, -5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()

  // La distance restante, en bas du disque.
  ctx.save()
  ctx.font = '700 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.lineWidth = 3
  const label = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`
  ctx.strokeText(`${destination.icon} ${label}`, center, SIZE - 8)
  ctx.fillStyle = DESTINATION_COLOR
  ctx.fillText(`${destination.icon} ${label}`, center, SIZE - 8)
  ctx.restore()
}

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
      drawMapMarkers(
        ctx,
        view,
        visibleMapMarkers.filter((marker) => {
          const dx = marker.position.x - px
          const dz = marker.position.z - pz
          return dx * dx + dz * dz <= (VIEW_RADIUS + 20) * (VIEW_RADIUS + 20)
        }),
        { labels: false, minSize: 3, maxSize: 5 },
      )
      // La destination posée depuis le GPS du téléphone, s'il y en a une.
      drawDestination(ctx, px, pz, scale)

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
        // Le disque : un vrai rond cerclé d'encre, comme un médaillon dessiné.
        borderRadius: '50%',
        overflow: 'hidden',
        border: outline,
        boxShadow: hardShadow,
        pointerEvents: 'none',
      }}
    >
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: 'block' }} />
      {/* Repère nord. */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: '50%',
          transform: 'translateX(-50%)',
          font: `900 12px ${HUD.font}`,
          color: HUD.paper,
          WebkitTextStroke: `3px ${HUD.ink}`,
          paintOrder: 'stroke fill',
        }}
      >
        N
      </div>
    </div>
  )
}
