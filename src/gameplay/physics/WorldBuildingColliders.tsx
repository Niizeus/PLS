import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { usePlayerStore } from '../stats/playerStore'
import { SPAWN, terrainHeight } from '../../world/beauvais/cityData'
import { buildingsNear } from '../../world/beauvais/collision'
import { PHYSICS_GROUPS, PHYSICS_MATERIAL } from './physicsConfig'
import { createTileResourceCache } from '../../world/beauvais/tileResourceCache'
import { useCollisionDebugStore } from '../../devtools/collisionDebugStore'
import { recordPerfSpan } from '../../devtools/perfProfiler'

/**
 * 🧱 Façades solides (Rapier) autour du joueur, streamées par tuiles.
 *
 * ## Pourquoi ce fichier est écrit comme ça (à lire avant de le simplifier)
 *
 * Une tuile du centre-ville contient de **150 à 770 murs**. Si on monte une tuile
 * d'un coup, React crée ces 150-770 `<CuboidCollider>` — donc autant d'`Object3D`
 * et autant de colliders Rapier — dans UNE seule image. Résultat mesuré au
 * profileur : une « long task » de 40 à 80 ms, c'est-à-dire une grosse saccade.
 * En voiture on traverse une tuile toutes les 3 secondes → une saccade toutes les
 * 3 secondes, et c'est exactement ce qu'on ressentait en prenant de la vitesse.
 *
 * La parade : on ne crée (ni ne détruit) jamais plus de `WALLS_PER_BATCH` murs
 * par image. Les murs d'une tuile sont pré-découpés en **lots** au moment du
 * build, et le planificateur ci-dessous n'autorise **qu'un seul lot par image**,
 * que ce soit pour apparaître ou pour disparaître. Le coût total est le même,
 * mais étalé sur ~10 images de +4 ms au lieu d'une image à +60 ms.
 *
 * ⚠️ Si tu remets un rendu « toute la tuile d'un coup », les saccades reviennent.
 */

const COLLIDER_TILE_SIZE = 96
const TILE_REACH = 1
const UPDATE_EVERY_FRAMES = 12
const PREPARE_DELAY_MS = 12
const MIN_WALL_LENGTH = 0.6
const WALL_THICKNESS = 0.48
const QUERY_EXTRA_RADIUS = 72
/** Nombre max de colliders créés/détruits dans une même image. */
const WALLS_PER_BATCH = 48
/** Au-delà de cette distance en tuiles, on lâche la tuile d'un coup (téléport). */
const DROP_AT_ONCE_REACH = TILE_REACH + 2

const BUILDING_COLLISION_DEBUG_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#fb923c',
  wireframe: true,
  transparent: true,
  opacity: 0.72,
  depthTest: false,
})

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

/** Les murs d'une tuile, déjà découpés en lots montables image par image. */
type WallBatches = WallColliderData[][]

const wallColliderCache = createTileResourceCache<WallBatches>({
  name: 'physics-building-walls',
  maxEntries: 192,
  build: (key) => {
    const [tx, tz] = key.split(':').map(Number)
    return toBatches(buildTileWallColliders(tx, tz))
  },
})

export function warmBuildingColliderTilesAround(x: number, z: number, reach = TILE_REACH): number {
  const center = tileOf(x, z)
  let warmed = 0
  for (const tile of colliderTilesAround(center, reach)) {
    wallColliderCache.get(tile.key)
    warmed += 1
  }
  return warmed
}

