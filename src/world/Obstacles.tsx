import { Outlines, Instances, Instance } from '@react-three/drei'
import { useMemo } from 'react'
import { toonGradient } from '../shaders/toonGradient'

/**
 * Décor de test : quelques "bâtiments" repères + un champ de plots.
 *
 * Deux techniques montrées ici, utiles pour Beauvais plus tard :
 * 1) BÂTIMENTS REPÈRES : boîtes toon avec contour <Outlines> (le look BD net).
 * 2) CHAMP DE PLOTS : <Instances> = des centaines d'objets en UN SEUL draw call.
 *    C'est LA technique clé pour tenir 60 FPS avec beaucoup d'objets identiques
 *    (arbres, lampadaires, poubelles... voir docs/04-MONDE-BEAUVAIS.md).
 */

// Position + couleur des gros repères, posés autour du spawn.
const LANDMARKS: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [
  { pos: [-8, 1.5, -6], size: [3, 3, 3], color: '#e8734a' },
  { pos: [7, 2.5, -10], size: [4, 5, 4], color: '#4a90e8' },
  { pos: [12, 1, 4], size: [2, 2, 6], color: '#e8c54a' },
  { pos: [-12, 2, 8], size: [5, 4, 3], color: '#a24ae8' },
]

export default function Obstacles() {
  // On calcule une fois les positions du champ de plots (grille clairsemée).
  const pillars = useMemo(() => {
    const list: { pos: [number, number, number]; color: string }[] = []
    const palette = ['#f26d6d', '#6df2a0', '#6da8f2', '#f2d16d']
    for (let x = -18; x <= 18; x += 6) {
      for (let z = -18; z <= 18; z += 6) {
        // On laisse le centre dégagé pour le joueur.
        if (Math.abs(x) < 6 && Math.abs(z) < 6) continue
        list.push({ pos: [x, 0.5, z], color: palette[(Math.abs(x + z) / 6) % palette.length | 0] })
      }
    }
    return list
  }, [])

  return (
    <group>
      {/* 1) Bâtiments repères avec contour BD. */}
      {LANDMARKS.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow receiveShadow>
          <boxGeometry args={b.size} />
          <meshToonMaterial color={b.color} gradientMap={toonGradient} />
          <Outlines thickness={0.04} color="#1a1a1a" />
        </mesh>
      ))}

      {/* 2) Champ de plots instanciés : 1 géométrie + 1 matériau pour tous. */}
      <Instances castShadow receiveShadow limit={200}>
        <boxGeometry args={[1, 1, 1]} />
        <meshToonMaterial gradientMap={toonGradient} />
        {pillars.map((p, i) => (
          <Instance key={i} position={p.pos} color={p.color} />
        ))}
      </Instances>
    </group>
  )
}
