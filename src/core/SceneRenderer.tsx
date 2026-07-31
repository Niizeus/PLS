import { useFrame } from '@react-three/fiber'
import { FRAME } from './framePriority'
import { usePostProcessing } from './postfx/usePostProcessing'

/**
 * Rend l'image, en DERNIER.
 *
 * Depuis qu'on fixe l'ordre des `useFrame` (voir `framePriority.ts`), React
 * Three Fiber ne rend plus tout seul : il laisse la main dès qu'une priorité est
 * utilisée. Ce composant reprend simplement ce travail, à la toute fin de
 * l'image — donc après que le joueur ait bougé et que la caméra l'ait suivi.
 *
 * Depuis les contours de cell-shading, il ne dessine plus directement à l'écran :
 * il passe par la chaîne d'effets d'image (`postfx/usePostProcessing.ts`), qui
 * rend la scène puis la retouche. C'est le SEUL endroit du jeu qui déclenche un
 * rendu : deux appels et la scène est dessinée deux fois par image.
 */
export default function SceneRenderer() {
  const composer = usePostProcessing()

  useFrame((_, delta) => {
    // `delta` sert aux effets qui s'animent dans le temps (aucun pour l'instant,
    // mais un flou de vitesse ou un grain en auront besoin).
    composer.render(delta)
  }, FRAME.RENDER)

  return null
}
