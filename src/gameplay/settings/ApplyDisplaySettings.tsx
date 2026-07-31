import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'

/**
 * 💡 Applique les réglages d'IMAGE au rendu.
 *
 * Pour l'instant : la luminosité, posée en filtre CSS sur le canvas WebGL.
 *
 * ── Pourquoi un filtre CSS et pas une exposition 3D ────────────────────────
 * Régler l'exposition du moteur (`toneMappingExposure`) changerait l'éclairage
 * de la scène : les couleurs cartoon, le ciel et le brouillard sont calibrés
 * ensemble, on ne veut PAS que le joueur puisse les déséquilibrer. La
 * luminosité est un réglage d'**écran**, pas d'ambiance : le filtre CSS agit
 * sur l'image finie, exactement comme le bouton de ton moniteur.
 *
 * Ce composant ne rend rien : il ne fait que suivre le store.
 */
export default function ApplyDisplaySettings() {
  const brightness = useSettingsStore((s) => s.brightness)

  useEffect(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    // `none` plutôt que `brightness(1)` : à 1, on retire complètement le filtre
    // pour ne pas forcer le navigateur à composer une couche pour rien.
    canvas.style.filter = brightness === 1 ? 'none' : `brightness(${brightness})`
  }, [brightness])

  return null
}
