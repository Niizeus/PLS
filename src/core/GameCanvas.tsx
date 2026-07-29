import { Canvas } from '@react-three/fiber'
import Lights from './Lights'
import FollowCamera from './FollowCamera'
import SceneRenderer from './SceneRenderer'
import DynamicSky from './DynamicSky'
import TimeFog from './TimeFog'
import World from '../world/World'
import Characters from '../entities/Characters'
import PhysicsRoot from '../gameplay/physics/PhysicsRoot'
import WorldBuildingColliders from '../gameplay/physics/WorldBuildingColliders'
import WorldPhysicsColliders from '../gameplay/physics/WorldPhysicsColliders'

/**
 * La scène 3D complète.
 *
 * Ce fichier est volontairement STABLE : il ne fait qu'assembler quelques gros
 * blocs (le monde, les persos, la lumière, la caméra). On y touche presque
 * jamais → c'est ce qui évite que tout le monde se marche dessus ici.
 *  - Pour ajouter au MONDE  → src/world/World.tsx
 *  - Pour ajouter un PERSO  → src/entities/Characters.tsx
 * Les blocs communiquent via le store (ex : la caméra suit le joueur sans
 * qu'on ait à les brancher ici). Voir docs/02-ARCHITECTURE.md.
 *
 * Choix perf (voir recherche/plan) pour viser 60 FPS mini :
 *  - dpr borné [1, 2] : évite de rendre en 3x sur écrans très denses.
 *  - powerPreference 'high-performance' : demande le GPU dédié.
 *  - ombres activées mais une seule lumière projette (voir Lights).
 *  - fog : donne de la profondeur ET évite d'afficher trop loin.
 */
export default function GameCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 5, 8], fov: 55, near: 0.1, far: 950 }}
    >
      {/* Ciel dynamique + brouillard assorti à l'horizon (climat océanique, cf docs/04). */}
      <DynamicSky />
      <TimeFog />

      <Lights />

      <PhysicsRoot>
        <World />
        <WorldPhysicsColliders />
        <WorldBuildingColliders />
        <Characters />
      </PhysicsRoot>

      <FollowCamera />

      {/* Rend l'image en dernier — voir core/framePriority.ts. */}
      <SceneRenderer />
    </Canvas>
  )
}
