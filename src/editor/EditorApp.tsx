import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  MAP_MARKER_DAYS,
  MAP_MARKER_TYPES,
  MAP_MARKERS,
  serializeMapMarkers,
  validateMapMarkers,
  type MapMarker,
  type MapMarkerDay,
  type MapMarkerOpeningHours,
  type MapMarkerType,
} from '../data/mapMarkers'
import { BOUNDS, BUILDINGS, ROADS, SPAWN, WATERS } from '../world/beauvais/cityData'
import { ZONES, type Zone } from '../world/beauvais/zones'
import { drawBuildings, drawRoads, drawWater, drawZones, type MapView } from '../ui/mapDraw'
import EditorGameView, { type EditorCameraState } from './EditorGameView'

type LayerId = 'water' | 'roads' | 'buildings' | 'zones' | 'markers'
type ViewMode = 'plan' | 'gameTop' | 'gameTilt'
type EditorTool = 'select' | 'place' | 'zone'

interface LayerConfig {
  id: LayerId
  label: string
  color: string
}

interface MouseWorld {
  x: number
  z: number
}

const CITY_RES = 3200
const PAD = 36
const MIN_ZOOM = 0.06
const MAX_ZOOM = 18
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const GAME_FIT_MARGIN = 1.12
const ZONES_COMMENT =
  'Quartiers de Beauvais. Chaque zone = un polygone (contour [x,z] en metres monde, origine = cathedrale). Edite depuis editor.html.'

const boundsCenter = {
  x: (BOUNDS.minX + BOUNDS.maxX) / 2,
  z: (BOUNDS.minZ + BOUNDS.maxZ) / 2,
}
const citySpan = Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ)
const cityScale = (CITY_RES - 2 * PAD) / citySpan
const cityWorldOrigin = {
  x: boundsCenter.x - CITY_RES / 2 / cityScale,
  z: boundsCenter.z - CITY_RES / 2 / cityScale,
}

const layerConfigs: LayerConfig[] = [
  { id: 'water', label: 'Eau', color: '#4d8fb8' },
  { id: 'roads', label: 'Routes', color: '#474b4f' },
  { id: 'buildings', label: 'Batiments', color: '#d7c8af' },
  { id: 'zones', label: 'Quartiers', color: '#f0b84d' },
  { id: 'markers', label: "Points d'interet", color: '#e6493f' },
]

const initialLayers: Record<LayerId, boolean> = {
  water: true,
  roads: true,
  buildings: true,
  zones: true,
  markers: true,
}

const markerTypeLabels: Record<MapMarkerType, string> = {
  apartment: 'Appartement',
  shop: 'Shop',
  bar: 'Bar',
  work: 'Travail',
  station: 'Gare',
  town_hall: 'Mairie',
  police: 'Police',
  entrance: 'Entree',
  exit: 'Sortie',
  blocked_exit: 'Sortie bloquee',
  roadworks: 'Travaux',
  npc: 'PNJ',
  test: 'Test',
  secret: 'Secret',
}

const layerCanvasCache = new Map<Exclude<LayerId, 'zones' | 'markers'>, HTMLCanvasElement>()

function makeLayerCanvas(layer: Exclude<LayerId, 'zones' | 'markers'>): HTMLCanvasElement {
  const cached = layerCanvasCache.get(layer)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = CITY_RES
  canvas.height = CITY_RES
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const view: MapView = {
    centerX: boundsCenter.x,
    centerZ: boundsCenter.z,
    scale: cityScale,
    w: CITY_RES,
    h: CITY_RES,
  }

  if (layer === 'water') drawWater(ctx, view, '#4d8fb8')
  if (layer === 'roads') drawRoads(ctx, view, '#45484c')
  if (layer === 'buildings') drawBuildings(ctx, view, '#d7c8af')

  layerCanvasCache.set(layer, canvas)
  return canvas
}

