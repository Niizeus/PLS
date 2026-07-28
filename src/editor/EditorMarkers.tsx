import * as THREE from 'three'
import { type MapMarker } from '../data/mapMarkers'
import { terrainHeight } from '../world/beauvais/cityData'

interface EditorMarkersProps {
  visible: boolean
  markers: MapMarker[]
  selectedMarkerId: string | null
}

function MarkerPin({ marker, selected }: { marker: MapMarker; selected: boolean }) {
  const color = new THREE.Color(marker.color)
  const y = terrainHeight(marker.position.x, marker.position.z) + 2.5

  return (
    <group position={[marker.position.x, y, marker.position.z]}>
      <mesh>
        <sphereGeometry args={[2.3, 18, 12]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      <mesh position={[0, -2.2, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[1.4, 4.2, 1.4]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[marker.interactionRadius, marker.interactionRadius + 0.25, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} depthTest={false} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[marker.interactionRadius + 1.1, marker.interactionRadius + 1.75, 48]} />
          <meshBasicMaterial color="#fff7dc" depthTest={false} />
        </mesh>
      )}
    </group>
  )
}

export default function EditorMarkers({ visible, markers, selectedMarkerId }: EditorMarkersProps) {
  if (!visible) return null
  return (
    <>
      {markers.filter((marker) => marker.visibleInGame || marker.devOnly).map((marker) => (
        <MarkerPin key={marker.id} marker={marker} selected={marker.id === selectedMarkerId} />
      ))}
    </>
  )
}
