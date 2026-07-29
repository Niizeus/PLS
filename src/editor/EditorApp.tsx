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
import { readNumberInput } from './editorInputs'
import { saveData } from './editorSave'
import { useEditorHistory } from './editorHistory'
import { useEditorWorkspace } from './editorWorkspace'
import { PanelToggle, type EditorPanelsApi } from './EditorPanels'
import { makeInterior, slugifyInteriorId, uniqueInteriorId, type InteriorType } from '../data/interiors'

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

/**
 * Type d'interieur propose par defaut quand on cree l'interieur d'un point d'interet.
 * Les deux vocabulaires ne se recouvrent pas completement (un POI "npc" ou "secret" n'a pas
 * d'equivalent direct) : tout ce qui ne correspond a rien devient une boutique, modifiable
 * ensuite dans le module Interieurs.
 */
const interiorTypeByMarkerType: Partial<Record<MapMarkerType, InteriorType>> = {
  apartment: 'apartment',
  shop: 'shop',
  bar: 'bar',
  work: 'workplace',
  station: 'station',
  town_hall: 'town_hall',
  police: 'police',
  secret: 'secret',
}

function interiorTypeForMarker(type: MapMarkerType): InteriorType {
  return interiorTypeByMarkerType[type] ?? 'shop'
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

/**
 * Copie profonde des points d'interet, pour les photos d'historique.
 * ⚠️ Ne pas utiliser `serializeMapMarkers` ici : elle trie la liste, ce qui ferait sauter
 * l'ordre d'affichage a chaque annulation.
 */
function cloneMarkers(markers: MapMarker[]): MapMarker[] {
  return markers.map((marker) => ({
    ...marker,
    position: { ...marker.position },
    tags: [...marker.tags],
    openingHours: marker.openingHours?.map((entry) => ({ ...entry, days: [...entry.days] })),
  }))
}

/** Index du segment de contour le plus proche du point, pour y inserer un sommet. */
function findNearestZoneEdge(zone: Zone, point: MouseWorld) {
  let bestIndex = 0
  let bestDistance = Infinity
  for (let index = 0; index < zone.pts.length; index += 1) {
    const [ax, az] = zone.pts[index]
    const [bx, bz] = zone.pts[(index + 1) % zone.pts.length]
    const dx = bx - ax
    const dz = bz - az
    const lengthSq = dx * dx + dz * dz
    // Projection du point sur le segment, bornee a [0,1] pour rester entre les deux sommets.
    const t = lengthSq === 0 ? 0 : clamp(((point.x - ax) * dx + (point.z - az) * dz) / lengthSq, 0, 1)
    const distance = Math.hypot(point.x - (ax + t * dx), point.z - (az + t * dz))
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }
  return bestIndex
}

function makeZoneId(zones: Zone[]) {
  const ids = new Set(zones.map((zone) => zone.id))
  let index = zones.length + 1
  while (ids.has(`quartier_${index}`)) index += 1
  return `quartier_${index}`
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
  /** Volets lateraux, partages avec l'autre module (voir EditorHub). */
  panels: EditorPanelsApi
  /** `false` quand un autre module est a l'ecran : le module reste monte mais se met en veille. */
  active: boolean
}

/** Ce que l'historique annuler/retablir memorise a chaque modification. */
interface MapSnapshot {
  markers: MapMarker[]
  zones: Zone[]
}

export default function EditorApp({ moduleTabs, panels, active }: EditorAppProps) {
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
  const recordRef = useRef<(coalesceKey?: string) => void>(() => {})
  const dragRef = useRef<
    | { mode: 'pan'; pointerId: number; x: number; y: number; startX: number; startY: number; moved: boolean }
    | { mode: 'zonePoint'; pointerId: number; zoneId: string; pointIndex: number; startX: number; startY: number; moved: boolean }
    | { mode: 'marker'; pointerId: number; markerId: string; grabOffset: MouseWorld; startX: number; startY: number; moved: boolean }
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
  // Photo du dernier etat ecrit sur le disque : comparee a l'etat courant, elle dit si des
  // modifications attendent d'etre sauvegardees (voir markersDirty / zonesDirty).
  const [savedMarkersJson, setSavedMarkersJson] = useState(() => JSON.stringify(serializeMapMarkers(MAP_MARKERS)))
  const [savedZonesJson, setSavedZonesJson] = useState(() => JSON.stringify(cloneZones(ZONES)))
  const [markerSearch, setMarkerSearch] = useState('')
  const history = useEditorHistory<MapSnapshot>()
  const workspaceInteriors = useEditorWorkspace((state) => state.interiors)

  const selectedMarker = markers.find((marker) => marker.id === selectedMarkerId) ?? null
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null
  const linkedInterior = selectedMarker?.interiorId
    ? (workspaceInteriors.find((interior) => interior.id === selectedMarker.interiorId) ?? null)
    : null
  const markerValidation = useMemo(() => validateMapMarkers(markers), [markers])
  const markersDirty = useMemo(
    () => JSON.stringify(serializeMapMarkers(markers)) !== savedMarkersJson,
    [markers, savedMarkersJson],
  )
  const zonesDirty = useMemo(() => JSON.stringify(cloneZones(zones)) !== savedZonesJson, [zones, savedZonesJson])
  const hasUnsavedChanges = markersDirty || zonesDirty

  /**
   * Liste de POI affichee dans le volet gauche.
   * La recherche porte sur le nom, le type (libelle francais compris) et les tags, pour
   * retrouver un lieu aussi bien par "kebab" que par "bar" ou "sortie".
   */
  const visibleMarkers = useMemo(() => {
    const needle = markerSearch.trim().toLowerCase()
    if (!needle) return markers
    return markers.filter((marker) =>
      [marker.name, marker.type, markerTypeLabels[marker.type] ?? '', marker.id, ...marker.tags]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [markers, markerSearch])

  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    toolRef.current = editorTool
  }, [editorTool])

  useEffect(() => {
    markersRef.current = markers
    // Copie en lecture pour le module Interieurs (voir editorWorkspace.ts).
    useEditorWorkspace.getState().setMarkers(markers)
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

  /** Photo de l'etat courant, lue depuis les refs (a jour meme au milieu d'un glisser). */
  const snapshot = (): MapSnapshot => ({
    markers: cloneMarkers(markersRef.current),
    zones: cloneZones(zonesRef.current),
  })

  /** A appeler AVANT toute modification, pour rendre l'action annulable (Ctrl+Z). */
  const record = (coalesceKey?: string) => history.push(snapshot(), coalesceKey)

  const applyMarkers = (list: MapMarker[], status: string) => {
    markersRef.current = list // garde le ref a jour meme entre deux rendus (glisser souris)
    setMarkers(list)
    setSaveStatus(status)
  }

  const applyZones = (list: Zone[], status: string) => {
    zonesRef.current = list
    setZones(list)
    setSaveStatus(status)
  }

  /** Remet l'editeur dans un etat memorise par l'historique. */
  const applySnapshot = (snap: MapSnapshot, status: string) => {
    applyMarkers(snap.markers, status)
    applyZones(snap.zones, status)
    // La selection peut pointer vers un element qui n'existe plus dans cette version.
    if (!snap.markers.some((marker) => marker.id === selectedMarkerIdRef.current)) setSelectedMarkerId(null)
    if (!snap.zones.some((zone) => zone.id === selectedZoneIdRef.current)) {
      setSelectedZoneId(snap.zones[0]?.id ?? null)
    }
    setSelectedZonePoint(null)
  }

  const undo = () => {
    const previous = history.undo(snapshot())
    if (previous) applySnapshot(previous, 'Annulation locale, sauvegarde requise')
  }

  const redo = () => {
    const next = history.redo(snapshot())
    if (next) applySnapshot(next, 'Retablissement local, sauvegarde requise')
  }

  // ⚠️ IMPORTANT : `recipe` est appliquee TOUT DE SUITE, pas a l'interieur du callback
  // passe a setMarkers/setZones. React n'execute ce callback-la qu'au rendu suivant, et
  // les champs de l'inspecteur y liraient un `event.currentTarget` deja remis a null par
  // React -> TypeError en plein rendu -> l'editeur entier se demonte (page blanche).
  // En appliquant la recette ici, on lit l'evenement pendant qu'il est encore valide.
  const updateSelectedMarker = (recipe: (marker: MapMarker) => MapMarker, coalesceKey = 'marker-field') => {
    if (!selectedMarkerId) return
    const current = markersRef.current.find((marker) => marker.id === selectedMarkerId)
    if (!current) return
    record(coalesceKey)
    const next = recipe(current)
    applyMarkers(
      markersRef.current.map((marker) => (marker.id === selectedMarkerId ? next : marker)),
      'Modifications non sauvegardees',
    )
  }

  const updateSelectedZone = (recipe: (zone: Zone) => Zone, coalesceKey: string | undefined = 'zone-field') => {
    if (!selectedZoneId) return
    const current = zonesRef.current.find((zone) => zone.id === selectedZoneId)
    if (!current) return
    record(coalesceKey)
    const next = recipe(current)
    applyZones(
      zonesRef.current.map((zone) => (zone.id === selectedZoneId ? next : zone)),
      'Quartiers modifies, sauvegarde requise',
    )
  }

  /**
   * Deplace un sommet de quartier.
   * `recordHistory` est a `false` pendant un glisser : l'historique a deja ete pris au
   * moment ou on a attrape le sommet, sinon chaque pixel parcouru serait une annulation.
   */
  const moveZonePoint = (zoneId: string, pointIndex: number, point: MouseWorld, recordHistory = true) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return
    if (recordHistory) record('zone-point')
    applyZones(
      zonesRef.current.map((zone) =>
        zone.id === zoneId
          ? {
              ...zone,
              pts: zone.pts.map((zonePoint, index) =>
                index === pointIndex ? [Number(point.x.toFixed(1)), Number(point.z.toFixed(1))] : zonePoint,
              ),
            }
          : zone,
      ),
      'Quartiers modifies, sauvegarde requise',
    )
  }

  /**
   * Ajoute un sommet au quartier selectionne, INSERE dans le contour au bon endroit :
   * au milieu du segment le plus proche du clic. Avant, le point partait toujours en fin de
   * liste, ce qui repliait le polygone sur lui-meme des qu'on ne cliquait pas dans l'ordre.
   */
  const addZonePoint = (point: MouseWorld) => {
    const zone = zonesRef.current.find((item) => item.id === selectedZoneIdRef.current)
    if (!zone) return
    const insertAt = zone.pts.length >= 2 ? findNearestZoneEdge(zone, point) + 1 : zone.pts.length
    updateSelectedZone((current) => {
      const pts = [...current.pts]
      pts.splice(insertAt, 0, [Number(point.x.toFixed(1)), Number(point.z.toFixed(1))])
      return { ...current, pts }
    }, undefined)
    setSelectedZonePoint(insertAt)
  }

  const deleteSelectedZonePoint = () => {
    if (!selectedZone || selectedZonePoint === null || selectedZone.pts.length <= 3) return
    updateSelectedZone((zone) => ({ ...zone, pts: zone.pts.filter((_, index) => index !== selectedZonePoint) }), undefined)
    setSelectedZonePoint(null)
  }

  /** Nouveau quartier : un carre de 200 m au centre de la vue, a redessiner ensuite. */
  const addZone = () => {
    const { cx, cz } = cameraRef.current
    const half = 100
    const zone: Zone = {
      id: makeZoneId(zonesRef.current),
      name: 'Nouveau quartier',
      color: '#f0b84d',
      pts: [
        [Number((cx - half).toFixed(1)), Number((cz - half).toFixed(1))],
        [Number((cx + half).toFixed(1)), Number((cz - half).toFixed(1))],
        [Number((cx + half).toFixed(1)), Number((cz + half).toFixed(1))],
        [Number((cx - half).toFixed(1)), Number((cz + half).toFixed(1))],
      ],
    }
    record()
    applyZones([...zonesRef.current, zone], 'Nouveau quartier cree, sauvegarde requise')
    setSelectedZoneId(zone.id)
    setSelectedZonePoint(null)
    setEditorTool('zone')
  }

  const deleteSelectedZone = () => {
    const zone = zonesRef.current.find((item) => item.id === selectedZoneIdRef.current)
    if (!zone) return
    if (!window.confirm(`Supprimer le quartier "${zone.name}" et ses ${zone.pts.length} points ?`)) return
    record()
    const list = zonesRef.current.filter((item) => item.id !== zone.id)
    applyZones(list, 'Quartier supprime localement, sauvegarde requise')
    setSelectedZoneId(list[0]?.id ?? null)
    setSelectedZonePoint(null)
  }

  const updateSelectedPosition = (axis: 'x' | 'z', value: number) => {
    if (!Number.isFinite(value)) return
    updateSelectedMarker((marker) => ({
      ...marker,
      position: { ...marker.position, [axis]: value },
    }))
  }

  /** Deplace un POI a la souris. Meme logique d'historique que `moveZonePoint`. */
  const moveMarker = (markerId: string, point: MouseWorld, recordHistory = true) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return
    if (recordHistory) record('marker-move')
    applyMarkers(
      markersRef.current.map((marker) =>
        marker.id === markerId
          ? { ...marker, position: { x: Number(point.x.toFixed(2)), z: Number(point.z.toFixed(2)) } }
          : marker,
      ),
      'Point deplace, sauvegarde requise',
    )
  }

  const deleteSelectedMarker = () => {
    const marker = markersRef.current.find((item) => item.id === selectedMarkerIdRef.current)
    if (!marker) return
    record()
    applyMarkers(
      markersRef.current.filter((item) => item.id !== marker.id),
      'Point supprime localement, sauvegarde requise',
    )
    setSelectedMarkerId(null)
  }

  /** Duplique le POI selectionne, decale de 5 m pour qu'il ne se cache pas sous l'original. */
  const duplicateSelectedMarker = () => {
    const marker = markersRef.current.find((item) => item.id === selectedMarkerIdRef.current)
    if (!marker) return
    const copy: MapMarker = {
      ...cloneMarkers([marker])[0],
      id: makeMarkerId(markersRef.current),
      name: `${marker.name} copie`,
      position: { x: Number((marker.position.x + 5).toFixed(2)), z: Number((marker.position.z + 5).toFixed(2)) },
    }
    record()
    applyMarkers([...markersRef.current, copy], 'Point duplique, sauvegarde requise')
    setSelectedMarkerId(copy.id)
  }

  /**
   * Cree le niveau interieur d'un point d'interet, puis bascule dessus pour l'editer.
   *
   * L'interieur est fabrique EN MEMOIRE et ouvert tout de suite : pas besoin de sauvegarder
   * pour pouvoir le dessiner. Il n'atterrit sur le disque qu'au bouton Sauver du module
   * Interieurs, et le POI ne garde le lien que si on sauvegarde aussi les POI.
   */
  const createInteriorForSelectedMarker = () => {
    const marker = markersRef.current.find((item) => item.id === selectedMarkerIdRef.current)
    if (!marker) return

    const existingInteriors = useEditorWorkspace.getState().interiors
    const interiorId = uniqueInteriorId(slugifyInteriorId(marker.name || marker.id), existingInteriors)
    const interior = makeInterior({
      id: interiorId,
      name: marker.name || 'Nouvel interieur',
      type: interiorTypeForMarker(marker.type),
      markerId: marker.id,
    })

    updateSelectedMarker((current) => ({ ...current, interiorId }), undefined)
    useEditorWorkspace.getState().addInterior(interior)
  }

  const openInteriorOfSelectedMarker = () => {
    if (selectedMarker?.interiorId) useEditorWorkspace.getState().openInterior(selectedMarker.interiorId)
  }

  /** Detache le POI de son interieur. Le fichier de l'interieur, lui, reste sur le disque. */
  const detachInteriorFromSelectedMarker = () => {
    updateSelectedMarker((current) => ({ ...current, interiorId: undefined }), undefined)
  }

  /** Recentre la vue sur un point du monde sans changer le zoom. */
  const centerOn = (point: MouseWorld) => {
    cameraRef.current = { ...cameraRef.current, cx: point.x, cz: point.z }
    setViewInfo({ ...cameraRef.current })
  }

  /**
   * Recentre la vue sur ce qui est selectionne (touche F).
   * Priorite au point d'interet ; a defaut, le centre du quartier selectionne.
   */
  const focusSelection = () => {
    const marker = markersRef.current.find((item) => item.id === selectedMarkerIdRef.current)
    if (marker) {
      centerOn({ x: marker.position.x, z: marker.position.z })
      return
    }
    const zone = zonesRef.current.find((item) => item.id === selectedZoneIdRef.current)
    if (!zone?.pts.length) return
    const sum = zone.pts.reduce((acc, [x, z]) => ({ x: acc.x + x, z: acc.z + z }), { x: 0, z: 0 })
    centerOn({ x: sum.x / zone.pts.length, z: sum.z / zone.pts.length })
  }

  const handleWorldClick = (point: MouseWorld) => {
    if (toolRef.current === 'zone') {
      addZonePoint(point)
      return
    }

    if (!layersRef.current.markers) return

    if (toolRef.current === 'place') {
      const marker = makeMarkerAt(point, markersRef.current)
      record()
      applyMarkers([...markersRef.current, marker], 'Nouveau point cree, sauvegarde requise')
      setSelectedMarkerId(marker.id)
      return
    }

    const hitDistance = Math.max(4, 12 / cameraRef.current.zoom)
    const marker = findNearestMarker(markersRef.current, point, hitDistance)
    setSelectedMarkerId(marker?.id ?? null)
  }

  // Les gestionnaires souris du canvas ne sont attaches qu'une fois (effet a dependances
  // vides) : ils passent par ces refs pour toujours appeler la version courante.
  useEffect(() => {
    worldClickRef.current = handleWorldClick
    recordRef.current = record
  })

  // Fermer l'onglet ou recharger avec des modifications non sauvegardees les perdait en
  // silence. Le navigateur affiche maintenant sa demande de confirmation standard.
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  // Raccourcis clavier. Pas de tableau de dependances : l'effet se rebranche a chaque rendu
  // pour toujours agir sur la selection courante.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Module masque : les deux modules restent montes, seul celui a l'ecran ecoute le clavier.
      if (!active) return
      // Ne jamais voler les touches a un champ de saisie : on doit pouvoir taper "v" dans un nom.
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return

      if (event.ctrlKey || event.metaKey) {
        if (event.code === 'KeyZ' && !event.shiftKey) {
          event.preventDefault()
          undo()
        } else if ((event.code === 'KeyZ' && event.shiftKey) || event.code === 'KeyY') {
          event.preventDefault()
          redo()
        } else if (event.code === 'KeyD') {
          event.preventDefault()
          duplicateSelectedMarker()
        } else if (event.code === 'KeyS') {
          event.preventDefault()
          if (markersDirty) void saveMarkers()
          if (zonesDirty) void saveZones()
          if (!markersDirty && !zonesDirty) setSaveStatus('Rien a sauver, tout est deja sur le disque')
        }
        return
      }

      if (event.code === 'KeyV') setEditorTool('select')
      if (event.code === 'KeyP') setEditorTool('place')
      if (event.code === 'KeyQ') setEditorTool('zone')
      if (event.code === 'KeyF') focusSelection()
      if (event.code === 'Delete' || event.code === 'Backspace') {
        event.preventDefault()
        // Suppr agit sur ce qui est reellement en cours d'edition : un sommet de quartier
        // quand on est dans l'outil Quartier, sinon le point d'interet selectionne.
        if (editorTool === 'zone' && selectedZonePoint !== null) deleteSelectedZonePoint()
        else deleteSelectedMarker()
      }
      if (event.code === 'Escape') {
        setSelectedMarkerId(null)
        setSelectedZonePoint(null)
        setEditorTool('select')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
      // Module masque (l'autre onglet est a l'ecran) : rien a dessiner, on se rendort.
      // Le module reste monte pour ne pas perdre le travail en cours, mais il ne doit pas
      // consommer de CPU pour rien.
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
        raf = requestAnimationFrame(render)
        return
      }
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
          dragRef.current = {
            mode: 'zonePoint',
            pointerId: event.pointerId,
            zoneId: selectedZoneIdRef.current,
            pointIndex,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          }
          canvas.setPointerCapture(event.pointerId)
          return
        }
      }

      // Outil Selection : attraper un POI pour le deplacer directement a la souris.
      if (toolRef.current === 'select' && layersRef.current.markers) {
        const hitDistance = Math.max(4, 12 / pixelsPerMeter())
        const marker = findNearestMarker(markersRef.current, { x: wx, z: wz }, hitDistance)
        if (marker) {
          setSelectedMarkerId(marker.id)
          dragRef.current = {
            mode: 'marker',
            pointerId: event.pointerId,
            markerId: marker.id,
            // Ecart entre le clic et le centre du point : le POI ne saute pas sous le curseur.
            grabOffset: { x: marker.position.x - wx, z: marker.position.z - wz },
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          }
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
      if (drag.mode === 'zonePoint' || drag.mode === 'marker') {
        // Un simple clic ne doit pas creer d'entree dans l'historique : on attend un vrai
        // deplacement, puis on prend UNE photo pour tout le glisser.
        if (!drag.moved) {
          if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= 3) return
          drag.moved = true
          recordRef.current()
        }
        if (drag.mode === 'zonePoint') moveZonePoint(drag.zoneId, drag.pointIndex, { x: wx, z: wz }, false)
        else moveMarker(drag.markerId, { x: wx + drag.grabOffset.x, z: wz + drag.grabOffset.z }, false)
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
        if (drag.mode === 'zonePoint' || drag.mode === 'marker') return
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
    const result = await saveData({
      endpoint: '/__pls/map-markers',
      payload: serialized,
      successMessage: `Sauvegarde OK : ${serialized.length} point(s)`,
    })
    if (result.status === 'ok') {
      setMarkers(serialized)
      markersRef.current = serialized
      setSavedMarkersJson(JSON.stringify(serialized))
    }
    setSaveStatus(result.message)
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
    const result = await saveData({
      endpoint: '/__pls/zones',
      payload,
      successMessage: `Sauvegarde quartiers OK : ${payload.zones.length} quartier(s)`,
    })
    if (result.status === 'ok') setSavedZonesJson(JSON.stringify(payload.zones))
    setSaveStatus(result.message)
  }

  return (
    <div className={`editor-shell ${active ? '' : 'editor-hidden'}`} style={panels.shellStyle}>
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
            title="Selection et deplacement (V)"
          >
            Selection
          </button>
          <button
            type="button"
            className={editorTool === 'place' ? 'active' : ''}
            onClick={() => setEditorTool('place')}
            title="Placer un point d'interet (P)"
          >
            Placer
          </button>
          <button
            type="button"
            className={editorTool === 'zone' ? 'active' : ''}
            onClick={() => setEditorTool('zone')}
            title="Dessiner les contours de quartier (Q)"
          >
            Quartier
          </button>
        </div>
        <div className="editor-actions">
          <button type="button" onClick={undo} disabled={!history.canUndo} title="Annuler (Ctrl+Z)">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={!history.canRedo} title="Retablir (Ctrl+Y)">
            ↷
          </button>
          <button type="button" onClick={() => zoomBy(1.2)} title="Zoomer">
            +
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.2)} title="Dezoomer">
            -
          </button>
          <button type="button" onClick={centerOnSpawn} title="Centrer sur le point de depart du joueur">
            Spawn
          </button>
          <button type="button" onClick={fitCity} title="Voir toute la ville">
            Ville
          </button>
          <button
            type="button"
            className={`primary ${markersDirty ? 'dirty' : ''}`}
            onClick={saveMarkers}
            title={markersDirty ? "Points d'interet modifies, pas encore sur le disque" : 'Points a jour sur le disque'}
          >
            Sauver POI{markersDirty ? ' •' : ''}
          </button>
          <button
            type="button"
            className={`primary ${zonesDirty ? 'dirty' : ''}`}
            onClick={saveZones}
            title={zonesDirty ? 'Quartiers modifies, pas encore sur le disque' : 'Quartiers a jour sur le disque'}
          >
            Sauver quartiers{zonesDirty ? ' •' : ''}
          </button>
        </div>
      </header>

      <aside className={`editor-left ${panels.layout.leftCollapsed ? 'collapsed' : ''}`}>
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
                onDoubleClick={focusSelection}
                title="Clic : selectionner. Double-clic : centrer la vue dessus."
              >
                <span className="layer-swatch" style={{ background: zone.color }} />
                <span>
                  <strong>{zone.name}</strong>
                  <small>{zone.pts.length} points</small>
                </span>
              </button>
            ))}
          </div>
          <div className="list-actions">
            <button type="button" onClick={addZone}>
              + Quartier
            </button>
            <button type="button" className="danger" onClick={deleteSelectedZone} disabled={!selectedZone}>
              Supprimer
            </button>
          </div>
        </section>

        <section>
          <h2>Points ({visibleMarkers.length}/{markers.length})</h2>
          <input
            className="list-search"
            type="search"
            value={markerSearch}
            placeholder="Chercher un nom, un type, un tag..."
            onChange={(event) => setMarkerSearch(event.currentTarget.value)}
          />
          <div className="marker-list">
            {visibleMarkers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                className={`marker-row ${marker.id === selectedMarkerId ? 'active' : ''}`}
                onClick={() => setSelectedMarkerId(marker.id)}
                onDoubleClick={() => centerOn({ x: marker.position.x, z: marker.position.z })}
                title="Clic : selectionner. Double-clic : centrer la vue dessus."
              >
                <span className="layer-swatch" style={{ background: marker.color }} />
                <span>
                  <strong>{marker.name}</strong>
                  <small>{markerTypeLabels[marker.type] ?? marker.type}</small>
                </span>
              </button>
            ))}
            {markers.length > 0 && visibleMarkers.length === 0 && (
              <p className="editor-note">Aucun point ne correspond a cette recherche.</p>
            )}
            {markers.length === 0 && (
              <p className="editor-note">Aucun point. Outil Placer (P) puis clic sur la carte.</p>
            )}
          </div>
        </section>

        <section>
          <h2>Aide</h2>
          <dl className="shortcut-list">
            <div>
              <dt>V / P / Q</dt>
              <dd>Selection / Placer / Quartier</dd>
            </div>
            <div>
              <dt>Glisser</dt>
              <dd>Deplace le point ou le sommet attrape ; sinon deplace la vue</dd>
            </div>
            <div>
              <dt>Molette</dt>
              <dd>Zoomer / dezoomer</dd>
            </div>
            <div>
              <dt>F</dt>
              <dd>Centrer sur la selection</dd>
            </div>
            <div>
              <dt>Suppr</dt>
              <dd>Supprimer la selection</dd>
            </div>
            <div>
              <dt>Ctrl+Z / Y</dt>
              <dd>Annuler / retablir</dd>
            </div>
            <div>
              <dt>Ctrl+D</dt>
              <dd>Dupliquer le point</dd>
            </div>
            <div>
              <dt>Ctrl+S</dt>
              <dd>Sauvegarder ce qui a change</dd>
            </div>
            <div>
              <dt>Echap</dt>
              <dd>Tout deselectionner</dd>
            </div>
          </dl>
          <p className="editor-note">
            Outil Quartier : cliquer un sommet pour l&apos;attraper, cliquer ailleurs pour inserer un sommet dans
            le contour, au plus pres du bord clique.
          </p>
        </section>
      </aside>

      <main ref={mapPanelRef} className="editor-map-panel">
        {/* Poignees et boutons vivent dans le panneau central : il ne defile pas, donc ils
            restent toujours visibles, contrairement aux volets qui, eux, defilent. */}
        {panels.renderHandle('left')}
        {panels.renderHandle('right')}
        <PanelToggle side="left" collapsed={panels.layout.leftCollapsed} onToggle={() => panels.toggle('left')} />
        <PanelToggle side="right" collapsed={panels.layout.rightCollapsed} onToggle={() => panels.toggle('right')} />
        {viewMode !== 'plan' && active && (
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
            tool={editorTool}
            onMarkerDrag={(markerId, point, first) => moveMarker(markerId, point, first)}
          />
        )}
        <canvas ref={canvasRef} className={`editor-map-canvas ${viewMode === 'plan' ? 'visible' : 'hidden'}`} />
        <div className="editor-map-status">
          {mouseWorld ? `x ${formatCoord(mouseWorld.x)} / z ${formatCoord(mouseWorld.z)}` : 'Survolez la carte'}
        </div>
      </main>

      <aside className={`editor-right ${panels.layout.rightCollapsed ? 'collapsed' : ''}`}>
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
            <div>
              <dt>A sauver</dt>
              <dd className={hasUnsavedChanges ? 'inspector-dirty' : ''}>
                {hasUnsavedChanges
                  ? [markersDirty ? 'POI' : null, zonesDirty ? 'Quartiers' : null].filter(Boolean).join(' + ')
                  : 'Rien, tout est sur le disque'}
              </dd>
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
                          x: readNumberInput(event.currentTarget.value),
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
                          z: readNumberInput(event.currentTarget.value),
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
                    onChange={(event) => updateSelectedPosition('x', readNumberInput(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>Z</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedMarker.position.z}
                    onChange={(event) => updateSelectedPosition('z', readNumberInput(event.currentTarget.value))}
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
                  onChange={(event) => {
                    const radius = readNumberInput(event.currentTarget.value)
                    if (!Number.isFinite(radius)) return
                    updateSelectedMarker((marker) => ({ ...marker, interactionRadius: Math.max(0.1, radius) }))
                  }}
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
              <div className="interior-link">
                <span className="interior-link-title">Interieur</span>
                {selectedMarker.interiorId ? (
                  <>
                    <p className="editor-note">
                      Ce point ouvre <strong>{linkedInterior?.name ?? selectedMarker.interiorId}</strong>
                      {!linkedInterior && ' — introuvable, il a du etre supprime.'}
                    </p>
                    <div className="interior-link-actions">
                      <button type="button" className="secondary-action" onClick={openInteriorOfSelectedMarker}>
                        Editer l&apos;interieur
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={detachInteriorFromSelectedMarker}
                        title="Le point ne mene plus nulle part. Le fichier de l'interieur reste sur le disque."
                      >
                        Detacher
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="editor-note">Ce point ne mene nulle part pour l&apos;instant.</p>
                    <div className="interior-link-actions">
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={createInteriorForSelectedMarker}
                        title="Cree une piece avec un point d'arrivee et une sortie, puis l'ouvre pour l'editer"
                      >
                        Creer l&apos;interieur
                      </button>
                      <select
                        value=""
                        aria-label="Rattacher un interieur existant"
                        onChange={(event) => {
                          const interiorId = event.currentTarget.value
                          if (interiorId) updateSelectedMarker((current) => ({ ...current, interiorId }), undefined)
                        }}
                      >
                        <option value="">Rattacher un existant...</option>
                        {workspaceInteriors.map((interior) => (
                          <option key={interior.id} value={interior.id}>
                            {interior.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-action" onClick={focusSelection} title="Touche F">
                  Centrer
                </button>
                <button type="button" className="secondary-action" onClick={duplicateSelectedMarker} title="Ctrl+D">
                  Dupliquer
                </button>
                <button type="button" className="danger" onClick={deleteSelectedMarker} title="Suppr">
                  Supprimer
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
