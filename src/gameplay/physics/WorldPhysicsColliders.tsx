import { TrimeshCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { usePlayerStore } from '../stats/playerStore'
import { SPAWN } from '../../world/beauvais/cityData'
import { loadTerrain } from '../../world/beauvais/terrain'
import { PHYSICS_GROUPS, PHYSICS_MATERIAL } from './physicsConfig'
import { driveSurfaceHeightAt } from './physicsSurface'

const COLLIDER_CHUNK_SIZE = 48
const SAMPLE_STEP = 1
const REACH = 2
const UPDATE_EVERY_FRAMES = 12

interface PhysicsTile {
  key: string
  tx: number
  tz: number
}

interface TrimeshData {
  vertices: Float32Array
  indices: Uint32Array
}

/** Colliders Rapier streamés autour du joueur : Rapier devient l'autorité du sol proche. */
export default function WorldPhysicsColliders() {
  const [ready, setReady] = useState(false)
  const [center, setCenter] = useState(() => tileOf(SPAWN.x, SPAWN.z))
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
    const next = tileOf(player?.position.x ?? SPAWN.x, player?.position.z ?? SPAWN.z)
    setCenter((current) => (current.tx === next.tx && current.tz === next.tz ? current : next))
  })

  const tiles = useMemo(() => {
    const out: PhysicsTile[] = []
    for (let dx = -REACH; dx <= REACH; dx++) {
      for (let dz = -REACH; dz <= REACH; dz++) {
        const tx = center.tx + dx
        const tz = center.tz + dz
        out.push({ key: tx + ':' + tz, tx, tz })
      }
    }
    return out
  }, [center])

  if (!ready) return null

  return (
    <>
      {tiles.map((tile) => (
        <WorldPhysicsTile key={tile.key} tile={tile} />
      ))}
    </>
  )
}

function WorldPhysicsTile({ tile }: { tile: PhysicsTile }) {
  const mesh = useMemo(() => buildTileTrimesh(tile.tx, tile.tz), [tile.tx, tile.tz])
  const originX = tile.tx * COLLIDER_CHUNK_SIZE
  const originZ = tile.tz * COLLIDER_CHUNK_SIZE

  return (
    <RigidBody type="fixed" colliders={false} position={[originX, 0, originZ]}>
      <TrimeshCollider
        args={[mesh.vertices, mesh.indices]}
        friction={PHYSICS_MATERIAL.asphalt.friction}
        restitution={PHYSICS_MATERIAL.asphalt.restitution}
        collisionGroups={PHYSICS_GROUPS.world}
        solverGroups={PHYSICS_GROUPS.world}
      />
    </RigidBody>
  )
}

function buildTileTrimesh(tx: number, tz: number): TrimeshData {
  const steps = Math.round(COLLIDER_CHUNK_SIZE / SAMPLE_STEP)
  const vertsPerSide = steps + 1
  const minX = tx * COLLIDER_CHUNK_SIZE
  const minZ = tz * COLLIDER_CHUNK_SIZE
  const vertices = new Float32Array(vertsPerSide * vertsPerSide * 3)

  for (let z = 0; z <= steps; z++) {
    for (let x = 0; x <= steps; x++) {
      const worldX = minX + x * SAMPLE_STEP
      const worldZ = minZ + z * SAMPLE_STEP
      const index = (z * vertsPerSide + x) * 3
      vertices[index] = x * SAMPLE_STEP
      vertices[index + 1] = driveSurfaceHeightAt(worldX, worldZ)
      vertices[index + 2] = z * SAMPLE_STEP
    }
  }

  const indices = new Uint32Array(steps * steps * 6)
  let cursor = 0
  for (let z = 0; z < steps; z++) {
    for (let x = 0; x < steps; x++) {
      const a = z * vertsPerSide + x
      const b = a + 1
      const c = a + vertsPerSide
      const d = c + 1
      indices[cursor++] = a
      indices[cursor++] = c
      indices[cursor++] = b
      indices[cursor++] = b
      indices[cursor++] = c
      indices[cursor++] = d
    }
  }

  return { vertices, indices }
}

function tileOf(x: number, z: number) {
  return {
    tx: Math.floor(x / COLLIDER_CHUNK_SIZE),
    tz: Math.floor(z / COLLIDER_CHUNK_SIZE),
  }
}
