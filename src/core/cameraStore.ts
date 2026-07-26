import { create } from 'zustand'

/**
 * Orientation de la caméra 3e personne, pilotée à la souris.
 *
 * - `yaw`   : rotation horizontale (tourner autour du perso).
 * - `pitch` : inclinaison verticale (regarder plus ou moins d'en haut).
 *
 * ⚠️ On lit ces valeurs dans des boucles useFrame (caméra ET déplacement du perso,
 * qui doit être "relatif à la caméra"). Pour ne PAS déclencher de re-render React à
 * chaque mouvement de souris, on lit via `useCameraStore.getState()` dans useFrame,
 * jamais via le hook réactif. C'est le même principe que le store du joueur.
 */

/**
 * Bornes du pitch.
 *
 * `pitch` est la hauteur de la caméra AU-DESSUS du perso : grand = vue plongeante,
 * petit = vue rasante. L'ancien plancher (0,15 rad ≈ 9°) gardait donc toujours la
 * caméra au-dessus de l'épaule, regard légèrement vers le bas — **impossible de
 * lever les yeux**, ni vers le ciel ni vers le haut de la cathédrale.
 *
 * On descend maintenant en NÉGATIF : la caméra passe sous la ligne des yeux et la
 * vue se redresse. Deux garde-fous vont avec, dans `FollowCamera.tsx` : la caméra
 * ne s'enfonce jamais dans le sol, et le point visé monte à mesure qu'on lève les
 * yeux (sans ça, sur terrain plat, le sol bloquerait tout le mouvement).
 */
export const PITCH_MIN = -0.45 // ≈ -26° : on regarde vers le haut
export const PITCH_MAX = 1.35 // ≈ 77° : vue quasi verticale

interface CameraState {
  yaw: number
  pitch: number
  /** Applique un déplacement souris (dx, dy en pixels) à l'orientation. */
  rotate: (dx: number, dy: number) => void
}

const SENSITIVITY = 0.0025 // radians par pixel de souris
// Axe vertical inversé : souris vers le haut → la vue baisse (façon pilotage d'avion).
// Passe à false pour revenir à l'autre sens.
const INVERT_Y = true

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const useCameraStore = create<CameraState>((set) => ({
  yaw: 0,
  pitch: 0.5,
  rotate: (dx, dy) =>
    set((s) => ({
      yaw: s.yaw - dx * SENSITIVITY, // souris à droite → la vue tourne à droite
      pitch: clamp(s.pitch + (INVERT_Y ? 1 : -1) * dy * SENSITIVITY, PITCH_MIN, PITCH_MAX),
    })),
}))
