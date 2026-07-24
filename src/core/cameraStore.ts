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

// Bornes du pitch : on empêche de passer sous l'horizon ou au-dessus du perso.
export const PITCH_MIN = 0.15
export const PITCH_MAX = 1.2

interface CameraState {
  yaw: number
  pitch: number
  /** Applique un déplacement souris (dx, dy en pixels) à l'orientation. */
  rotate: (dx: number, dy: number) => void
}

const SENSITIVITY = 0.0025 // radians par pixel de souris

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const useCameraStore = create<CameraState>((set) => ({
  yaw: 0,
  pitch: 0.5,
  rotate: (dx, dy) =>
    set((s) => ({
      yaw: s.yaw - dx * SENSITIVITY, // souris à droite → la vue tourne à droite
      pitch: clamp(s.pitch - dy * SENSITIVITY, PITCH_MIN, PITCH_MAX), // souris vers le haut → on lève la vue
    })),
}))
