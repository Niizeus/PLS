import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 🌤️  Ciel en dégradé (léger : une simple texture de fond, aucun objet 3D).
 *
 * On peint un dégradé vertical (bleu-gris en haut → clair à l'horizon) dans une
 * texture qu'on met en fond de scène. Le brouillard (voir GameCanvas) reprend la
 * couleur de l'horizon → la ville lointaine se fond dans le ciel. Beaucoup plus
 * "vivant" qu'un aplat gris, et ça ne coûte quasi rien.
 */

// Couleur du bas du dégradé = à reprendre pour le brouillard (voir GameCanvas).
export const HORIZON_COLOR = '#cdd6e0'
const SKY_TOP = '#8ea7c6'

function makeGradient(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, SKY_TOP)
  g.addColorStop(1, HORIZON_COLOR)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function GradientSky() {
  const { scene } = useThree()
  const texture = useMemo(makeGradient, [])
  useEffect(() => {
    const prev = scene.background
    scene.background = texture
    return () => {
      scene.background = prev
    }
  }, [scene, texture])
  return null
}
