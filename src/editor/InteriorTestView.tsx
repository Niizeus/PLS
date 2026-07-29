import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import PlayerModel from '../entities/player/PlayerModel'
import { KEY } from '../gameplay/input/keyMap'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { toonGradient } from '../shaders/toonGradient'
import { type InteriorDefinition, type InteriorFloor, type InteriorRoom } from '../data/interiors'
import { getVisibleWallSegments, isWallRemoved } from './interiorGeometry'

interface InteriorTestViewProps {
  interior: InteriorDefinition
  floor: InteriorFloor
}

const WALL_THICKNESS = 0.18
const PLAYER_RADIUS = 0.34

function isInsideRoom(x: number, z: number, room: InteriorRoom, margin = PLAYER_RADIUS) {
  return x >= room.x + margin && x <= room.x + room.w - margin && z >= room.z + margin && z <= room.z + room.d - margin
}

function isInsideRemovedWallPassage(x: number, z: number, floor: InteriorFloor) {
  const width = PLAYER_RADIUS * 2.2
  for (const wall of floor.removedWalls ?? []) {
    const room = floor.rooms.find((item) => item.id === wall.roomId)
    if (!room || !isWallRemoved(room, floor.rooms, wall.side, floor.removedWalls ?? [])) continue
    if (wall.side === 'top' || wall.side === 'bottom') {
      const edgeZ = wall.side === 'top' ? room.z : room.z + room.d
      if (x >= room.x + PLAYER_RADIUS && x <= room.x + room.w - PLAYER_RADIUS && Math.abs(z - edgeZ) <= width) return true
    } else {
      const edgeX = wall.side === 'left' ? room.x : room.x + room.w
      if (z >= room.z + PLAYER_RADIUS && z <= room.z + room.d - PLAYER_RADIUS && Math.abs(x - edgeX) <= width) return true
    }
  }
  return false
}

function isWalkable(x: number, z: number, floor: InteriorFloor) {
  const rooms = floor.rooms
  if (!rooms.length) return true
  return rooms.some((room) => isInsideRoom(x, z, room)) || isInsideRemovedWallPassage(x, z, floor)
}

function getInitialSpawn(floor: InteriorFloor) {
  const spawn = floor.spawnPoints[0]
  if (spawn) return { x: spawn.x, z: spawn.z, rotation: spawn.rotation }
  const room = floor.rooms[0]
  if (room) return { x: room.x + room.w / 2, z: room.z + room.d / 2, rotation: 0 }
  return { x: 0, z: 0, rotation: 0 }
}

