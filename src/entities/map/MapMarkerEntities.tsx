import { Outlines } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MAP_MARKERS, type MapMarker } from '../../data/mapMarkers'
import { KEY } from '../../gameplay/input/keyMap'
import { getMapMarkerAvailability, isRuntimeMapMarker, formatMarkerAction } from '../../gameplay/map/mapMarkerRuntime'
import { useMapMarkerStore } from '../../gameplay/map/mapMarkerStore'
import { useGameTimeStore } from '../../gameplay/time/gameTimeStore'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { toonGradient } from '../../shaders/toonGradient'
import { groundHeight } from '../../world/beauvais/roadway'

const PIN_HEIGHT = 3.4
const PULSE_CSS_VAR = '--pls-poi-pulse'

function MarkerPin({ marker }: { marker: MapMarker }) {
  const color = useMemo(() => new THREE.Color(marker.color), [marker.color])
  const y = groundHeight(marker.position.x, marker.position.z) + 1.6

  return (
    <group position={[marker.position.x, y, marker.position.z]}>
      <mesh castShadow>
        <sphereGeometry args={[0.75, 18, 12]} />
        <meshToonMaterial color={color} gradientMap={toonGradient} />
        <Outlines thickness={0.035} color="#171717" />
      </mesh>
      <mesh position={[0, -1.05, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[0.35, PIN_HEIGHT, 0.35]} />
        <meshToonMaterial color={color} gradientMap={toonGradient} />
        <Outlines thickness={0.025} color="#171717" />
      </mesh>
      <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[marker.interactionRadius, marker.interactionRadius + 0.08, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} depthTest={false} />
      </mesh>
    </group>
  )
}

export default function MapMarkerEntities() {
  const visibleMarkers = useMemo(() => MAP_MARKERS.filter(isRuntimeMapMarker), [])
  const setNearbyMarker = useMapMarkerStore((state) => state.setNearbyMarker)
  const showInteractionMessage = useMapMarkerStore((state) => state.showInteractionMessage)

  useFrame(({ clock }) => {
    const player = usePlayerStore.getState().playerObject
    if (!player) return

    const totalMinutes = useGameTimeStore.getState().totalMinutes
    let nearest: MapMarker | null = null
    let nearestDistance = Infinity

    for (const marker of visibleMarkers) {
      const dx = player.position.x - marker.position.x
      const dz = player.position.z - marker.position.z
      const distance = Math.hypot(dx, dz)
      if (distance <= marker.interactionRadius && distance < nearestDistance) {
        nearest = marker
        nearestDistance = distance
      }
    }

    if (!nearest) {
      if (useMapMarkerStore.getState().nearbyMarker) setNearbyMarker(null)
      return
    }

    const availability = getMapMarkerAvailability(nearest, totalMinutes)
    const current = useMapMarkerStore.getState().nearbyMarker
    if (
      current?.marker.id !== nearest.id ||
      current.availability.isOpen !== availability.isOpen ||
      current.availability.label !== availability.label
    ) {
      setNearbyMarker({ marker: nearest, distance: nearestDistance, availability })
    }

    const pulse = 1 + Math.sin(clock.elapsedTime * 4.2) * 0.06
    document.documentElement.style.setProperty(PULSE_CSS_VAR, String(pulse))
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== KEY.INTERACT || event.repeat) return
      if (document.body.dataset.plsInventoryOpen === 'true') return
      const nearby = useMapMarkerStore.getState().nearbyMarker
      if (!nearby) return

      showInteractionMessage(formatMarkerAction(nearby.marker, nearby.availability))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showInteractionMessage])

  return (
    <>
      {visibleMarkers.map((marker) => (
        <MarkerPin key={marker.id} marker={marker} />
      ))}
    </>
  )
}
