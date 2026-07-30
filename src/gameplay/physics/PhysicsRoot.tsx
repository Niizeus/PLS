import { Physics } from '@react-three/rapier'
import { Suspense, type ReactNode } from 'react'
import { PHYSICS_WORLD } from './physicsConfig'
import { useCollisionDebugStore } from '../../devtools/collisionDebugStore'

interface PhysicsRootProps {
  children: ReactNode
}

/** Enveloppe Rapier unique : toutes les entites physiques partagent ces lois. */
export default function PhysicsRoot({ children }: PhysicsRootProps) {
  const collisionDebugEnabled = useCollisionDebugStore((state) => state.enabled)

  return (
    <Suspense fallback={null}>
      <Physics
        gravity={PHYSICS_WORLD.GRAVITY}
        timeStep={PHYSICS_WORLD.TIME_STEP}
        lengthUnit={PHYSICS_WORLD.LENGTH_UNIT}
        colliders={false}
        numSolverIterations={PHYSICS_WORLD.SOLVER_ITERATIONS}
        numAdditionalFrictionIterations={PHYSICS_WORLD.FRICTION_ITERATIONS}
        maxCcdSubsteps={PHYSICS_WORLD.CCD_SUBSTEPS}
        updatePriority={PHYSICS_WORLD.UPDATE_PRIORITY}
        debug={import.meta.env.DEV && (PHYSICS_WORLD.DEBUG || collisionDebugEnabled)}
      >
        {children}
      </Physics>
    </Suspense>
  )
}
