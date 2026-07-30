import { HeightfieldCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayerStore } from '../stats/playerStore'
import { SPAWN } from '../../world/beauvais/cityData'
import { loadTerrain } from '../../world/beauvais/terrain'
import { roadwayHeightAt } from '../../world/beauvais/roadway'
import { PHYSICS_GROUPS, PHYSICS_MATERIAL } from './physicsConfig'
import { createAsyncTileResourceCache } from '../../world/beauvais/tileResourceCache'
import { useCollisionDebugStore } from '../../devtools/collisionDebugStore'
import { useCarStore } from '../../entities/vehicles/carStore'
import { buildPhysicsGroundTileInWorker } from './physicsGroundWorkerClient'
import { recordPerfSpan } from '../../devtools/perfProfiler'

const COLLIDER_CHUNK_SIZE = 128
const SAMPLE_STEP = 8
const ACTIVE_REACH = 1
const PREFETCH_SIDE_REACH = 1
const PREFETCH_NORMAL_STEPS = 2
const PREFETCH_FAST_STEPS = 3
const FAST_PREFETCH_SPEED = 24
const UPDATE_EVERY_FRAMES = 12
const PREPARE_DELAY_MS = 16
const MOUNT_STEP_DELAY_MS = 48
const COLLISION_DEBUG_ROAD_LIFT = 0.18

interface PhysicsTile {
  key: string
  tx: number
  tz: number
}

interface StreamingCenter {
  tx: number
  tz: number
  dirX: number
  dirZ: number
  fast: boolean
}

interface HeightfieldData {
  nrows: number
  ncols: number
  heights: Float32Array
  scale: {
    x: number
    y: number
    z: number
  }
  workerMs: number
}

const COLLISION_DEBUG_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#67e8f9',
  wireframe: true,
  transparent: true,
  opacity: 0.64,
  depthTest: false,
})

const ROAD_COLLISION_DEBUG_MATERIAL = new THREE.PointsMaterial({
  color: '#f472b6',
  size: 0.28,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.95,
  depthTest: false,
})

const heightfieldCache = createAsyncTileResourceCache<HeightfieldData>({
  name: 'physics-ground-heightfield',
  maxEntries: 256,
  build: async (key) => {
    const [tx, tz] = key.split(':').map(Number)
    const tile = await buildPhysicsGroundTileInWorker({
      key,
      tx,
      tz,
      chunkSize: COLLIDER_CHUNK_SIZE,
      sampleStep: SAMPLE_STEP,
    })
    recordPerfSpan('worker.compute:physics-ground-heightfield', performance.now() - tile.workerMs, key)
    return tile
  },
})

export async function warmPhysicsGroundTilesAround(x: number, z: number, reach = ACTIVE_REACH): Promise<number> {
  const center = { ...tileOf(x, z), dirX: 0, dirZ: 0, fast: false }
  let warmed = 0
  for (const tile of physicsTilesAround(center, reach)) {
    await heightfieldCache.prepare(tile.key)
    warmed += 1
  }
  return warmed
}