export default function WorldBuildingColliders() {
  const [center, setCenter] = useState(() => tileOf(SPAWN.x, SPAWN.z))
  /** clé de tuile → nombre de lots de murs actuellement montés. */
  const [mounted, setMounted] = useState<Map<string, number>>(() => new Map())
  const frame = useRef(0)

  const tiles = useMemo(() => colliderTilesAround(center), [center])
  const tileSignature = useMemo(() => tiles.map((tile) => tile.key).join('|'), [tiles])

  // Le planificateur tourne dans `useFrame` : il lui faut la cible la plus fraîche
  // sans dépendre du cycle de rendu React.
  const targetRef = useRef({ center, tiles })
  targetRef.current = { center, tiles }

  useFrame(() => {
    // 1) Recentrage : inutile de le tester à chaque image.
    frame.current = (frame.current + 1) % UPDATE_EVERY_FRAMES
    if (frame.current === 0) {
      const player = usePlayerStore.getState().playerObject
      const next = tileOf(player?.position.x ?? SPAWN.x, player?.position.z ?? SPAWN.z)
      setCenter((current) => (current.tx === next.tx && current.tz === next.tz ? current : next))
    }

    // 2) UN seul pas de streaming par image (un lot de murs, pas plus).
    const target = targetRef.current
    setMounted((current) => streamOneStep(current, target.center, target.tiles))
  })

  // Construction des données de murs (léger : ~1 ms par tuile), espacée pour ne
  // pas empiler plusieurs builds dans la même image.
  useEffect(() => {
    let cancelled = false
    let cursor = 0

    const prepareNext = () => {
      if (cancelled) return
      while (cursor < tiles.length) {
        const tile = tiles[cursor++]
        if (!wallColliderCache.has(tile.key)) {
          wallColliderCache.get(tile.key)
          window.setTimeout(prepareNext, PREPARE_DELAY_MS)
          return
        }
      }
    }

    prepareNext()
    return () => {
      cancelled = true
    }
  }, [tileSignature, tiles])

  return (
    <>
      {[...mounted].map(([key, batchCount]) =>
        batchCount > 0 ? <WorldBuildingColliderTile key={key} tileKey={key} batchCount={batchCount} /> : null,
      )}
    </>
  )
}

/**
 * Fait avancer le streaming d'UN cran : soit on révèle un lot de murs d'une tuile
 * voulue, soit on retire un lot d'une tuile devenue inutile. Jamais les deux, et
 * jamais plus d'un lot — c'est là que se joue l'absence de saccade.
 *
 * Renvoie la Map inchangée s'il n'y a rien à faire : React ne re-rend alors pas.
 */
function streamOneStep(
  current: Map<string, number>,
  center: { tx: number; tz: number },
  wanted: ColliderTile[],
): Map<string, number> {
  // a) Compléter les tuiles voulues, de la plus proche à la plus lointaine.
  for (const tile of wanted) {
    if (!wallColliderCache.has(tile.key)) continue
    const total = wallColliderCache.get(tile.key).length
    const shown = current.get(tile.key) ?? 0
    if (shown < total) {
      const next = new Map(current)
      next.set(tile.key, shown + 1)
      return next
    }
  }

  // b) Dégonfler les tuiles obsolètes, de la plus lointaine à la plus proche.
  let farthestKey: string | null = null
  let farthestDistance = -1
  for (const key of current.keys()) {
    // `wanted` fait au plus 9 entrées : une recherche linéaire évite d'allouer un
    // Set à chaque image (cette fonction tourne 60 fois par seconde).
    if (wanted.some((tile) => tile.key === key)) continue
    const distance = tileDistance(key, center)
    if (distance > farthestDistance) {
      farthestDistance = distance
      farthestKey = key
    }
  }
  if (farthestKey === null) return current

  const next = new Map(current)
  // Téléport / respawn : une tuile très loin ne sert plus à rien, on la lâche
  // d'un bloc plutôt que d'étaler la purge sur des dizaines d'images.
  if (farthestDistance > DROP_AT_ONCE_REACH) {
    next.delete(farthestKey)
    return next
  }

  const shown = (next.get(farthestKey) ?? 0) - 1
  if (shown <= 0) next.delete(farthestKey)
  else next.set(farthestKey, shown)
  return next
}

