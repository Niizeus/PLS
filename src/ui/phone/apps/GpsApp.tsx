import { useEffect, useMemo, useRef, useState } from 'react'
import { MAP_MARKERS } from '../../../data/mapMarkers'
import { getMapMarkerAvailability, isRuntimeMapMarkerOnMap } from '../../../gameplay/map/mapMarkerRuntime'
import { useDestinationStore } from '../../../gameplay/map/destinationStore'
import { loadWaypoints } from '../../../gameplay/map/waypoints'
import { playPhoneSound } from '../../../gameplay/phone/phoneSounds'
import { usePlayerStore } from '../../../gameplay/stats/playerStore'
import { useGameTimeStore } from '../../../gameplay/time/gameTimeStore'
import { SPAWN } from '../../../world/beauvais/cityData'
import { buildingsNear } from '../../../world/beauvais/collision'
import { drawBuildings, drawMapMarkers, drawPlayer, drawRoads, type MapView } from '../../mapDraw'
import { PHONE, appScroll, appSectionLabel, card } from '../phoneStyle'

/**
 * 🗺️ Application GPS — la carte de Beauvais dans le téléphone.
 *
 * Elle ne réinvente rien : elle réutilise les MÊMES outils de dessin que la
 * minimap et la grande carte (`ui/mapDraw.ts`), les MÊMES points d'intérêt
 * (`data/mapMarkers.json`, filtrés par `mapMarkerRuntime`) et les MÊMES points de
 * passage que le joueur pose sur la carte (`gameplay/map/waypoints.ts`).
 *
 * ⚠️ Perf : on redessine à ~8 images/seconde et pas 60. Sur un écran de 244 px,
 * personne ne voit la différence, et ça laisse le GPU/CPU au jeu — d'autant que
 * `drawRoads` parcourt TOUTES les routes de la ville à chaque passage.
 */

const MAP_W = 244
const MAP_H = 186
const REDRAW_MS = 125
/** Rayons de vue (mètres) = les crans de zoom, du plus serré au plus large. */
const ZOOMS = [90, 180, 360]

const visibleMarkers = MAP_MARKERS.filter(isRuntimeMapMarkerOnMap)

