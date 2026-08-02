import { Suspense, useEffect, useRef } from 'react'
import { CapsuleCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useKeyboard } from '../../gameplay/input/useKeyboard'
import { useMouse } from '../../gameplay/input/useMouse'
import { usePlayerMovement } from './usePlayerMovement'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { useCharacterStatsStore } from '../../gameplay/stats/characterStatsStore'
import { SPAWN } from '../../world/beauvais/cityData'
import { groundHeight } from '../../world/beauvais/roadway'
import PlayerModel from './PlayerModel'
import { getPlayerTuning } from '../../devtools/devTuningStore'
import { PHYSICS_GROUPS } from '../../gameplay/physics/physicsConfig'
import PlayerRagdoll from './PlayerRagdoll'
import { useCollisionDebugStore } from '../../devtools/collisionDebugStore'

/**
 * Le joueur (Pierrot).
 *
 * - Le groupe racine est DÉPLACÉ par la logique (usePlayerMovement) et PUBLIÉ dans
 *   le store pour que la caméra le suive.
 * - Le visuel est le modèle 3D animé (PlayerModel), chargé de façon asynchrone
 *   (Suspense) : le groupe existe tout de suite, le modèle apparaît quand il est prêt.
 * - L'animation jouée suit l'"action" du store (idle/walk/run/...) — gérée dans PlayerModel.
 */
export default function Player() {
  const targetRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<RapierRigidBody>(null)
  const playerTuning = getPlayerTuning()
  const spawnY = groundHeight(SPAWN.x, SPAWN.z) + playerTuning.BODY_HEIGHT
  const capsuleHalfHeight = Math.max(0.1, playerTuning.BODY_HEIGHT - playerTuning.BODY_RADIUS)
  const isRagdoll = usePlayerStore((s) => s.isRagdoll)
  const collisionDebugEnabled = useCollisionDebugStore((s) => s.enabled)

  // Publie le perso dans le store à son montage (retiré au démontage).
  const setPlayerObject = usePlayerStore((s) => s.setPlayerObject)
  useEffect(() => {
    setPlayerObject(targetRef.current)
    return () => setPlayerObject(null)
  }, [setPlayerObject])

  // Dégâts → animation "Hurt".
  // On surveille simplement la barre de vie : dès qu'elle BAISSE à cause d'un
  // choc net (coup reçu, chute...), on joue l'animation. Les dégâts lents des
  // besoins à zéro ne sonnent plus le joueur : ils passent par la marche triste.
  // Quand un vrai système de combat
  // arrivera, il pourra aussi appeler `usePlayerStore.getState().takeHit()`
  // directement, sans toucher à ce fichier.
  useEffect(() => {
    let previousHealth = useCharacterStatsStore.getState().health
    return useCharacterStatsStore.subscribe((state) => {
      if (state.health < previousHealth && state.lastHealthLossSource !== 'needs') {
        usePlayerStore.getState().takeHit()
      }
      previousHealth = state.health
    })
  }, [])

  // Branche les entrées + la logique de déplacement/combat (déplace le groupe,
  // met à jour l'action dans le store).
  const keys = useKeyboard()
  const mouse = useMouse()
  usePlayerMovement(targetRef, bodyRef, keys, mouse)

  return (
    <>
      <group ref={targetRef} position={[SPAWN.x, spawnY, SPAWN.z]} />
      <RigidBody
        ref={bodyRef}
        type="kinematicPosition"
        colliders={false}
        position={[SPAWN.x, spawnY, SPAWN.z]}
        canSleep={false}
        ccd
        dominanceGroup={2}
      >
        <CapsuleCollider
          args={[capsuleHalfHeight, playerTuning.BODY_RADIUS]}
          friction={0.8}
          restitution={0}
          collisionGroups={PHYSICS_GROUPS.player}
          solverGroups={PHYSICS_GROUPS.player}
        />
        <Suspense fallback={null}>
          <PlayerModel />
        </Suspense>
      </RigidBody>
      {import.meta.env.DEV && collisionDebugEnabled ? (
        <PlayerPhysicsDebugVisual bodyHeight={playerTuning.BODY_HEIGHT} radius={playerTuning.BODY_RADIUS} />
      ) : null}
      {isRagdoll ? (
        <Suspense fallback={null}>
          <PlayerRagdoll />
        </Suspense>
      ) : null}
    </>
  )
}

function PlayerPhysicsDebugVisual({ bodyHeight, radius }: { bodyHeight: number; radius: number }) {
  const debug = usePlayerStore((s) => s.physicsDebug)
  const color = debug.mode === 'unstucking' ? '#f97316' : debug.mode === 'sliding' ? '#facc15' : debug.grounded ? '#22c55e' : '#38bdf8'
  const linePositions = debug.hitPoint && debug.hitNormal
    ? new Float32Array([
        debug.hitPoint.x,
        debug.hitPoint.y,
        debug.hitPoint.z,
        debug.hitPoint.x + debug.hitNormal.x * 0.85,
        debug.hitPoint.y + debug.hitNormal.y * 0.85,
        debug.hitPoint.z + debug.hitNormal.z * 0.85,
      ])
    : null

  return (
    <>
      <mesh position={[debug.position.x, debug.position.y, debug.position.z]}>
        <cylinderGeometry args={[radius, radius, bodyHeight * 2, 18, 1, true]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.62} depthWrite={false} />
      </mesh>
      {debug.groundY !== null ? (
        <mesh position={[debug.position.x, debug.groundY, debug.position.z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 1.25, 0.025, 6, 28]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.78} depthWrite={false} />
        </mesh>
      ) : null}
      {debug.hitPoint ? (
        <mesh position={[debug.hitPoint.x, debug.hitPoint.y, debug.hitPoint.z]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshBasicMaterial color="#fb923c" depthWrite={false} />
        </mesh>
      ) : null}
      {linePositions ? (
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#f97316" transparent opacity={0.92} depthWrite={false} />
        </line>
      ) : null}
    </>
  )
}
