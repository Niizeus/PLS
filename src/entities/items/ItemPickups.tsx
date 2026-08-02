import { Outlines } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { ITEM_DEFINITIONS, ITEMS_BY_ID, type ItemCategory } from '../../data/items'
import { KEY } from '../../gameplay/input/keyMap'
import { usePendingPlacementStore } from '../../gameplay/inventory/pendingPlacementStore'
import { usePickupStore, type WorldPickup } from '../../gameplay/inventory/pickupStore'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { toonGradient } from '../../shaders/toonGradient'
import { isBlocked } from '../../world/beauvais/collision'
import { SPAWN } from '../../world/beauvais/cityData'
import { groundHeight } from '../../world/beauvais/roadway'

const PICKUP_RANGE = 3

const placePickup = (id: string, itemId: string, quantity: number, dx: number, dz: number): WorldPickup => {
  const baseX = SPAWN.x + dx
  const baseZ = SPAWN.z + dz
  if (!isBlocked(baseX, baseZ)) return { id, itemId, quantity, x: baseX, z: baseZ }

  for (let radius = 2; radius <= 10; radius += 2) {
    for (let step = 0; step < 12; step++) {
      const angle = (step / 12) * Math.PI * 2
      const x = baseX + Math.cos(angle) * radius
      const z = baseZ + Math.sin(angle) * radius
      if (!isBlocked(x, z)) return { id, itemId, quantity, x, z }
    }
  }

  return { id, itemId, quantity, x: SPAWN.x, z: SPAWN.z - 6 }
}

const STATIC_PICKUPS: WorldPickup[] = [
  placePickup('spawn-kebab', 'kebab-chef', 1, -4, 1.5),
  placePickup('spawn-soda', 'soda-market', 1, -4.8, -4.5),
  placePickup('spawn-doliprane', 'doliprane', 1, -6.5, -2),
  placePickup('spawn-cendrier', 'cendrier', 2, 0.5, 5.2),
  placePickup('spawn-gilet', 'gilet-fluo', 1, -8.2, 4),
]

const TEST_PICKUP_COLS = 6
const TEST_PICKUP_SPACING = 2.6
const TEST_PICKUP_START_DX = -6.5
const TEST_PICKUP_START_DZ = 9

const TEST_PICKUPS: WorldPickup[] = ITEM_DEFINITIONS.map((item, index) => {
  const col = index % TEST_PICKUP_COLS
  const row = Math.floor(index / TEST_PICKUP_COLS)
  const quantity = item.stackable ? Math.min(3, item.maxStack ?? 3) : 1

  return placePickup(
    `test-item-${item.id}`,
    item.id,
    quantity,
    TEST_PICKUP_START_DX + col * TEST_PICKUP_SPACING,
    TEST_PICKUP_START_DZ + row * TEST_PICKUP_SPACING,
  )
})

const isTestPickup = (pickupId: string) => pickupId.startsWith('test-item-')

const PICKUP_COLOR: Record<ItemCategory, string> = {
  arme: '#f97316',
  arme_lancer: '#94a3b8',
  consommable_nourriture: '#22c55e',
  consommable_boisson: '#38bdf8',
  consommable_chelou: '#a855f7',
  alcool: '#facc15',
  armure_tete: '#fb7185',
  armure_torse: '#60a5fa',
  armure_bras: '#e879f9',
  armure_jambes: '#818cf8',
  vehicule: '#ef4444',
}

export default function ItemPickups() {
  const collectedIds = usePickupStore((s) => s.collectedIds)
  const droppedPickups = usePickupStore((s) => s.droppedPickups)
  const setNearbyPickup = usePickupStore((s) => s.setNearbyPickup)
  const collectPickup = usePickupStore((s) => s.collectPickup)

  const activePickups = useMemo(
    () => [
      ...STATIC_PICKUPS.filter((pickup) => !collectedIds.includes(pickup.id)),
      ...TEST_PICKUPS,
      ...droppedPickups,
    ],
    [collectedIds, droppedPickups],
  )

  useFrame(({ clock }) => {
    const player = usePlayerStore.getState().playerObject
    if (!player) return

    let nearest: WorldPickup | null = null
    let nearestDistanceSq = PICKUP_RANGE * PICKUP_RANGE

    for (const pickup of activePickups) {
      const dx = player.position.x - pickup.x
      const dz = player.position.z - pickup.z
      const distanceSq = dx * dx + dz * dz
      if (distanceSq <= nearestDistanceSq) {
        nearest = pickup
        nearestDistanceSq = distanceSq
      }
    }

    if (!nearest) {
      if (usePickupStore.getState().nearbyPickup) setNearbyPickup(null)
      return
    }

    const item = ITEMS_BY_ID[nearest.itemId]
    if (!item) return
    const currentNearby = usePickupStore.getState().nearbyPickup
    if (currentNearby?.pickupId !== nearest.id) {
      setNearbyPickup({ pickupId: nearest.id, itemId: nearest.itemId, itemName: item.name, quantity: nearest.quantity })
    }

    const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.08
    document.documentElement.style.setProperty('--pls-pickup-pulse', String(pulse))
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== KEY.INTERACT || event.repeat) return
      if (document.body.dataset.plsInventoryOpen === 'true') return
      const nearby = usePickupStore.getState().nearbyPickup
      if (!nearby) return

      const pickup = activePickups.find((candidate) => candidate.id === nearby.pickupId)
      if (!pickup || (!isTestPickup(pickup.id) && usePickupStore.getState().collectedIds.includes(pickup.id))) return

      // ⚠️ On ne RANGE pas l'objet ici : on le met « en main » et le sac s'ouvre.
      // C'est le joueur qui lui trouve une place (voir pendingPlacementStore).
      // L'objet reste donc dans le monde tant qu'il n'est pas posé.
      usePendingPlacementStore.getState().startPlacement({
        itemId: pickup.itemId,
        quantity: pickup.quantity,
        pickupId: pickup.id,
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activePickups, collectPickup])

  return (
    <>
      {activePickups.map((pickup) => {
        const item = ITEMS_BY_ID[pickup.itemId]
        if (!item) return null
        return (
          <group key={pickup.id} position={[pickup.x, groundHeight(pickup.x, pickup.z) + 0.55, pickup.z]}>
            <mesh castShadow>
              <boxGeometry args={[0.65, 0.65, 0.65]} />
              <meshToonMaterial color={PICKUP_COLOR[item.category]} gradientMap={toonGradient} />
              <Outlines thickness={0.035} color="#161616" />
            </mesh>
            <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 4, 0]}>
              <boxGeometry args={[0.16, 0.16, 0.16]} />
              <meshToonMaterial color="#f8fafc" gradientMap={toonGradient} />
              <Outlines thickness={0.025} color="#161616" />
            </mesh>
          </group>
        )
      })}
    </>
  )
}
