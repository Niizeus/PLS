import { Outlines } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PHYSICS_GROUPS, PHYSICS_MATERIAL } from '../../gameplay/physics/physicsConfig'
import { toonGradient } from '../../shaders/toonGradient'
import { SPAWN } from '../beauvais/cityData'

interface RampDefinition {
  id: string
  dx: number
  dz: number
  yaw: number
  length: number
  width: number
  height: number
}

const PLATEAU_SIZE = 220
const PLATEAU_THICKNESS = 0.18

const RAMPS: RampDefinition[] = [
  { id: 'small-straight', dx: 18, dz: -10, yaw: 0, length: 8, width: 5, height: 1.4 },
  { id: 'big-straight', dx: 38, dz: -10, yaw: 0, length: 13, width: 5.5, height: 3.2 },
  { id: 'side-angle', dx: 26, dz: -32, yaw: -0.55, length: 11, width: 4.8, height: 2.2 },
  { id: 'wide-soft', dx: -22, dz: -18, yaw: 0.2, length: 16, width: 8, height: 2.4 },
]

export default function FlatTestWorld() {
  return (
    <>
      <RigidBody type="fixed" colliders={false} position={[SPAWN.x, -PLATEAU_THICKNESS * 0.5, SPAWN.z]}>
        <CuboidCollider
          args={[PLATEAU_SIZE * 0.5, PLATEAU_THICKNESS * 0.5, PLATEAU_SIZE * 0.5]}
          friction={PHYSICS_MATERIAL.asphalt.friction}
          restitution={PHYSICS_MATERIAL.asphalt.restitution}
          collisionGroups={PHYSICS_GROUPS.world}
          solverGroups={PHYSICS_GROUPS.world}
        />
        <mesh receiveShadow position={[0, PLATEAU_THICKNESS * 0.5 + 0.004, 0]}>
          <boxGeometry args={[PLATEAU_SIZE, 0.025, PLATEAU_SIZE]} />
          <meshToonMaterial color="#7f9469" gradientMap={toonGradient} />
        </mesh>
      </RigidBody>

      <TestGrid />
      <StartPad />
      {RAMPS.map((ramp) => (
        <TestRamp key={ramp.id} ramp={ramp} />
      ))}
    </>
  )
}

function TestGrid() {
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(PLATEAU_SIZE, 22, '#233044', '#42526a')
    helper.position.set(SPAWN.x, 0.018, SPAWN.z)
    helper.material.depthWrite = false
    return helper
  }, [])

  return <primitive object={grid} />
}

function StartPad() {
  return (
    <group position={[SPAWN.x, 0.035, SPAWN.z]}>
      <mesh receiveShadow>
        <boxGeometry args={[18, 0.04, 7]} />
        <meshToonMaterial color="#26313f" gradientMap={toonGradient} />
        <Outlines thickness={0.018} color="#111827" />
      </mesh>
      <mesh position={[0, 0.045, -2.6]}>
        <boxGeometry args={[16, 0.025, 0.22]} />
        <meshToonMaterial color="#ffd83d" gradientMap={toonGradient} />
      </mesh>
      <mesh position={[0, 0.045, 2.6]}>
        <boxGeometry args={[16, 0.025, 0.22]} />
        <meshToonMaterial color="#ffd83d" gradientMap={toonGradient} />
      </mesh>
    </group>
  )
}

function TestRamp({ ramp }: { ramp: RampDefinition }) {
  const angle = Math.atan2(ramp.height, ramp.length)
  const visualLength = Math.hypot(ramp.length, ramp.height)
  const startX = SPAWN.x + ramp.dx
  const startZ = SPAWN.z + ramp.dz
  const dirX = Math.cos(ramp.yaw)
  const dirZ = -Math.sin(ramp.yaw)
  const centerX = startX + dirX * ramp.length * 0.5
  const centerZ = startZ + dirZ * ramp.length * 0.5

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[centerX, ramp.height * 0.5, centerZ]}
      rotation={[0, ramp.yaw, 0]}
    >
      <CuboidCollider
        args={[visualLength * 0.5, 0.16, ramp.width * 0.5]}
        rotation={[0, 0, angle]}
        friction={PHYSICS_MATERIAL.asphalt.friction}
        restitution={PHYSICS_MATERIAL.asphalt.restitution}
        collisionGroups={PHYSICS_GROUPS.world}
        solverGroups={PHYSICS_GROUPS.world}
      />
      <group rotation={[0, 0, angle]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[visualLength, 0.32, ramp.width]} />
          <meshToonMaterial color="#f0c65a" gradientMap={toonGradient} />
          <Outlines thickness={0.026} color="#19140b" />
        </mesh>
        <mesh position={[0, 0.2, -ramp.width * 0.28]} castShadow>
          <boxGeometry args={[visualLength * 0.82, 0.035, 0.12]} />
          <meshToonMaterial color="#1f2937" gradientMap={toonGradient} />
        </mesh>
        <mesh position={[0, 0.2, ramp.width * 0.28]} castShadow>
          <boxGeometry args={[visualLength * 0.82, 0.035, 0.12]} />
          <meshToonMaterial color="#1f2937" gradientMap={toonGradient} />
        </mesh>
      </group>
    </RigidBody>
  )
}
