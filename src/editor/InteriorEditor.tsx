import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  INTERIORS,
  serializeInterior,
  validateInteriors,
  type InteriorDefinition,
  type InteriorDoor,
  type InteriorExit,
  type InteriorFloor,
  type InteriorProp,
  type InteriorRemovedWall,
  type InteriorRoom,
  type InteriorSpawnPoint,
  type InteriorWindow,
} from '../data/interiors'
import InteriorTestView from './InteriorTestView'
import { getVisibleWallSegments, getWallSegments, isWallRemoved, type InteriorWallSegment } from './interiorGeometry'

type InteriorTool = 'select' | 'room' | 'wall' | 'door' | 'window' | 'spawn' | 'exit' | 'prop'
type SelectedInteriorItem =
  | { kind: 'room'; id: string }
  | { kind: 'wall'; roomId: string; side: InteriorWallSegment['side'] }
  | { kind: 'door'; id: string }
  | { kind: 'window'; id: string }
  | { kind: 'spawn'; id: string }
  | { kind: 'exit'; id: string }
  | { kind: 'prop'; id: string }

interface InteriorEditorProps {
  moduleTabs?: ReactNode
}

interface PlanPoint {
  x: number
  z: number
}

const MIN_ZOOM = 14
const MAX_ZOOM = 90
const GRID_STEP = 0.5
const ROOM_MIN_SIZE = 0.5
const WALL_SNAP_DISTANCE = 0.75
const HISTORY_LIMIT = 60
const PROP_TRANSFER_TYPE = 'application/x-pls-prop'

const toolLabels: Record<InteriorTool, string> = {
  select: 'Selection',
  room: 'Piece',
  wall: 'Mur',
  door: 'Porte',
  window: 'Fenetre',
  spawn: 'Spawn',
  exit: 'Sortie',
  prop: 'Prop',
}

