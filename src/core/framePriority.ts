/**
 * ⏱️ ORDRE D'EXÉCUTION DES `useFrame`, à chaque image.
 *
 * ## Le problème que ça règle
 *
 * Par défaut, tous les `useFrame` tournent avec la priorité 0 : leur ordre est
 * alors l'ordre de MONTAGE des composants React. Autrement dit, il suffisait de
 * déplacer une ligne dans `GameCanvas.tsx` pour que la caméra soit calculée
 * AVANT le joueur — et donc qu'elle vise la position de l'image précédente.
 * Ce retard d'une image est invisible à pied, mais très visible à 200 km/h :
 * c'est une saccade proportionnelle à la vitesse.
 *
 * On fixe donc l'ordre explicitement : on lit les entrées, on simule, on place
 * ce qui est accroché au joueur, on positionne la caméra, et on rend.
 *
 * ⚠️ **Effet de bord à connaître** : dès qu'un `useFrame` a une priorité > 0,
 * React Three Fiber arrête de rendre automatiquement — il considère qu'on prend
 * la main sur la boucle. C'est pour ça que `SceneRenderer` existe et appelle
 * `gl.render()` lui-même, en dernier. Si tu supprimes toutes les priorités, il
 * faut aussi supprimer `SceneRenderer`, sinon la scène serait rendue deux fois.
 */
export const FRAME = {
  /** Entrées : on vide la file des mouvements souris accumulés. */
  INPUT: 0,
  /** Simulation : déplacement du joueur et conduite des véhicules. */
  LOGIC: 1,
  /** Visuels accrochés au joueur (la caisse du véhicule qu'il conduit). */
  ATTACHED: 2,
  /** Caméra : elle vise une position déjà à jour. */
  CAMERA: 3,
  /** Rendu de l'image. Toujours en dernier... */
  RENDER: 10,
  /**
   * ...sauf la capture photo du téléphone, qui doit lire le canvas WebGL juste
   * APRÈS le rendu et avant que le navigateur n'efface le tampon de dessin.
   * Voir `gameplay/phone/PhoneCameraCapture.tsx`.
   */
  CAPTURE: 11,
} as const
