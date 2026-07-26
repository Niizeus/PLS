import { useFrame } from '@react-three/fiber'
import { FRAME } from './framePriority'

/**
 * Rend l'image, en DERNIER.
 *
 * Depuis qu'on fixe l'ordre des `useFrame` (voir `framePriority.ts`), React
 * Three Fiber ne rend plus tout seul : il laisse la main dès qu'une priorité est
 * utilisée. Ce composant reprend simplement ce travail, à la toute fin de
 * l'image — donc après que le joueur ait bougé et que la caméra l'ait suivi.
 */
export default function SceneRenderer() {
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera)
  }, FRAME.RENDER)

  return null
}
