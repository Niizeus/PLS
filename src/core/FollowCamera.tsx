import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'

interface FollowCameraProps {
  /** Le groupe 3D du joueur, que la caméra doit suivre. */
  targetRef: RefObject<THREE.Group>
}

// Décalage de la caméra par rapport au joueur : derrière (Z+) et au-dessus (Y+).
const OFFSET = new THREE.Vector3(0, 6, 9)
// Point visé légèrement au-dessus des pieds du perso.
const LOOK_HEIGHT = 1.2

/**
 * Caméra 3e personne qui suit le joueur en douceur (lerp).
 * Vue fixe derrière le perso : le déplacement "vers le haut" à l'écran = tout droit.
 */
export default function FollowCamera({ targetRef }: FollowCameraProps) {
  const { camera } = useThree()
  const desiredPos = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    const target = targetRef.current
    if (!target) return

    // Position voulue = position du joueur + décalage.
    desiredPos.current.copy(target.position).add(OFFSET)
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
