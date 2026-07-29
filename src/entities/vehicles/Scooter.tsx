import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { groundHeight } from '../../world/beauvais/roadway'
import { useScooterStore } from './scooterStore'
import { FRAME } from '../../core/framePriority'
import { getVehicleTuning } from '../../devtools/devTuningStore'
import { SCOOTER_COLORS } from './scooterConfig'

/**
 * Le scooter (placeholder cartoon en primitives).
 *
 * Il ne se conduit pas lui-même : c'est la logique du joueur (usePlayerMovement)
 * qui le pilote. Ici on se contente de le PLACER au bon endroit chaque frame :
 *  - garé : à sa position de parking (scooterStore) ;
 *  - conduit : sous le joueur, à sa position et son orientation.
 * Il pointe vers -Z (comme "l'avant" du joueur).
 */
export default function Scooter() {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { riding, parkedX, parkedZ, parkedRot } = useScooterStore.getState()

    if (riding) {
      const player = usePlayerStore.getState().playerObject
      if (player) {
        g.position.set(player.position.x, player.position.y - getVehicleTuning('scooter').SEAT_HEIGHT, player.position.z)
        g.rotation.y = player.rotation.y
      }
    } else {
      g.position.set(parkedX, groundHeight(parkedX, parkedZ), parkedZ)
      g.rotation.y = parkedRot
    }
    // ATTACHED : on lit la position du joueur, donc APRES qu'il ait bouge.
  }, FRAME.ATTACHED)

  const outline = <Outlines thickness={0.03} color="#1a1a1a" />

  return (
    <group ref={group}>
      {/* Groupe interne pivoté de 180° : met le guidon À L'AVANT (sens de la marche). */}
      <group rotation={[0, Math.PI, 0]}>
      {/* Plateau / marchepied */}
      <mesh position={[0, 0.32, 0.05]} castShadow>
        <boxGeometry args={[0.34, 0.12, 1.15]} />
        <meshToonMaterial color={SCOOTER_COLORS.body} gradientMap={toonGradient} />
        {outline}
      </mesh>

      {/* Tablier avant (bouclier) */}
      <mesh position={[0, 0.6, -0.5]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.36, 0.5, 0.1]} />
        <meshToonMaterial color={SCOOTER_COLORS.body} gradientMap={toonGradient} />
        {outline}
      </mesh>

      {/* Colonne de direction */}
      <mesh position={[0, 0.85, -0.52]} castShadow>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshToonMaterial color={SCOOTER_COLORS.metal} gradientMap={toonGradient} />
        {outline}
      </mesh>

      {/* Guidon */}
      <mesh position={[0, 1.08, -0.52]} castShadow>
        <boxGeometry args={[0.55, 0.06, 0.06]} />
        <meshToonMaterial color={SCOOTER_COLORS.metal} gradientMap={toonGradient} />
        {outline}
      </mesh>

      {/* Selle */}
      <mesh position={[0, 0.6, 0.4]} castShadow>
        <boxGeometry args={[0.3, 0.14, 0.5]} />
        <meshToonMaterial color={SCOOTER_COLORS.seat} gradientMap={toonGradient} />
        {outline}
      </mesh>

      {/* Roue avant (axe le long de X → elle roule vers l'avant) */}
      <mesh position={[0, 0.24, -0.52]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.12, 18]} />
        <meshToonMaterial color={SCOOTER_COLORS.wheel} gradientMap={toonGradient} />
      </mesh>

      {/* Roue arrière */}
      <mesh position={[0, 0.24, 0.5]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.12, 18]} />
        <meshToonMaterial color={SCOOTER_COLORS.wheel} gradientMap={toonGradient} />
      </mesh>
      </group>
    </group>
  )
}
