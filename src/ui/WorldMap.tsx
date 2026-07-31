import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MAP_MARKERS } from '../data/mapMarkers'
import { isRuntimeMapMarkerOnMap } from '../gameplay/map/mapMarkerRuntime'
// Type + sauvegarde des points de passage : partagés avec l'app GPS du téléphone.
import { loadWaypoints, saveWaypoints, type Waypoint } from '../gameplay/map/waypoints'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { BOUNDS, SPAWN } from '../world/beauvais/cityData'
import { drawBuildings, drawMapMarkers, drawPlayer, drawRoads, drawWater, drawZones, type MapView } from './mapDraw'
import { HUD, hardShadow, outline, outlineThin } from './hudStyle'

/**
 * Grande carte de la ville (touche M) : plein écran, avec ZOOM (molette),
 * DÉPLACEMENT (glisser) et POINTS DE PASSAGE (clic → texte + icône, sauvegardés).
 *
 * La ville étant statique, on la pré-dessine UNE fois dans un canvas hors-écran,
 * puis on la recopie à l'échelle/position voulues → zoom et déplacement fluides.
 */

const CITY_RES = 3000 // résolution du rendu hors-écran de la ville
const PAD = 30
const ICONS = ['🏠', '⭐', '⚠️', '🛒', '🚩'] // 5 icônes simples

const boundsCenter = { x: (BOUNDS.minX + BOUNDS.maxX) / 2, z: (BOUNDS.minZ + BOUNDS.maxZ) / 2 }
const citySpan = Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ)
const visibleMapMarkers = MAP_MARKERS.filter(isRuntimeMapMarkerOnMap)

// Ville pré-rendue une seule fois.
let cityCanvas: HTMLCanvasElement | null = null
let cityScale = 0
function getCity(): HTMLCanvasElement {
  if (cityCanvas) return cityCanvas
  const c = document.createElement('canvas')
  c.width = CITY_RES
  c.height = CITY_RES
  const ctx = c.getContext('2d')!
  cityScale = (CITY_RES - 2 * PAD) / citySpan
  const view: MapView = { centerX: boundsCenter.x, centerZ: boundsCenter.z, scale: cityScale, w: CITY_RES, h: CITY_RES }
  ctx.fillStyle = '#5f6553'
  ctx.fillRect(0, 0, CITY_RES, CITY_RES)
  drawWater(ctx, view, '#3f79a8')
  drawRoads(ctx, view, '#3f4247')
  drawBuildings(ctx, view, '#d8cdb8')
  cityCanvas = c
  return c
}

interface FormState {
  sx: number
  sy: number
  x: number
  z: number
  text: string
  icon: string
  editId?: number
}

