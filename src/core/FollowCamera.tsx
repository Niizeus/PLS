import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { usePlayerStore } from '../gameplay/stats/playerStore'

// Décalage de la caméra par rapport au joueur : derrière (Z+) et au-dessus (Y+).
const OFFSET = new THREE.Vector3(0, 6, 9)
// Point visé légèrement au-dessus des pieds du perso.
const LOOK_HEIGHT = 1.2

/**
 * Caméra 3e personne qui suit le joueur en douceur (lerp).
 * Vue fixe derrière le perso : le déplacement "vers le haut" à l'écran = tout droit.
 *
 * La caméra ne connaît pas Player directement : elle lit sa cible dans le store
 * (publiée par Player). Résultat : aucun branchement à faire dans GameCanvas.
 */
export default function FollowCamera() {
  const { camera } = useThree()
  const desiredPos = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())
  const target = usePlayerStore((s) => s.playerObject)

  useFrame((_, delta) => {
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