function formatCoord(value: number) {
  return `${value.toFixed(1)} m`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function makeMarkerId(markers: MapMarker[]) {
  const stamp = Date.now().toString(36)
  let id = `poi_${stamp}`
  let index = 2
  const ids = new Set(markers.map((marker) => marker.id))
  while (ids.has(id)) {
    id = `poi_${stamp}_${index}`
    index += 1
  }
  return id
}

function makeMarkerAt(point: MouseWorld, markers: MapMarker[]): MapMarker {
  return {
    id: makeMarkerId(markers),
    name: 'Nouveau point',
    type: 'test',
    position: {
      x: Number(point.x.toFixed(2)),
      z: Number(point.z.toFixed(2)),
    },
    color: '#e6493f',
    icon: 'test',
    interactionRadius: 3,
    prompt: '',
    visibleInGame: true,
    visibleOnMap: true,
    devOnly: true,
    tags: ['test'],
  }
}

function findNearestMarker(markers: MapMarker[], point: MouseWorld, maxDistance: number) {
  let nearest: MapMarker | null = null
  let nearestDistance = maxDistance
  for (const marker of markers) {
    if (!marker.visibleOnMap && !marker.visibleInGame && !marker.devOnly) continue
    const distance = Math.hypot(marker.position.x - point.x, marker.position.z - point.z)
    if (distance <= nearestDistance) {
      nearest = marker
      nearestDistance = distance
    }
  }
  return nearest
}

function drawMapMarkers(
  ctx: CanvasRenderingContext2D,
  toScreen: (wx: number, wz: number) => [number, number],
  markers: MapMarker[],
  selectedMarkerId: string | null,
) {
  ctx.save()
  ctx.textAlign = 'center'
  for (const marker of markers) {
    if (!marker.visibleOnMap) continue
    const [x, y] = toScreen(marker.position.x, marker.position.z)
    const selected = marker.id === selectedMarkerId

    if (selected) {
      ctx.beginPath()
      ctx.arc(x, y, 12, 0, Math.PI * 2)
      ctx.strokeStyle = '#fff7dc'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(x, y, selected ? 8 : 6, 0, Math.PI * 2)
    ctx.fillStyle = marker.color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()

    ctx.font = '700 12px system-ui'
    ctx.textBaseline = 'top'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.72)'
    ctx.fillStyle = '#fffaf0'
    ctx.strokeText(marker.name, x, y + 8)
    ctx.fillText(marker.name, x, y + 8)
  }
  ctx.restore()
}

function cloneZones(zones: Zone[]): Zone[] {
  return zones.map((zone) => ({ ...zone, pts: zone.pts.map((point) => [point[0], point[1]]) }))
}

function drawEditableZonePoints(
  ctx: CanvasRenderingContext2D,
  toScreen: (wx: number, wz: number) => [number, number],
  zone: Zone | null,
  selectedPointIndex: number | null,
) {
  if (!zone) return
  ctx.save()
  zone.pts.forEach(([x, z], index) => {
    const [sx, sy] = toScreen(x, z)
    ctx.beginPath()
    ctx.arc(sx, sy, selectedPointIndex === index ? 8 : 6, 0, Math.PI * 2)
    ctx.fillStyle = selectedPointIndex === index ? '#fff7dc' : zone.color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#15191d'
    ctx.stroke()
    ctx.font = '800 10px system-ui'
    ctx.fillStyle = '#15191d'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(index + 1), sx, sy + 0.5)
  })
  ctx.restore()
}

function findNearestZonePoint(zone: Zone | null, point: MouseWorld, maxDistance: number) {
  if (!zone) return null
  let nearest: number | null = null
  let bestDistance = maxDistance
  zone.pts.forEach(([x, z], index) => {
    const distance = Math.hypot(x - point.x, z - point.z)
    if (distance <= bestDistance) {
      nearest = index
      bestDistance = distance
    }
  })
  return nearest
}

function formatOpeningHours(hours: MapMarkerOpeningHours[] | undefined) {
  if (!hours?.length) return ''
  return hours.map((entry) => `${entry.days.join(',')} ${entry.open}-${entry.close}`).join('; ')
}

function parseOpeningHours(text: string): { ok: true; hours?: MapMarkerOpeningHours[] } | { ok: false; error: string } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: true, hours: undefined }

  const entries: MapMarkerOpeningHours[] = []
  for (const part of trimmed.split(';')) {
    const match = part.trim().match(/^([a-z,\s]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/)
    if (!match) {
      return { ok: false, error: 'Format attendu : mon,tue 08:30-17:00; sat 10:00-18:00' }
    }

    const days = match[1]
      .split(',')
      .map((day) => day.trim())
      .filter(Boolean)
    const open = match[2]
    const close = match[3]
    if (!days.length || !days.every((day) => MAP_MARKER_DAYS.includes(day as MapMarkerDay))) {
      return { ok: false, error: 'Jour invalide. Utilise mon,tue,wed,thu,fri,sat,sun.' }
    }
    if (!TIME_RE.test(open) || !TIME_RE.test(close)) {
      return { ok: false, error: 'Heures invalides. Utilise HH:mm.' }
    }
    entries.push({ days: days as MapMarkerDay[], open, close })
  }

  return { ok: true, hours: entries }
}