export default function WorldMap() {
  const [open, setOpen] = useState(false)
  const [wps, setWps] = useState<Waypoint[]>(loadWaypoints)
  const [form, setForm] = useState<FormState | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wpsRef = useRef(wps)
  // Vue (centre monde + zoom), en ref pour ne pas re-render pendant le pan/zoom.
  const cam = useRef({ cx: boundsCenter.x, cz: boundsCenter.z, zoom: 1 })

  useEffect(() => {
    wpsRef.current = wps
    saveWaypoints(wps)
  }, [wps])

  // Ouverture / fermeture au clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') setOpen((o) => !o)
      else if (e.key === 'Escape') {
        setForm((f) => (f ? null : f))
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Rendu + interactions (uniquement quand la carte est ouverte).
  useEffect(() => {
    if (!open) return
    document.exitPointerLock?.()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    const ctx = canvas.getContext('2d')!
    const city = getCity()

    // On centre la vue sur le joueur à l'ouverture.
    const p0 = usePlayerStore.getState().playerObject
    cam.current = { cx: p0 ? p0.position.x : SPAWN.x, cz: p0 ? p0.position.z : SPAWN.z, zoom: 1.6 }

    const baseScale = () => (Math.min(canvas.width, canvas.height) - 2 * PAD) / citySpan
    const ppm = () => baseScale() * cam.current.zoom
    const toScreen = (wx: number, wz: number): [number, number] => {
      const s = ppm()
      return [canvas.width / 2 + (wx - cam.current.cx) * s, canvas.height / 2 + (wz - cam.current.cz) * s]
    }
    const toWorld = (sx: number, sy: number): [number, number] => {
      const s = ppm()
      return [cam.current.cx + (sx - canvas.width / 2) / s, cam.current.cz + (sy - canvas.height / 2) / s]
    }

    let raf = 0
    const render = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.fillStyle = '#4a4f44'
      ctx.fillRect(0, 0, W, H)

      // Ville (image statique) recopiée à la bonne échelle/position.
      const imgScale = ppm() / cityScale
      const ox = boundsCenter.x - CITY_RES / 2 / cityScale
      const oz = boundsCenter.z - CITY_RES / 2 / cityScale
      const [dx, dy] = toScreen(ox, oz)
      ctx.drawImage(city, dx, dy, CITY_RES * imgScale, CITY_RES * imgScale)

      // Quartiers (contours + noms) par-dessus la ville.
      const zoneView: MapView = { centerX: cam.current.cx, centerZ: cam.current.cz, scale: ppm(), w: W, h: H }
      drawZones(ctx, zoneView)
      drawMapMarkers(ctx, zoneView, visibleMapMarkers)

      // Points de passage.
      ctx.textAlign = 'center'
      for (const w of wpsRef.current) {
        const [x, y] = toScreen(w.x, w.z)
        ctx.textBaseline = 'bottom'
        ctx.font = '24px system-ui'
        ctx.fillText(w.icon, x, y)
        if (w.text) {
          ctx.font = '600 13px system-ui'
          ctx.textBaseline = 'top'
          ctx.lineWidth = 3
          ctx.strokeStyle = 'rgba(0,0,0,0.75)'
          ctx.fillStyle = '#fff'
          ctx.strokeText(w.text, x, y + 3)
          ctx.fillText(w.text, x, y + 3)
        }
      }

      // Joueur.
      const pl = usePlayerStore.getState().playerObject
      const view: MapView = { centerX: cam.current.cx, centerZ: cam.current.cz, scale: ppm(), w: W, h: H }
      drawPlayer(ctx, view, pl ? pl.position.x : SPAWN.x, pl ? pl.position.z : SPAWN.z, pl ? pl.rotation.y : 0, 11)

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    // --- Interactions ---
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const [wx, wz] = toWorld(e.offsetX, e.offsetY) // point sous le curseur (fixe)
      cam.current.zoom = Math.min(12, Math.max(0.6, cam.current.zoom * factor))
      const s = ppm()
      cam.current.cx = wx - (e.offsetX - canvas.width / 2) / s
      cam.current.cz = wz - (e.offsetY - canvas.height / 2) / s
    }
    let drag: { x: number; y: number; moved: boolean } | null = null
    const onDown = (e: MouseEvent) => {
      drag = { x: e.offsetX, y: e.offsetY, moved: false }
    }
    const onMove = (e: MouseEvent) => {
      if (!drag) return
      const s = ppm()
      cam.current.cx -= (e.movementX || 0) / s
      cam.current.cz -= (e.movementY || 0) / s
      if (Math.abs(e.offsetX - drag.x) + Math.abs(e.offsetY - drag.y) > 4) drag.moved = true
    }
    const onUp = () => {
      drag = null // le simple clic/glisser ne sert qu'au déplacement de la carte
    }
    // DOUBLE-CLIC = poser (ou éditer) un point de passage.
    const onDbl = (e: MouseEvent) => {
      const [wx, wz] = toWorld(e.offsetX, e.offsetY)
      const s = ppm()
      const hit = wpsRef.current.find((w) => {
        const dx = (w.x - wx) * s
        const dz = (w.z - wz) * s
        return dx * dx + dz * dz < 22 * 22
      })
      if (hit) setForm({ sx: e.offsetX, sy: e.offsetY, x: hit.x, z: hit.z, text: hit.text, icon: hit.icon, editId: hit.id })
      else setForm({ sx: e.offsetX, sy: e.offsetY, x: wx, z: wz, text: '', icon: ICONS[0] })
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('dblclick', onDbl)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('dblclick', onDbl)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [open])

  if (!open) return null

  const saveForm = () => {
    if (!form) return
    if (form.editId != null) {
      setWps((list) => list.map((w) => (w.id === form.editId ? { ...w, text: form.text, icon: form.icon } : w)))
    } else {
      setWps((list) => [...list, { id: Date.now(), x: form.x, z: form.z, text: form.text.trim(), icon: form.icon }])
    }
    setForm(null)
  }
  const deleteForm = () => {
    if (form?.editId != null) setWps((list) => list.filter((w) => w.id !== form.editId))
    setForm(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: HUD.ink, zIndex: 50, pointerEvents: 'auto' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'grab' }}
      />

      {/* Bandeau d'aide. */}
      <div
        style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          padding: '7px 16px', borderRadius: 999, background: HUD.paper,
          border: outline, boxShadow: hardShadow,
          color: HUD.ink, font: `800 13px ${HUD.font}`, whiteSpace: 'nowrap',
        }}
      >
        Beauvais — molette : zoom · glisser : déplacer · double-clic : point de passage · M/Échap : fermer
      </div>

      {/* Formulaire de point de passage. */}
      {form && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(form.sx, window.innerWidth - 240),
            top: Math.min(form.sy, window.innerHeight - 170),
            width: 220, padding: 12, borderRadius: HUD.radius,
            background: HUD.paper, border: outline, color: HUD.ink,
            font: `700 13px ${HUD.font}`, boxShadow: hardShadow,
          }}
        >
          <div style={{ marginBottom: 8, fontWeight: 700 }}>
            {form.editId != null ? 'Modifier le point' : 'Nouveau point'}
          </div>
          <input
            autoFocus
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && saveForm()}
            placeholder="Petit texte…"
            style={{
              width: '100%', padding: '6px 8px', marginBottom: 8, borderRadius: 8,
              border: outlineThin, background: '#fff', color: HUD.ink,
              font: `700 13px ${HUD.font}`,
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setForm({ ...form, icon: ic })}
                style={{
                  fontSize: 20, width: 34, height: 34, borderRadius: 9, cursor: 'pointer',
                  background: form.icon === ic ? '#ffd83d' : HUD.paper,
                  border: form.icon === ic ? outline : outlineThin,
                }}
              >
                {ic}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveForm} style={btn('#ffd83d', HUD.ink)}>Enregistrer</button>
            {form.editId != null && <button onClick={deleteForm} style={btn('#e63946', HUD.paper)}>Supprimer</button>}
            <button onClick={() => setForm(null)} style={btn(HUD.paper, HUD.ink)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

const btn = (bg: string, color: string): CSSProperties => ({
  flex: 1, padding: '6px 4px', borderRadius: 9, cursor: 'pointer',
  background: bg, border: outlineThin, color, font: `800 12px ${HUD.font}`,
})
