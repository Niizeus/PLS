import { Outlines } from '@react-three/drei'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useState } from 'react'
import { toonGradient } from '../../shaders/toonGradient'
import { loadTerrain } from '../../world/beauvais/terrain'
import { PHYSICS_GROUPS, PHYSICS_MATERIAL } from './physicsConfig'
import {
  VEHICLE_TEST_RAMP,
  testSurfaceBaseY,
  vehicleTestPropArea,
  vehicleTestRampBaseY,
} from './vehicleTestSurfaces'

type TestPropKind = 'crate' | 'trash'
type PhysicsMaterial = {
  friction: number
  restitution: number
}

interface TestProp {
  id: string
  kind: TestPropKind
  dx: number
  dz: number
  drop: number
  mass: number
}

const TEST_PROPS: TestProp[] = [
  { id: 'physics-crate-a', kind: 'crate', dx: -1.1, dz: -0.8, drop: 0.06, mass: 18 },
  { id: 'physics-crate-b', kind: 'crate', dx: 0.3, dz: -0.9, drop: 0.12, mass: 18 },
  { id: 'physics-trash-a', kind: 'trash', dx: 1.2, dz: 0.8, drop: 0.08, mass: 12 },
  { id: 'physics-trash-b', kind: 'trash', dx: -0.2, dz: 1.1, drop: 0.14, mass: 12 },
]

