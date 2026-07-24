import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { BOUNDS, SPAWN } from '../world/beauvais/cityData'
import { drawBuildings, drawPlayer, drawRoads, drawWater, type MapView } from './mapDraw'

/**
 * Grande carte de la ville, ouverte/fermée avec la touche M (ou Échap pour fermer).
 *
 * On dessine toute la ville "vue du dessus", ajustée pour tenir dans le canvas,
 * avec la position du joueur. Tant que la carte est ouverte, une boucle
 * d'animation met à jour le marqueur du joueur.
 *
 * Astuce clavier : ici on écoute `event.key` (la LETTRE) et pas `event.code`, pour
 * que ce soit bien la touche "M" qui ouvre la carte, quel que soit le clavier.
 */

const RES = 1000 // résolution interne du canvas (px) ; le CSS l'adapte à l'écran
const PAD = 40 // marge autour de la ville

// La ville est STATIQUE : on la dessine une seule fois dans ce canvas hors-écran
// (~34 000 bâtiments), puis chaque image on ne fait que le recopier. Ouverture
// instantanée et fluide, au lieu de tout redessiner 60 fois par seconde.
let staticMap: HTMLCanvasElement | null = null

function getStaticMap(view: MapView): HTMLCanvasElement {
  if (staticMap) return staticMap
  const c = document.createElement('canvas')
  c.width = RES
  c.height = RES
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#5f6553'
  ctx.fillRect(0, 0, RES, RES)
  drawWater(ctx, view, '#3f79a8')
  drawRoads(ctx, view, '#3f4247')
  drawBuildings(ctx, view, '#d8cdb8')
  staticMap = c
  return c
}

export default function WorldMap() {
  const [open, setOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Ouverture/fermeture au clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') setOpen((o) => !o)
      else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Dessin (uniquement quand la carte est ouverte).
  useEffect(() => {
    if (!open) return
    // On rend le curseur au joueur pour qu'il puisse regarder la carte.
    document.exitPointerLock?.()

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Échelle pour faire tenir toute la ville dans le canvas.
    const width = BOUNDS.maxX - BOUNDS.minX
    const depth = BOUNDS.maxZ - BOUNDS.minZ
    const scale = (RES - 2 * PAD) / Math.max(width, depth)
    const view: MapView = {
      centerX: (BOUNDS.minX + BOUNDS.maxX) / 2,
      centerZ: (BOUNDS.minZ + BOUNDS.maxZ) / 2,
      scale,
      w: RES,
      h: RES,
    }

    // La ville (statique) est pré-rendue une fois ; on la recopie chaque image.
    const city = getStaticMap(view)

    let raf = 0
    const render = () => {
      const player = usePlayerStore.getState().playerObject
      const px = player ? player.position.x : SPAWN.x
      const pz = player ? player.position.z : SPAWN.z
      const angle = player ? player.rotation.y : 0

      ctx.drawImage(city, 0, 0)
      drawPlayer(ctx, view, px, pz, angle, 12)

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 14, 26, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        pointerEvents: 'auto',
        zIndex: 50,
      }}
    >
      <div style={{ font: '700 20px system-ui, sans-serif', color: '#e6ecf5' }}>
        Beauvais — Carte
      </div>
      <canvas
        ref={canvasRef}
        width={RES}
        height={RES}
        style={{
          width: 'min(90vw, 82vh)',
          height: 'min(90vw, 82vh)',
          borderRadius: 12,
          border: '2px solid rgba(230, 236, 245, 0.5)',
          background: '#5f6553',
        }}
      />
      <div style={{ font: '13px system-ui, sans-serif', color: '#aeb8c8' }}>
        M ou Échap pour fermer
      </div>
    </div>
  )
}
