import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { usePlayerStore } from '../stats/playerStore'
import { SPAWN, terrainHeight } from '../../world/beauvais/cityData'
import { buildingsNear } from '../../world/beauvais/collision'
import { PHYSICS_GROUPS, PHYSICS_MATERIAL } from './physicsConfig'

const COLLIDER_TILE_SIZE = 96
const TILE_REACH = 1
const UPDATE_EVERY_FRAMES = 12
const MIN_WALL_LENGTH = 0.6
const WALL_THICKNESS = 0.48
const QUERY_EXTRA_RADIUS = 72

interface ColliderTile {
  key: string
  tx: number
  tz: number
}

interface WallColliderData {
  key: string
  x: number
  y: number
  z: number
  yaw: number
  halfLength: number
  halfHeight: number
}

/** Facades Rapier proches : stream par tuiles stables pour eviter les remounts massifs. */
export default function WorldBuildingColliders() {
  const [center, setCenter] = useState(() => tileOf(SPAWN.x, SPAWN.z))
  const frame = useRef(0)

  useFrame(() => {
    frame.current = (frame.current + 1) % UPDATE_EVERY_FRAMES
    if (frame.current !== 0) return

    const player = usePlayerStore.getState().playerObject
    const next = tileOf(player?.position.x ?? SPAWN.x, player?.position.z ?? SPAWN.z)
    setCenter((current) => (current.tx === next.tx && current.tz === next.tz ? current : next))
  })

  const tiles = useMemo(() => {
    const out: ColliderTile[] = []
    for (let dx = -TILE_REACH; dx <= TILE_REACH; dx++) {
      for (let dz = -TILE_REACH; dz <= TILE_REACH; dz++) {
        const tx = center.tx + dx
        const tz = center.tz + dz
        out.push({ key: tx + ':' + tz, tx, tz })
      }
    }
    return out
  }, [center])

  return (
    <>
      {tiles.map((tile) => (
        <WorldBuildingColliderTile key={tile.key} tile={tile} />
      ))}
    </>
  )
}

function WorldBuildingColliderTile({ tile }: { tile: ColliderTile }) {
  const walls = useMemo(() => buildTileWallColliders(tile.tx, tile.tz), [tile.tx, tile.tz])
  if (walls.length === 0) return null

  return (
    <RigidBody type="fixed" colliders={false}>
      {walls.map((wall) => (
        <CuboidCollider
          key={wall.key}
          position={[wall.x, wall.y, wall.z]}
          rotation={[0, wall.yaw, 0]}
          args={[wall.halfLength, wall.halfHeight, WALL_THICKNESS * 0.5]}
          friction={PHYSICS_MATERIAL.asphalt.friction}
          restitution={0.02}
          collisionGroups={PHYSICS_GROUPS.world}
          solverGroups={PHYSICS_GROUPS.world}
        />
      ))}
    </RigidBody>
  )
}

function buildTileWallColliders(tx: number, tz: number): WallColliderData[] {
  const minX = tx * COLLIDER_TILE_SIZE
  const minZ = tz * COLLIDER_TILE_SIZE
  const maxX = minX + COLLIDER_TILE_SIZE
  const maxZ = minZ + COLLIDER_TILE_SIZE
  const centerX = minX + COLLIDER_TILE_SIZE * 0.5
  const centerZ = minZ + COLLIDER_TILE_SIZE * 0.5
  const queryRadius = Math.SQRT2 * COLLIDER_TILE_SIZE * 0.5 + QUERY_EXTRA_RADIUS
  const buildings = buildingsNear(centerX, centerZ, queryRadius)
  const walls: WallColliderData[] = []

  for (const building of buildings) {
    const pts = building.pts
    const height = Math.max(2.4, building.h + (building.rh ?? 0))
    const halfHeight = height * 0.5

    for (let p = 0, q = pts.length - 1; p < pts.length; q = p++) {
      const ax = pts[q][0]
      const az = pts[q][1]
      const bx = pts[p][0]
      const bz = pts[p][1]
      const dx = bx - ax
      const dz = bz - az
      const length = Math.hypot(dx, dz)
      if (length < MIN_WALL_LENGTH) continue

      const cx = (ax + bx) * 0.5
      const cz = (az + bz) * 0.5
      if (cx < minX || cx >= maxX || cz < minZ || cz >= maxZ) continue

      const baseY = terrainHeight(cx, cz)
      walls.push({
        key: wallKey(ax, az, bx, bz),
        x: cx,
        y: baseY + halfHeight,
        z: cz,
        yaw: Math.atan2(-dz, dx),
        halfLength: length * 0.5,
        halfHeight,
      })
    }
  }

  return walls
}

function tileOf(x: number, z: number) {
  return {
    tx: Math.floor(x / COLLIDER_TILE_SIZE),
    tz: Math.floor(z / COLLIDER_TILE_SIZE),
  }
}

function wallKey(ax: number, az: number, bx: number, bz: number): string {
  return `${ax.toFixed(2)}:${az.toFixed(2)}:${bx.toFixed(2)}:${bz.toFixed(2)}`
}