/** Banc d'essai Rapier : props dynamiques + tremplin places apres chargement du relief. */
export default function SandboxPhysicsProps() {
  const [terrainReady, setTerrainReady] = useState(false)
  useEffect(() => {
    let alive = true
    loadTerrain().finally(() => {
      if (alive) setTerrainReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!terrainReady) return null

  const propArea = vehicleTestPropArea()
  const padX = propArea.centerX
  const padZ = propArea.centerZ
  const padY = testSurfaceBaseY(padX, padZ)

  return (
    <>
      <RigidBody type="fixed" colliders={false} position={[padX, padY - 0.08, padZ]}>
        <CuboidCollider
          args={[5, 0.08, 5]}
          friction={PHYSICS_MATERIAL.asphalt.friction}
          restitution={PHYSICS_MATERIAL.asphalt.restitution}
          collisionGroups={PHYSICS_GROUPS.world}
          solverGroups={PHYSICS_GROUPS.world}
        />
        <mesh position={[0, 0.085, 0]} receiveShadow>
          <boxGeometry args={[10, 0.035, 10]} />
          <meshToonMaterial color="#26313f" gradientMap={toonGradient} />
        </mesh>
      </RigidBody>

      {TEST_PROPS.map((prop) => (
        <PhysicsTestProp key={prop.id} prop={prop} />
      ))}
      <VehicleTestRamp />
    </>
  )
}

function VehicleTestRamp() {
  const ramp = VEHICLE_TEST_RAMP
  const baseY = vehicleTestRampBaseY()
  const angle = Math.atan2(ramp.height, ramp.length)
  const visualLength = Math.hypot(ramp.length, ramp.height)
  const approachLength = 22
  const approachX = ramp.startX - ramp.dirX * (approachLength * 0.5)
  const approachZ = ramp.startZ - ramp.dirZ * (approachLength * 0.5)
  const approachY = testSurfaceBaseY(approachX, approachZ) + 0.035

  return (
    <group>
      <RigidBody
        type="fixed"
        colliders={false}
        position={[ramp.centerX, baseY + ramp.height * 0.5, ramp.centerZ]}
        rotation={[0, ramp.yaw, 0]}
      >
        <CuboidCollider
          args={[visualLength * 0.5, 0.14, ramp.width * 0.5]}
          rotation={[0, 0, angle]}
          friction={PHYSICS_MATERIAL.asphalt.friction}
          restitution={PHYSICS_MATERIAL.asphalt.restitution}
          collisionGroups={PHYSICS_GROUPS.world}
          solverGroups={PHYSICS_GROUPS.world}
        />
        <group rotation={[0, 0, angle]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[visualLength, 0.28, ramp.width]} />
            <meshToonMaterial color="#f0c65a" gradientMap={toonGradient} />
            <Outlines thickness={0.025} color="#19140b" />
          </mesh>
          <mesh position={[0, 0.18, -ramp.width * 0.22]} castShadow>
            <boxGeometry args={[visualLength * 0.8, 0.035, 0.12]} />
            <meshToonMaterial color="#1f2937" gradientMap={toonGradient} />
          </mesh>
          <mesh position={[0, 0.18, ramp.width * 0.22]} castShadow>
            <boxGeometry args={[visualLength * 0.8, 0.035, 0.12]} />
            <meshToonMaterial color="#1f2937" gradientMap={toonGradient} />
          </mesh>
        </group>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} position={[approachX, approachY, approachZ]} rotation={[0, ramp.yaw, 0]}>
        <CuboidCollider
          args={[approachLength * 0.5, 0.035, ramp.width * 0.45]}
          friction={PHYSICS_MATERIAL.asphalt.friction}
          restitution={PHYSICS_MATERIAL.asphalt.restitution}
          collisionGroups={PHYSICS_GROUPS.world}
          solverGroups={PHYSICS_GROUPS.world}
        />
        <mesh receiveShadow>
          <boxGeometry args={[approachLength, 0.04, ramp.width * 0.9]} />
          <meshToonMaterial color="#26313f" gradientMap={toonGradient} />
        </mesh>
      </RigidBody>
    </group>
  )
}

function PhysicsTestProp({ prop }: { prop: TestProp }) {
  const propArea = vehicleTestPropArea()
  const x = propArea.centerX + prop.dx
  const z = propArea.centerZ + prop.dz
  const restHeight = prop.kind === 'crate' ? 0.42 : 0.55
  const y = testSurfaceBaseY(x, z) + restHeight + prop.drop
  const material = prop.kind === 'crate' ? PHYSICS_MATERIAL.propWood : PHYSICS_MATERIAL.propMetal

  return (
    <RigidBody
      colliders={false}
      position={[x, y, z]}
      rotation={[0.15, prop.dx * 0.37, -0.08]}
      canSleep
      ccd
      linearDamping={material.linearDamping}
      angularDamping={material.angularDamping}
      collisionGroups={PHYSICS_GROUPS.prop}
      solverGroups={PHYSICS_GROUPS.prop}
    >
      {prop.kind === 'crate' ? (
        <CrateCollider material={material} mass={prop.mass} />
      ) : (
        <TrashCollider material={material} mass={prop.mass} />
      )}
      {prop.kind === 'crate' ? <CrateMesh /> : <TrashMesh />}
    </RigidBody>
  )
}

function CrateCollider({ material, mass }: { material: PhysicsMaterial; mass: number }) {
  return (
    <CuboidCollider
      args={[0.42, 0.42, 0.42]}
      friction={material.friction}
      restitution={material.restitution}
      mass={mass}
      collisionGroups={PHYSICS_GROUPS.prop}
      solverGroups={PHYSICS_GROUPS.prop}
    />
  )
}

function TrashCollider({ material, mass }: { material: PhysicsMaterial; mass: number }) {
  return (
    <CylinderCollider
      args={[0.55, 0.32]}
      friction={material.friction}
      restitution={material.restitution}
      mass={mass}
      collisionGroups={PHYSICS_GROUPS.prop}
      solverGroups={PHYSICS_GROUPS.prop}
    />
  )
}

function CrateMesh() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.84, 0.84, 0.84]} />
        <meshToonMaterial color="#a86f3c" gradientMap={toonGradient} />
        <Outlines thickness={0.025} color="#17120d" />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <boxGeometry args={[0.98, 0.08, 0.12]} />
        <meshToonMaterial color="#704423" gradientMap={toonGradient} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[0, -Math.PI / 4, 0]} castShadow>
        <boxGeometry args={[0.98, 0.08, 0.12]} />
        <meshToonMaterial color="#704423" gradientMap={toonGradient} />
      </mesh>
    </group>
  )
}

function TrashMesh() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.36, 1.1, 14]} />
        <meshToonMaterial color="#65717f" gradientMap={toonGradient} />
        <Outlines thickness={0.024} color="#15191f" />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.34, 0.12, 14]} />
        <meshToonMaterial color="#8a96a3" gradientMap={toonGradient} />
        <Outlines thickness={0.018} color="#15191f" />
      </mesh>
    </group>
  )
}
