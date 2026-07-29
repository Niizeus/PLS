import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { groundHeight } from '../../world/beauvais/roadway'
import { FRAME } from '../../core/framePriority'
import { getVehicleTuning } from '../../devtools/devTuningStore'
import { CAR_COLORS } from './carConfig'
import { useCarStore } from './carStore'

/** Voiture prototype en primitives, pensee comme repere d'echelle et test de conduite. */
export default function Car() {
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { riding, parkedX, parkedZ, parkedRot } = useCarStore.getState()

    if (riding) {
      const player = usePlayerStore.getState().playerObject
      if (player) {
        g.position.set(player.position.x, player.position.y - getVehicleTuning('car').SEAT_HEIGHT, player.position.z)
        g.rotation.y = player.rotation.y
      }
    } else {
      g.position.set(parkedX, groundHeight(parkedX, parkedZ), parkedZ)
      g.rotation.y = parkedRot
    }
    // ATTACHED : on lit la position du joueur, donc APRES qu'il ait bouge.
  }, FRAME.ATTACHED)

  const outline = <Outlines thickness={0.035} color="#17171d" />

  return (
    <group ref={group}>
      {/* Chassis 4 m x 1,8 m, avant vers +Z. */}
      <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.58, 3.9]} />
        <meshToonMaterial color={CAR_COLORS.body} gradientMap={toonGradient} />
        {outline}
      </mesh>

      {/* Capot plus bas pour lire l'avant de loin. */}
      <mesh position={[0, 0.92, 1.05]} castShadow>
        <boxGeometry args={[1.62, 0.18, 1.35]} />
        <meshToonMaterial color={CAR_COLORS.bodyDark} gradientMap={toonGradient} />
        {outline}
      </mesh>

      {/* Habitacle ramasse et un peu caricatural. */}
      <mesh position={[0, 1.12, -0.35]} castShadow>
        <boxGeometry args={[1.35, 0.72, 1.25]} />
        <meshToonMaterial color={CAR_COLORS.glass} gradientMap={toonGradient} />
        {outline}
      </mesh>

      <mesh position={[0, 1.5, -0.35]} castShadow>
        <boxGeometry args={[1.1, 0.12, 0.95]} />
        <meshToonMaterial color={CAR_COLORS.body} gradientMap={toonGradient} />
        {outline}
      </mesh>

      {/* Pare-chocs et phares. */}
      <mesh position={[0, 0.53, 2.04]} castShadow>
        <boxGeometry args={[1.9, 0.16, 0.16]} />
        <meshToonMaterial color={CAR_COLORS.bumper} gradientMap={toonGradient} />
        {outline}
      </mesh>
      <mesh position={[-0.48, 0.75, 2.14]} castShadow>
        <boxGeometry args={[0.34, 0.16, 0.08]} />
        <meshToonMaterial color={CAR_COLORS.trim} gradientMap={toonGradient} />
      </mesh>
      <mesh position={[0.48, 0.75, 2.14]} castShadow>
        <boxGeometry args={[0.34, 0.16, 0.08]} />
        <meshToonMaterial color={CAR_COLORS.trim} gradientMap={toonGradient} />
      </mesh>
      <mesh position={[0, 0.5, -2.02]} castShadow>
        <boxGeometry args={[1.82, 0.14, 0.14]} />
        <meshToonMaterial color={CAR_COLORS.bumper} gradientMap={toonGradient} />
        {outline}
      </mesh>

      <Wheel x={-0.98} z={1.25} />
      <Wheel x={0.98} z={1.25} />
      <Wheel x={-0.98} z={-1.25} />
      <Wheel x={0.98} z={-1.25} />
    </group>
  )
}

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.38, z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.26, 20]} />
        <meshToonMaterial color={CAR_COLORS.wheel} gradientMap={toonGradient} />
      </mesh>
      <mesh position={[0, 0, 0.14]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.03, 14]} />
        <meshToonMaterial color={CAR_COLORS.tireHub} gradientMap={toonGradient} />
      </mesh>
    </group>
  )
}
