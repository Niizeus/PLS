import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { buildingHeightAt } from '../world/beauvais/collision'
import { useCameraStore } from './cameraStore'

// Distance caméra ↔ joueur, et hauteur du point visé (un peu au-dessus des pieds).
const DISTANCE = 9
const LOOK_HEIGHT = 1.2
const MIN_DISTANCE = 1.8 // on ne colle pas la caméra pile sur le perso
const CAM_MARGIN = 0.4 // petite marge devant le mur

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

    // Point visé (au-dessus des pieds du perso) = origine du "rayon" caméra.
    const ox = target.position.x
    const oy = target.position.y + LOOK_HEIGHT
    const oz = target.position.z

    // Décalage (origine → position voulue de la caméra) : arrière (X/Z) + hauteur (Y).
    const horiz = Math.cos(pitch) * DISTANCE
    const dirX = Math.sin(yaw) * horiz
    const dirZ = Math.cos(yaw) * horiz
    const upY = Math.sin(pitch) * DISTANCE

    // COLLISION CAMÉRA : on avance du joueur vers la position voulue en testant si
    // un bâtiment (assez haut) bouche la vue ; si oui, on s'arrête juste avant.
    let dist = DISTANCE
    const steps = 14
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const sx = ox + dirX * t
      const sz = oz + dirZ * t
      const sy = oy + upY * t
      if (sy < buildingHeightAt(sx, sz) + 0.3) {
        // Un bâtiment dépasse la trajectoire de la caméra ici : on borne la distance.
        dist = Math.max(MIN_DISTANCE, DISTANCE * t - CAM_MARGIN)
        break
      }
    }

    const f = dist / DISTANCE
    desiredPos.current.set(ox + dirX * f, oy + upY * f, oz + dirZ * f)

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