function InteriorPlayerController({ floor }: { floor: InteriorFloor }) {
  const groupRef = useRef<THREE.Group>(null)
  const keysRef = useRef({ forward: false, backward: false, left: false, right: false, run: false })
  const cameraControlRef = useRef({ yaw: 0, distance: 8, height: 6.2 })
  const cameraDragRef = useRef<{ x: number; y: number } | null>(null)
  const spawn = useMemo(() => getInitialSpawn(floor), [floor])
  const { camera, gl } = useThree()

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.position.set(spawn.x, 1, spawn.z)
    group.rotation.y = spawn.rotation
  }, [spawn])

  useEffect(() => {
    const setKey = (code: string, pressed: boolean) => {
      const keys = keysRef.current
      if (code === KEY.FORWARD) keys.forward = pressed
      if (code === KEY.BACKWARD) keys.backward = pressed
      if (code === KEY.LEFT) keys.left = pressed
      if (code === KEY.RIGHT) keys.right = pressed
      if (code === KEY.RUN) keys.run = pressed
    }
    const onDown = (event: KeyboardEvent) => setKey(event.code, true)
    const onUp = (event: KeyboardEvent) => setKey(event.code, false)
    const onBlur = () => {
      keysRef.current = { forward: false, backward: false, left: false, right: false, run: false }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    const element = gl.domElement
    const onContextMenu = (event: MouseEvent) => event.preventDefault()
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 2 && event.button !== 1) return
      cameraDragRef.current = { x: event.clientX, y: event.clientY }
      element.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      const drag = cameraDragRef.current
      if (!drag) return
      const controls = cameraControlRef.current
      controls.yaw -= (event.clientX - drag.x) * 0.008
      controls.height = THREE.MathUtils.clamp(controls.height + (event.clientY - drag.y) * 0.025, 2.8, 12)
      drag.x = event.clientX
      drag.y = event.clientY
    }
    const onPointerUp = () => {
      cameraDragRef.current = null
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cameraControlRef.current.distance = THREE.MathUtils.clamp(
        cameraControlRef.current.distance * (event.deltaY < 0 ? 0.9 : 1.1),
        3.5,
        16,
      )
    }

    element.addEventListener('contextmenu', onContextMenu)
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointercancel', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('contextmenu', onContextMenu)
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointercancel', onPointerUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_, rawDelta) => {
    const group = groupRef.current
    if (!group) return
    const delta = Math.min(rawDelta, 0.08)
    const keys = keysRef.current
    const fwd = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0)
    const strafe = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
    const moving = fwd !== 0 || strafe !== 0
    const speed = keys.run ? 5.8 : 3.2

    if (moving) {
      const yaw = cameraControlRef.current.yaw
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
      const move = forward.multiplyScalar(fwd).add(right.multiplyScalar(strafe)).normalize().multiplyScalar(speed * delta)
      const nextX = group.position.x + move.x
      const nextZ = group.position.z + move.z
      if (isWalkable(nextX, group.position.z, floor)) group.position.x = nextX
      if (isWalkable(group.position.x, nextZ, floor)) group.position.z = nextZ
      group.rotation.y = Math.atan2(move.x, move.z)
      usePlayerStore.getState().setAction(keys.run ? 'run' : 'walk')
    } else {
      usePlayerStore.getState().setAction('idle')
    }

    const controls = cameraControlRef.current
    const targetCamera = new THREE.Vector3(
      group.position.x + Math.sin(controls.yaw) * controls.distance,
      controls.height,
      group.position.z + Math.cos(controls.yaw) * controls.distance,
    )
    camera.position.lerp(targetCamera, 1 - Math.exp(-8 * delta))
    camera.lookAt(group.position.x, 0.9, group.position.z)
  })

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <PlayerModel />
      </Suspense>
    </group>
  )
}

function RoomMeshes({ floor, wallHeight }: { floor: InteriorFloor; wallHeight: number }) {
  return (
    <>
      {floor.rooms.length === 0 && (
        <gridHelper args={[12, 24, '#5f6b75', '#3a4248']} position={[0, 0.02, 0]} />
      )}
      {floor.rooms.map((room) => (
        <group key={room.id}>
          <mesh position={[room.x + room.w / 2, 0, room.z + room.d / 2]} receiveShadow>
            <boxGeometry args={[room.w, 0.08, room.d]} />
            <meshToonMaterial color="#6d765f" gradientMap={toonGradient} />
          </mesh>
          {getVisibleWallSegments(room, floor.rooms, WALL_THICKNESS, floor.removedWalls ?? []).map((wall) => (
            <Wall key={wall.id} x={wall.x} z={wall.z} w={wall.w} d={wall.d} h={wallHeight} />
          ))}
        </group>
      ))}
      {floor.doors.map((door) => (
        <mesh key={door.id} position={[door.x, 1.05, door.z]} rotation={[0, door.rotation, 0]}>
          <boxGeometry args={[door.width, 2.1, 0.08]} />
          <meshBasicMaterial color="#d99a45" transparent opacity={0.72} />
        </mesh>
      ))}
      {floor.windows.map((windowItem) => (
        <group
          key={windowItem.id}
          position={[
            windowItem.x + Math.sin(windowItem.rotation) * 0.08,
            windowItem.sillHeight + 0.45,
            windowItem.z + Math.cos(windowItem.rotation) * 0.08,
          ]}
          rotation={[0, windowItem.rotation, 0]}
        >
          <mesh>
            <boxGeometry args={[windowItem.width, 0.9, 0.04]} />
            <meshBasicMaterial color="#62b6cb" transparent opacity={0.78} />
          </mesh>
          <mesh>
            <boxGeometry args={[windowItem.width + 0.16, 1.02, 0.055]} />
            <meshBasicMaterial color="#e7fbff" wireframe />
          </mesh>
        </group>
      ))}
      {floor.props.map((prop) => (
        <PrototypeProp key={prop.id} assetId={prop.assetId} x={prop.x} z={prop.z} rotation={prop.rotation} />
      ))}
      {floor.exits.map((exit) => (
        <mesh key={exit.id} position={[exit.x, 0.05, exit.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.48, 32]} />
          <meshBasicMaterial color="#4dab5f" />
        </mesh>
      ))}
    </>
  )
}

