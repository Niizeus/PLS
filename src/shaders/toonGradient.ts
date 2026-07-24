import * as THREE from 'three'

/**
 * Fabrique la "gradient map" utilisée par MeshToonMaterial.
 *
 * Le principe du cell-shading : au lieu d'un éclairage lisse, la lumière est
 * découpée en quelques PALIERS (ici 3-4). Cette texture 1D de N pixels dit à
 * Three.js "voici les N niveaux de luminosité autorisés". Filtre Nearest =
 * pas de dégradé entre les paliers → transitions nettes façon BD.
 *
 * On la crée UNE fois et on la réutilise partout (économie mémoire + draw calls).
 */
export function makeToonGradient(steps = 4): THREE.DataTexture {
  const colors = new Uint8Array(steps)
  for (let i = 0; i < steps; i++) {
    // Réparti du sombre au clair : 0, 85, 170, 255 pour 4 paliers.
    colors[i] = Math.round((i / (steps - 1)) * 255)
  }

  const texture = new THREE.DataTexture(colors, steps, 1, THREE.RedFormat)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

// Instance partagée : importe `toonGradient` et passe-le à tes MeshToonMaterial.
export const toonGradient = makeToonGradient(4)
