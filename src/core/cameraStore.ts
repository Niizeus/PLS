import { create } from 'zustand'
import { getCameraTuning } from '../devtools/devTuningStore'

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
  /**
   * Met un mouvement souris (dx, dy en pixels) EN ATTENTE.
   * Il ne sera appliqué qu'au début de l'image suivante — voir `flushRotation`.
   */
  queueRotation: (dx: number, dy: number) => void
  /** Applique la souris accumulée. À appeler UNE seule fois par image. */
  flushRotation: () => void
}

// Axe vertical inversé : souris vers le haut → la vue baisse (façon pilotage d'avion).
// Passe à false pour revenir à l'autre sens.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 🖱️ Pourquoi la souris est mise en attente au lieu d'être appliquée tout de suite.
 *
 * Les événements souris n'arrivent PAS au rythme des images : une souris à
 * 125 Hz sur un jeu à 60 images/s livre parfois 2 événements sur une image et 1
 * sur la suivante. En appliquant chaque événement à l'arrivée, la rotation
 * avançait donc de 2 crans puis 1 cran puis 2 — une micro-saccade permanente,
 * indépendante du reste du jeu.
 *
 * On accumule donc les mouvements ici (hors du store, pour ne déclencher aucun
 * rendu React) et on les applique en UNE fois au début de chaque image.
 */
let pendingX = 0
let pendingY = 0

export const useCameraStore = create<CameraState>((set) => ({
  yaw: 0,
  pitch: 0.5,
  queueRotation: (dx, dy) => {
    pendingX += dx
    pendingY += dy
  },
  flushRotation: () => {
    if (pendingX === 0 && pendingY === 0) return
    const dx = pendingX
    const dy = pendingY
    pendingX = 0
    pendingY = 0
    const tuning = getCameraTuning()
    set((s) => ({
      yaw: s.yaw - dx * tuning.SENSITIVITY, // souris à droite → la vue tourne à droite
      pitch: clamp(
        s.pitch + (tuning.INVERT_Y >= 0.5 ? 1 : -1) * dy * tuning.SENSITIVITY,
        tuning.PITCH_MIN,
        tuning.PITCH_MAX,
      ),
    }))
  },
}))