function PrototypeProp({ assetId, x, z, rotation }: { assetId: string; x: number; z: number; rotation: number }) {
  if (assetId === 'proto_table') {
    return (
      <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[1.25, 0.14, 0.75]} />
          <meshToonMaterial color="#e0a849" gradientMap={toonGradient} />
        </mesh>
        {[-0.45, 0.45].flatMap((legX) =>
          [-0.25, 0.25].map((legZ) => (
            <mesh key={`${legX}:${legZ}`} position={[legX, 0.36, legZ]} castShadow>
              <boxGeometry args={[0.12, 0.72, 0.12]} />
              <meshToonMaterial color="#8a6532" gradientMap={toonGradient} />
            </mesh>
          )),
        )}
      </group>
    )
  }
  if (assetId === 'proto_chair') {
    return (
      <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[0.55, 0.12, 0.55]} />
          <meshToonMaterial color="#4fb477" gradientMap={toonGradient} />
        </mesh>
        <mesh position={[0, 0.82, 0.24]} castShadow>
          <boxGeometry args={[0.55, 0.8, 0.1]} />
          <meshToonMaterial color="#3f8f60" gradientMap={toonGradient} />
        </mesh>
      </group>
    )
  }
  if (assetId === 'proto_counter') {
    return (
      <mesh position={[x, 0.55, z]} rotation={[0, rotation, 0]} castShadow>
        <boxGeometry args={[1.7, 1.1, 0.65]} />
        <meshToonMaterial color="#d26d55" gradientMap={toonGradient} />
      </mesh>
    )
  }
  if (assetId === 'proto_light') {
    return (
      <group position={[x, 0, z]}>
        <pointLight position={[0, 1.9, 0]} intensity={1.2} distance={4.5} color="#f3e36d" />
        <mesh position={[0, 1.95, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshBasicMaterial color="#f3e36d" />
        </mesh>
      </group>
    )
  }
  return (
    <mesh position={[x, 0.35, z]} rotation={[0, rotation, 0]} castShadow>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      <meshToonMaterial color="#b276ff" gradientMap={toonGradient} />
    </mesh>
  )
}

function Wall({ x, z, w, d, h }: { x: number; z: number; w: number; d: number; h: number }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshToonMaterial color="#d7c8af" gradientMap={toonGradient} />
    </mesh>
  )
}

export default function InteriorTestView({ interior, floor }: InteriorTestViewProps) {
  useEffect(() => {
    return () => {
      usePlayerStore.getState().setAction('idle')
    }
  }, [])

  return (
    <Canvas
      className="editor-game-canvas"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 6.5, 8], fov: 55, near: 0.1, far: 120 }}
    >
      <color attach="background" args={['#202326']} />
      <hemisphereLight args={['#f6fbff', '#575044', 1.2]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 8, 4]} intensity={1.5} castShadow />
      <RoomMeshes floor={floor} wallHeight={interior.defaultWallHeight} />
      <InteriorPlayerController floor={floor} />
    </Canvas>
  )
}
