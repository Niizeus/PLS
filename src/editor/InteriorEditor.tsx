import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  INTERIORS,
  INTERIOR_TYPES,
  makeInterior,
  makeRoomShape,
  serializeInterior,
  slugifyInteriorId,
  uniqueInteriorId,
  validateInteriors,
  type InteriorDefinition,
  type InteriorFloor,
  type InteriorOpening,
  type InteriorOpeningKind,
  type InteriorProp,
  type InteriorSurface,
  type InteriorType,
  type InteriorWall,
} from '../data/interiors'
import {
  constrainAngle,
  makeArcPolygon,
  makeRectanglePolygon,
  makeRegularPolygon,
  polygonCentroid,
  projectOnWall,
  wallLength,
  wallPointAt,
  type Point2,
} from '../data/interiorGeometry'
import InteriorTestView from './InteriorTestView'
import {
  drawGrid,
  drawMarkers,
  drawOpeningPreview,
  drawPolygonPreview,
  drawSnapHint,
  drawSurfaces,
  drawWallPreview,
  drawWalls,
  wallAngleDegrees,
  type InteriorSelection,
} from './interiorDraw'
import { findWallNear, hitTest, snapPoint } from './interiorTools'
import { readNumberInput } from './editorInputs'
import { saveData } from './editorSave'
import { useEditorHistory } from './editorHistory'
import { useEditorWorkspace } from './editorWorkspace'
import { PanelToggle, type EditorPanelsApi } from './EditorPanels'

/**
 * 🏠 Editeur d'interieurs — plan 2D.
 *
 * Le plan est fait de MURS (segments a n'importe quel angle) et de SOLS (polygones), pas de
 * rectangles : voir le gros commentaire de `src/data/interiors.ts` pour le pourquoi. La piece
 * rectangulaire existe toujours, mais comme simple raccourci qui pose 4 murs + 1 sol.
 */

type InteriorTool =
  | 'select'
  | 'wall'
  | 'room'
  | 'floor'
  | 'shape'
  | 'opening'
  | 'split'
  | 'spawn'
  | 'exit'
  | 'prop'

type ShapeKind = 'circle' | 'half' | 'polygon'

interface InteriorEditorProps {
  moduleTabs?: ReactNode
  /** Volets lateraux, partages avec l'autre module (voir EditorHub). */
  panels: EditorPanelsApi
  /** `false` quand un autre module est a l'ecran : le module reste monte mais se met en veille. */
  active: boolean
}

const MIN_ZOOM = 8
const MAX_ZOOM = 160
const GRID_STEP = 0.25
const SNAP_PIXELS = 12
const HIT_PIXELS = 8
const MIN_WALL_LENGTH = 0.1

const toolLabels: Record<InteriorTool, string> = {
  select: 'Selection',
  wall: 'Mur',
  room: 'Piece',
  floor: 'Sol',
  shape: 'Forme',
  opening: 'Ouverture',
  split: 'Couper',
  spawn: 'Spawn',
  exit: 'Sortie',
  prop: 'Prop',
}

const toolHints: Record<InteriorTool, string> = {
  select: 'Clic pour selectionner, glisser pour deplacer. Molette : zoom. Clic molette : deplacer la vue.',
  wall: 'Clic pour poser le depart, clic pour poser l’arrivee — le mur continue en chaine. Maj bloque l’angle sur 15°, Echap arrete la chaine.',
  room: 'Clic-glisser : pose 4 murs et un sol. Ensuite chaque mur se modifie tout seul.',
  floor: 'Clic-glisser : pose un sol rectangulaire, sans aucun mur.',
  shape: 'Clic-glisser depuis le centre : pose un sol rond, en demi-cercle ou en polygone.',
  opening: 'Glisser le long d’un mur : perce une ouverture sur cette portion seulement, le reste du mur est conserve.',
  split: 'Clic sur un mur : le coupe en deux murs independants a cet endroit.',
  spawn: 'Clic : pose le point d’arrivee du joueur.',
  exit: 'Clic : pose une sortie.',
  prop: 'Clic : pose l’objet choisi dans la bibliotheque en bas.',
}

const openingPresets: Record<InteriorOpeningKind, { label: string; width: number; sillHeight: number; topHeight: number }> = {
  passage: { label: 'Passage', width: 1.4, sillHeight: 0, topHeight: 2.4 },
  door: { label: 'Porte', width: 0.9, sillHeight: 0, topHeight: 2.1 },
  window: { label: 'Fenetre', width: 1.2, sillHeight: 0.9, topHeight: 2.1 },
}

const PLACEHOLDER_ASSETS = [
  { id: 'proto_cube', label: 'Cube', color: '#b276ff' },
  { id: 'proto_table', label: 'Table', color: '#e0a849' },
  { id: 'proto_chair', label: 'Chaise', color: '#4fb477' },
  { id: 'proto_counter', label: 'Comptoir', color: '#d26d55' },
  { id: 'proto_light', label: 'Lumiere', color: '#f3e36d' },
] as const

