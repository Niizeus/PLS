import { useEffect, useMemo } from 'react'
import { toonGradient } from '../../shaders/toonGradient'
import { buildCathedral } from './cathedralMesh'

/**
 * ⛪ La cathédrale Saint-Pierre, seul bâtiment de Beauvais à avoir son propre modèle.
 *
 * Deux différences avec le reste de la ville (`Beauvais.tsx`) :
 *
 *  1. Sa géométrie est construite par `cathedralMesh.ts` au lieu du gabarit
 *     « murs + toit » commun. `Beauvais.tsx` saute donc ce bâtiment — sinon on
 *     aurait deux volumes l'un dans l'autre.
 *  2. Elle n'est PAS découpée en tuiles : elle est affichée en permanence. C'est
 *     le repère central de la carte, on doit la voir depuis l'autre bout de la
 *     ville — et ça ne coûte qu'un seul objet à dessiner.
 *
 * ⚠️ Le montage doit se faire APRÈS le chargement du relief (World.tsx s'en
 * charge) : le modèle lit `terrainHeight()` une seule fois, au montage.
 */
export default function Cathedral() {
  const geometry = useMemo(() => buildCathedral(), [])

  // Libère la mémoire GPU si le composant disparaît (rechargement à chaud).
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshToonMaterial vertexColors gradientMap={toonGradient} />
    </mesh>
  )
}