export default function GpsApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  // Les points de passage sont lus une fois à l'ouverture de l'app : le joueur ne
  // peut pas en poser depuis le téléphone (ça se fait sur la grande carte, M).
  const waypoints = useMemo(() => loadWaypoints(), [])

  // L'heure sert à savoir ce qui est OUVERT. On s'abonne à la minute (pas au
  // temps continu) pour ne pas re-render 60 fois par seconde.
  const minute = useGameTimeStore((s) => Math.floor(s.totalMinutes))

  // Position du joueur pour la LISTE (le canvas, lui, la relit à chaque dessin).
  const [position, setPosition] = useState(() => playerPosition())

  const destination = useDestinationStore((s) => s.destination)
  const goTo = (x: number, z: number, label: string, icon: string) => {
    playPhoneSound('tap')
    useDestinationStore.getState().setDestination({ x, z, label, icon })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const render = () => {
      const { x, z, angle } = playerPosition()
      const radius = ZOOMS[zoomRef.current]
      const scale = MAP_H / 2 / radius
      const view: MapView = { centerX: x, centerZ: z, scale, w: MAP_W, h: MAP_H }

      ctx.fillStyle = '#5f6553'
      ctx.fillRect(0, 0, MAP_W, MAP_H)
      drawRoads(ctx, view, '#3f4247')
      // Seulement les bâtiments proches : la grille spatiale évite de parcourir
      // les dizaines de milliers d'empreintes de la ville entière.
      drawBuildings(ctx, view, '#d8cdb8', buildingsNear(x, z, radius * 1.6))
      drawMapMarkers(ctx, view, visibleMarkers, { labels: false, minSize: 4, maxSize: 7 })

      // Les points de passage du joueur, en losanges clairs.
      ctx.fillStyle = '#fef08a'
      for (const wp of waypoints) {
        const px = MAP_W / 2 + (wp.x - x) * scale
        const pz = MAP_H / 2 + (wp.z - z) * scale
        ctx.beginPath()
        ctx.moveTo(px, pz - 4)
        ctx.lineTo(px + 4, pz)
        ctx.lineTo(px, pz + 4)
        ctx.lineTo(px - 4, pz)
        ctx.fill()
      }

      // La destination en cours, en doré (même code couleur que la minimap).
      const target = useDestinationStore.getState().destination
      if (target) {
        const tx = MAP_W / 2 + (target.x - x) * scale
        const tz = MAP_H / 2 + (target.z - z) * scale
        ctx.fillStyle = '#fbbf24'
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(tx, tz - 7)
        ctx.lineTo(tx + 6, tz)
        ctx.lineTo(tx, tz + 7)
        ctx.lineTo(tx - 6, tz)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }

      drawPlayer(ctx, view, x, z, angle, 7)
      // La LISTE ne se recalcule que si on a vraiment bougé : sinon on relancerait
      // un rendu React (et un tri des lieux) 8 fois par seconde pour rien.
      setPosition((prev) => (Math.hypot(prev.x - x, prev.z - z) > 2 ? { x, z, angle } : prev))
    }

    render()
    const timer = setInterval(render, REDRAW_MS)
    return () => clearInterval(timer)
  }, [waypoints])

  // Lieux les plus proches en premier : c'est ce qu'on cherche sur un GPS.
  const nearby = useMemo(() => {
    return visibleMarkers
      .map((marker) => ({
        marker,
        distance: Math.hypot(marker.position.x - position.x, marker.position.z - position.z),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12)
  }, [position.x, position.z])

  return (
    <div style={appScroll}>
      <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: PHONE.cardBorder }}>
        <canvas ref={canvasRef} width={MAP_W} height={MAP_H} style={{ display: 'block', width: '100%' }} />
        <span style={compassStyle}>N</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} style={{ ...zoomButtonStyle, bottom: 34 }}>
          −
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} style={{ ...zoomButtonStyle, bottom: 8 }}>
          +
        </button>
      </div>

      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', font: `700 10px ${PHONE.mono}` }}>
        <span style={{ color: PHONE.textDim }}>Vue {ZOOMS[zoom]} m</span>
        <span style={{ color: PHONE.textDim }}>
          X {Math.round(position.x)} · Z {Math.round(position.z)}
        </span>
      </div>

      {destination && (
        <div
          style={{
            ...card,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: 'rgba(251, 191, 36, 0.16)',
            borderColor: 'rgba(251, 191, 36, 0.4)',
          }}
        >
          <span style={{ fontSize: 15 }}>{destination.icon}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', font: `800 9px ${PHONE.font}`, color: '#fcd34d' }}>DESTINATION</span>
            <span style={{ display: 'block', font: `800 11px ${PHONE.font}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {destination.label}
            </span>
          </span>
          <span style={{ font: `800 10px ${PHONE.mono}`, color: '#fcd34d' }}>
            {formatDistance(Math.hypot(destination.x - position.x, destination.z - position.z))}
          </span>
          <button
            type="button"
            onClick={() => {
              playPhoneSound('back')
              useDestinationStore.getState().clearDestination()
            }}
            title="Annuler la destination"
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              border: PHONE.cardBorder,
              background: PHONE.card,
              color: PHONE.text,
              font: `900 11px ${PHONE.font}`,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={appSectionLabel}>Autour de toi</div>
      {nearby.map(({ marker, distance }) => {
        const availability = getMapMarkerAvailability(marker, minute)
        const isTarget = destination?.label === marker.name
        return (
          <button
            key={marker.id}
            type="button"
            onClick={() => goTo(marker.position.x, marker.position.z, marker.name, marker.icon)}
            title={`Y aller — ${marker.name}`}
            style={{
              ...card,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              textAlign: 'left',
              color: 'inherit',
              cursor: 'pointer',
              borderColor: isTarget ? 'rgba(251, 191, 36, 0.45)' : undefined,
            }}
          >
            <span style={{ fontSize: 15 }}>{marker.icon}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  display: 'block',
                  font: `800 11px ${PHONE.font}`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {marker.name}
              </span>
              <span
                style={{
                  display: 'block',
                  font: `700 9px ${PHONE.font}`,
                  color: availability.isOpen ? '#86efac' : '#fca5a5',
                }}
              >
                {availability.label}
              </span>
            </span>
            <span style={{ font: `800 10px ${PHONE.mono}`, color: PHONE.accent }}>{formatDistance(distance)}</span>
          </button>
        )
      })}

      {waypoints.length > 0 && (
        <>
          <div style={appSectionLabel}>Tes points de passage</div>
          {waypoints.map((wp) => (
            <button
              key={wp.id}
              type="button"
              onClick={() => goTo(wp.x, wp.z, wp.text || 'Point de passage', wp.icon)}
              title="Y aller"
              style={{ ...card, display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 15 }}>{wp.icon}</span>
              <span style={{ flex: 1, minWidth: 0, font: `800 11px ${PHONE.font}` }}>{wp.text || 'Sans nom'}</span>
              <span style={{ font: `800 10px ${PHONE.mono}`, color: '#fde68a' }}>
                {formatDistance(Math.hypot(wp.x - position.x, wp.z - position.z))}
              </span>
            </button>
          ))}
        </>
      )}

      <div style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
        Touche un lieu pour en faire ta destination : une flèche dorée apparaît sur la minimap
        avec la distance. Les points de passage, eux, se posent sur la grande carte (touche M).
      </div>
    </div>
  )
}

/** Position + orientation du joueur, avec repli sur le spawn avant qu'il existe. */
function playerPosition() {
  const player = usePlayerStore.getState().playerObject
  return {
    x: player ? player.position.x : SPAWN.x,
    z: player ? player.position.z : SPAWN.z,
    angle: player ? player.rotation.y : 0,
  }
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

const compassStyle = {
  position: 'absolute' as const,
  top: 5,
  left: '50%',
  transform: 'translateX(-50%)',
  font: `800 10px ${PHONE.font}`,
  color: '#fff',
  textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)',
}

const zoomButtonStyle = {
  position: 'absolute' as const,
  right: 8,
  width: 22,
  height: 22,
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.22)',
  background: 'rgba(12, 17, 30, 0.72)',
  color: '#fff',
  font: `900 13px ${PHONE.font}`,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
}
