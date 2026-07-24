import { Canvas } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import Lights from './Lights'
import FollowCamera from './FollowCamera'
import TestGround from '../world/TestGround'
import Obstacles from '../world/Obstacles'
import Player from '../entities/player/Player'

/**
 * La scène 3D complète.
 *
 * Choix perf (voir recherche/plan) pour viser 60 FPS mini :
 *  - dpr borné [1, 2] : évite de rendre en 3x sur écrans très denses.
 *  - powerPreference 'high-performance' : demande le GPU dédié.
 *  - ombres activées mais une seule lumière projette (voir Lights).
 *  - fog : donne de la profondeur ET évite d'afficher trop loin.
 */
export default function GameCanvas() {
  // Réf du joueur, partagée entre Player (qui la remplit) et FollowCamera (qui la suit).
  const playerRef = useRef<THREE.Group>(null)

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 6, 9], fov: 50, near: 0.1, far: 200 }}
    >
      {/* Ciel gris-bleu façon Beauvais (climat océanique, cf docs/04). */}
      <color attach="background" args={['#aebfd4']} />
      <fog attach="fog" args={['#aebfd4', 45, 110]} />

      <Lights />

      <TestGround />
      <Obstacles />
      <Player groupRef={playerRef} />

      <FollowCamera targetRef={playerRef} />
    </Canvas>
  )
}