function WorldBuildingColliderTile({ tileKey, batchCount }: { tileKey: string; batchCount: number }) {
  const batches = useMemo(() => wallColliderCache.get(tileKey), [tileKey])
  useEffect(() => {
    wallColliderCache.retain(tileKey)
    return () => wallColliderCache.release(tileKey)
  }, [tileKey])
  if (batches.length === 0) return null

  return (
    <RigidBody type="fixed" colliders={false}>
      {batches.slice(0, batchCount).map((walls, index) => (
        <WallBatch key={index} walls={walls} />
      ))}
    </RigidBody>
  )
}

/**
 * Un lot de murs. `memo` est ESSENTIEL : quand une tuile gagne un lot, les lots
 * déjà montés ne doivent surtout pas être re-réconciliés (leur tableau `walls`
 * est stable, donc React les saute complètement).
 */
const WallBatch = memo(function WallBatch({ walls }: { walls: WallColliderData[] }) {
  const collisionDebugEnabled = useCollisionDebugStore((state) => state.enabled)
  // Coût réel d'un lot, visible dans le rapport du profileur (F2 → capture).
  // C'est LA valeur à surveiller : elle doit rester très en dessous de 16 ms.
  const queuedAt = useRef(performance.now())
  useEffect(() => {
    recordPerfSpan('react.mount:physics-building-walls-batch', queuedAt.current, String(walls.length))
  }, [walls])

  return (
    <>
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
      {collisionDebugEnabled &&
        walls.map((wall) => (
          <mesh
            key={'debug:' + wall.key}
            position={[wall.x, wall.y, wall.z]}
            rotation={[0, wall.yaw, 0]}
            material={BUILDING_COLLISION_DEBUG_MATERIAL}
            renderOrder={920}
            castShadow={false}
            receiveShadow={false}
          >
            <boxGeometry args={[wall.halfLength * 2, wall.halfHeight * 2, WALL_THICKNESS]} />
          </mesh>
        ))}
    </>
  )
})

function toBatches(walls: WallColliderData[]): WallBatches {
  const batches: WallBatches = []
  for (let i = 0; i < walls.length; i += WALLS_PER_BATCH) {
    batches.push(walls.slice(i, i + WALLS_PER_BATCH))
  }
  return batches
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
  const seenWalls = new Set<string>()

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
      const key = wallKey(ax, az, bx, bz)
      if (seenWalls.has(key)) continue
      seenWalls.add(key)

      const baseY = terrainHeight(cx, cz)
      walls.push({
        key,
        x: cx,
        y: baseY + halfHeight,
        z: cz,
        yaw: Math.atan2(-dz, dx),
        halfLength: length * 0.5,
        halfHeight,
      })
    }
  }

  // Les murs les plus proches du centre de la tuile arrivent en premier : le
  // joueur voit donc d'abord se solidifier ce qui est autour de lui.
  walls.sort(
    (a, b) =>
      (a.x - centerX) ** 2 + (a.z - centerZ) ** 2 - ((b.x - centerX) ** 2 + (b.z - centerZ) ** 2),
  )
  return walls
}

function tileOf(x: number, z: number) {
  return {
    tx: Math.floor(x / COLLIDER_TILE_SIZE),
    tz: Math.floor(z / COLLIDER_TILE_SIZE),
  }
}

/** Distance de Chebyshev (en tuiles) entre une clé de tuile et le centre courant. */
function tileDistance(key: string, center: { tx: number; tz: number }): number {
  const [tx, tz] = key.split(':').map(Number)
  return Math.max(Math.abs(tx - center.tx), Math.abs(tz - center.tz))
}

function colliderTilesAround(center: { tx: number; tz: number }, reach = TILE_REACH): ColliderTile[] {
  const out: ColliderTile[] = []
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

function wallKey(ax: number, az: number, bx: number, bz: number): string {
  const a = `${ax.toFixed(2)}:${az.toFixed(2)}`
  const b = `${bx.toFixed(2)}:${bz.toFixed(2)}`
  return a < b ? `${a}:${b}` : `${b}:${a}`
}
