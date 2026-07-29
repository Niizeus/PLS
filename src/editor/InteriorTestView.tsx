import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import PlayerModel from '../entities/player/PlayerModel'
import { KEY } from '../gameplay/input/keyMap'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { toonGradient } from '../shaders/toonGradient'
import { type InteriorDefinition, type InteriorFloor, type InteriorWall } from '../data/interiors'
import {
  getWallChunks,
  openingSpan,
  pointInPolygon,
  polygonCentroid,
  projectOnWall,
  wallAngle,
  wallLength,
  wallPointAt,
} from '../data/interiorGeometry'

interface InteriorTestViewProps {
  interior: InteriorDefinition
  floor: InteriorFloor
}

const PLAYER_RADIUS = 0.34
const FLOOR_THICKNESS = 0.08

/**
 * 🚶 Collisions du mode test, derivees du MEME modele que l'affichage.
 *
 * C'est la regle a ne pas casser : ce qui bloque doit etre ce qu'on voit. Avant, la collision
 * testait "suis-je dans un rectangle de piece", donc un mur pose en diagonale aurait ete
 * traversable et un sol rond aurait eu des bords invisibles.
 *
 * Deux conditions pour pouvoir avancer :
 *  1. etre au-dessus d'un sol ;
 *  2. ne pas etre dans l'epaisseur d'un mur — sauf en face d'une ouverture qui touche le sol
 *     (un passage ou une porte se franchissent, une fenetre non).
 */
function isWalkable(x: number, z: number, floor: InteriorFloor) {
  const point = { x, z }

  // Un etage sans sol n'est pas une prison : on laisse circuler pour pouvoir tester tot.
  if (floor.surfaces.length > 0) {
    const onFloor = floor.surfaces.some((surface) => pointInPolygon(point, surface.pts))
    if (!onFloor) return false
  }

  for (const wall of floor.walls) {
    const projection = projectOnWall(wall, point)
    if (projection.distance > wall.thickness / 2 + PLAYER_RADIUS) continue

    // Le joueur doit tenir dans l'ouverture, pas seulement la toucher du bord.
    const throughOpening = wall.openings.some((opening) => {
      if (opening.sillHeight > 0.01) return false
      const span = openingSpan(wall, opening)
      return projection.distanceAlong >= span.start + PLAYER_RADIUS && projection.distanceAlong <= span.end - PLAYER_RADIUS
    })
    if (!throughOpening) return false
  }
  return true
}

function getInitialSpawn(floor: InteriorFloor) {
  const spawn = floor.spawnPoints[0]
  if (spawn) return { x: spawn.x, z: spawn.z, rotation: spawn.rotation }
  const surface = floor.surfaces[0]
  if (surface) {
    const center = polygonCentroid(surface.pts)
    return { x: center.x, z: center.z, rotation: 0 }
  }
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
      // Les deux axes sont testes separement : on glisse le long d'un mur au lieu de s'y coller.
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

/** Un sol : le polygone est extrude d'une dalle fine. */
function SurfaceMesh({ pts }: { pts: [number, number][] }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    pts.forEach(([x, z], index) => {
      if (index === 0) shape.moveTo(x, z)
      else shape.lineTo(x, z)
    })
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: FLOOR_THICKNESS, bevelEnabled: false })
    // La forme est dessinee dans le plan XY : on la couche a plat, face vers le haut.
    geo.rotateX(Math.PI / 2)
    return geo
  }, [pts])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial color="#6d765f" gradientMap={toonGradient} />
    </mesh>
  )
}

/**
 * Un mur : autant de boites que de morceaux pleins.
 * Une porte laisse les troncons de part et d'autre plus un linteau ; une fenetre ajoute une
 * allege en dessous. Le mur n'est jamais supprime en entier (voir `getWallChunks`).
 */
function WallMeshes({ wall, defaultHeight }: { wall: InteriorWall; defaultHeight: number }) {
  const height = wall.height ?? defaultHeight
  const angle = wallAngle(wall)
  const chunks = useMemo(() => getWallChunks(wall, wall.openings, height), [wall, height])

  return (
    <group>
      {chunks.map((chunk, index) => {
        const length = chunk.end - chunk.start
        if (length <= 0.001) return null
        const center = wallPointAt(wall, (chunk.start + chunk.end) / 2)
        const chunkHeight = chunk.top - chunk.bottom
        return (
          <mesh
            key={`${wall.id}-${index}`}
            position={[center.x, chunk.bottom + chunkHeight / 2, center.z]}
            // Rotation autour de Y : la boite est construite le long de X puis orientee.
            rotation={[0, -angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[length, chunkHeight, wall.thickness]} />
            <meshToonMaterial color="#d7c8af" gradientMap={toonGradient} />
          </mesh>
        )
      })}
      {/* Reperes translucides pour voir a quoi sert chaque ouverture. */}
      {wall.openings.map((opening) => {
        if (opening.kind === 'passage') return null
        const center = wallPointAt(wall, opening.offset)
        const openingHeight = opening.topHeight - opening.sillHeight
        return (
          <mesh
            key={opening.id}
            position={[center.x, opening.sillHeight + openingHeight / 2, center.z]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[opening.width, openingHeight, Math.max(0.04, wall.thickness * 0.3)]} />
            <meshBasicMaterial
              color={opening.kind === 'door' ? '#d99a45' : '#62b6cb'}
              transparent
              opacity={opening.kind === 'door' ? 0.55 : 0.7}
            />
          </mesh>
        )
      })}
    </group>
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

function FloorMeshes({ floor, wallHeight }: { floor: InteriorFloor; wallHeight: number }) {
  const empty = floor.walls.length === 0 && floor.surfaces.length === 0
  return (
    <>
      {empty && <gridHelper args={[12, 24, '#5f6b75', '#3a4248']} position={[0, 0.02, 0]} />}
      {floor.surfaces.map((surface) => (
        <SurfaceMesh key={surface.id} pts={surface.pts} />
      ))}
      {floor.walls.map((wall) => (
        <WallMeshes key={wall.id} wall={wall} defaultHeight={wallHeight} />
      ))}
      {floor.props.map((prop) => (
        <PrototypeProp key={prop.id} assetId={prop.assetId} x={prop.x} z={prop.z} rotation={prop.rotation} />
      ))}
      {floor.exits.map((exit) => (
        <mesh key={exit.id} position={[exit.x, 0.12, exit.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.48, 32]} />
          <meshBasicMaterial color="#4dab5f" />
        </mesh>
      ))}
    </>
  )
}

export default function InteriorTestView({ interior, floor }: InteriorTestViewProps) {
  useEffect(() => {
    return () => {
      usePlayerStore.getState().setAction('idle')
    }
  }, [])

  const wallCount = floor.walls.length
  const totalLength = floor.walls.reduce((sum, wall) => sum + wallLength(wall), 0)

  return (
    <>
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
        <FloorMeshes floor={floor} wallHeight={interior.defaultWallHeight} />
        <InteriorPlayerController floor={floor} />
      </Canvas>
      <div className="interior-test-badge">
        {wallCount} murs · {totalLength.toFixed(1)} m de mur · {floor.surfaces.length} sols
      </div>
    </>
  )
}