const PROP_TRANSFER_TYPE = 'application/x-pls-prop'

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`
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

function assetOf(assetId: string) {
  const asset = PLACEHOLDER_ASSETS.find((item) => item.id === assetId) ?? PLACEHOLDER_ASSETS[0]
  return { color: asset.color, label: asset.label[0] ?? 'O' }
}

/** Compte tout ce qu'un etage contient, pour l'inspecteur. */
function countFloorItems(floor: InteriorFloor | null) {
  if (!floor) return 0
  const openings = floor.walls.reduce((total, wall) => total + wall.openings.length, 0)
  return floor.walls.length + floor.surfaces.length + openings + floor.props.length + floor.spawnPoints.length + floor.exits.length
}

export default function InteriorEditor({ moduleTabs, panels, active }: InteriorEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef({ cx: 0, cz: 0, zoom: 42 })

  const interiors = useEditorWorkspace((state) => state.interiors)
  const setInteriors = useEditorWorkspace((state) => state.setInteriors)
  const activeInteriorId = useEditorWorkspace((state) => state.activeInteriorId) ?? ''
  const setActiveInteriorId = useEditorWorkspace((state) => state.setActiveInteriorId)
  const workspaceMarkers = useEditorWorkspace((state) => state.markers)

  const [activeFloorId, setActiveFloorId] = useState(INTERIORS[0]?.floors[0]?.id ?? '')
  const [tool, setTool] = useState<InteriorTool>('select')
  const [selected, setSelected] = useState<InteriorSelection | null>(null)
  const [mousePoint, setMousePoint] = useState<Point2 | null>(null)
  const [saveStatus, setSaveStatus] = useState('Aucune modification')
  const [viewInfo, setViewInfo] = useState(cameraRef.current)
  const [testMode, setTestMode] = useState(false)
  const [pendingPropAssetId, setPendingPropAssetId] = useState<string>('proto_cube')
  const [openingKind, setOpeningKind] = useState<InteriorOpeningKind>('passage')
  const [shapeKind, setShapeKind] = useState<ShapeKind>('circle')
  const [shapeSegments, setShapeSegments] = useState(16)
  const [shapeSides, setShapeSides] = useState(6)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [savedInteriorsJson, setSavedInteriorsJson] = useState<Record<string, string>>(() =>
    Object.fromEntries(INTERIORS.map((interior) => [interior.id, JSON.stringify(serializeInterior(interior))])),
  )

  const history = useEditorHistory<InteriorDefinition[]>()

  const interiorsRef = useRef(interiors)
  const activeInteriorIdRef = useRef(activeInteriorId)
  const activeFloorIdRef = useRef(activeFloorId)
  const toolRef = useRef(tool)
  const selectedRef = useRef(selected)
  const activeRef = useRef(active)
  const shiftRef = useRef(false)
  const snapRef = useRef(snapEnabled)
  const pendingPropRef = useRef(pendingPropAssetId)
  const openingKindRef = useRef(openingKind)
  const shapeRef = useRef({ kind: shapeKind, segments: shapeSegments, sides: shapeSides })
  /** Depart de la chaine de murs en cours, ou `null` si on n'est pas en train de tracer. */
  const chainStartRef = useRef<Point2 | null>(null)
  const [chainStart, setChainStart] = useState<Point2 | null>(null)
  const actionsRef = useRef<{
    createWall: (from: Point2, to: Point2) => void
    createRoom: (x: number, z: number, w: number, d: number) => void
    createFloorSurface: (pts: [number, number][], name: string) => void
    createOpening: (wallId: string, offset: number, width: number) => void
    splitWall: (wallId: string, distance: number) => void
    addPointItem: (point: Point2, assetId?: string) => void
    moveSelection: (selection: InteriorSelection, point: Point2, record: boolean) => void
    record: (key?: string) => void
  }>({
    createWall: () => {},
    createRoom: () => {},
    createFloorSurface: () => {},
    createOpening: () => {},
    splitWall: () => {},
    addPointItem: () => {},
    moveSelection: () => {},
    record: () => {},
  })

  const dragRef = useRef<
    | { mode: 'pan'; pointerId: number; x: number; y: number; moved: boolean }
    | { mode: 'move'; pointerId: number; selection: InteriorSelection; grab: Point2; origin: Point2; moved: boolean }
    | { mode: 'rect'; pointerId: number; start: Point2; current: Point2; kind: 'room' | 'floor' }
    | { mode: 'shape'; pointerId: number; center: Point2; current: Point2 }
    | { mode: 'opening'; pointerId: number; wallId: string; from: number; to: number }
    | null
  >(null)

  const activeInterior = interiors.find((interior) => interior.id === activeInteriorId) ?? interiors[0]
  const activeFloor = activeInterior ? getFloor(activeInterior, activeFloorId) : null
  const linkedMarker = activeInterior
    ? (workspaceMarkers.find((marker) => marker.interiorId === activeInterior.id) ?? null)
    : null
  const validation = useMemo(() => validateInteriors(interiors), [interiors])

  const dirtyInteriorIds = useMemo(
    () =>
      interiors
        .filter((interior) => JSON.stringify(serializeInterior(interior)) !== savedInteriorsJson[interior.id])
        .map((interior) => interior.id),
    [interiors, savedInteriorsJson],
  )
  const isDirty = dirtyInteriorIds.length > 0
  const activeIsDirty = activeInterior ? dirtyInteriorIds.includes(activeInterior.id) : false

  const selectedWall =
    selected?.kind === 'wall' || selected?.kind === 'wallEnd'
      ? (activeFloor?.walls.find((wall) => wall.id === selected.id) ?? null)
      : null
  const selectedOpeningWall =
    selected?.kind === 'opening' ? (activeFloor?.walls.find((wall) => wall.id === selected.wallId) ?? null) : null
  const selectedOpening =
    selected?.kind === 'opening' ? (selectedOpeningWall?.openings.find((item) => item.id === selected.id) ?? null) : null
  const selectedSurface =
    selected?.kind === 'surface' || selected?.kind === 'surfaceVertex'
      ? (activeFloor?.surfaces.find((surface) => surface.id === selected.id) ?? null)
      : null
  const selectedPointItem =
    selected?.kind === 'spawn'
      ? (activeFloor?.spawnPoints.find((item) => item.id === selected.id) ?? null)
      : selected?.kind === 'exit'
        ? (activeFloor?.exits.find((item) => item.id === selected.id) ?? null)
        : selected?.kind === 'prop'
          ? (activeFloor?.props.find((item) => item.id === selected.id) ?? null)
          : null

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
    // Changer d'outil interrompt une chaine de murs en cours.
    chainStartRef.current = null
    setChainStart(null)
  }, [tool])
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])
  useEffect(() => {
    activeRef.current = active
  }, [active])
  useEffect(() => {
    snapRef.current = snapEnabled
  }, [snapEnabled])
  useEffect(() => {
    pendingPropRef.current = pendingPropAssetId
  }, [pendingPropAssetId])
  useEffect(() => {
    openingKindRef.current = openingKind
  }, [openingKind])
  useEffect(() => {
    shapeRef.current = { kind: shapeKind, segments: shapeSegments, sides: shapeSides }
  }, [shapeKind, shapeSegments, shapeSides])

  /**
   * Garde l'etage actif coherent avec l'interieur ouvert : le module Carte peut ouvrir un
   * interieur de l'exterieur, et un `activeFloorId` perime ferait appliquer les modifications
   * a un etage introuvable — donc silencieusement perdues.
   */
  useEffect(() => {
    if (!activeInterior) return
    if (!activeInterior.floors.some((floor) => floor.id === activeFloorId)) {
      setActiveFloorId(activeInterior.floors[0]?.id ?? '')
      setSelected(null)
    }
  }, [activeInterior, activeFloorId])

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // --- Modifications ----------------------------------------------------------------------

  const applyInteriors = (list: InteriorDefinition[], status: string) => {
    interiorsRef.current = list
    setInteriors(list)
    setSaveStatus(status)
  }

  const record = (coalesceKey?: string) => history.push(cloneInteriors(interiorsRef.current), coalesceKey)

  /**
   * ⚠️ `recipe` est appliquee TOUT DE SUITE, jamais dans le callback de setState : React ne
   * l'executerait qu'au rendu suivant, ou `event.currentTarget` vaut deja null — TypeError en
   * plein rendu, et tout l'editeur se demonte (page blanche).
   */
  const updateActiveFloor = (
    recipe: (floor: InteriorFloor) => InteriorFloor,
    options: { record?: boolean; coalesceKey?: string; status?: string } = {},
  ) => {
    const { record: shouldRecord = true, coalesceKey, status = 'Modifications non sauvegardees' } = options
    const interior = interiorsRef.current.find((item) => item.id === activeInteriorIdRef.current)
    if (!interior) return
    if (shouldRecord) record(coalesceKey)
    const next = serializeInterior({
      ...interior,
      floors: interior.floors.map((floor) => (floor.id === activeFloorIdRef.current ? recipe(floor) : floor)),
    })
    applyInteriors(
      interiorsRef.current.map((item) => (item.id === interior.id ? next : item)),
      status,
    )
  }

  const updateActiveInterior = (recipe: (interior: InteriorDefinition) => InteriorDefinition, coalesceKey?: string) => {
    const interior = interiorsRef.current.find((item) => item.id === activeInteriorIdRef.current)
    if (!interior) return
    record(coalesceKey)
    const next = serializeInterior(recipe(interior))
    applyInteriors(
      interiorsRef.current.map((item) => (item.id === interior.id ? next : item)),
      'Modifications non sauvegardees',
    )
  }

  const restore = (list: InteriorDefinition[], status: string) => {
    const restored = cloneInteriors(list)
    interiorsRef.current = restored
    setInteriors(restored)
    const interior = restored.find((item) => item.id === activeInteriorIdRef.current) ?? restored[0]
    if (interior) {
      setActiveInteriorId(interior.id)
      if (!interior.floors.some((floor) => floor.id === activeFloorIdRef.current)) {
        setActiveFloorId(interior.floors[0]?.id ?? '')
      }
    }
    setSelected(null)
    setSaveStatus(status)
  }

  const undo = () => {
    const previous = history.undo(cloneInteriors(interiorsRef.current))
    if (previous) restore(previous, 'Annulation locale, sauvegarde requise')
  }

  const redo = () => {
    const next = history.redo(cloneInteriors(interiorsRef.current))
    if (next) restore(next, 'Retablissement local, sauvegarde requise')
  }

  const updateWall = (wallId: string, recipe: (wall: InteriorWall) => InteriorWall, options?: { record?: boolean; coalesceKey?: string }) => {
    updateActiveFloor(
      (floor) => ({ ...floor, walls: floor.walls.map((wall) => (wall.id === wallId ? recipe(wall) : wall)) }),
      options,
    )
  }

  const updateSurface = (
    surfaceId: string,
    recipe: (surface: InteriorSurface) => InteriorSurface,
    options?: { record?: boolean; coalesceKey?: string },
  ) => {
    updateActiveFloor(
      (floor) => ({ ...floor, surfaces: floor.surfaces.map((surface) => (surface.id === surfaceId ? recipe(surface) : surface)) }),
      options,
    )
  }

  const updateOpening = (
    wallId: string,
    openingId: string,
    recipe: (opening: InteriorOpening) => InteriorOpening,
    options?: { record?: boolean; coalesceKey?: string },
  ) => {
    updateWall(
      wallId,
      (wall) => ({ ...wall, openings: wall.openings.map((opening) => (opening.id === openingId ? recipe(opening) : opening)) }),
      options,
    )
  }

  // --- Creation ---------------------------------------------------------------------------

  const createWall = (from: Point2, to: Point2) => {
    const length = Math.hypot(to.x - from.x, to.z - from.z)
    if (length < MIN_WALL_LENGTH) return
    const wall: InteriorWall = {
      id: makeId('mur'),
      name: 'Mur',
      ax: from.x,
      az: from.z,
      bx: to.x,
      bz: to.z,
      thickness: activeInterior?.defaultWallThickness ?? 0.18,
      material: 'proto_wall',
      openings: [],
    }
    updateActiveFloor((floor) => ({ ...floor, walls: [...floor.walls, wall] }), { status: 'Mur ajoute, sauvegarde requise' })
    setSelected({ kind: 'wall', id: wall.id })
  }

  const createRoom = (x: number, z: number, w: number, d: number) => {
    if (w < MIN_WALL_LENGTH || d < MIN_WALL_LENGTH) return
    const shape = makeRoomShape({
      idPrefix: makeId('piece'),
      name: 'Piece',
      x,
      z,
      w,
      d,
      thickness: activeInterior?.defaultWallThickness ?? 0.18,
    })
    updateActiveFloor(
      (floor) => ({ ...floor, walls: [...floor.walls, ...shape.walls], surfaces: [...floor.surfaces, shape.surface] }),
      { status: 'Piece ajoutee, sauvegarde requise' },
    )
    setSelected({ kind: 'surface', id: shape.surface.id })
  }

  const createFloorSurface = (pts: [number, number][], name: string) => {
    const surface: InteriorSurface = { id: makeId('sol'), name, pts, material: 'proto_floor' }
    updateActiveFloor((floor) => ({ ...floor, surfaces: [...floor.surfaces, surface] }), {
      status: 'Sol ajoute, sauvegarde requise',
    })
    setSelected({ kind: 'surface', id: surface.id })
  }

  /**
   * Perce une ouverture sur une PORTION de mur.
   * C'est la reponse au probleme de depart : la separation entre deux pieces de tailles
   * differentes s'ouvre sans emporter la partie du mur qui donne sur l'exterieur.
   */
  const createOpening = (wallId: string, offset: number, width: number) => {
    const floor = activeFloor
    const wall = floor?.walls.find((item) => item.id === wallId)
    if (!floor || !wall) return
    const preset = openingPresets[openingKindRef.current]
    const length = wallLength(wall)
    const finalWidth = Math.max(0.2, Math.min(width, length))
    const finalOffset = Math.min(length - finalWidth / 2, Math.max(finalWidth / 2, offset))

    // Les deux bouts de l'ouverture, en coordonnees monde.
    const startPoint = wallPointAt(wall, finalOffset - finalWidth / 2)
    const endPoint = wallPointAt(wall, finalOffset + finalWidth / 2)

    /**
     * Une separation entre deux pieces est faite de DEUX murs superposes (chaque piece a pose
     * le sien). Percer un seul laisserait l'autre debout, et on aurait l'impression que
     * l'outil ne marche pas. On perce donc tous les murs confondus avec la portion visee.
     */
    const targets: { id: string; offset: number; width: number }[] = []
    for (const candidate of floor.walls) {
      const candidateLength = wallLength(candidate)
      const startProjection = projectOnWall(candidate, startPoint)
      const endProjection = projectOnWall(candidate, endPoint)
      const reach = candidate.thickness / 2 + 0.06
      if (startProjection.distance > reach || endProjection.distance > reach) continue
      const from = Math.min(startProjection.distanceAlong, endProjection.distanceAlong)
      const to = Math.max(startProjection.distanceAlong, endProjection.distanceAlong)
      if (to - from < 0.15) continue
      targets.push({
        id: candidate.id,
        offset: (from + to) / 2,
        width: Math.min(to - from, candidateLength),
      })
    }
    if (!targets.length) return

    const firstId = targets[0].id
    let firstOpeningId = ''
    record()
    updateActiveFloor(
      (currentFloor) => ({
        ...currentFloor,
        walls: currentFloor.walls.map((item) => {
          const target = targets.find((entry) => entry.id === item.id)
          if (!target) return item
          const opening: InteriorOpening = {
            id: makeId('ouverture'),
            name: preset.label,
            kind: openingKindRef.current,
            offset: target.offset,
            width: target.width,
            sillHeight: preset.sillHeight,
            topHeight: preset.topHeight,
          }
          if (item.id === firstId) firstOpeningId = opening.id
          return { ...item, openings: [...item.openings, opening] }
        }),
      }),
      {
        record: false,
        status:
          targets.length > 1
            ? `${preset.label} perce dans ${targets.length} murs superposes, sauvegarde requise`
            : `${preset.label} perce, sauvegarde requise`,
      },
    )
    if (firstOpeningId) setSelected({ kind: 'opening', wallId: firstId, id: firstOpeningId })
  }

  /** Coupe un mur en deux murs independants, chacun gardant les ouvertures de son cote. */
  const splitWall = (wallId: string, distance: number) => {
    const wall = activeFloor?.walls.find((item) => item.id === wallId)
    if (!wall) return
    const length = wallLength(wall)
    if (distance < MIN_WALL_LENGTH || length - distance < MIN_WALL_LENGTH) {
      setSaveStatus('Coupe trop pres du bout du mur')
      return
    }
    const cut = wallPointAt(wall, distance)
    const first: InteriorWall = {
      ...wall,
      id: makeId('mur'),
      bx: cut.x,
      bz: cut.z,
      openings: wall.openings.filter((opening) => opening.offset < distance),
    }
    const second: InteriorWall = {
      ...wall,
      id: makeId('mur'),
      ax: cut.x,
      az: cut.z,
      openings: wall.openings
        .filter((opening) => opening.offset >= distance)
        .map((opening) => ({ ...opening, id: makeId('ouverture'), offset: opening.offset - distance })),
    }
    updateActiveFloor(
      (floor) => ({ ...floor, walls: floor.walls.flatMap((item) => (item.id === wallId ? [first, second] : [item])) }),
      { status: 'Mur coupe, sauvegarde requise' },
    )
    setSelected({ kind: 'wall', id: first.id })
  }

  const addPointItem = (point: Point2, assetId = pendingPropRef.current) => {
    const x = round2(point.x)
    const z = round2(point.z)
    const current = toolRef.current
    if (current === 'spawn') {
      const spawn = { id: makeId('spawn'), name: 'Arrivee', x, z, rotation: 0 }
      updateActiveFloor((floor) => ({ ...floor, spawnPoints: [...floor.spawnPoints, spawn] }))
      setSelected({ kind: 'spawn', id: spawn.id })
    } else if (current === 'exit') {
      const exit = { id: makeId('sortie'), name: 'Sortie', x, z, rotation: 0, target: { kind: 'exterior' as const } }
      updateActiveFloor((floor) => ({ ...floor, exits: [...floor.exits, exit] }))
      setSelected({ kind: 'exit', id: exit.id })
    } else if (current === 'prop') {
      const asset = PLACEHOLDER_ASSETS.find((item) => item.id === assetId) ?? PLACEHOLDER_ASSETS[0]
      const prop: InteriorProp = { id: makeId('prop'), assetId: asset.id, name: asset.label, x, z, rotation: 0 }
      updateActiveFloor((floor) => ({ ...floor, props: [...floor.props, prop] }))
      setSelected({ kind: 'prop', id: prop.id })
    }
  }

  // --- Deplacement ------------------------------------------------------------------------

  const moveSelection = (selection: InteriorSelection, point: Point2, shouldRecord: boolean) => {
    const options = { record: shouldRecord, coalesceKey: 'move' }
    if (selection.kind === 'wall') {
      const wall = interiorsRef.current
        .find((item) => item.id === activeInteriorIdRef.current)
        ?.floors.find((floor) => floor.id === activeFloorIdRef.current)
        ?.walls.find((item) => item.id === selection.id)
      if (!wall) return
      // On deplace le mur entier : on garde son vecteur et on repose son milieu sur le curseur.
      const halfX = (wall.bx - wall.ax) / 2
      const halfZ = (wall.bz - wall.az) / 2
      updateWall(
        selection.id,
        (item) => ({ ...item, ax: point.x - halfX, az: point.z - halfZ, bx: point.x + halfX, bz: point.z + halfZ }),
        options,
      )
      return
    }
    if (selection.kind === 'wallEnd') {
      updateWall(
        selection.id,
        (wall) => (selection.end === 'a' ? { ...wall, ax: point.x, az: point.z } : { ...wall, bx: point.x, bz: point.z }),
        options,
      )
      return
    }
    if (selection.kind === 'surfaceVertex') {
      updateSurface(
        selection.id,
        (surface) => ({
          ...surface,
          pts: surface.pts.map((pt, index) => (index === selection.index ? ([point.x, point.z] as [number, number]) : pt)),
        }),
        options,
      )
      return
    }
    if (selection.kind === 'surface') {
      const surface = interiorsRef.current
        .find((item) => item.id === activeInteriorIdRef.current)
        ?.floors.find((floor) => floor.id === activeFloorIdRef.current)
        ?.surfaces.find((item) => item.id === selection.id)
      if (!surface) return
      const center = polygonCentroid(surface.pts)
      const dx = point.x - center.x
      const dz = point.z - center.z
      updateSurface(
        selection.id,
        (item) => ({ ...item, pts: item.pts.map(([x, z]) => [x + dx, z + dz] as [number, number]) }),
        options,
      )
      return
    }
    if (selection.kind === 'opening') {
      const wall = interiorsRef.current
        .find((item) => item.id === activeInteriorIdRef.current)
        ?.floors.find((floor) => floor.id === activeFloorIdRef.current)
        ?.walls.find((item) => item.id === selection.wallId)
      if (!wall) return
      const projection = projectOnWall(wall, point)
      updateOpening(selection.wallId, selection.id, (opening) => {
        const half = opening.width / 2
        const length = wallLength(wall)
        return { ...opening, offset: Math.min(length - half, Math.max(half, projection.distanceAlong)) }
      }, options)
      return
    }
    const x = round2(point.x)
    const z = round2(point.z)
    if (selection.kind === 'spawn') {
      updateActiveFloor(
        (floor) => ({ ...floor, spawnPoints: floor.spawnPoints.map((item) => (item.id === selection.id ? { ...item, x, z } : item)) }),
        options,
      )
    } else if (selection.kind === 'exit') {
      updateActiveFloor(
        (floor) => ({ ...floor, exits: floor.exits.map((item) => (item.id === selection.id ? { ...item, x, z } : item)) }),
        options,
      )
    } else if (selection.kind === 'prop') {
      updateActiveFloor(
        (floor) => ({ ...floor, props: floor.props.map((item) => (item.id === selection.id ? { ...item, x, z } : item)) }),
        options,
      )
    }
  }

  const deleteSelection = () => {
    const selection = selectedRef.current
    if (!selection) return
    updateActiveFloor(
      (floor) => {
        if (selection.kind === 'wall' || selection.kind === 'wallEnd') {
          return { ...floor, walls: floor.walls.filter((wall) => wall.id !== selection.id) }
        }
        if (selection.kind === 'opening') {
          return {
            ...floor,
            walls: floor.walls.map((wall) =>
              wall.id === selection.wallId
                ? { ...wall, openings: wall.openings.filter((opening) => opening.id !== selection.id) }
                : wall,
            ),
          }
        }
        if (selection.kind === 'surface' || selection.kind === 'surfaceVertex') {
          // Sur un sommet, on ne supprime le sol entier que s'il ne reste pas assez de points.
          if (selection.kind === 'surfaceVertex') {
            const surface = floor.surfaces.find((item) => item.id === selection.id)
            if (surface && surface.pts.length > 3) {
              return {
                ...floor,
                surfaces: floor.surfaces.map((item) =>
                  item.id === selection.id ? { ...item, pts: item.pts.filter((_, index) => index !== selection.index) } : item,
                ),
              }
            }
          }
          return { ...floor, surfaces: floor.surfaces.filter((item) => item.id !== selection.id) }
        }
        if (selection.kind === 'spawn') return { ...floor, spawnPoints: floor.spawnPoints.filter((item) => item.id !== selection.id) }
        if (selection.kind === 'exit') return { ...floor, exits: floor.exits.filter((item) => item.id !== selection.id) }
        return { ...floor, props: floor.props.filter((item) => item.id !== selection.id) }
      },
      { status: 'Element supprime, sauvegarde requise' },
    )
    setSelected(null)
  }

  const duplicateSelection = () => {
    const selection = selectedRef.current
    if (!selection || !activeFloor) return
    if (selection.kind === 'wall' || selection.kind === 'wallEnd') {
      const wall = activeFloor.walls.find((item) => item.id === selection.id)
      if (!wall) return
      const copy: InteriorWall = {
        ...wall,
        id: makeId('mur'),
        ax: wall.ax + 0.5,
        az: wall.az + 0.5,
        bx: wall.bx + 0.5,
        bz: wall.bz + 0.5,
        openings: wall.openings.map((opening) => ({ ...opening, id: makeId('ouverture') })),
      }
      updateActiveFloor((floor) => ({ ...floor, walls: [...floor.walls, copy] }))
      setSelected({ kind: 'wall', id: copy.id })
      return
    }
    if (selection.kind === 'surface' || selection.kind === 'surfaceVertex') {
      const surface = activeFloor.surfaces.find((item) => item.id === selection.id)
      if (!surface) return
      const copy: InteriorSurface = {
        ...surface,
        id: makeId('sol'),
        name: `${surface.name} copie`,
        pts: surface.pts.map(([x, z]) => [x + 0.5, z + 0.5] as [number, number]),
      }
      updateActiveFloor((floor) => ({ ...floor, surfaces: [...floor.surfaces, copy] }))
      setSelected({ kind: 'surface', id: copy.id })
    }
  }

  const addFloor = () => {
    if (!activeInterior) return
    const index = activeInterior.floors.length + 1
    const floor: InteriorFloor = {
      id: `etage_${index}`,
      label: `Etage ${index - 1}`,
      elevation: round2((index - 1) * activeInterior.defaultWallHeight),
      height: activeInterior.defaultWallHeight,
      walls: [],
      surfaces: [],
      props: [],
      spawnPoints: [],
      exits: [],
      stairs: [],
    }
    updateActiveInterior((interior) => ({ ...interior, floors: [...interior.floors, floor] }))
    setActiveFloorId(floor.id)
    setSelected(null)
  }

  const addInterior = () => {
    const name = 'Nouvel interieur'
    const interior = makeInterior({
      id: uniqueInteriorId(slugifyInteriorId(name), interiorsRef.current),
      name,
      type: 'shop',
    })
    record()
    applyInteriors([...interiorsRef.current, serializeInterior(interior)], 'Nouvel interieur cree, sauvegarde requise')
    setActiveInteriorId(interior.id)
    setActiveFloorId(interior.floors[0].id)
    setSelected(null)
  }

  useEffect(() => {
    actionsRef.current = {
      createWall,
      createRoom,
      createFloorSurface,
      createOpening,
      splitWall,
      addPointItem,
      moveSelection,
      record,
    }
  })

  // --- Clavier ----------------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') shiftRef.current = true
      if (!active) return
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
          duplicateSelection()
        } else if (event.code === 'KeyS') {
          event.preventDefault()
          if (activeIsDirty) void saveInterior()
        }
        return
      }

      if (event.code === 'KeyV') setTool('select')
      if (event.code === 'KeyM') setTool('wall')
      if (event.code === 'KeyR') setTool('room')
      if (event.code === 'KeyG') setTool('floor')
      if (event.code === 'KeyC') setTool('shape')
      if (event.code === 'KeyO') setTool('opening')
      if (event.code === 'KeyX') setTool('split')
      if (event.code === 'Delete' || event.code === 'Backspace') {
        event.preventDefault()
        deleteSelection()
      }
      if (event.code === 'Escape') {
        // D'abord on interrompt la chaine en cours, sinon on deselectionne.
        if (chainStartRef.current) {
          chainStartRef.current = null
          setChainStart(null)
        } else {
          setSelected(null)
          setTool('select')
        }
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') shiftRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  })

  // --- Canvas -----------------------------------------------------------------------------

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
    const toScreen = (point: Point2): [number, number] => [
      canvas.clientWidth / 2 + (point.x - cameraRef.current.cx) * cameraRef.current.zoom,
      canvas.clientHeight / 2 + (point.z - cameraRef.current.cz) * cameraRef.current.zoom,
    ]
    const toPlan = (screenX: number, screenY: number): Point2 => ({
      x: cameraRef.current.cx + (screenX - canvas.clientWidth / 2) / cameraRef.current.zoom,
      z: cameraRef.current.cz + (screenY - canvas.clientHeight / 2) / cameraRef.current.zoom,
    })
    const planFromEvent = (event: PointerEvent): Point2 => {
      const rect = canvas.getBoundingClientRect()
      return toPlan(event.clientX - rect.left, event.clientY - rect.top)
    }
    const currentFloor = () => {
      const interior = interiorsRef.current.find((item) => item.id === activeInteriorIdRef.current)
      return interior ? getFloor(interior, activeFloorIdRef.current) : null
    }
    /** Point accroche, en tenant compte du magnetisme et de la contrainte d'angle. */
    const snapped = (raw: Point2, from?: Point2 | null) => {
      const zoom = cameraRef.current.zoom
      let point = raw
      let label = ''
      if (from && shiftRef.current) {
        point = constrainAngle(from, point, 15)
        label = 'angle 15°'
      }
      if (!snapRef.current) return { point, label, magnetic: Boolean(label) }
      const result = snapPoint(currentFloor(), point, {
        radiusMeters: SNAP_PIXELS / zoom,
        gridStep: GRID_STEP,
        ignoreWallIds: [],
      })
      // La contrainte d'angle prime : elle ne doit pas etre annulee par un aimant voisin.
      if (label && !result.magnetic) return { point, label, magnetic: true }
      return { point: result.point, label: label ? `${label} + ${result.label}` : result.label, magnetic: result.magnetic }
    }

    let snapHint: { point: Point2; label: string } | null = null

    let raf = 0
    const render = () => {
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
        raf = requestAnimationFrame(render)
        return
      }
      resize()
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const floor = currentFloor()
      const zoom = cameraRef.current.zoom

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#252a2f'
      ctx.fillRect(0, 0, width, height)
      drawGrid(ctx, width, height, cameraRef.current, GRID_STEP)

      if (floor) {
        drawSurfaces(ctx, floor, toScreen, selectedRef.current)
        drawWalls(ctx, floor, toScreen, zoom, selectedRef.current)
        drawMarkers(ctx, floor, toScreen, selectedRef.current, assetOf)
      }

      const drag = dragRef.current
      if (drag?.mode === 'rect') {
        const x = Math.min(drag.start.x, drag.current.x)
        const z = Math.min(drag.start.z, drag.current.z)
        const w = Math.abs(drag.current.x - drag.start.x)
        const d = Math.abs(drag.current.z - drag.start.z)
        drawPolygonPreview(ctx, toScreen, makeRectanglePolygon(x, z, w, d))
      }
      if (drag?.mode === 'shape') {
        const preview = buildShapePolygon(drag.center, drag.current)
        if (preview) drawPolygonPreview(ctx, toScreen, preview)
      }
      if (drag?.mode === 'opening' && floor) {
        const wall = floor.walls.find((item) => item.id === drag.wallId)
        if (wall) {
          const from = Math.min(drag.from, drag.to)
          const to = Math.max(drag.from, drag.to)
          drawOpeningPreview(ctx, toScreen, wall, { offset: (from + to) / 2, width: Math.max(0.2, to - from) }, zoom)
        }
      }
      if (chainStartRef.current && mousePlanRef.current) {
        drawWallPreview(
          ctx,
          toScreen,
          chainStartRef.current,
          mousePlanRef.current,
          activeInterior?.defaultWallThickness ?? 0.18,
          zoom,
        )
      }
      if (snapHint) drawSnapHint(ctx, toScreen, snapHint.point, snapHint.label)

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    const mousePlanRef = { current: null as Point2 | null }

    const zoomAt = (screenX: number, screenY: number, factor: number) => {
      const before = toPlan(screenX, screenY)
      cameraRef.current.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cameraRef.current.zoom * factor))
      cameraRef.current.cx = before.x - (screenX - canvas.clientWidth / 2) / cameraRef.current.zoom
      cameraRef.current.cz = before.z - (screenY - canvas.clientHeight / 2) / cameraRef.current.zoom
      setViewInfo({ ...cameraRef.current })
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomAt(event.offsetX, event.offsetY, event.deltaY < 0 ? 1.12 : 1 / 1.12)
    }

    const onPointerDown = (event: PointerEvent) => {
      const floor = currentFloor()
      const zoom = cameraRef.current.zoom
      const raw = planFromEvent(event)

      // Le bouton du milieu deplace toujours la vue, quel que soit l'outil : indispensable
      // maintenant que le clic gauche sert a tracer.
      if (event.button === 1 || (event.button === 0 && toolRef.current === 'select' && !floor)) {
        event.preventDefault()
        dragRef.current = { mode: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
        canvas.setPointerCapture(event.pointerId)
        return
      }
      if (event.button !== 0) return
      if (!floor) return

      const tolerance = HIT_PIXELS / zoom
      const currentTool = toolRef.current

      if (currentTool === 'select') {
        const hit = hitTest(floor, raw, tolerance, selectedRef.current)
        if (hit) {
          setSelected(hit)
          const origin = originOfSelection(floor, hit)
          dragRef.current = {
            mode: 'move',
            pointerId: event.pointerId,
            selection: hit,
            grab: raw,
            origin: origin ?? raw,
            moved: false,
          }
        } else {
          setSelected(null)
          dragRef.current = { mode: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
        }
        canvas.setPointerCapture(event.pointerId)
        return
      }

      if (currentTool === 'wall') {
        const result = snapped(raw, chainStartRef.current)
        if (!chainStartRef.current) {
          chainStartRef.current = result.point
          setChainStart(result.point)
        } else {
          actionsRef.current.createWall(chainStartRef.current, result.point)
          // La chaine continue depuis le point qu'on vient de poser.
          chainStartRef.current = result.point
          setChainStart(result.point)
        }
        return
      }

      if (currentTool === 'room' || currentTool === 'floor') {
        const result = snapped(raw)
        dragRef.current = {
          mode: 'rect',
          pointerId: event.pointerId,
          start: result.point,
          current: result.point,
          kind: currentTool,
        }
        canvas.setPointerCapture(event.pointerId)
        return
      }

      if (currentTool === 'shape') {
        const result = snapped(raw)
        dragRef.current = { mode: 'shape', pointerId: event.pointerId, center: result.point, current: result.point }
        canvas.setPointerCapture(event.pointerId)
        return
      }

      if (currentTool === 'opening') {
        const wall = findWallNear(floor, raw, tolerance)
        if (!wall) {
          setSaveStatus('Vise un mur pour y percer une ouverture')
          return
        }
        const projection = projectOnWall(wall, raw)
        dragRef.current = {
          mode: 'opening',
          pointerId: event.pointerId,
          wallId: wall.id,
          from: projection.distanceAlong,
          to: projection.distanceAlong,
        }
        canvas.setPointerCapture(event.pointerId)
        return
      }

      if (currentTool === 'split') {
        const wall = findWallNear(floor, raw, tolerance)
        if (!wall) {
          setSaveStatus('Vise un mur pour le couper')
          return
        }
        actionsRef.current.splitWall(wall.id, projectOnWall(wall, raw).distanceAlong)
        return
      }

      // spawn / exit / prop
      const result = snapped(raw)
      actionsRef.current.addPointItem(result.point)
    }

    const onPointerMove = (event: PointerEvent) => {
      const raw = planFromEvent(event)
      mousePlanRef.current = raw
      setMousePoint(raw)

      const floor = currentFloor()
      const drag = dragRef.current

      // Repere d'accroche affiche des qu'on est dans un outil de trace.
      if (!drag && toolRef.current !== 'select' && floor) {
        const result = snapped(raw, chainStartRef.current)
        snapHint = result.magnetic ? { point: result.point, label: result.label } : null
        if (result.magnetic) mousePlanRef.current = result.point
      } else if (!drag) {
        snapHint = null
      }

      if (!drag || drag.pointerId !== event.pointerId) return

      if (drag.mode === 'pan') {
        drag.moved = true
        cameraRef.current.cx -= (event.clientX - drag.x) / cameraRef.current.zoom
        cameraRef.current.cz -= (event.clientY - drag.y) / cameraRef.current.zoom
        drag.x = event.clientX
        drag.y = event.clientY
        setViewInfo({ ...cameraRef.current })
        return
      }

      if (drag.mode === 'move') {
        if (!drag.moved) {
          if (Math.hypot(raw.x - drag.grab.x, raw.z - drag.grab.z) < 3 / cameraRef.current.zoom) return
          drag.moved = true
          actionsRef.current.record()
        }
        const target = {
          x: drag.origin.x + raw.x - drag.grab.x,
          z: drag.origin.z + raw.z - drag.grab.z,
        }
        const result = snapped(target)
        actionsRef.current.moveSelection(drag.selection, result.point, false)
        snapHint = result.magnetic ? { point: result.point, label: result.label } : null
        return
      }

      if (drag.mode === 'rect') {
        drag.current = snapped(raw).point
        return
      }
      if (drag.mode === 'shape') {
        drag.current = raw
        return
      }
      if (drag.mode === 'opening' && floor) {
        const wall = floor.walls.find((item) => item.id === drag.wallId)
        if (wall) drag.to = projectOnWall(wall, raw).distanceAlong
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragRef.current = null

      // ⚠️ On repart de la position du RELACHEMENT, pas du dernier `pointermove` :
      // un geste rapide relache entre deux evenements de deplacement, et la forme
      // s'arretait alors quelques centimetres avant l'endroit vise.
      const raw = planFromEvent(event)
      const floor = currentFloor()

      if (drag.mode === 'rect') {
        const end = snapped(raw).point
        const x = Math.min(drag.start.x, end.x)
        const z = Math.min(drag.start.z, end.z)
        const w = Math.abs(end.x - drag.start.x)
        const d = Math.abs(end.z - drag.start.z)
        if (w < MIN_WALL_LENGTH || d < MIN_WALL_LENGTH) return
        if (drag.kind === 'room') actionsRef.current.createRoom(x, z, w, d)
        else actionsRef.current.createFloorSurface(makeRectanglePolygon(x, z, w, d), 'Sol')
        return
      }

      if (drag.mode === 'shape') {
        const polygon = buildShapePolygon(drag.center, raw)
        if (polygon) {
          const shape = shapeRef.current
          const name = shape.kind === 'circle' ? 'Sol rond' : shape.kind === 'half' ? 'Sol demi-cercle' : `Sol ${shape.sides} cotes`
          actionsRef.current.createFloorSurface(polygon, name)
        }
        return
      }

      if (drag.mode === 'opening') {
        const wall = floor?.walls.find((item) => item.id === drag.wallId)
        const endDistance = wall ? projectOnWall(wall, raw).distanceAlong : drag.to
        const from = Math.min(drag.from, endDistance)
        const to = Math.max(drag.from, endDistance)
        const preset = openingPresets[openingKindRef.current]
        // Un simple clic (sans glisser) pose une ouverture de largeur standard.
        const width = to - from < 0.15 ? preset.width : to - from
        actionsRef.current.createOpening(drag.wallId, (from + to) / 2, width)
      }
    }

    /** Construit le polygone de l'outil Forme, selon le reglage courant. */
    function buildShapePolygon(center: Point2, current: Point2): [number, number][] | null {
      const radius = Math.hypot(current.x - center.x, current.z - center.z)
      if (radius < 0.2) return null
      const shape = shapeRef.current
      const angle = Math.atan2(current.z - center.z, current.x - center.x)
      if (shape.kind === 'circle') return makeArcPolygon(center.x, center.z, radius, shape.segments, Math.PI * 2)
      if (shape.kind === 'half') return makeArcPolygon(center.x, center.z, radius, Math.max(3, Math.round(shape.segments / 2)), Math.PI, angle)
      return makeRegularPolygon(center.x, center.z, radius, shape.sides, angle)
    }

    /** Point de reference d'une selection, pour calculer un deplacement relatif. */
    function originOfSelection(floor: InteriorFloor, selection: InteriorSelection): Point2 | null {
      if (selection.kind === 'wall') {
        const wall = floor.walls.find((item) => item.id === selection.id)
        return wall ? { x: (wall.ax + wall.bx) / 2, z: (wall.az + wall.bz) / 2 } : null
      }
      if (selection.kind === 'wallEnd') {
        const wall = floor.walls.find((item) => item.id === selection.id)
        if (!wall) return null
        return selection.end === 'a' ? { x: wall.ax, z: wall.az } : { x: wall.bx, z: wall.bz }
      }
      if (selection.kind === 'surface') {
        const surface = floor.surfaces.find((item) => item.id === selection.id)
        return surface ? polygonCentroid(surface.pts) : null
      }
      if (selection.kind === 'surfaceVertex') {
        const surface = floor.surfaces.find((item) => item.id === selection.id)
        const point = surface?.pts[selection.index]
        return point ? { x: point[0], z: point[1] } : null
      }
      if (selection.kind === 'opening') {
        const wall = floor.walls.find((item) => item.id === selection.wallId)
        const opening = wall?.openings.find((item) => item.id === selection.id)
        return wall && opening ? wallPointAt(wall, opening.offset) : null
      }
      const list =
        selection.kind === 'spawn' ? floor.spawnPoints : selection.kind === 'exit' ? floor.exits : floor.props
      const item = list.find((entry) => entry.id === selection.id)
      return item ? { x: item.x, z: item.z } : null
    }

    const onPointerLeave = () => {
      setMousePoint(null)
      mousePlanRef.current = null
      snapHint = null
    }
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(PROP_TRANSFER_TYPE)) return
      event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      const assetId = event.dataTransfer?.getData(PROP_TRANSFER_TYPE)
      if (!assetId) return
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      setTool('prop')
      actionsRef.current.addPointItem(toPlan(event.clientX - rect.left, event.clientY - rect.top), assetId)
    }
    const onAuxClick = (event: MouseEvent) => {
      // Le clic du milieu ne doit pas coller le presse-papier X11 ni faire defiler.
      if (event.button === 1) event.preventDefault()
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('dragover', onDragOver)
    canvas.addEventListener('drop', onDrop)
    canvas.addEventListener('auxclick', onAuxClick)
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
      canvas.removeEventListener('auxclick', onAuxClick)
      window.removeEventListener('resize', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInteriorId, activeFloorId, testMode])

  // --- Sauvegarde -------------------------------------------------------------------------

  const saveInterior = async () => {
    if (!activeInterior) return
    const serialized = serializeInterior(activeInterior)
    const result = validateInteriors([serialized])
    if (result.errors.length) {
      setSaveStatus(`Sauvegarde bloquee : ${result.errors.length} erreur(s)`)
      return
    }

    setSaveStatus('Sauvegarde en cours...')
    const outcome = await saveData({
      endpoint: '/__pls/interiors',
      payload: serialized,
      successMessage: `Sauvegarde OK : ${serialized.name}`,
    })
    if (outcome.status === 'ok') {
      const list = interiorsRef.current.map((interior) => (interior.id === serialized.id ? serialized : interior))
      interiorsRef.current = list
      setInteriors(list)
      setSavedInteriorsJson((current) => ({ ...current, [serialized.id]: JSON.stringify(serialized) }))
    }
    setSaveStatus(outcome.message)
  }

  const fitPlan = () => {
    // Cadre sur ce qui existe, plutot que de revenir bêtement a l'origine.
    const points: Point2[] = []
    for (const wall of activeFloor?.walls ?? []) {
      points.push({ x: wall.ax, z: wall.az }, { x: wall.bx, z: wall.bz })
    }
    for (const surface of activeFloor?.surfaces ?? []) {
      for (const [x, z] of surface.pts) points.push({ x, z })
    }
    if (!points.length) {
      cameraRef.current = { cx: 0, cz: 0, zoom: 42 }
    } else {
      const minX = Math.min(...points.map((p) => p.x))
      const maxX = Math.max(...points.map((p) => p.x))
      const minZ = Math.min(...points.map((p) => p.z))
      const maxZ = Math.max(...points.map((p) => p.z))
      const canvas = canvasRef.current
      const spanX = Math.max(1, maxX - minX)
      const spanZ = Math.max(1, maxZ - minZ)
      const zoom =
        canvas && canvas.clientWidth > 0
          ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(canvas.clientWidth / (spanX * 1.3), canvas.clientHeight / (spanZ * 1.3))))
          : 42
      cameraRef.current = { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, zoom }
    }
    setViewInfo({ ...cameraRef.current })
  }

  const itemCount = countFloorItems(activeFloor)

  return (
    <div className={`editor-shell ${active ? '' : 'editor-hidden'}`} style={panels.shellStyle}>
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
          <button type="button" onClick={undo} disabled={!history.canUndo} title="Annuler (Ctrl+Z)">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={!history.canRedo} title="Retablir (Ctrl+Y)">
            ↷
          </button>
          <button type="button" onClick={fitPlan} title="Cadrer sur le plan">
            Cadrer
          </button>
          <button
            type="button"
            onClick={() => setTestMode(false)}
            className={testMode ? '' : 'active'}
            disabled={!testMode}
          >
            Plan 2D
          </button>
          <button type="button" onClick={() => setTestMode(true)} disabled={!activeInterior || !activeFloor}>
            Tester
          </button>
          <button
            type="button"
            className={`primary ${activeIsDirty ? 'dirty' : ''}`}
            onClick={saveInterior}
            title={activeIsDirty ? 'Interieur ouvert modifie, pas encore sur le disque' : 'Interieur ouvert a jour'}
          >
            Sauver{activeIsDirty ? ' •' : ''}
          </button>
        </div>
      </header>

      <aside className={`editor-left ${panels.layout.leftCollapsed ? 'collapsed' : ''}`}>
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
          <div className="list-actions">
            <button type="button" onClick={addInterior}>
              + Interieur
            </button>
          </div>
        </section>

        <section>
          <h2>Interieur ouvert</h2>
          {activeInterior ? (
            <form className="marker-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Identifiant</span>
                <input value={activeInterior.id} readOnly title="Nom du fichier JSON, fige a la creation" />
              </label>
              <label>
                <span>Nom</span>
                <input
                  value={activeInterior.name}
                  onChange={(event) => {
                    const name = event.currentTarget.value
                    updateActiveInterior((interior) => ({ ...interior, name }), 'interior-name')
                  }}
                />
              </label>
              <div className="field-pair">
                <label>
                  <span>Type</span>
                  <select
                    value={activeInterior.type}
                    onChange={(event) => {
                      const type = event.currentTarget.value as InteriorType
                      updateActiveInterior((interior) => ({ ...interior, type }))
                    }}
                  >
                    {INTERIOR_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Hauteur murs</span>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={activeInterior.defaultWallHeight}
                    onChange={(event) => {
                      const height = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(height) || height <= 0) return
                      updateActiveInterior((interior) => ({ ...interior, defaultWallHeight: height }), 'interior-height')
                    }}
                  />
                </label>
              </div>
              <p className="editor-note">
                {linkedMarker
                  ? `Ouvert depuis le point « ${linkedMarker.name} » sur la carte.`
                  : "Aucun point de la carte n'ouvre cet interieur pour l'instant."}
              </p>
            </form>
          ) : (
            <p className="editor-note">Aucun interieur. Clique « + Interieur » pour en creer un.</p>
          )}
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
          <h2>Reglages d&apos;outil</h2>
          <label className="layer-row">
            <span className="layer-swatch" style={{ background: '#6de3ff' }} />
            <span>Magnetisme</span>
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(event) => setSnapEnabled(event.currentTarget.checked)}
              aria-label="Activer le magnetisme"
            />
          </label>

          {tool === 'opening' && (
            <div className="tool-settings">
              <span className="tool-settings-title">Type d&apos;ouverture</span>
              <div className="editor-floor-tabs">
                {(Object.keys(openingPresets) as InteriorOpeningKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={openingKind === kind ? 'active' : ''}
                    onClick={() => setOpeningKind(kind)}
                  >
                    {openingPresets[kind].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === 'shape' && (
            <div className="tool-settings">
              <span className="tool-settings-title">Forme</span>
              <div className="editor-floor-tabs">
                <button type="button" className={shapeKind === 'circle' ? 'active' : ''} onClick={() => setShapeKind('circle')}>
                  Rond
                </button>
                <button type="button" className={shapeKind === 'half' ? 'active' : ''} onClick={() => setShapeKind('half')}>
                  Demi-cercle
                </button>
                <button type="button" className={shapeKind === 'polygon' ? 'active' : ''} onClick={() => setShapeKind('polygon')}>
                  Polygone
                </button>
              </div>
              {shapeKind === 'polygon' ? (
                <label className="marker-form">
                  <span>Cotes : {shapeSides}</span>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    step="1"
                    value={shapeSides}
                    onChange={(event) => setShapeSides(Number(event.currentTarget.value))}
                  />
                </label>
              ) : (
                <label className="marker-form">
                  <span>Finesse : {shapeSegments} segments</span>
                  <input
                    type="range"
                    min="6"
                    max="48"
                    step="2"
                    value={shapeSegments}
                    onChange={(event) => setShapeSegments(Number(event.currentTarget.value))}
                  />
                </label>
              )}
              <p className="editor-note">
                Un rond est toujours une suite de segments. 16 suffisent en cartoon ; monter plus haut coute des
                triangles sans que ca se voie.
              </p>
            </div>
          )}
        </section>

        <section>
          <h2>Aide</h2>
          <p className="editor-note">{toolHints[tool]}</p>
          <dl className="shortcut-list">
            <div>
              <dt>V / M / R</dt>
              <dd>Selection / Mur / Piece</dd>
            </div>
            <div>
              <dt>G / C</dt>
              <dd>Sol / Forme ronde</dd>
            </div>
            <div>
              <dt>O / X</dt>
              <dd>Ouverture / Couper un mur</dd>
            </div>
            <div>
              <dt>Maj</dt>
              <dd>Bloque l&apos;angle sur 15°</dd>
            </div>
            <div>
              <dt>Clic molette</dt>
              <dd>Deplacer la vue</dd>
            </div>
            <div>
              <dt>Suppr</dt>
              <dd>Supprimer la selection</dd>
            </div>
            <div>
              <dt>Ctrl+Z / Y</dt>
              <dd>Annuler / retablir</dd>
            </div>
          </dl>
        </section>
      </aside>

      <main className="editor-map-panel interior-plan-panel">
        {panels.renderHandle('left')}
        {panels.renderHandle('right')}
        <PanelToggle side="left" collapsed={panels.layout.leftCollapsed} onToggle={() => panels.toggle('left')} />
        <PanelToggle side="right" collapsed={panels.layout.rightCollapsed} onToggle={() => panels.toggle('right')} />
        {testMode && active && activeInterior && activeFloor ? (
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
            : chainStart
              ? 'Chaine de murs en cours — Echap pour arreter'
              : mousePoint
                ? `x ${round2(mousePoint.x)} m / z ${round2(mousePoint.z)} m`
                : 'Survolez le plan'}
        </div>
      </main>

      <aside className={`editor-right ${panels.layout.rightCollapsed ? 'collapsed' : ''}`}>
        <section>
          <h2>Inspecteur</h2>
          <dl className="inspector-list">
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
              <dt>Contenu</dt>
              <dd>
                {activeFloor?.walls.length ?? 0} murs · {activeFloor?.surfaces.length ?? 0} sols · {itemCount} objets
              </dd>
            </div>
            <div>
              <dt>Etat</dt>
              <dd>{saveStatus}</dd>
            </div>
            <div>
              <dt>A sauver</dt>
              <dd className={isDirty ? 'inspector-dirty' : ''}>
                {isDirty ? `${dirtyInteriorIds.length} interieur(s) : ${dirtyInteriorIds.join(', ')}` : 'Rien, tout est sur le disque'}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2>Selection</h2>
          {selectedWall ? (
            <form className="marker-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Nom</span>
                <input
                  value={selectedWall.name}
                  onChange={(event) => {
                    const name = event.currentTarget.value
                    updateWall(selectedWall.id, (wall) => ({ ...wall, name }), { coalesceKey: 'wall-name' })
                  }}
                />
              </label>
              <div className="field-pair">
                <label>
                  <span>Longueur</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={round2(wallLength(selectedWall))}
                    onChange={(event) => {
                      const length = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(length) || length < MIN_WALL_LENGTH) return
                      // On etire depuis A, en gardant la direction du mur.
                      updateWall(
                        selectedWall.id,
                        (wall) => {
                          const end = wallPointAt(wall, length)
                          return { ...wall, bx: end.x, bz: end.z }
                        },
                        { coalesceKey: 'wall-length' },
                      )
                    }}
                  />
                </label>
                <label>
                  <span>Angle °</span>
                  <input
                    type="number"
                    step="5"
                    value={Math.round(wallAngleDegrees(selectedWall))}
                    onChange={(event) => {
                      const degrees = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(degrees)) return
                      updateWall(
                        selectedWall.id,
                        (wall) => {
                          const length = wallLength(wall)
                          const radians = (degrees * Math.PI) / 180
                          return { ...wall, bx: wall.ax + Math.cos(radians) * length, bz: wall.az + Math.sin(radians) * length }
                        },
                        { coalesceKey: 'wall-angle' },
                      )
                    }}
                  />
                </label>
              </div>
              <div className="field-pair">
                <label>
                  <span>Epaisseur</span>
                  <input
                    type="number"
                    min="0.02"
                    step="0.02"
                    value={selectedWall.thickness}
                    onChange={(event) => {
                      const thickness = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(thickness) || thickness <= 0) return
                      updateWall(selectedWall.id, (wall) => ({ ...wall, thickness }), { coalesceKey: 'wall-thickness' })
                    }}
                  />
                </label>
                <label>
                  <span>Hauteur</span>
                  <input
                    type="number"
                    min="0.2"
                    step="0.1"
                    placeholder={String(activeInterior?.defaultWallHeight ?? 2.7)}
                    value={selectedWall.height ?? ''}
                    onChange={(event) => {
                      const raw = event.currentTarget.value
                      const height = readNumberInput(raw)
                      updateWall(
                        selectedWall.id,
                        (wall) => ({ ...wall, height: raw.trim() === '' ? undefined : Number.isFinite(height) && height > 0 ? height : wall.height }),
                        { coalesceKey: 'wall-height' },
                      )
                    }}
                  />
                </label>
              </div>
              <div className="field-pair">
                <label>
                  <span>A — x</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedWall.ax}
                    onChange={(event) => {
                      const value = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(value)) return
                      updateWall(selectedWall.id, (wall) => ({ ...wall, ax: value }), { coalesceKey: 'wall-ax' })
                    }}
                  />
                </label>
                <label>
                  <span>A — z</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedWall.az}
                    onChange={(event) => {
                      const value = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(value)) return
                      updateWall(selectedWall.id, (wall) => ({ ...wall, az: value }), { coalesceKey: 'wall-az' })
                    }}
                  />
                </label>
              </div>
              <div className="field-pair">
                <label>
                  <span>B — x</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedWall.bx}
                    onChange={(event) => {
                      const value = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(value)) return
                      updateWall(selectedWall.id, (wall) => ({ ...wall, bx: value }), { coalesceKey: 'wall-bx' })
                    }}
                  />
                </label>
                <label>
                  <span>B — z</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedWall.bz}
                    onChange={(event) => {
                      const value = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(value)) return
                      updateWall(selectedWall.id, (wall) => ({ ...wall, bz: value }), { coalesceKey: 'wall-bz' })
                    }}
                  />
                </label>
              </div>

              <div className="tool-settings">
                <span className="tool-settings-title">Ouvertures ({selectedWall.openings.length})</span>
                {selectedWall.openings.length ? (
                  <div className="marker-list">
                    {selectedWall.openings.map((opening) => (
                      <button
                        key={opening.id}
                        type="button"
                        className="marker-row"
                        onClick={() => setSelected({ kind: 'opening', wallId: selectedWall.id, id: opening.id })}
                      >
                        <span
                          className="layer-swatch"
                          style={{ background: opening.kind === 'door' ? '#d99a45' : opening.kind === 'window' ? '#62b6cb' : '#8b949c' }}
                        />
                        <span>
                          <strong>{opening.name}</strong>
                          <small>
                            a {round2(opening.offset)} m · {round2(opening.width)} m de large
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="editor-note">Aucune. Outil Ouverture (O), puis glisser sur ce mur.</p>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="secondary-action" onClick={duplicateSelection} title="Ctrl+D">
                  Dupliquer
                </button>
                <button type="button" className="danger" onClick={deleteSelection} title="Suppr">
                  Supprimer
                </button>
              </div>
            </form>
          ) : selectedOpening && selectedOpeningWall ? (
            <form className="marker-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Nom</span>
                <input
                  value={selectedOpening.name}
                  onChange={(event) => {
                    const name = event.currentTarget.value
                    updateOpening(selectedOpeningWall.id, selectedOpening.id, (opening) => ({ ...opening, name }), {
                      coalesceKey: 'opening-name',
                    })
                  }}
                />
              </label>
              <label>
                <span>Type</span>
                <select
                  value={selectedOpening.kind}
                  onChange={(event) => {
                    const kind = event.currentTarget.value as InteriorOpeningKind
                    const preset = openingPresets[kind]
                    updateOpening(selectedOpeningWall.id, selectedOpening.id, (opening) => ({
                      ...opening,
                      kind,
                      sillHeight: preset.sillHeight,
                      topHeight: preset.topHeight,
                    }))
                  }}
                >
                  {(Object.keys(openingPresets) as InteriorOpeningKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {openingPresets[kind].label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-pair">
                <label>
                  <span>Position</span>
                  <input
                    type="number"
                    step="0.1"
                    value={round2(selectedOpening.offset)}
                    onChange={(event) => {
                      const offset = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(offset)) return
                      updateOpening(selectedOpeningWall.id, selectedOpening.id, (opening) => ({ ...opening, offset }), {
                        coalesceKey: 'opening-offset',
                      })
                    }}
                  />
                </label>
                <label>
                  <span>Largeur</span>
                  <input
                    type="number"
                    min="0.2"
                    step="0.1"
                    value={round2(selectedOpening.width)}
                    onChange={(event) => {
                      const width = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(width) || width <= 0) return
                      updateOpening(selectedOpeningWall.id, selectedOpening.id, (opening) => ({ ...opening, width }), {
                        coalesceKey: 'opening-width',
                      })
                    }}
                  />
                </label>
              </div>
              <div className="field-pair">
                <label>
                  <span>Bas</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={selectedOpening.sillHeight}
                    onChange={(event) => {
                      const sillHeight = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(sillHeight) || sillHeight < 0) return
                      updateOpening(selectedOpeningWall.id, selectedOpening.id, (opening) => ({ ...opening, sillHeight }), {
                        coalesceKey: 'opening-sill',
                      })
                    }}
                  />
                </label>
                <label>
                  <span>Haut</span>
                  <input
                    type="number"
                    min="0.2"
                    step="0.1"
                    value={selectedOpening.topHeight}
                    onChange={(event) => {
                      const topHeight = readNumberInput(event.currentTarget.value)
                      if (!Number.isFinite(topHeight) || topHeight <= 0) return
                      updateOpening(selectedOpeningWall.id, selectedOpening.id, (opening) => ({ ...opening, topHeight }), {
                        coalesceKey: 'opening-top',
                      })
                    }}
                  />
                </label>
              </div>
              <p className="editor-note">
                Une ouverture qui touche le sol laisse passer le joueur. Une fenetre (bas &gt; 0) ne laisse passer que
                la lumiere.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setSelected({ kind: 'wall', id: selectedOpeningWall.id })}
                >
                  Voir le mur
                </button>
                <button type="button" className="danger" onClick={deleteSelection}>
                  Supprimer
                </button>
              </div>
            </form>
          ) : selectedSurface ? (
            <form className="marker-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                <span>Nom</span>
                <input
                  value={selectedSurface.name}
                  onChange={(event) => {
                    const name = event.currentTarget.value
                    updateSurface(selectedSurface.id, (surface) => ({ ...surface, name }), { coalesceKey: 'surface-name' })
                  }}
                />
              </label>
              <p className="editor-note">
                {selectedSurface.pts.length} sommets. Selectionne le sol puis attrape un sommet pour le deformer.
                Suppr sur un sommet l&apos;enleve, Suppr sur le sol le supprime entier.
              </p>
              {selected?.kind === 'surfaceVertex' && selectedSurface.pts[selected.index] && (
                <div className="field-pair">
                  <label>
                    <span>Sommet x</span>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedSurface.pts[selected.index][0]}
                      onChange={(event) => {
                        const value = readNumberInput(event.currentTarget.value)
                        if (!Number.isFinite(value)) return
                        updateSurface(
                          selectedSurface.id,
                          (surface) => ({
                            ...surface,
                            pts: surface.pts.map((pt, index) => (index === selected.index ? ([value, pt[1]] as [number, number]) : pt)),
                          }),
                          { coalesceKey: 'vertex-x' },
                        )
                      }}
                    />
                  </label>
                  <label>
                    <span>Sommet z</span>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedSurface.pts[selected.index][1]}
                      onChange={(event) => {
                        const value = readNumberInput(event.currentTarget.value)
                        if (!Number.isFinite(value)) return
                        updateSurface(
                          selectedSurface.id,
                          (surface) => ({
                            ...surface,
                            pts: surface.pts.map((pt, index) => (index === selected.index ? ([pt[0], value] as [number, number]) : pt)),
                          }),
                          { coalesceKey: 'vertex-z' },
                        )
                      }}
                    />
                  </label>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="secondary-action" onClick={duplicateSelection} title="Ctrl+D">
                  Dupliquer
                </button>
                <button type="button" className="danger" onClick={deleteSelection}>
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
                  onChange={(event) => {
                    const name = event.currentTarget.value
                    const id = selectedPointItem.id
                    const kind = selected?.kind
                    updateActiveFloor(
                      (floor) => ({
                        ...floor,
                        spawnPoints:
                          kind === 'spawn' ? floor.spawnPoints.map((item) => (item.id === id ? { ...item, name } : item)) : floor.spawnPoints,
                        exits: kind === 'exit' ? floor.exits.map((item) => (item.id === id ? { ...item, name } : item)) : floor.exits,
                        props: kind === 'prop' ? floor.props.map((item) => (item.id === id ? { ...item, name } : item)) : floor.props,
                      }),
                      { coalesceKey: 'point-name' },
                    )
                  }}
                />
              </label>
              <div className="field-pair">
                <label>
                  <span>X</span>
                  <input type="number" step="0.1" value={selectedPointItem.x} readOnly />
                </label>
                <label>
                  <span>Z</span>
                  <input type="number" step="0.1" value={selectedPointItem.z} readOnly />
                </label>
              </div>
              <p className="editor-note">Glisse l&apos;element sur le plan pour le deplacer.</p>
              <div className="form-actions">
                <button type="button" className="danger" onClick={deleteSelection}>
                  Supprimer
                </button>
              </div>
            </form>
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