const PLACEHOLDER_ASSETS = [
  { id: 'proto_cube', label: 'Cube', color: '#b276ff' },
  { id: 'proto_table', label: 'Table', color: '#e0a849' },
  { id: 'proto_chair', label: 'Chaise', color: '#4fb477' },
  { id: 'proto_counter', label: 'Comptoir', color: '#d26d55' },
  { id: 'proto_light', label: 'Lumiere', color: '#f3e36d' },
] as const

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}`
}

function snap(value: number, step = GRID_STEP) {
  return Math.round(value / step) * step
}

function round2(value: number) {
  return Number(value.toFixed(2))
}

function cloneInteriors(interiors: InteriorDefinition[]) {
  return interiors.map((interior) => serializeInterior(interior))
}

function getFloor(interior: InteriorDefinition, floorId: string): InteriorFloor {
  return interior.floors.find((floor) => floor.id === floorId) ?? interior.floors[0]
}

function pointInRoom(point: PlanPoint, room: InteriorRoom) {
  return point.x >= room.x && point.x <= room.x + room.w && point.z >= room.z && point.z <= room.z + room.d
}

function distanceToPoint(point: PlanPoint, x: number, z: number) {
  return Math.hypot(point.x - x, point.z - z)
}

function getSelectionPoint(floor: InteriorFloor, selected: SelectedInteriorItem): PlanPoint | null {
  if (selected.kind === 'wall') return null
  if (selected.kind === 'room') {
    const room = floor.rooms.find((item) => item.id === selected.id)
    return room ? { x: room.x, z: room.z } : null
  }
  const item = getSelectedPointItem(floor, selected)
  return item ? { x: item.x, z: item.z } : null
}

function getSelectedPointItem(floor: InteriorFloor, selected: SelectedInteriorItem) {
  if (selected.kind === 'wall') return null
  if (selected.kind === 'door') return floor.doors.find((item) => item.id === selected.id) ?? null
  if (selected.kind === 'window') return floor.windows.find((item) => item.id === selected.id) ?? null
  if (selected.kind === 'spawn') return floor.spawnPoints.find((item) => item.id === selected.id) ?? null
  if (selected.kind === 'exit') return floor.exits.find((item) => item.id === selected.id) ?? null
  if (selected.kind === 'prop') return floor.props.find((item) => item.id === selected.id) ?? null
  return null
}

function distanceToSegment(point: PlanPoint, wall: InteriorWallSegment) {
  const halfW = wall.w / 2
  const halfD = wall.d / 2
  const minX = wall.x - halfW
  const maxX = wall.x + halfW
  const minZ = wall.z - halfD
  const maxZ = wall.z + halfD
  const x = Math.min(maxX, Math.max(minX, point.x))
  const z = Math.min(maxZ, Math.max(minZ, point.z))
  return distanceToPoint(point, x, z)
}

function findNearestWall(floor: InteriorFloor, point: PlanPoint, maxDistance = 0.28) {
  let best: InteriorWallSegment | null = null
  let bestDistance = maxDistance
  for (const room of floor.rooms) {
    for (const wall of getWallSegments(room, 0.12)) {
      const distance = distanceToSegment(point, wall)
      if (distance <= bestDistance) {
        best = wall
        bestDistance = distance
      }
    }
  }
  return best
}

function snapToNearestWall(point: PlanPoint, floor: InteriorFloor): { x: number; z: number; rotation: number } {
  let best: { x: number; z: number; rotation: number; distance: number } | null = null

  for (const room of floor.rooms) {
    const candidates = [
      { x: Math.min(room.x + room.w, Math.max(room.x, point.x)), z: room.z, rotation: 0 },
      { x: Math.min(room.x + room.w, Math.max(room.x, point.x)), z: room.z + room.d, rotation: 0 },
      { x: room.x, z: Math.min(room.z + room.d, Math.max(room.z, point.z)), rotation: Math.PI / 2 },
      { x: room.x + room.w, z: Math.min(room.z + room.d, Math.max(room.z, point.z)), rotation: Math.PI / 2 },
    ]
    for (const candidate of candidates) {
      const distance = distanceToPoint(point, candidate.x, candidate.z)
      if (distance <= WALL_SNAP_DISTANCE && (!best || distance < best.distance)) best = { ...candidate, distance }
    }
  }

  if (!best) return { x: round2(snap(point.x)), z: round2(snap(point.z)), rotation: 0 }
  return { x: round2(snap(best.x)), z: round2(snap(best.z)), rotation: best.rotation }
}

function findSelection(floor: InteriorFloor, point: PlanPoint): SelectedInteriorItem | null {
  for (const spawn of floor.spawnPoints) if (distanceToPoint(point, spawn.x, spawn.z) <= 0.35) return { kind: 'spawn', id: spawn.id }
  for (const exit of floor.exits) if (distanceToPoint(point, exit.x, exit.z) <= 0.35) return { kind: 'exit', id: exit.id }
  for (const prop of floor.props) if (distanceToPoint(point, prop.x, prop.z) <= 0.35) return { kind: 'prop', id: prop.id }
  for (const door of floor.doors) if (distanceToPoint(point, door.x, door.z) <= 0.35) return { kind: 'door', id: door.id }
  for (const windowItem of floor.windows) {
    if (distanceToPoint(point, windowItem.x, windowItem.z) <= 0.35) return { kind: 'window', id: windowItem.id }
  }
  for (let index = floor.rooms.length - 1; index >= 0; index -= 1) {
    const room = floor.rooms[index]
    if (pointInRoom(point, room)) return { kind: 'room', id: room.id }
  }
  return null
}

export default function InteriorEditor({ moduleTabs }: InteriorEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef({ cx: 0, cz: 0, zoom: 32 })
  const interiorsRef = useRef<InteriorDefinition[]>(cloneInteriors(INTERIORS))
  const activeInteriorIdRef = useRef(INTERIORS[0]?.id ?? '')
  const activeFloorIdRef = useRef(INTERIORS[0]?.floors[0]?.id ?? '')
  const toolRef = useRef<InteriorTool>('select')
  const selectedRef = useRef<SelectedInteriorItem | null>(null)
  const undoStackRef = useRef<InteriorDefinition[][]>([])
  const redoStackRef = useRef<InteriorDefinition[][]>([])
  const moveHistoryRef = useRef<InteriorDefinition[] | null>(null)
  const pendingPropAssetIdRef = useRef<(typeof PLACEHOLDER_ASSETS)[number]['id']>('proto_cube')
  const dragRef = useRef<
    | { mode: 'pan'; pointerId: number; x: number; y: number; moved: boolean }
    | { mode: 'room'; pointerId: number; start: PlanPoint; current: PlanPoint }
    | { mode: 'move'; pointerId: number; selected: SelectedInteriorItem; start: PlanPoint; origin: PlanPoint; moved: boolean }
    | null
  >(null)

  const [interiors, setInteriors] = useState(() => cloneInteriors(INTERIORS))
  const [activeInteriorId, setActiveInteriorId] = useState(INTERIORS[0]?.id ?? '')
  const [activeFloorId, setActiveFloorId] = useState(INTERIORS[0]?.floors[0]?.id ?? '')
  const [tool, setTool] = useState<InteriorTool>('select')
  const [selected, setSelected] = useState<SelectedInteriorItem | null>(null)
  const [mousePoint, setMousePoint] = useState<PlanPoint | null>(null)
  const [saveStatus, setSaveStatus] = useState('Aucune modification')
  const [viewInfo, setViewInfo] = useState(cameraRef.current)
  const [testMode, setTestMode] = useState(false)
  const [pendingPropAssetId, setPendingPropAssetId] = useState<(typeof PLACEHOLDER_ASSETS)[number]['id']>('proto_cube')
  const [, setHistoryVersion] = useState(0)

  const activeInterior = interiors.find((interior) => interior.id === activeInteriorId) ?? interiors[0]
  const activeFloor = activeInterior ? getFloor(activeInterior, activeFloorId) : null
  const validation = useMemo(() => validateInteriors(interiors), [interiors])
  const selectedRoom = selected?.kind === 'room' ? activeFloor?.rooms.find((room) => room.id === selected.id) ?? null : null
  const selectedPointItem = selected && activeFloor ? getSelectedPointItem(activeFloor, selected) : null

  useEffect(() => {
    interiorsRef.current = interiors
  }, [interiors])

  useEffect(() => {
    activeInteriorIdRef.current = activeInteriorId
  }, [activeInteriorId])

  useEffect(() => {
    activeFloorIdRef.current = activeFloorId
  }, [activeFloorId])

  useEffect(() => {
    toolRef.current = tool
  }, [tool])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    pendingPropAssetIdRef.current = pendingPropAssetId
  }, [pendingPropAssetId])

  const pushHistory = (snapshot = cloneInteriors(interiorsRef.current)) => {
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-HISTORY_LIMIT)
    redoStackRef.current = []
    setHistoryVersion((version) => version + 1)
  }

  const restoreInteriors = (nextInteriors: InteriorDefinition[], status: string) => {
    const restored = cloneInteriors(nextInteriors)
    const nextInterior = restored.find((interior) => interior.id === activeInteriorIdRef.current) ?? restored[0]
    const nextFloor = nextInterior?.floors.find((floor) => floor.id === activeFloorIdRef.current) ?? nextInterior?.floors[0]

    interiorsRef.current = restored
    setInteriors(restored)
    if (nextInterior) setActiveInteriorId(nextInterior.id)
    if (nextFloor) setActiveFloorId(nextFloor.id)
    setSelected(null)
    setSaveStatus(status)
  }

  const undo = () => {
    const previous = undoStackRef.current.pop()
    if (!previous) return
    redoStackRef.current = [...redoStackRef.current, cloneInteriors(interiorsRef.current)].slice(-HISTORY_LIMIT)
    setHistoryVersion((version) => version + 1)
    restoreInteriors(previous, 'Annulation locale, sauvegarde requise')
  }

  const redo = () => {
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current = [...undoStackRef.current, cloneInteriors(interiorsRef.current)].slice(-HISTORY_LIMIT)
    setHistoryVersion((version) => version + 1)
    restoreInteriors(next, 'Retablissement local, sauvegarde requise')
  }

  const updateActiveInterior = (recipe: (interior: InteriorDefinition) => InteriorDefinition, recordHistory = true) => {
    if (recordHistory) pushHistory()
    setInteriors((current) =>
      current.map((interior) => (interior.id === activeInteriorId ? serializeInterior(recipe(interior)) : interior)),
    )
    setSaveStatus('Modifications non sauvegardees')
  }

  const updateActiveFloor = (recipe: (floor: InteriorFloor) => InteriorFloor, recordHistory = true) => {
    updateActiveInterior((interior) => ({
      ...interior,
      floors: interior.floors.map((floor) => (floor.id === activeFloorId ? recipe(floor) : floor)),
    }), recordHistory)
  }

  const moveSelectedItem = (selection: SelectedInteriorItem, point: PlanPoint) => {
    if (selection.kind === 'wall') return
    updateActiveFloor((floor) => {
      const x = round2(snap(point.x))
      const z = round2(snap(point.z))
      if (selection.kind === 'room') {
        return {
          ...floor,
          rooms: floor.rooms.map((room) => (room.id === selection.id ? { ...room, x, z } : room)),
        }
      }

      if (selection.kind === 'door') {
        const snapped = snapToNearestWall(point, floor)
        return {
          ...floor,
          doors: floor.doors.map((door) => (door.id === selection.id ? { ...door, ...snapped } : door)),
        }
      }
      if (selection.kind === 'window') {
        const snapped = snapToNearestWall(point, floor)
        return {
          ...floor,
          windows: floor.windows.map((windowItem) =>
            windowItem.id === selection.id ? { ...windowItem, ...snapped } : windowItem,
          ),
        }
      }
      if (selection.kind === 'spawn') {
        return {
          ...floor,
          spawnPoints: floor.spawnPoints.map((spawn) => (spawn.id === selection.id ? { ...spawn, x, z } : spawn)),
        }
      }
      if (selection.kind === 'exit') {
        return {
          ...floor,
          exits: floor.exits.map((exit) => (exit.id === selection.id ? { ...exit, x, z } : exit)),
        }
      }
      return {
        ...floor,
        props: floor.props.map((prop) => (prop.id === selection.id ? { ...prop, x, z } : prop)),
      }
    }, false)
  }

  const deleteSelectedItem = () => {
    const selection = selectedRef.current
    if (!selection) return
    if (selection.kind === 'wall') {
      toggleWallRemoval(selection.roomId, selection.side)
      return
    }
    updateActiveFloor((floor) => ({
      ...floor,
      rooms: selection.kind === 'room' ? floor.rooms.filter((item) => item.id !== selection.id) : floor.rooms,
      doors: selection.kind === 'door' ? floor.doors.filter((item) => item.id !== selection.id) : floor.doors,
      windows: selection.kind === 'window' ? floor.windows.filter((item) => item.id !== selection.id) : floor.windows,
      props: selection.kind === 'prop' ? floor.props.filter((item) => item.id !== selection.id) : floor.props,
      spawnPoints:
        selection.kind === 'spawn' ? floor.spawnPoints.filter((item) => item.id !== selection.id) : floor.spawnPoints,
      exits: selection.kind === 'exit' ? floor.exits.filter((item) => item.id !== selection.id) : floor.exits,
    }))
    setSelected(null)
  }

  const toggleWallRemoval = (roomId: string, side: InteriorWallSegment['side']) => {
    const wallId = `wall_${roomId}_${side}`
    updateActiveFloor((floor) => {
      const removedWalls = floor.removedWalls ?? []
      const exists = removedWalls.some((wall) => wall.roomId === roomId && wall.side === side)
      const nextRemovedWalls: InteriorRemovedWall[] = exists
        ? removedWalls.filter((wall) => !(wall.roomId === roomId && wall.side === side))
        : [...removedWalls, { id: wallId, roomId, side }]
      return { ...floor, removedWalls: nextRemovedWalls }
    })
    setSelected({ kind: 'wall', roomId, side })
  }

  const duplicateSelectedItem = () => {
    const selection = selectedRef.current
    if (!selection || selection.kind === 'wall') return
    updateActiveFloor((floor) => {
      if (selection.kind === 'room') {
        const room = floor.rooms.find((item) => item.id === selection.id)
        if (!room) return floor
        const copy = { ...room, id: makeId('room'), name: `${room.name} copie`, x: round2(room.x + 0.5), z: round2(room.z + 0.5) }
        setSelected({ kind: 'room', id: copy.id })
        return { ...floor, rooms: [...floor.rooms, copy] }
      }
      const item = getSelectedPointItem(floor, selection)
      if (!item) return floor
      const copy = { ...item, id: makeId(selection.kind), name: `${item.name} copie`, x: round2(item.x + 0.5), z: round2(item.z + 0.5) }
      setSelected({ kind: selection.kind, id: copy.id } as SelectedInteriorItem)
      if (selection.kind === 'door') return { ...floor, doors: [...floor.doors, copy as InteriorDoor] }
      if (selection.kind === 'window') return { ...floor, windows: [...floor.windows, copy as InteriorWindow] }
      if (selection.kind === 'spawn') return { ...floor, spawnPoints: [...floor.spawnPoints, copy as InteriorSpawnPoint] }
      if (selection.kind === 'exit') return { ...floor, exits: [...floor.exits, copy as InteriorExit] }
      return { ...floor, props: [...floor.props, copy as InteriorProp] }
    })
  }

  const addPropAt = (point: PlanPoint, assetId = pendingPropAssetIdRef.current) => {
    const x = round2(snap(point.x))
    const z = round2(snap(point.z))
    const asset = PLACEHOLDER_ASSETS.find((item) => item.id === assetId) ?? PLACEHOLDER_ASSETS[0]
    const prop: InteriorProp = { id: makeId('prop'), assetId: asset.id, name: asset.label, x, z, rotation: 0 }
    updateActiveFloor((floor) => ({ ...floor, props: [...floor.props, prop] }))
    setSelected({ kind: 'prop', id: prop.id })
  }

  const addPointItem = (point: PlanPoint) => {
    const x = round2(snap(point.x))
    const z = round2(snap(point.z))
    if (toolRef.current === 'door') {
      const snapped = activeFloor ? snapToNearestWall(point, activeFloor) : { x, z, rotation: 0 }
      const door: InteriorDoor = { id: makeId('door'), name: 'Porte', ...snapped, width: 0.9 }
      updateActiveFloor((floor) => ({ ...floor, doors: [...floor.doors, door] }))
      setSelected({ kind: 'door', id: door.id })
    }
    if (toolRef.current === 'window') {
      const snapped = activeFloor ? snapToNearestWall(point, activeFloor) : { x, z, rotation: 0 }
      const windowItem: InteriorWindow = { id: makeId('window'), name: 'Fenetre', ...snapped, width: 1.2, sillHeight: 0.9 }
      updateActiveFloor((floor) => ({ ...floor, windows: [...floor.windows, windowItem] }))
      setSelected({ kind: 'window', id: windowItem.id })
    }
    if (toolRef.current === 'spawn') {
      const spawnPoint: InteriorSpawnPoint = { id: makeId('spawn'), name: 'Spawn', x, z, rotation: 0 }
      updateActiveFloor((floor) => ({ ...floor, spawnPoints: [...floor.spawnPoints, spawnPoint] }))
      setSelected({ kind: 'spawn', id: spawnPoint.id })
    }
    if (toolRef.current === 'exit') {
      const exit: InteriorExit = {
        id: makeId('exit'),
        name: 'Sortie',
        x,
        z,
        rotation: 0,
        target: { kind: 'exterior' },
      }
      updateActiveFloor((floor) => ({ ...floor, exits: [...floor.exits, exit] }))
      setSelected({ kind: 'exit', id: exit.id })
    }
    if (toolRef.current === 'prop') {
      addPropAt(point)
    }
  }

  const addPresetRoom = (name: string, w: number, d: number) => {
    const room: InteriorRoom = {
      id: makeId('room'),
      name,
      x: round2(cameraRef.current.cx - w / 2),
      z: round2(cameraRef.current.cz - d / 2),
      w,
      d,
      floorMaterial: 'proto_floor',
      wallMaterial: 'proto_wall',
    }
    updateActiveFloor((floor) => ({ ...floor, rooms: [...floor.rooms, room] }))
    setSelected({ kind: 'room', id: room.id })
  }

  const addFloor = () => {
    if (!activeInterior) return
    const index = activeInterior.floors.length + 1
    const floor: InteriorFloor = {
      id: `etage_${index}`,
      label: `Etage ${index - 1}`,
      elevation: round2((index - 1) * activeInterior.defaultWallHeight),
      height: activeInterior.defaultWallHeight,
      rooms: [],
      removedWalls: [],
      doors: [],
      windows: [],
      props: [],
      spawnPoints: [],
      exits: [],
      stairs: [],
    }
    updateActiveInterior((interior) => ({ ...interior, floors: [...interior.floors, floor] }))
    setActiveFloorId(floor.id)
    setSelected(null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelectedItem()
      }
      if (event.ctrlKey && !event.shiftKey && event.code === 'KeyZ') {
        event.preventDefault()
        undo()
      }
      if ((event.ctrlKey && event.shiftKey && event.code === 'KeyZ') || (event.ctrlKey && event.code === 'KeyY')) {
        event.preventDefault()
        redo()
      }
      if (event.ctrlKey && event.code === 'KeyD') {
        event.preventDefault()
        duplicateSelectedItem()
      }
      if (event.code === 'KeyV') setTool('select')
      if (event.code === 'KeyR') setTool('room')
      if (event.code === 'KeyP') setTool('door')
      if (event.code === 'KeyF') setTool('window')
      if (event.code === 'Escape') {
        setSelected(null)
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    if (testMode) return
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
    const toScreen = (point: PlanPoint): [number, number] => [
      canvas.clientWidth / 2 + (point.x - cameraRef.current.cx) * cameraRef.current.zoom,
      canvas.clientHeight / 2 + (point.z - cameraRef.current.cz) * cameraRef.current.zoom,
    ]
    const toPlan = (screenX: number, screenY: number): PlanPoint => ({
      x: cameraRef.current.cx + (screenX - canvas.clientWidth / 2) / cameraRef.current.zoom,
      z: cameraRef.current.cz + (screenY - canvas.clientHeight / 2) / cameraRef.current.zoom,
    })
    const zoomAt = (screenX: number, screenY: number, factor: number) => {
      const before = toPlan(screenX, screenY)
      cameraRef.current.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cameraRef.current.zoom * factor))
      cameraRef.current.cx = before.x - (screenX - canvas.clientWidth / 2) / cameraRef.current.zoom
      cameraRef.current.cz = before.z - (screenY - canvas.clientHeight / 2) / cameraRef.current.zoom
      setViewInfo({ ...cameraRef.current })
    }

    let raf = 0
    const render = () => {
      resize()
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const interior = interiorsRef.current.find((item) => item.id === activeInteriorIdRef.current)
      const floor = interior ? getFloor(interior, activeFloorIdRef.current) : null

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#252a2f'
      ctx.fillRect(0, 0, width, height)
      drawGrid(ctx, width, height, cameraRef.current)

      if (floor) drawFloor(ctx, floor, toScreen, selectedRef.current)

      const drag = dragRef.current
      if (drag?.mode === 'room') drawRoomPreview(ctx, drag.start, drag.current, toScreen)

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomAt(event.offsetX, event.offsetY, event.deltaY < 0 ? 1.12 : 1 / 1.12)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      const point = toPlan(event.clientX - rect.left, event.clientY - rect.top)
      if (toolRef.current === 'room') {
        dragRef.current = { mode: 'room', pointerId: event.pointerId, start: point, current: point }
      } else {
        const interior = interiorsRef.current.find((item) => item.id === activeInteriorIdRef.current)
        const floor = interior ? getFloor(interior, activeFloorIdRef.current) : null
        const hit = toolRef.current === 'select' && floor ? findSelection(floor, point) : null
        if (hit) {
          setSelected(hit)
          const origin = floor ? getSelectionPoint(floor, hit) : null
          moveHistoryRef.current = cloneInteriors(interiorsRef.current)
          dragRef.current = {
            mode: 'move',
            pointerId: event.pointerId,
            selected: hit,
            start: point,
            origin: origin ?? point,
            moved: false,
          }
        } else {
          dragRef.current = { mode: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
        }
      }
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const point = toPlan(event.clientX - rect.left, event.clientY - rect.top)
      setMousePoint(point)

      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (drag.mode === 'room') {
        drag.current = point
        return
      }
      if (drag.mode === 'move') {
        if (Math.hypot(point.x - drag.start.x, point.z - drag.start.z) > 0.05) drag.moved = true
        if (!drag.moved) return
        moveSelectedItem(drag.selected, {
          x: drag.origin.x + point.x - drag.start.x,
          z: drag.origin.z + point.z - drag.start.z,
        })
        return
      }
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 2) drag.moved = true
      cameraRef.current.cx -= (event.clientX - drag.x) / cameraRef.current.zoom
      cameraRef.current.cz -= (event.clientY - drag.y) / cameraRef.current.zoom
      drag.x = event.clientX
      drag.y = event.clientY
      setViewInfo({ ...cameraRef.current })
    }
    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current
      const rect = canvas.getBoundingClientRect()
      const point = toPlan(event.clientX - rect.left, event.clientY - rect.top)
      dragRef.current = null

      if (drag?.mode === 'room') {
        const x = round2(snap(Math.min(drag.start.x, point.x)))
        const z = round2(snap(Math.min(drag.start.z, point.z)))
        const w = round2(Math.max(ROOM_MIN_SIZE, snap(Math.abs(point.x - drag.start.x))))
        const d = round2(Math.max(ROOM_MIN_SIZE, snap(Math.abs(point.z - drag.start.z))))
        const room: InteriorRoom = {
          id: makeId('room'),
          name: 'Nouvelle piece',
          x,
          z,
          w,
          d,
          floorMaterial: 'proto_floor',
          wallMaterial: 'proto_wall',
        }
        updateActiveFloor((floor) => ({ ...floor, rooms: [...floor.rooms, room] }))
        setSelected({ kind: 'room', id: room.id })
        return
      }

      if (drag?.mode === 'move') {
        if (drag.moved && moveHistoryRef.current) pushHistory(moveHistoryRef.current)
        moveHistoryRef.current = null
        return
      }

      if (drag?.mode === 'pan' && !drag.moved) {
        if (toolRef.current === 'select') {
          const interior = interiorsRef.current.find((item) => item.id === activeInteriorIdRef.current)
          const floor = interior ? getFloor(interior, activeFloorIdRef.current) : null
          setSelected(floor ? findSelection(floor, point) : null)
        } else if (toolRef.current === 'wall') {
          const interior = interiorsRef.current.find((item) => item.id === activeInteriorIdRef.current)
          const floor = interior ? getFloor(interior, activeFloorIdRef.current) : null
          const wall = floor ? findNearestWall(floor, point) : null
          if (wall) toggleWallRemoval(wall.roomId, wall.side)
        } else {
          addPointItem(point)
        }
      }
    }
    const onPointerLeave = () => setMousePoint(null)
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(PROP_TRANSFER_TYPE)) return
      event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      const assetId = event.dataTransfer?.getData(PROP_TRANSFER_TYPE) as (typeof PLACEHOLDER_ASSETS)[number]['id']
      if (!assetId) return
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      addPropAt(toPlan(event.clientX - rect.left, event.clientY - rect.top), assetId)
      setTool('prop')
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('dragover', onDragOver)
    canvas.addEventListener('drop', onDrop)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('dragover', onDragOver)
      canvas.removeEventListener('drop', onDrop)
      window.removeEventListener('resize', resize)
    }
  }, [activeInteriorId, activeFloorId, testMode])

  const saveInterior = async () => {
    if (!activeInterior) return
    const serialized = serializeInterior(activeInterior)
    const result = validateInteriors([serialized])
    if (result.errors.length) {
      setSaveStatus(`Sauvegarde bloquee : ${result.errors.length} erreur(s)`)
      return
    }

    setSaveStatus('Sauvegarde en cours...')
    try {
      const response = await fetch('/__pls/interiors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serialized),
      })
      if (!response.ok) throw new Error(await response.text())
      setInteriors((current) => current.map((interior) => (interior.id === serialized.id ? serialized : interior)))
      setSaveStatus(`Sauvegarde OK : ${serialized.name}`)
    } catch (error) {
      setSaveStatus(`Sauvegarde impossible : ${(error as Error).message}`)
    }
  }

  const fitPlan = () => {
    cameraRef.current = { cx: 0, cz: 0, zoom: 36 }
    setViewInfo({ ...cameraRef.current })
  }

  const updateSelectedRoom = (recipe: (room: InteriorRoom) => InteriorRoom) => {
    if (!selectedRoom) return
    updateActiveFloor((floor) => ({
      ...floor,
      rooms: floor.rooms.map((room) => (room.id === selectedRoom.id ? recipe(room) : room)),
    }))
  }

  const updateSelectedPointItem = (recipe: (item: NonNullable<typeof selectedPointItem>) => NonNullable<typeof selectedPointItem>) => {
    if (!selected || !selectedPointItem) return
    updateActiveFloor((floor) => {
      if (selected.kind === 'door') {
        return { ...floor, doors: floor.doors.map((item) => (item.id === selected.id ? (recipe(item) as InteriorDoor) : item)) }
      }
      if (selected.kind === 'window') {
        return {
          ...floor,
          windows: floor.windows.map((item) => (item.id === selected.id ? (recipe(item) as InteriorWindow) : item)),
        }
      }
      if (selected.kind === 'spawn') {
        return {
          ...floor,
          spawnPoints: floor.spawnPoints.map((item) =>
            item.id === selected.id ? (recipe(item) as InteriorSpawnPoint) : item,
          ),
        }
      }
      if (selected.kind === 'exit') {
        return { ...floor, exits: floor.exits.map((item) => (item.id === selected.id ? (recipe(item) as InteriorExit) : item)) }
      }
      if (selected.kind === 'prop') {
        return { ...floor, props: floor.props.map((item) => (item.id === selected.id ? (recipe(item) as InteriorProp) : item)) }
      }
      return floor
    })
  }

  const activeItemCount = activeFloor
    ? activeFloor.rooms.length +
      activeFloor.doors.length +
      activeFloor.windows.length +
      activeFloor.props.length +
      activeFloor.spawnPoints.length +
      activeFloor.exits.length
    : 0

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div>
          <div className="editor-title">Editeur PLS</div>
          <div className="editor-subtitle">Plan 2D des interieurs</div>
        </div>
        {moduleTabs}
        <div className="editor-tool-tabs" aria-label="Outil interieur">
          {(Object.keys(toolLabels) as InteriorTool[]).map((item) => (
            <button key={item} type="button" className={tool === item ? 'active' : ''} onClick={() => setTool(item)}>
              {toolLabels[item]}
            </button>
          ))}
        </div>
        <div className="editor-actions">
          <button type="button" onClick={undo} disabled={undoStackRef.current.length === 0} title="Ctrl+Z">
            Undo
          </button>
          <button type="button" onClick={redo} disabled={redoStackRef.current.length === 0} title="Ctrl+Y">
            Redo
          </button>
          <button type="button" onClick={() => (cameraRef.current.zoom = Math.min(MAX_ZOOM, cameraRef.current.zoom * 1.2))}>
            +
          </button>
          <button type="button" onClick={() => (cameraRef.current.zoom = Math.max(MIN_ZOOM, cameraRef.current.zoom / 1.2))}>
            -
          </button>
          <button
            type="button"
            onClick={() => {
              setTestMode(false)
              fitPlan()
            }}
          >
            Plan 2D
          </button>
          <button type="button" onClick={() => setTestMode(true)} disabled={!activeInterior || !activeFloor}>
            Tester
          </button>
          <button type="button" className="primary" onClick={saveInterior}>
            Sauver
          </button>
        </div>
      </header>

      <aside className="editor-left">
        <section>
          <h2>Interieurs</h2>
          <div className="marker-list">
            {interiors.map((interior) => (
              <button
                key={interior.id}
                type="button"
                className={`marker-row ${interior.id === activeInteriorId ? 'active' : ''}`}
                onClick={() => {
                  setActiveInteriorId(interior.id)
                  setActiveFloorId(interior.floors[0]?.id ?? '')
                  setSelected(null)
                }}
              >
                <span className="layer-swatch" style={{ background: '#7c5cff' }} />
                <span>
                  <strong>{interior.name}</strong>
                  <small>{interior.type}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Etages</h2>
          <div className="editor-floor-tabs">
            {activeInterior?.floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                className={floor.id === activeFloorId ? 'active' : ''}
                onClick={() => {
                  setActiveFloorId(floor.id)
                  setSelected(null)
                }}
              >
                {floor.label}
              </button>
            ))}
            <button type="button" onClick={addFloor}>
              + Etage
            </button>
          </div>
        </section>

        <section>
          <h2>Pieces rapides</h2>
          <div className="editor-floor-tabs">
            <button type="button" onClick={() => addPresetRoom('Piece 3x3', 3, 3)}>
              Piece 3x3
            </button>
            <button type="button" onClick={() => addPresetRoom('Piece 4x5', 4, 5)}>
              Piece 4x5
            </button>
            <button type="button" onClick={() => addPresetRoom('Couloir', 1.4, 5)}>
              Couloir
            </button>
          </div>
        </section>

        <section>
          <h2>Navigation</h2>
          <p className="editor-note">
            Piece : cliquer-glisser sur la grille. Mur : cliquer un mur pour l'ouvrir ou le refermer.
            Porte/fenetre/spawn/sortie/prop : cliquer pour placer. Molette pour
            zoomer, clic-glisser le vide pour deplacer la camera, clic-glisser un element pour le bouger. Suppr efface,
            Ctrl+Z annule, Ctrl+Y retablit, Ctrl+D duplique, V/R/P/F changent d'outil.
          </p>
        </section>
      </aside>

      <main className="editor-map-panel interior-plan-panel">
        {testMode && activeInterior && activeFloor ? (
          <InteriorTestView interior={activeInterior} floor={activeFloor} />
        ) : (
          <canvas ref={canvasRef} className="editor-map-canvas visible" />
        )}
        {!testMode && (
          <div className="placeholder-asset-tray" aria-label="Bibliotheque placeholders">
            {PLACEHOLDER_ASSETS.map((asset) => (
              <button
                key={asset.id}
                type="button"
                draggable
                className={pendingPropAssetId === asset.id ? 'active' : ''}
                onClick={() => {
                  setPendingPropAssetId(asset.id)
                  setTool('prop')
                }}
                onDragStart={(event) => {
                  event.dataTransfer.setData(PROP_TRANSFER_TYPE, asset.id)
                  event.dataTransfer.effectAllowed = 'copy'
                  setPendingPropAssetId(asset.id)
                }}
              >
                <span className="placeholder-preview" style={{ background: asset.color }} />
                <span>{asset.label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="editor-map-status">
          {testMode
            ? 'Test 3D : ZQSD pour bouger, Maj pour courir, Plan 2D pour revenir'
            : mousePoint
              ? `x ${round2(mousePoint.x)} m / z ${round2(mousePoint.z)} m`
              : 'Survolez le plan'}
        </div>
      </main>

      <aside className="editor-right">
        <section>
          <h2>Inspecteur</h2>
          <dl className="inspector-list">
            <div>
              <dt>Interieur</dt>
              <dd>{activeInterior?.name ?? 'Aucun'}</dd>
            </div>
            <div>
              <dt>Etage</dt>
              <dd>{activeFloor?.label ?? 'Aucun'}</dd>
            </div>
            <div>
              <dt>Outil</dt>
              <dd>{toolLabels[tool]}</dd>
            </div>
            <div>
              <dt>Zoom</dt>
              <dd>{viewInfo.zoom.toFixed(0)} px/m</dd>
            </div>
            <div>
              <dt>Objets</dt>
              <dd>{activeItemCount}</dd>
            </div>
            <div>
              <dt>Etat</dt>
              <dd>{saveStatus}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2>Selection</h2>
          {selectedRoom ? (
            <form className="marker-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Nom</span>
                <input value={selectedRoom.name} onChange={(event) => updateSelectedRoom((room) => ({ ...room, name: event.currentTarget.value }))} />
              </label>
              <div className="field-pair">
                <label>
                  <span>X</span>
                  <input type="number" step="0.5" value={selectedRoom.x} onChange={(event) => updateSelectedRoom((room) => ({ ...room, x: Number(event.currentTarget.value) }))} />
                </label>
                <label>
                  <span>Z</span>
                  <input type="number" step="0.5" value={selectedRoom.z} onChange={(event) => updateSelectedRoom((room) => ({ ...room, z: Number(event.currentTarget.value) }))} />
                </label>
              </div>
              <div className="field-pair">
                <label>
                  <span>Largeur</span>
                  <input type="number" min="0.5" step="0.5" value={selectedRoom.w} onChange={(event) => updateSelectedRoom((room) => ({ ...room, w: Math.max(0.5, Number(event.currentTarget.value)) }))} />
                </label>
                <label>
                  <span>Profondeur</span>
                  <input type="number" min="0.5" step="0.5" value={selectedRoom.d} onChange={(event) => updateSelectedRoom((room) => ({ ...room, d: Math.max(0.5, Number(event.currentTarget.value)) }))} />
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={duplicateSelectedItem}>
                  Dupliquer
                </button>
                <button type="button" className="danger" onClick={deleteSelectedItem}>
                  Supprimer
                </button>
              </div>
            </form>
          ) : selectedPointItem ? (
            <form className="marker-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Nom</span>
                <input
                  value={selectedPointItem.name}
                  onChange={(event) => updateSelectedPointItem((item) => ({ ...item, name: event.currentTarget.value }))}
                />
              </label>
              <div className="field-pair">
                <label>
                  <span>X</span>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedPointItem.x}
                    onChange={(event) =>
                      updateSelectedPointItem((item) => {
                        const point = { x: Number(event.currentTarget.value), z: item.z }
                        if ((selected?.kind === 'door' || selected?.kind === 'window') && activeFloor) {
                          return { ...item, ...snapToNearestWall(point, activeFloor) }
                        }
                        return { ...item, x: point.x }
                      })
                    }
                  />
                </label>
                <label>
                  <span>Z</span>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedPointItem.z}
                    onChange={(event) =>
                      updateSelectedPointItem((item) => {
                        const point = { x: item.x, z: Number(event.currentTarget.value) }
                        if ((selected?.kind === 'door' || selected?.kind === 'window') && activeFloor) {
                          return { ...item, ...snapToNearestWall(point, activeFloor) }
                        }
                        return { ...item, z: point.z }
                      })
                    }
                  />
                </label>
              </div>
              {'rotation' in selectedPointItem && selected?.kind !== 'door' && selected?.kind !== 'window' && (
                <label>
                  <span>Rotation degres</span>
                  <input
                    type="number"
                    step="15"
                    value={Math.round((selectedPointItem.rotation * 180) / Math.PI)}
                    onChange={(event) =>
                      updateSelectedPointItem((item) => ({
                        ...item,
                        rotation: (Number(event.currentTarget.value) * Math.PI) / 180,
                      }))
                    }
                  />
                </label>
              )}
              {(selected?.kind === 'door' || selected?.kind === 'window') && activeFloor && (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() =>
                    updateSelectedPointItem((item) => ({
                      ...item,
                      ...snapToNearestWall({ x: item.x, z: item.z }, activeFloor),
                    }))
                  }
                >
                  Recaler au mur
                </button>
              )}
              {'width' in selectedPointItem && (
                <label>
                  <span>Largeur</span>
                  <input
                    type="number"
                    min="0.2"
                    step="0.1"
                    value={Number((selectedPointItem as { width: number }).width)}
                    onChange={(event) =>
                      updateSelectedPointItem((item) => ({
                        ...item,
                        width: Math.max(0.2, Number(event.currentTarget.value)),
                      }) as NonNullable<typeof selectedPointItem>)
                    }
                  />
                </label>
              )}
              {'assetId' in selectedPointItem && (
                <label>
                  <span>Asset</span>
                  <select
                    value={String((selectedPointItem as { assetId: string }).assetId)}
                    onChange={(event) =>
                      updateSelectedPointItem((item) => ({
                        ...item,
                        assetId: event.currentTarget.value,
                      }) as NonNullable<typeof selectedPointItem>)
                    }
                  >
                    {PLACEHOLDER_ASSETS.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="form-actions">
                <button type="button" onClick={duplicateSelectedItem}>
                  Dupliquer
                </button>
                <button type="button" className="danger" onClick={deleteSelectedItem}>
                  Supprimer
                </button>
              </div>
            </form>
          ) : selected?.kind === 'wall' && activeFloor ? (
            <div className="marker-form">
              <p className="editor-note">
                Mur {selected.side} de la piece {activeFloor.rooms.find((room) => room.id === selected.roomId)?.name ?? selected.roomId}.
              </p>
              <button type="button" className="secondary-action" onClick={() => toggleWallRemoval(selected.roomId, selected.side)}>
                {activeFloor.rooms.find((room) => room.id === selected.roomId) &&
                isWallRemoved(
                  activeFloor.rooms.find((room) => room.id === selected.roomId)!,
                  activeFloor.rooms,
                  selected.side,
                  activeFloor.removedWalls ?? [],
                )
                  ? 'Refermer ce mur'
                  : 'Supprimer ce mur'}
              </button>
            </div>
          ) : selected ? (
            <p className="editor-note">{selected.kind} selectionne. L'inspecteur detaille arrive ensuite.</p>
          ) : (
            <p className="editor-note">Aucun element selectionne.</p>
          )}
        </section>

        <section>
          <h2>Validation</h2>
          <dl className="inspector-list">
            <div>
              <dt>Etat</dt>
              <dd>{validation.errors.length === 0 ? 'OK' : `${validation.errors.length} erreur(s)`}</dd>
            </div>
          </dl>
          {validation.errors.length > 0 && (
            <ul className="validation-list">
              {validation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, camera: { cx: number; cz: number; zoom: number }) {
  const major = 2
  const minX = camera.cx - width / 2 / camera.zoom
  const maxX = camera.cx + width / 2 / camera.zoom
  const minZ = camera.cz - height / 2 / camera.zoom
  const maxZ = camera.cz + height / 2 / camera.zoom

  ctx.save()
  for (let x = Math.floor(minX / GRID_STEP) * GRID_STEP; x <= maxX; x += GRID_STEP) {
    const sx = width / 2 + (x - camera.cx) * camera.zoom
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, height)
    ctx.strokeStyle = Math.abs(x % major) < 0.001 ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.055)'
    ctx.lineWidth = Math.abs(x % major) < 0.001 ? 1 : 0.5
    ctx.stroke()
  }
  for (let z = Math.floor(minZ / GRID_STEP) * GRID_STEP; z <= maxZ; z += GRID_STEP) {
    const sy = height / 2 + (z - camera.cz) * camera.zoom
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(width, sy)
    ctx.strokeStyle = Math.abs(z % major) < 0.001 ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.055)'
    ctx.lineWidth = Math.abs(z % major) < 0.001 ? 1 : 0.5
    ctx.stroke()
  }
  ctx.restore()
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  floor: InteriorFloor,
  toScreen: (point: PlanPoint) => [number, number],
  selected: SelectedInteriorItem | null,
) {
  for (const room of floor.rooms) {
    const [x, y] = toScreen({ x: room.x, z: room.z })
    const [x2, y2] = toScreen({ x: room.x + room.w, z: room.z + room.d })
    ctx.fillStyle = selected?.kind === 'room' && selected.id === room.id ? '#5f6f4a' : '#4d5946'
    ctx.fillRect(x, y, x2 - x, y2 - y)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.strokeRect(x, y, x2 - x, y2 - y)
  }

  for (const room of floor.rooms) {
    for (const wall of getVisibleWallSegments(room, floor.rooms, 0.12, floor.removedWalls ?? [])) {
      const halfW = wall.w / 2
      const halfD = wall.d / 2
      const [aX, aY] = toScreen({ x: wall.x - halfW, z: wall.z - halfD })
      const [bX, bY] = toScreen({ x: wall.x + halfW, z: wall.z + halfD })
      const selectedWall = selected?.kind === 'wall' && selected.roomId === wall.roomId && selected.side === wall.side
      const removed = isWallRemoved(room, floor.rooms, wall.side, floor.removedWalls ?? [])
      ctx.fillStyle = selectedWall ? '#fff7dc' : removed ? '#5b5148' : '#d7c8af'
      ctx.fillRect(aX, aY, bX - aX, bY - aY)
    }
    for (const wall of getWallSegments(room, 0.12)) {
      if (!isWallRemoved(room, floor.rooms, wall.side, floor.removedWalls ?? [])) continue
      const halfW = wall.w / 2
      const halfD = wall.d / 2
      const [aX, aY] = toScreen({ x: wall.x - halfW, z: wall.z - halfD })
      const [bX, bY] = toScreen({ x: wall.x + halfW, z: wall.z + halfD })
      ctx.save()
      ctx.setLineDash([6, 5])
      ctx.lineWidth = selected?.kind === 'wall' && selected.roomId === wall.roomId && selected.side === wall.side ? 3 : 2
      ctx.strokeStyle = '#f0b84d'
      ctx.strokeRect(aX, aY, bX - aX, bY - aY)
      ctx.restore()
    }
  }

  for (const room of floor.rooms) {
    const [x, y] = toScreen({ x: room.x, z: room.z })
    ctx.fillStyle = '#fff7dc'
    ctx.font = '750 12px system-ui'
    ctx.fillText(room.name, x + 8, y + 18)
  }

  floor.doors.forEach((door) =>
    drawSegmentItem(ctx, toScreen, door.x, door.z, door.rotation, door.width, '#d99a45', 'P', selected?.kind === 'door' && selected.id === door.id),
  )
  floor.windows.forEach((windowItem) =>
    drawSegmentItem(
      ctx,
      toScreen,
      windowItem.x,
      windowItem.z,
      windowItem.rotation,
      windowItem.width,
      '#62b6cb',
      'F',
      selected?.kind === 'window' && selected.id === windowItem.id,
      true,
    ),
  )
  floor.props.forEach((prop) => {
    const asset = PLACEHOLDER_ASSETS.find((item) => item.id === prop.assetId) ?? PLACEHOLDER_ASSETS[0]
    drawPoint(ctx, toScreen, prop.x, prop.z, asset.color, asset.label[0] ?? 'O', selected?.kind === 'prop' && selected.id === prop.id)
  })
  floor.spawnPoints.forEach((spawn) => drawPoint(ctx, toScreen, spawn.x, spawn.z, '#e6493f', 'S', selected?.kind === 'spawn' && selected.id === spawn.id))
  floor.exits.forEach((exit) => drawPoint(ctx, toScreen, exit.x, exit.z, '#4dab5f', 'X', selected?.kind === 'exit' && selected.id === exit.id))
}

function drawSegmentItem(
  ctx: CanvasRenderingContext2D,
  toScreen: (point: PlanPoint) => [number, number],
  x: number,
  z: number,
  rotation: number,
  width: number,
  color: string,
  label: string,
  selected: boolean,
  framed = false,
) {
  const half = width / 2
  const dx = Math.cos(rotation) * half
  const dz = -Math.sin(rotation) * half
  const [ax, ay] = toScreen({ x: x - dx, z: z - dz })
  const [bx, by] = toScreen({ x: x + dx, z: z + dz })
  const [cx, cy] = toScreen({ x, z })

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = selected ? 8 : 6
  ctx.strokeStyle = selected ? '#fff7dc' : '#ffffff'
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
  ctx.lineWidth = selected ? 4 : 3
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
  if (framed) {
    ctx.lineWidth = 2
    ctx.strokeStyle = '#e7fbff'
    ctx.strokeRect(cx - Math.abs(bx - ax) / 2 - 3, cy - Math.abs(by - ay) / 2 - 6, Math.max(14, Math.abs(bx - ax) + 6), Math.max(12, Math.abs(by - ay) + 12))
  }
  ctx.fillStyle = '#111'
  ctx.font = '900 10px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, cx, cy - 10)
  ctx.restore()
}

function drawPoint(
  ctx: CanvasRenderingContext2D,
  toScreen: (point: PlanPoint) => [number, number],
  x: number,
  z: number,
  color: string,
  label: string,
  selected = false,
) {
  const [sx, sy] = toScreen({ x, z })
  ctx.beginPath()
  ctx.arc(sx, sy, selected ? 10 : 8, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = selected ? 3 : 2
  ctx.strokeStyle = selected ? '#fff7dc' : '#ffffff'
  ctx.stroke()
  ctx.fillStyle = '#111'
  ctx.font = '900 10px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, sx, sy + 0.5)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

function drawRoomPreview(
  ctx: CanvasRenderingContext2D,
  start: PlanPoint,
  current: PlanPoint,
  toScreen: (point: PlanPoint) => [number, number],
) {
  const x = snap(Math.min(start.x, current.x))
  const z = snap(Math.min(start.z, current.z))
  const w = snap(Math.abs(current.x - start.x))
  const d = snap(Math.abs(current.z - start.z))
  const [sx, sy] = toScreen({ x, z })
  const [ex, ey] = toScreen({ x: x + w, z: z + d })
  ctx.save()
  ctx.fillStyle = 'rgba(240,184,77,0.18)'
  ctx.strokeStyle = '#f0b84d'
  ctx.lineWidth = 2
  ctx.fillRect(sx, sy, ex - sx, ey - sy)
  ctx.strokeRect(sx, sy, ex - sx, ey - sy)
  ctx.restore()
}