/** Colliders Rapier streamés autour du joueur : Rapier devient l'autorité du sol proche. */
export default function WorldPhysicsColliders() {
  const [ready, setReady] = useState(false)
  const [targetCenter, setTargetCenter] = useState<StreamingCenter>(() => ({
    ...tileOf(SPAWN.x, SPAWN.z),
    dirX: 0,
    dirZ: 0,
    fast: false,
  }))
  const [mountedKeys, setMountedKeys] = useState<string[]>(() => [tileKey(tileOf(SPAWN.x, SPAWN.z))])
  const [preparedKeys, setPreparedKeys] = useState<Set<string>>(() => new Set())
  const frame = useRef(0)

  useEffect(() => {
    let alive = true
    loadTerrain().finally(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useFrame(() => {
    if (!ready) return
    frame.current = (frame.current + 1) % UPDATE_EVERY_FRAMES
    if (frame.current !== 0) return

    const player = usePlayerStore.getState().playerObject
    const car = useCarStore.getState()
    const nextTile = tileOf(player?.position.x ?? SPAWN.x, player?.position.z ?? SPAWN.z)
    const direction = directionFromVelocity(car.velocityX, car.velocityZ)
    const fast = Math.abs(car.speed) > FAST_PREFETCH_SPEED
    const next: StreamingCenter = { ...nextTile, ...direction, fast }
    setTargetCenter((current) =>
      current.tx === next.tx &&
      current.tz === next.tz &&
      current.dirX === next.dirX &&
      current.dirZ === next.dirZ &&
      current.fast === next.fast
        ? current
        : next,
    )
  })

  const targetActiveTiles = useMemo(() => physicsTilesAround(targetCenter, ACTIVE_REACH), [targetCenter])
  const prefetchTiles = useMemo(() => physicsPrefetchTiles(targetCenter), [targetCenter])
  const prefetchTileSignature = useMemo(() => prefetchTiles.map((tile) => tile.key).join('|'), [prefetchTiles])
  const targetActiveSignature = useMemo(() => targetActiveTiles.map((tile) => tile.key).join('|'), [targetActiveTiles])
  const mountedKeySignature = useMemo(() => mountedKeys.join('|'), [mountedKeys])

  useEffect(() => {
    if (!ready) return undefined

    let cancelled = false
    let cursor = 0

    const publishPrepared = () => {
      setPreparedKeys((current) => {
        const next = new Set<string>()
        for (const tile of prefetchTiles) {
          if (heightfieldCache.has(tile.key)) next.add(tile.key)
        }
        const changed = next.size !== current.size || [...next].some((key) => !current.has(key))
        return changed ? next : current
      })
    }

    const prepareNext = () => {
      if (cancelled) return

      while (cursor < prefetchTiles.length) {
        const tile = prefetchTiles[cursor++]
        if (!heightfieldCache.has(tile.key)) {
          heightfieldCache.prepare(tile.key).finally(() => {
            publishPrepared()
            window.setTimeout(prepareNext, PREPARE_DELAY_MS)
          })
          return
        }
      }

      publishPrepared()
    }

    prepareNext()
    return () => {
      cancelled = true
    }
  }, [ready, prefetchTileSignature, prefetchTiles])

  useEffect(() => {
    if (!ready) return undefined
    let cancelled = false

    const timer = window.setTimeout(() => {
      if (cancelled) return

      const targetKeys = new Set(targetActiveTiles.map((tile) => tile.key))
      setMountedKeys((current) => {
        const currentKeys = new Set(current)
        const missing = targetActiveTiles.find((tile) => !currentKeys.has(tile.key) && heightfieldCache.has(tile.key))
        if (missing) {
          recordPerfSpan('stream.mount-queue:physics-ground-heightfield-tile', performance.now(), missing.key)
          return [...current, missing.key]
        }

        if (!targetActiveTiles.every((tile) => currentKeys.has(tile.key))) return current

        const stale = current
          .filter((key) => !targetKeys.has(key))
          .sort((a, b) => distanceFromTileKey(b, targetCenter) - distanceFromTileKey(a, targetCenter))[0]
        if (stale) {
          recordPerfSpan('stream.unmount-queue:physics-ground-heightfield-tile', performance.now(), stale)
          return current.filter((key) => key !== stale)
        }

        return current
      })
    }, MOUNT_STEP_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [ready, targetCenter, targetActiveTiles, targetActiveSignature, mountedKeySignature, preparedKeys])

  if (!ready) return null

  const visibleTiles = mountedKeys
    .filter((key) => heightfieldCache.has(key))
    .map(tileFromKey)

  return (
    <>
      {visibleTiles.map((tile) => (
        <WorldPhysicsTile key={tile.key} tile={tile} />
      ))}
    </>
  )
}

function WorldPhysicsTile({ tile }: { tile: PhysicsTile }) {
  const heightfield = useMemo(() => heightfieldCache.get(tile.key), [tile.key])
  const mountQueuedAt = useRef(performance.now())
  const collisionDebugEnabled = useCollisionDebugStore((state) => state.enabled)
  useEffect(() => {
    recordPerfSpan('react.mount:physics-ground-heightfield-tile', mountQueuedAt.current, tile.key)
    heightfieldCache.retain(tile.key)
    return () => heightfieldCache.release(tile.key)
  }, [tile.key])
  if (!heightfield) return null

  const centerX = tile.tx * COLLIDER_CHUNK_SIZE + COLLIDER_CHUNK_SIZE / 2
  const centerZ = tile.tz * COLLIDER_CHUNK_SIZE + COLLIDER_CHUNK_SIZE / 2

  return (
    <RigidBody type="fixed" colliders={false} position={[centerX, 0, centerZ]}>
      <HeightfieldCollider
        args={[
          heightfield.nrows,
          heightfield.ncols,
          heightfield.heights as unknown as number[],
          heightfield.scale,
        ]}
        friction={PHYSICS_MATERIAL.asphalt.friction}
        restitution={PHYSICS_MATERIAL.asphalt.restitution}
        collisionGroups={PHYSICS_GROUPS.world}
        solverGroups={PHYSICS_GROUPS.world}
      />
      {collisionDebugEnabled && <TerrainCollisionDebugMesh tile={tile} heightfield={heightfield} />}
    </RigidBody>
  )
}

function TerrainCollisionDebugMesh({ tile, heightfield }: { tile: PhysicsTile; heightfield: HeightfieldData }) {
  const geometry = useMemo(() => {
    return buildHeightfieldDebugGeometry(heightfield)
  }, [heightfield])

  const roadSamplesGeometry = useMemo(() => buildRoadCollisionSampleGeometry(tile), [tile])

  useEffect(() => {
    return () => {
      geometry.dispose()
      roadSamplesGeometry?.dispose()
    }
  }, [geometry, roadSamplesGeometry])

  return (
    <>
      <mesh
        geometry={geometry}
        material={COLLISION_DEBUG_MATERIAL}
        renderOrder={900}
        castShadow={false}
        receiveShadow={false}
      />
      {roadSamplesGeometry && (
        <points
          geometry={roadSamplesGeometry}
          material={ROAD_COLLISION_DEBUG_MATERIAL}
          renderOrder={910}
          frustumCulled={false}
        />
      )}
    </>
  )
}

function buildHeightfieldDebugGeometry(heightfield: HeightfieldData): THREE.BufferGeometry {
  const { nrows, ncols, heights, scale } = heightfield
  const vertexRows = nrows + 1
  const vertexCols = ncols + 1
  const positions = new Float32Array(vertexRows * vertexCols * 3)
  const indices = new Uint32Array(nrows * ncols * 6)
  let vertexCursor = 0

  for (let row = 0; row < vertexRows; row++) {
    for (let col = 0; col < vertexCols; col++) {
      positions[vertexCursor++] = -scale.x / 2 + (col / ncols) * scale.x
      positions[vertexCursor++] = heights[col * vertexRows + row] * scale.y
      positions[vertexCursor++] = -scale.z / 2 + (row / nrows) * scale.z
    }
  }

  let indexCursor = 0
  for (let row = 0; row < nrows; row++) {
    for (let col = 0; col < ncols; col++) {
      const a = row * vertexCols + col
      const b = a + 1
      const c = a + vertexCols
      const d = c + 1
      indices[indexCursor++] = a
      indices[indexCursor++] = c
      indices[indexCursor++] = b
      indices[indexCursor++] = b
      indices[indexCursor++] = c
      indices[indexCursor++] = d
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeBoundingSphere()
  return geo
}

function buildRoadCollisionSampleGeometry(tile: PhysicsTile): THREE.BufferGeometry | null {
  const steps = Math.round(COLLIDER_CHUNK_SIZE / SAMPLE_STEP)
  const minX = tile.tx * COLLIDER_CHUNK_SIZE
  const minZ = tile.tz * COLLIDER_CHUNK_SIZE
  const positions: number[] = []

  for (let z = 0; z <= steps; z++) {
    for (let x = 0; x <= steps; x++) {
      const localX = x * SAMPLE_STEP
      const localZ = z * SAMPLE_STEP
      const worldX = minX + localX
      const worldZ = minZ + localZ
      const roadY = roadwayHeightAt(worldX, worldZ)
      if (roadY === -Infinity) continue
      positions.push(localX - COLLIDER_CHUNK_SIZE / 2, roadY + COLLISION_DEBUG_ROAD_LIFT, localZ - COLLIDER_CHUNK_SIZE / 2)
    }
  }

  if (positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.computeBoundingSphere()
  return geo
}

function tileOf(x: number, z: number) {
  return {
    tx: Math.floor(x / COLLIDER_CHUNK_SIZE),
    tz: Math.floor(z / COLLIDER_CHUNK_SIZE),
  }
}

function tileKey(tile: { tx: number; tz: number }): string {
  return tile.tx + ':' + tile.tz
}

function tileFromKey(key: string): PhysicsTile {
  const [tx, tz] = key.split(':').map(Number)
  return { key, tx, tz }
}

function distanceFromTileKey(key: string, center: { tx: number; tz: number }): number {
  const tile = tileFromKey(key)
  const dx = tile.tx - center.tx
  const dz = tile.tz - center.tz
  return dx * dx + dz * dz
}

function directionFromVelocity(vx: number, vz: number): { dirX: number; dirZ: number } {
  const length = Math.hypot(vx, vz)
  if (length < 3) return { dirX: 0, dirZ: 0 }
  return {
    dirX: Math.round(vx / length),
    dirZ: Math.round(vz / length),
  }
}

function physicsPrefetchTiles(center: StreamingCenter): PhysicsTile[] {
  const tiles = new Map<string, PhysicsTile>()
  const add = (tx: number, tz: number) => {
    const key = tx + ':' + tz
    if (!tiles.has(key)) tiles.set(key, { key, tx, tz })
  }

  for (const tile of physicsTilesAround(center, ACTIVE_REACH)) add(tile.tx, tile.tz)

  if (center.dirX !== 0 || center.dirZ !== 0) {
    const sideX = -center.dirZ
    const sideZ = center.dirX
    const maxStep = center.fast ? PREFETCH_FAST_STEPS : PREFETCH_NORMAL_STEPS
    for (let step = ACTIVE_REACH + 1; step <= maxStep; step++) {
      for (let side = -PREFETCH_SIDE_REACH; side <= PREFETCH_SIDE_REACH; side++) {
        add(center.tx + center.dirX * step + sideX * side, center.tz + center.dirZ * step + sideZ * side)
      }
    }
  }

  return [...tiles.values()].sort((a, b) => {
    const adx = a.tx - center.tx
    const adz = a.tz - center.tz
    const bdx = b.tx - center.tx
    const bdz = b.tz - center.tz
    const af = adx * center.dirX + adz * center.dirZ
    const bf = bdx * center.dirX + bdz * center.dirZ
    const activeA = Math.abs(adx) <= ACTIVE_REACH && Math.abs(adz) <= ACTIVE_REACH
    const activeB = Math.abs(bdx) <= ACTIVE_REACH && Math.abs(bdz) <= ACTIVE_REACH
    if (activeA !== activeB) return activeA ? -1 : 1
    if (af !== bf) return bf - af
    return adx * adx + adz * adz - (bdx * bdx + bdz * bdz)
  })
}

function physicsTilesAround(center: { tx: number; tz: number }, reach: number): PhysicsTile[] {
  const out: PhysicsTile[] = []
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      const tx = center.tx + dx
      const tz = center.tz + dz
      out.push({ key: tx + ':' + tz, tx, tz })
    }
  }
  return out.sort((a, b) => {
    const adx = a.tx - center.tx
    const adz = a.tz - center.tz
    const bdx = b.tx - center.tx
    const bdz = b.tz - center.tz
    return adx * adx + adz * adz - (bdx * bdx + bdz * bdz)
  })
}
