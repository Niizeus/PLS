import { Grid } from '@react-three/drei'
import { toonGradient } from '../shaders/toonGradient'

/**
 * Sol du playground (provisoire — remplacera Beauvais plus tard).
 * - Un grand plan qui reçoit les ombres, en matériau toon.
 * - Une grille par-dessus pour bien SENTIR le déplacement et l'échelle.
 */
export default function TestGround() {
  return (
    <group>
      {/* Le plan physique qui reçoit les ombres. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshToonMaterial color="#7cae7a" gradientMap={toonGradient} />
      </mesh>

      {/* Grille de repère (drei) : légère, purement visuelle. */}
      <Grid
        args={[200, 200]}
        cellSize={2}
        cellThickness={1}
        cellColor="#5f8f5d"
        sectionSize={10}
        sectionThickness={1.5}
        sectionColor="#3f6f4d"
        fadeDistance={70}
        fadeStrength={1.5}
        followCamera={false}
        infiniteGrid
        // Légèrement au-dessus du sol pour éviter le z-fighting avec le plan.
        position={[0, 0.01, 0]}
      />
    </group>
  )
}
