import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { useCameraStore } from './cameraStore'

// Distance caméra ↔ joueur, et hauteur du point visé (un peu au-dessus des pieds).
const DISTANCE = 9
const LOOK_HEIGHT = 1.2

/**
 * Caméra 3e personne ORBITALE : elle tourne autour du joueur selon la souris
 * (yaw/pitch du cameraStore) et le suit en douceur.
 *
 * La caméra ne connaît pas Player directement : elle lit sa cible dans le store
 * (publiée par Player) → aucun branchement à faire dans GameCanvas.
 */
export default function FollowCamera() {
  const { camera } = useThree()
  const desiredPos = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())
  const target = usePlayerStore((s) => s.playerObject)

  useFrame((_, delta) => {
    if (!target) return

    // Orientation caméra pilotée à la souris (lue sans re-render, cf cameraStore).
    const { yaw, pitch } = useCameraStore.getState()

    // Position voulue : sur une sphère autour du joueur (derrière + au-dessus).
    const horiz = Math.cos(pitch) * DISTANCE
    desiredPos.current.set(
      target.position.x + Math.sin(yaw) * horiz,
      target.position.y + LOOK_HEIGHT + Math.sin(pitch) * DISTANCE,
      target.position.z + Math.cos(yaw) * horiz,
    )

    // Lerp encadré par le delta pour une poursuite fluide et stable (frame-rate independent).
    const smoothing = 1 - Math.pow(0.001, delta)
    camera.position.lerp(desiredPos.current, smoothing)

    // On regarde le joueur (un peu au-dessus de ses pieds).
    lookAt.current.copy(target.position)
    lookAt.current.y += LOOK_HEIGHT
    camera.lookAt(lookAt.current)
  })

  return null
}
