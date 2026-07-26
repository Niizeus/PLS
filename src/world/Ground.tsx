import { useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../shaders/toonGradient'
import { BOUNDS } from './beauvais/cityData'

/**
 * 🟩 Le sol : un grand plan PLAT à l'altitude 0, couvrant toute la ville.
 *
 * Volontairement bête et méchant : pas de relief, pas de texture, une seule
 * couleur. C'est la référence de hauteur du jeu (voir `terrainHeight()` dans
 * cityData.ts, qui renvoie 0 lui aussi) → rien ne peut flotter ni s'enfoncer.
 */

const GROUND_COLOR = '#8a9470'
const MARGIN = 400 // marge autour de la ville, pour ne pas voir le bord du monde

export default function Ground() {
  const geometry = useMemo(() => {
    const w = BOUNDS.maxX - BOUNDS.minX + MARGIN * 2
    const d = BOUNDS.maxZ - BOUNDS.minZ + MARGIN * 2
    const g = new THREE.PlaneGeometry(w, d)
    g.rotateX(-Math.PI / 2) // le plan est vertical par défaut → on le couche
    g.translate((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2)
    return g
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial color={GROUND_COLOR} gradientMap={toonGradient} />
    </mesh>
  )
}