interface EditorAppProps {
  moduleTabs?: ReactNode
}

export default function EditorApp({ moduleTabs }: EditorAppProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapPanelRef = useRef<HTMLElement>(null)
  const cameraRef = useRef<EditorCameraState>({ cx: SPAWN.x, cz: SPAWN.z, zoom: 2.2 })
  const layersRef = useRef(initialLayers)
  const toolRef = useRef<EditorTool>('select')
  const markersRef = useRef<MapMarker[]>(serializeMapMarkers(MAP_MARKERS))
  const zonesRef = useRef<Zone[]>(cloneZones(ZONES))
  const selectedMarkerIdRef = useRef<string | null>(MAP_MARKERS[0]?.id ?? null)
  const selectedZoneIdRef = useRef<string | null>(ZONES[0]?.id ?? null)
  const selectedZonePointRef = useRef<number | null>(null)
  const worldClickRef = useRef<(point: MouseWorld) => void>(() => {})
  const dragRef = useRef<
    | { mode: 'pan'; pointerId: number; x: number; y: number; startX: number; startY: number; moved: boolean }
    | { mode: 'zonePoint'; pointerId: number; zoneId: string; pointIndex: number; moved: boolean }
    | null
  >(null)
  const [layers, setLayers] = useState(initialLayers)
  const [viewMode, setViewMode] = useState<ViewMode>('plan')
  const [editorTool, setEditorTool] = useState<EditorTool>('select')
  const [markers, setMarkers] = useState<MapMarker[]>(() => MAP_MARKERS)
  const [zones, setZones] = useState<Zone[]>(() => cloneZones(ZONES))
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(() => MAP_MARKERS[0]?.id ?? null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(() => ZONES[0]?.id ?? null)
  const [selectedZonePoint, setSelectedZonePoint] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState('Aucune modification')
  const [mouseWorld, setMouseWorld] = useState<MouseWorld | null>(null)
  const [viewInfo, setViewInfo] = useState(cameraRef.current)

  const selectedMarker = markers.find((marker) => marker.id === selectedMarkerId) ?? null
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null
  const markerValidation = useMemo(() => validateMapMarkers(markers), [markers])

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    toolRef.current = editorTool
  }, [editorTool])

  useEffect(() => {
    markersRef.current = markers
  }, [markers])

  useEffect(() => {
    zonesRef.current = zones
  }, [zones])

  useEffect(() => {
    selectedMarkerIdRef.current = selectedMarkerId
  }, [selectedMarkerId])

  useEffect(() => {
    selectedZoneIdRef.current = selectedZoneId
  }, [selectedZoneId])

  useEffect(() => {
    selectedZonePointRef.current = selectedZonePoint
  }, [selectedZonePoint])

  const updateSelectedMarker = (recipe: (marker: MapMarker) => MapMarker) => {
    if (!selectedMarkerId) return
    setMarkers((current) => current.map((marker) => (marker.id === selectedMarkerId ? recipe(marker) : marker)))
    setSaveStatus('Modifications non sauvegardees')
  }

  const updateSelectedZone = (recipe: (zone: Zone) => Zone) => {
    if (!selectedZoneId) return
    setZones((current) => current.map((zone) => (zone.id === selectedZoneId ? recipe(zone) : zone)))
    setSaveStatus('Quartiers modifies, sauvegarde requise')
  }

  const moveZonePoint = (zoneId: string, pointIndex: number, point: MouseWorld) => {
    setZones((current) =>
      current.map((zone) =>
        zone.id === zoneId
          ? {
              ...zone,
              pts: zone.pts.map((zonePoint, index) =>
                index === pointIndex ? [Number(point.x.toFixed(1)), Number(point.z.toFixed(1))] : zonePoint,
              ),
            }
          : zone,
      ),
    )
    setSaveStatus('Quartiers modifies, sauvegarde requise')
  }

  const addZonePoint = (point: MouseWorld) => {
    if (!selectedZoneId) return
    updateSelectedZone((zone) => ({
      ...zone,
      pts: [...zone.pts, [Number(point.x.toFixed(1)), Number(point.z.toFixed(1))]],
    }))
    setSelectedZonePoint((selectedZone?.pts.length ?? 0))
  }

  const deleteSelectedZonePoint = () => {
    if (!selectedZone || selectedZonePoint === null || selectedZone.pts.length <= 3) return
    updateSelectedZone((zone) => ({ ...zone, pts: zone.pts.filter((_, index) => index !== selectedZonePoint) }))
    setSelectedZonePoint(null)
  }

  const updateSelectedPosition = (axis: 'x' | 'z', value: number) => {
    if (!Number.isFinite(value)) return
    updateSelectedMarker((marker) => ({
      ...marker,
      position: { ...marker.position, [axis]: value },
    }))
  }

  const deleteSelectedMarker = () => {
    if (!selectedMarker) return
    setMarkers((current) => current.filter((marker) => marker.id !== selectedMarker.id))
    setSelectedMarkerId(null)
    setSaveStatus('Point supprime localement, sauvegarde requise')
  }

  const handleWorldClick = (point: MouseWorld) => {
    if (toolRef.current === 'zone') {
      addZonePoint(point)
      return
    }

    if (!layersRef.current.markers) return

    if (toolRef.current === 'place') {
      const marker = makeMarkerAt(point, markersRef.current)
      setMarkers((current) => [...current, marker])
      setSelectedMarkerId(marker.id)
      setSaveStatus('Nouveau point cree, sauvegarde requise')
      return
    }

    const hitDistance = Math.max(4, 12 / cameraRef.current.zoom)
    const marker = findNearestMarker(markersRef.current, point, hitDistance)
    setSelectedMarkerId(marker?.id ?? null)
  }

  useEffect(() => {
    worldClickRef.current = handleWorldClick
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const baseScale = () => (Math.min(canvas.clientWidth, canvas.clientHeight) - 2 * PAD) / citySpan
    const pixelsPerMeter = () => baseScale() * cameraRef.current.zoom
    const toScreen = (wx: number, wz: number): [number, number] => {
      const s = pixelsPerMeter()
      return [
        canvas.clientWidth / 2 + (wx - cameraRef.current.cx) * s,
        canvas.clientHeight / 2 + (wz - cameraRef.current.cz) * s,
      ]
    }
    const toWorld = (screenX: number, screenY: number): [number, number] => {
      const s = pixelsPerMeter()
      return [
        cameraRef.current.cx + (screenX - canvas.clientWidth / 2) / s,
        cameraRef.current.cz + (screenY - canvas.clientHeight / 2) / s,
      ]
    }

    let raf = 0
    let lastInfoUpdate = 0
    const render = (now: number) => {
      resize()
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const ppm = pixelsPerMeter()
      const imageScale = ppm / cityScale
      const [cityX, cityY] = toScreen(cityWorldOrigin.x, cityWorldOrigin.z)
      const activeLayers = layersRef.current

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#535946'
      ctx.fillRect(0, 0, width, height)

      if (activeLayers.water) {
        ctx.drawImage(makeLayerCanvas('water'), cityX, cityY, CITY_RES * imageScale, CITY_RES * imageScale)
      }
      if (activeLayers.roads) {
        ctx.drawImage(makeLayerCanvas('roads'), cityX, cityY, CITY_RES * imageScale, CITY_RES * imageScale)
      }
      if (activeLayers.buildings) {
        ctx.drawImage(makeLayerCanvas('buildings'), cityX, cityY, CITY_RES * imageScale, CITY_RES * imageScale)
      }
      if (activeLayers.zones) {
        const view: MapView = {
          centerX: cameraRef.current.cx,
          centerZ: cameraRef.current.cz,
          scale: ppm,
          w: width,
          h: height,
        }
        drawZones(ctx, view, zonesRef.current)
        drawEditableZonePoints(
          ctx,
          toScreen,
          zonesRef.current.find((zone) => zone.id === selectedZoneIdRef.current) ?? null,
          selectedZonePointRef.current,
        )
      }
      if (activeLayers.markers) {
        drawMapMarkers(ctx, toScreen, markersRef.current, selectedMarkerIdRef.current)
      }

      const [spawnX, spawnY] = toScreen(SPAWN.x, SPAWN.z)
      ctx.beginPath()
      ctx.arc(spawnX, spawnY, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#e6493f'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      if (now - lastInfoUpdate > 160) {
        setViewInfo({ ...cameraRef.current })
        lastInfoUpdate = now
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    const zoomAt = (screenX: number, screenY: number, factor: number) => {
      const [wx, wz] = toWorld(screenX, screenY)
      cameraRef.current.zoom = clamp(cameraRef.current.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const s = pixelsPerMeter()
      cameraRef.current.cx = wx - (screenX - canvas.clientWidth / 2) / s
      cameraRef.current.cz = wz - (screenY - canvas.clientHeight / 2) / s
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomAt(event.offsetX, event.offsetY, event.deltaY < 0 ? 1.15 : 1 / 1.15)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const [wx, wz] = toWorld(event.clientX - rect.left, event.clientY - rect.top)
      if (toolRef.current === 'zone') {
        const zone = zonesRef.current.find((item) => item.id === selectedZoneIdRef.current) ?? null
        const pointIndex = findNearestZonePoint(zone, { x: wx, z: wz }, Math.max(5, 10 / pixelsPerMeter()))
        if (pointIndex !== null && selectedZoneIdRef.current) {
          setSelectedZonePoint(pointIndex)
          dragRef.current = { mode: 'zonePoint', pointerId: event.pointerId, zoneId: selectedZoneIdRef.current, pointIndex, moved: false }
          canvas.setPointerCapture(event.pointerId)
          return
        }
      }
      dragRef.current = {
        mode: 'pan',
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      }
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const [wx, wz] = toWorld(event.clientX - rect.left, event.clientY - rect.top)
      setMouseWorld({ x: wx, z: wz })

      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (drag.mode === 'zonePoint') {
        drag.moved = true
        moveZonePoint(drag.zoneId, drag.pointIndex, { x: wx, z: wz })
        return
      }
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true
      const s = pixelsPerMeter()
      cameraRef.current.cx -= (event.clientX - drag.x) / s
      cameraRef.current.cz -= (event.clientY - drag.y) / s
      drag.x = event.clientX
      drag.y = event.clientY
    }
    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current
      if (drag?.pointerId === event.pointerId) {
        dragRef.current = null
        if (drag.mode === 'zonePoint') return
        if (!drag.moved) {
          const rect = canvas.getBoundingClientRect()
          const [x, z] = toWorld(event.clientX - rect.left, event.clientY - rect.top)
          worldClickRef.current({ x, z })
        }
      }
    }
    const onPointerLeave = () => setMouseWorld(null)

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const toggleLayer = (id: LayerId) => {
    setLayers((current) => ({ ...current, [id]: !current[id] }))
  }
  const centerOnSpawn = () => {
    cameraRef.current = { cx: SPAWN.x, cz: SPAWN.z, zoom: 2.2 }
    setViewInfo(cameraRef.current)
  }
  const fitCity = () => {
    const panel = mapPanelRef.current
    const spanX = BOUNDS.maxX - BOUNDS.minX
    const spanZ = BOUNDS.maxZ - BOUNDS.minZ
    const gameFitZoom = panel
      ? Math.min(panel.clientWidth / (spanX * GAME_FIT_MARGIN), panel.clientHeight / (spanZ * GAME_FIT_MARGIN))
      : 0.1
    const zoom = viewMode === 'plan' ? 1 : clamp(gameFitZoom * (viewMode === 'gameTilt' ? 0.82 : 1), MIN_ZOOM, MAX_ZOOM)
    cameraRef.current = { cx: boundsCenter.x, cz: boundsCenter.z, zoom }
    setViewInfo(cameraRef.current)
  }
  const zoomBy = (factor: number) => {
    cameraRef.current.zoom = clamp(cameraRef.current.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    setViewInfo({ ...cameraRef.current })
  }
  const saveMarkers = async () => {
    const serialized = serializeMapMarkers(markers)
    const validation = validateMapMarkers(serialized)
    if (validation.errors.length > 0) {
      setSaveStatus(`Sauvegarde bloquee : ${validation.errors.length} erreur(s)`)
      return
    }

    setSaveStatus('Sauvegarde en cours...')
    try {
      const response = await fetch('/__pls/map-markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serialized),
      })
      if (!response.ok) throw new Error(await response.text())
      setMarkers(serialized)
      setSaveStatus(`Sauvegarde OK : ${serialized.length} point(s)`)
    } catch (error) {
      setSaveStatus(`Sauvegarde impossible : ${(error as Error).message}`)
    }
  }

  const saveZones = async () => {
    const payload = {
      _comment: ZONES_COMMENT,
      zones: cloneZones(zones),
    }
    if (payload.zones.some((zone) => zone.pts.length < 3)) {
      setSaveStatus('Sauvegarde quartiers bloquee : chaque quartier doit avoir au moins 3 points')
      return
    }

    setSaveStatus('Sauvegarde quartiers en cours...')
    try {
      const response = await fetch('/__pls/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await response.text())
      setSaveStatus(`Sauvegarde quartiers OK : ${payload.zones.length} quartier(s)`)
    } catch (error) {
      setSaveStatus(`Sauvegarde quartiers impossible : ${(error as Error).message}`)
    }
  }

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div>
          <div className="editor-title">Editeur PLS</div>
          <div className="editor-subtitle">Plan 2D + vues IG de Beauvais</div>
        </div>
        {moduleTabs}
        <div className="editor-mode-tabs" aria-label="Mode de vue">
          <button type="button" className={viewMode === 'plan' ? 'active' : ''} onClick={() => setViewMode('plan')}>
            Plan 2D
          </button>
          <button
            type="button"
            className={viewMode === 'gameTop' ? 'active' : ''}
            onClick={() => setViewMode('gameTop')}
          >
            Vue IG Top
          </button>
          <button
            type="button"
            className={viewMode === 'gameTilt' ? 'active' : ''}
            onClick={() => setViewMode('gameTilt')}
          >
            Vue 2.5D
          </button>
        </div>
        <div className="editor-tool-tabs" aria-label="Outil actif">
          <button
            type="button"
            className={editorTool === 'select' ? 'active' : ''}
            onClick={() => setEditorTool('select')}
          >
            Selection
          </button>
          <button
            type="button"
            className={editorTool === 'place' ? 'active' : ''}
            onClick={() => setEditorTool('place')}
          >
            Placer
          </button>
          <button
            type="button"
            className={editorTool === 'zone' ? 'active' : ''}
            onClick={() => setEditorTool('zone')}
          >
            Quartier
          </button>
        </div>
        <div className="editor-actions">
          <button type="button" onClick={() => zoomBy(1.2)} title="Zoomer">
            +
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.2)} title="Dezoomer">
            -
          </button>
          <button type="button" onClick={centerOnSpawn}>
            Spawn
          </button>
          <button type="button" onClick={fitCity}>
            Ville
          </button>
          <button type="button" className="primary" onClick={saveMarkers}>
            Sauver POI
          </button>
          <button type="button" className="primary" onClick={saveZones}>
            Sauver quartiers
          </button>
        </div>
      </header>

      <aside className="editor-left">
        <section>
          <h2>Calques</h2>
          <div className="layer-list">
            {layerConfigs.map((layer) => (
              <label key={layer.id} className="layer-row">
                <span className="layer-swatch" style={{ background: layer.color }} />
                <span>{layer.label}</span>
                <input
                  type="checkbox"
                  checked={layers[layer.id]}
                  onChange={() => toggleLayer(layer.id)}
                  aria-label={`Afficher ${layer.label}`}
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2>Navigation</h2>
          <p className="editor-note">
            Selection : cliquer un point. Placer : cliquer sur la carte pour creer un POI. Quartier : cliquer un
            sommet pour le deplacer, cliquer ailleurs pour ajouter un point au quartier selectionne.
          </p>
        </section>

        <section>
          <h2>Quartiers</h2>
          <div className="marker-list">
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={`marker-row ${zone.id === selectedZoneId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedZoneId(zone.id)
                  setSelectedZonePoint(null)
                  setEditorTool('zone')
                }}
              >
                <span className="layer-swatch" style={{ background: zone.color }} />
                <span>
                  <strong>{zone.name}</strong>
                  <small>{zone.pts.length} points</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Points</h2>
          <div className="marker-list">
            {markers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                className={`marker-row ${marker.id === selectedMarkerId ? 'active' : ''}`}
                onClick={() => setSelectedMarkerId(marker.id)}
              >
                <span className="layer-swatch" style={{ background: marker.color }} />
                <span>
                  <strong>{marker.name}</strong>
                  <small>{markerTypeLabels[marker.type]}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main ref={mapPanelRef} className="editor-map-panel">
        {viewMode !== 'plan' && (
          <EditorGameView
            cameraRef={cameraRef}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            cameraMode={viewMode === 'gameTilt' ? 'tilted' : 'top'}
            setMouseWorld={setMouseWorld}
            setViewInfo={setViewInfo}
            showMarkers={layers.markers}
            markers={markers}
            selectedMarkerId={selectedMarkerId}
            onWorldClick={handleWorldClick}
          />
        )}
        <canvas ref={canvasRef} className={`editor-map-canvas ${viewMode === 'plan' ? 'visible' : 'hidden'}`} />
        <div className="editor-map-status">
          {mouseWorld ? `x ${formatCoord(mouseWorld.x)} / z ${formatCoord(mouseWorld.z)}` : 'Survolez la carte'}
        </div>
      </main>

      <aside className="editor-right">
        <section>
          <h2>Inspecteur</h2>
          <dl className="inspector-list">
            <div>
              <dt>Vue</dt>
              <dd>
                {viewMode === 'plan' ? 'Plan 2D' : viewMode === 'gameTop' ? 'Vue IG top-down' : 'Vue IG 2.5D'}
              </dd>
            </div>
            <div>
              <dt>Outil</dt>
              <dd>{editorTool === 'place' ? 'Placement' : editorTool === 'zone' ? 'Quartier' : 'Selection'}</dd>
            </div>
            <div>
              <dt>Centre</dt>
              <dd>
                x {formatCoord(viewInfo.cx)}
                <br />z {formatCoord(viewInfo.cz)}
              </dd>
            </div>
            <div>
              <dt>Zoom</dt>
              <dd>{viewInfo.zoom.toFixed(2)}x</dd>
            </div>
            <div>
              <dt>Spawn</dt>
              <dd>
                x {formatCoord(SPAWN.x)}
                <br />z {formatCoord(SPAWN.z)}
              </dd>
            </div>
            <div>
              <dt>Etat</dt>
              <dd>{saveStatus}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2>Quartier selectionne</h2>
          {selectedZone ? (
            <form className="marker-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Nom</span>
                <input value={selectedZone.name} onChange={(event) => updateSelectedZone((zone) => ({ ...zone, name: event.currentTarget.value }))} />
              </label>
              <div className="field-pair">
                <label>
                  <span>Couleur</span>
                  <input type="color" value={selectedZone.color} onChange={(event) => updateSelectedZone((zone) => ({ ...zone, color: event.currentTarget.value }))} />
                </label>
                <label>
                  <span>Point actif</span>
                  <select
                    value={selectedZonePoint ?? ''}
                    onChange={(event) => setSelectedZonePoint(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}
                  >
                    <option value="">Aucun</option>
                    {selectedZone.pts.map((_, index) => (
                      <option key={index} value={index}>
                        Point {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedZonePoint !== null && selectedZone.pts[selectedZonePoint] && (
                <div className="field-pair">
                  <label>
                    <span>X</span>
                    <input
                      type="number"
                      step="1"
                      value={selectedZone.pts[selectedZonePoint][0]}
                      onChange={(event) =>
                        moveZonePoint(selectedZone.id, selectedZonePoint, {
                          x: Number(event.currentTarget.value),
                          z: selectedZone.pts[selectedZonePoint][1],
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Z</span>
                    <input
                      type="number"
                      step="1"
                      value={selectedZone.pts[selectedZonePoint][1]}
                      onChange={(event) =>
                        moveZonePoint(selectedZone.id, selectedZonePoint, {
                          x: selectedZone.pts[selectedZonePoint][0],
                          z: Number(event.currentTarget.value),
                        })
                      }
                    />
                  </label>
                </div>
              )}
              <div className="form-actions">
                <button type="button" onClick={deleteSelectedZonePoint} disabled={selectedZonePoint === null || selectedZone.pts.length <= 3}>
                  Supprimer point
                </button>
              </div>
            </form>
          ) : (
            <p className="editor-note">Aucun quartier selectionne.</p>
          )}
        </section>

        <section>
          <h2>Point selectionne</h2>
          {selectedMarker ? (
            <form className="marker-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Id</span>
                <input value={selectedMarker.id} readOnly />
              </label>
              <label>
                <span>Nom</span>
                <input
                  value={selectedMarker.name}
                  onChange={(event) =>
                    updateSelectedMarker((marker) => ({ ...marker, name: event.currentTarget.value }))
                  }
                />
              </label>
              <label>
                <span>Type</span>
                <select
                  value={selectedMarker.type}
                  onChange={(event) =>
                    updateSelectedMarker((marker) => ({
                      ...marker,
                      type: event.currentTarget.value as MapMarkerType,
                    }))
                  }
                >
                  {MAP_MARKER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {markerTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-pair">
                <label>
                  <span>Icone</span>
                  <input
                    value={selectedMarker.icon}
                    onChange={(event) =>
                      updateSelectedMarker((marker) => ({ ...marker, icon: event.currentTarget.value }))
                    }
                  />
                </label>
                <label>
                  <span>Couleur</span>
                  <input
                    type="color"
                    value={selectedMarker.color}
                    onChange={(event) =>
                      updateSelectedMarker((marker) => ({ ...marker, color: event.currentTarget.value }))
                    }
                  />
                </label>
              </div>
              <div className="field-pair">
                <label>
                  <span>X</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedMarker.position.x}
                    onChange={(event) => updateSelectedPosition('x', Number(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>Z</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedMarker.position.z}
                    onChange={(event) => updateSelectedPosition('z', Number(event.currentTarget.value))}
                  />
                </label>
              </div>
              <label>
                <span>Rayon</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={selectedMarker.interactionRadius}
                  onChange={(event) =>
                    updateSelectedMarker((marker) => ({
                      ...marker,
                      interactionRadius: Math.max(0.1, Number(event.currentTarget.value)),
                    }))
                  }
                />
              </label>
              <label>
                <span>Prompt</span>
                <textarea
                  value={selectedMarker.prompt}
                  rows={2}
                  onChange={(event) =>
                    updateSelectedMarker((marker) => ({ ...marker, prompt: event.currentTarget.value }))
                  }
                />
              </label>
              <label>
                <span>Tags</span>
                <input
                  value={selectedMarker.tags.join(', ')}
                  onChange={(event) =>
                    updateSelectedMarker((marker) => ({
                      ...marker,
                      tags: event.currentTarget.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
              <label>
                <span>Horaires</span>
                <textarea
                  key={`${selectedMarker.id}-hours`}
                  defaultValue={formatOpeningHours(selectedMarker.openingHours)}
                  rows={2}
                  placeholder="mon,tue 08:30-17:00; sat 10:00-18:00"
                  onBlur={(event) => {
                    const parsed = parseOpeningHours(event.currentTarget.value)
                    if (!parsed.ok) {
                      setSaveStatus(parsed.error)
                      return
                    }
                    updateSelectedMarker((marker) => ({ ...marker, openingHours: parsed.hours }))
                  }}
                />
              </label>
              <label>
                <span>Message ferme</span>
                <input
                  value={selectedMarker.closedMessage ?? ''}
                  onChange={(event) =>
                    updateSelectedMarker((marker) => ({
                      ...marker,
                      closedMessage: event.currentTarget.value.trim() || undefined,
                    }))
                  }
                />
              </label>
              <div className="checkbox-list">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMarker.visibleOnMap}
                    onChange={(event) =>
                      updateSelectedMarker((marker) => ({ ...marker, visibleOnMap: event.currentTarget.checked }))
                    }
                  />
                  <span>Visible carte</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMarker.visibleInGame}
                    onChange={(event) =>
                      updateSelectedMarker((marker) => ({ ...marker, visibleInGame: event.currentTarget.checked }))
                    }
                  />
                  <span>Visible IG</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMarker.devOnly}
                    onChange={(event) =>
                      updateSelectedMarker((marker) => ({ ...marker, devOnly: event.currentTarget.checked }))
                    }
                  />
                  <span>Dev only</span>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="danger" onClick={deleteSelectedMarker}>
                  Supprimer localement
                </button>
              </div>
            </form>
          ) : (
            <p className="editor-note">Aucun point selectionne.</p>
          )}
        </section>

        <section>
          <h2>Donnees</h2>
          <dl className="inspector-list">
            <div>
              <dt>POI</dt>
              <dd>{markers.length.toLocaleString('fr-FR')}</dd>
            </div>
            <div>
              <dt>Validation</dt>
              <dd>{markerValidation.errors.length === 0 ? 'OK' : `${markerValidation.errors.length} erreur(s)`}</dd>
            </div>
            <div>
              <dt>Batiments</dt>
              <dd>{BUILDINGS.length.toLocaleString('fr-FR')}</dd>
            </div>
            <div>
              <dt>Routes</dt>
              <dd>{ROADS.length.toLocaleString('fr-FR')}</dd>
            </div>
            <div>
              <dt>Eau</dt>
              <dd>{WATERS.length.toLocaleString('fr-FR')}</dd>
            </div>
            <div>
              <dt>Quartiers</dt>
              <dd>{zones.length.toLocaleString('fr-FR')}</dd>
            </div>
          </dl>
          {markerValidation.errors.length > 0 && (
            <ul className="validation-list">
              {markerValidation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}
