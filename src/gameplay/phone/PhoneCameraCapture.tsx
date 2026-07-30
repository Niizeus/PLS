import { useFrame } from '@react-three/fiber'
import { FRAME } from '../../core/framePriority'
import { usePlayerStore } from '../stats/playerStore'
import { formatGameTime, getDayName, useGameTimeStore } from '../time/gameTimeStore'
import { usePhotoStore } from './photoStore'

/**
 * 📷 Prend la photo demandée par l'app Photo du téléphone.
 *
 * ── Pourquoi ce composant vit DANS le Canvas ─────────────────────────────────
 * Pour photographier la 3D, il faut lire le canvas WebGL... mais **son contenu
 * est effacé dès que le navigateur a affiché l'image** (on ne demande pas
 * `preserveDrawingBuffer`, qui coûte des perfs à chaque image pour un usage
 * ponctuel). La seule fenêtre où le pixel est encore lisible, c'est **juste
 * après `gl.render()`, dans la même image**. D'où la priorité `FRAME.CAPTURE`,
 * qui passe immédiatement après `SceneRenderer` (voir `core/framePriority.ts`).
 *
 * Le HUD et le téléphone étant du DOM (et pas de la 3D), ils n'apparaissent pas
 * sur la photo : on garde la vue du jeu, proprement.
 */

/** Largeur des photos enregistrées. Assez pour être jolies, assez léger en RAM. */
const PHOTO_WIDTH = 360

export default function PhoneCameraCapture() {
  useFrame(({ gl }) => {
    if (!usePhotoStore.getState().shotQueued) return

    const source = gl.domElement
    const width = PHOTO_WIDTH
    const height = Math.round((PHOTO_WIDTH * source.height) / source.width)

    const target = document.createElement('canvas')
    target.width = width
    target.height = height
    const ctx = target.getContext('2d')
    if (!ctx) {
      // Pas de contexte 2D (cas très rare) : on annule proprement la demande,
      // sinon on retenterait à chaque image.
      usePhotoStore.setState({ shotQueued: false })
      return
    }
    ctx.drawImage(source, 0, 0, width, height)

    const minutes = useGameTimeStore.getState().totalMinutes
    usePhotoStore.getState().addPhoto({
      dataUrl: target.toDataURL('image/jpeg', 0.72),
      timeLabel: `${getDayName(minutes)} ${formatGameTime(minutes)}`,
      place: usePlayerStore.getState().zoneName ?? 'Beauvais',
    })
  }, FRAME.CAPTURE)

  return null
}
