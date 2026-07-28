import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { type MapMarker } from '../data/mapMarkers'
import GradientSky from '../core/GradientSky'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import World from '../world/World'
import { SPAWN, terrainHeight } from '../world/beauvais/cityData'
import EditorMarkers from './EditorMarkers'

export interface EditorCameraState {
  cx: number
  cz: number
  zoom: number
}

export type EditorGameCameraMode = 'top' | 'tilted'

interface EditorGameViewProps {
  cameraRef: MutableRefObject<EditorCameraState>
  minZoom: number
  maxZoom: number
  cameraMode: EditorGameCameraMode
  setMouseWorld: (point: { x: number; z: number } | null) => void
  setViewInfo: (view: EditorCameraState) => void
  showMarkers: boolean
  markers: MapMarker[]
  selectedMarkerId: string | null
  onWorldClick: (point: { x: number; z: number }) => void
}

const TOP_CAMERA_HEIGHT = 760
const TILTED_CAMERA_DISTANCE = 980
const MARKER_COLOR = '#e6493f'
const WORLD_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function EditorWorldFocus({ cameraRef }: { cameraRef: MutableRefObject<EditorCameraState> }) {
  const focus = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    const previous = usePlayerStore.getState().playerObject
    usePlayerStore.getState().setPlayerObject(focus)
    return () => {
      if (usePlayerStore.getState().playerObject === focus) {
        usePlayerStore.getState().setPlayerObject(previous)
      }
    }
  }, [focus])

  useFrame(() => {
    focus.position.set(
      cameraRef.current.cx,
      terrainHeight(cameraRef.current.cx, cameraRef.current.cz),
      cameraRef.current.cz,
    )
  })

  return null
}

function EditorCameraRig({
  cameraRef,
  cameraMode,
  cameraObjectRef,
}: {
  cameraRef: MutableRefObject<EditorCameraState>
  cameraMode: EditorGameCameraMode
  cameraObjectRef: MutableRefObject<THREE.OrthographicCamera | null>
}) {
  const { camera, size } = useThree()
  const ortho = camera as THREE.OrthographicCamera
  const target = useMemo(() => new THREE.Vector3(), [])
  const tiltedDirection = useMemo(() => new THREE.Vector3(-0.58, 0.72, 0.38).normalize(), [])

  useEffect(() => {
    cameraObjectRef.current = ortho
    return () => {
      if (cameraObjectRef.current === ortho) cameraObjectRef.current = null
    }
  }, [cameraObjectRef, ortho])

  useFrame(() => {
    const y = terrainHeight(cameraRef.current.cx, cameraRef.current.cz)
    target.set(cameraRef.current.cx, y, cameraRef.current.cz)

    if (cameraMode === 'tilted') {
      camera.up.set(0, 1, 0)
      ortho.position
        .copy(target)
        .addScaledVector(tiltedDirection, TILTED_CAMERA_DISTANCE)
    } else {
      camera.up.set(0, 0, -1)
      ortho.position.set(cameraRef.current.cx, y + TOP_CAMERA_HEIGHT, cameraRef.current.cz)
    }

    ortho.zoom = cameraRef.current.zoom
    ortho.left = -size.width / 2
    ortho.right = size.width / 2
    ortho.top = size.height / 2
    ortho.bottom = -size.height / 2
    ortho.near = 0.1
    ortho.far = 2400
    ortho.lookAt(target)
    ortho.updateProjectionMatrix()
  })

  return null
}

function EditorLights() {
  return (
    <>
      <hemisphereLight args={['#d8ecff', '#6f725f', 1.05]} />
      <ambientLight intensity={0.48} />
      <directionalLight position={[420, 780, 320]} intensity={1.35} color="#fff2d8" castShadow={false} />
    </>
  )
}

function SpawnMarker() {
  return (
    <group position={[SPAWN.x, terrainHeight(SPAWN.x, SPAWN.z) + 1.2, SPAWN.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.5, 5.5, 40]} />
        <meshBasicMaterial color={MARKER_COLOR} depthTest={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.4, 16, 10]} />
        <meshBasicMaterial color={MARKER_COLOR} depthTest={false} />
      </mesh>
    </group>
  )
}

export default function EditorGameView({
  cameraRef,
  minZoom,
  maxZoom,
  cameraMode,
  setMouseWorld,
  setViewInfo,
  showMarkers,
  markers,
  selectedMarkerId,
  onWorldClick,
}: EditorGameViewProps) {
  const dragRef = useRef<{
    x: number
    y: number
    startX: number
    startY: number
    moved: boolean
    anchor: { x: number; z: number } | null
  } | null>(null)
  const cameraObjectRef = useRef<THREE.OrthographicCamera | null>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const intersection = useMemo(() => new THREE.Vector3(), [])

  const screenToWorld = (element: HTMLElement, clientX: number, clientY: number) => {
    const camera = cameraObjectRef.current
    if (!camera) return null
    const rect = element.getBoundingClientRect()
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.ray.intersectPlane(WORLD_PLANE, intersection)
    if (!hit) return null
    return { x: hit.x, z: hit.z }
  }

  const zoomAt = (element: HTMLElement, clientX: number, clientY: number, factor: number) => {
    const before = screenToWorld(element, clientX, clientY)
    cameraRef.current.zoom = clamp(cameraRef.current.zoom * factor, minZoom, maxZoom)
    const after = screenToWorld(element, clientX, clientY)
    if (before && after) {
      cameraRef.current.cx += before.x - after.x
      cameraRef.current.cz += before.z - after.z
    }
    setViewInfo({ ...cameraRef.current })
  }

  return (
    <Canvas
      className="editor-game-canvas"
      orthographic
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{
        position: [SPAWN.x, TOP_CAMERA_HEIGHT, SPAWN.z],
        zoom: cameraRef.current.zoom,
        near: 0.1,
        far: 2400,
      }}
      onPointerMove={(event) => {
        const point = screenToWorld(event.currentTarget, event.clientX, event.clientY)
        setMouseWorld(point)

        const drag = dragRef.current
        if (!drag) return
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true
        if (event.buttons !== 1 || !drag.anchor || !point) return

        cameraRef.current.cx += drag.anchor.x - point.x
        cameraRef.current.cz += drag.anchor.z - point.z
        setViewInfo({ ...cameraRef.current })
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        dragRef.current = {
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          anchor: screenToWorld(event.currentTarget, event.clientX, event.clientY),
        }
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current
        dragRef.current = null
        if (!drag || drag.moved) return
        const point = screenToWorld(event.currentTarget, event.clientX, event.clientY)
        if (point) onWorldClick(point)
      }}
      onPointerLeave={() => setMouseWorld(null)}
      onWheel={(event) => {
        event.preventDefault()
        zoomAt(event.currentTarget, event.clientX, event.clientY, event.deltaY < 0 ? 1.15 : 1 / 1.15)
      }}
    >
      <GradientSky />
      <EditorLights />
      <EditorCameraRig cameraRef={cameraRef} cameraMode={cameraMode} cameraObjectRef={cameraObjectRef} />
      <EditorWorldFocus cameraRef={cameraRef} />
      <World mode="editor" />
      <EditorMarkers visible={showMarkers} markers={markers} selectedMarkerId={selectedMarkerId} />
      <SpawnMarker />
    </Canvas>
  )
}
