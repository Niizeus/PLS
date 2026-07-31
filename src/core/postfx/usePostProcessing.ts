import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer, EffectPass, RenderPass } from 'postprocessing'
import { ToonOutlineEffect } from './ToonOutlineEffect'

/**
 * 🎞️ La CHAÎNE D'EFFETS d'image, montée une fois pour toute la partie.
 *
 * Au lieu de dessiner la scène directement à l'écran, on la dessine dans une
 * image en mémoire, on la retouche, et on affiche le résultat. C'est ce qui
 * permet des effets qui ont besoin de voir l'image ENTIÈRE : le trait noir du
 * cell-shading aujourd'hui, et demain ce qu'on voudra (flou de vitesse quand on
 * roule, poussée de couleurs, virage nocturne, écran de dégâts...).
 *
 * ## Ajouter un effet plus tard
 *
 * Un seul endroit à toucher : la liste passée à `EffectPass` ci-dessous. Un
 * `EffectPass` sait FUSIONNER plusieurs effets en un seul shader — donc empiler
 * trois effets dans le même `EffectPass` coûte bien moins cher que trois passes
 * séparées. Garde-les groupés tant qu'ils n'ont pas besoin du résultat l'un de
 * l'autre.
 *
 * ## ⚠️ Qui a le droit d'appeler `render()`
 *
 * Une seule chose rend l'image, et c'est `SceneRenderer` (voir
 * `core/framePriority.ts`). Ce hook FABRIQUE le composer, il ne le déclenche
 * jamais. Si un jour deux composants appellent `render()`, la scène est dessinée
 * deux fois et le compteur de FPS s'effondre sans raison visible.
 */
export function usePostProcessing(): EffectComposer {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const composer = useMemo(() => {
    const composer = new EffectComposer(gl, {
      // Le canvas était en `antialias: true`, mais cette option ne vaut que
      // pour un rendu direct à l'écran : dès qu'on passe par une image
      // intermédiaire, c'est ELLE qui doit être multi-échantillonnée. Sans ça,
      // tous les bords redeviennent en escalier.
      multisampling: Math.min(4, gl.capabilities.maxSamples),
      // Une image en 8 bits par canal suffit pour afficher, pas pour calculer :
      // les couleurs y sont déjà écrasées et les retouches créent des bandes
      // dans les dégradés du ciel. En demi-flottant, on garde de la marge.
      frameBufferType: THREE.HalfFloatType,
    })

    // 1. On dessine la scène normalement (c'est aussi elle qui remplit le
    //    tampon de profondeur dont le contour a besoin).
    composer.addPass(new RenderPass(scene, camera))

    // 2. On retouche l'image. Les effets suivants viendront ici, dans la même
    //    passe (voir plus haut).
    composer.addPass(new EffectPass(camera, new ToonOutlineEffect()))

    return composer
  }, [gl, scene, camera])

  // Redimensionnement : on lui repasse la taille CSS du canvas, il en déduit
  // tout seul la taille réelle des images en tenant compte du `dpr`.
  useEffect(() => {
    composer.setSize(size.width, size.height)
  }, [composer, size, dpr])

  // Les images intermédiaires vivent sur la carte graphique : si on ne les rend
  // pas, elles restent allouées après un changement de scène.
  useEffect(() => () => composer.dispose(), [composer])

  return composer
}
