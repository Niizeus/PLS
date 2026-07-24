import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Outlines } from '@react-three/drei'
import { toonGradient } from '../../shaders/toonGradient'
import { useKeyboard } from '../../gameplay/input/useKeyboard'
import { useMouse } from '../../gameplay/input/useMouse'
import { usePlayerMovement } from './usePlayerMovement'
import { CHIBRUX_COLORS, PLAYER } from './playerConfig'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { SPAWN } from '../../world/beauvais/cityData'

/**
 * Chibrux (placeholder stylisé, monté en primitives + matériau toon).
 * Remplaçable plus tard par un vrai modèle 3D sans toucher au reste.
 *
 * Structure : un groupe racine (déplacé par la logique) contenant un "corps"
 * visuel qu'on anime (balancement, bras d'attaque/défense).
 *
 * Ce composant est autonome : il gère sa propre réf et la PUBLIE dans le store
 * pour que la caméra puisse le suivre, sans dépendre de GameCanvas.
 */
export default function Player() {
  // Réf du groupe racine du perso (déplacé par la logique, suivi par la caméra).
  const groupRef = useRef<THREE.Group>(null)

  // Publie le perso dans le store à son montage (et le retire au démontage),
  // pour que FollowCamera puisse le suivre sans branchement manuel.
  const setPlayerObject = usePlayerStore((s) => s.setPlayerObject)
  useEffect(() => {
    setPlayerObject(groupRef.current)
    return () => setPlayerObject(null)
  }, [setPlayerObject])

  // Branche les entrées et la logique de déplacement/combat.
  const keys = useKeyboard()
  const mouse = useMouse()
  const motion = usePlayerMovement(groupRef, keys, mouse)

  // Réfs des parties animées.
  const bodyRef = useRef<THREE.Group>(null)
  const leftArmRef = useRef<THREE.Group>(null)
  const rightArmRef = useRef<THREE.Group>(null)
  const leftLegRef = useRef<THREE.Group>(null)
  const rightLegRef = useRef<THREE.Group>(null)

  // Phase de marche (accumulée) pour le balancement bras/jambes.
  const walkPhase = useRef(0)

  useFrame((_, delta) => {
    const m = motion.current
    const body = bodyRef.current
    const lArm = leftArmRef.current
    const rArm = rightArmRef.current
    const lLeg = leftLegRef.current
    const rLeg = rightLegRef.current
    if (!body || !lArm || !rArm || !lLeg || !rLeg) return

    // Avance la phase de marche selon l'intensité de déplacement.
    walkPhase.current += delta * (6 + m.moveIntensity * 6) * (m.moveIntensity > 0 ? 1 : 0)
    const swing = Math.sin(walkPhase.current) * m.moveIntensity

    // Balancement du corps (petit rebond vertical quand on bouge).
    body.position.y = Math.abs(Math.sin(walkPhase.current)) * 0.08 * m.moveIntensity

    // Jambes : alternées.
    lLeg.rotation.x = swing * 0.7
    rLeg.rotation.x = -swing * 0.7

    // Bras : par défaut ils balancent à l'inverse des jambes.
    let lArmX = -swing * 0.5
    let rArmX = swing * 0.5

    // Défense : les deux bras remontent devant (garde).
    if (m.action === 'defense') {
      lArmX = -2.1
      rArmX = -2.1
    }

    // Interaction (E) : le bras droit se tend en avant.
    if (m.interactProgress > 0) {
      rArmX = -1.4
    }

    // Attaque : le bras droit fait un arc rapide (haut → bas).
    if (m.attackProgress > 0) {
      // Courbe simple : lève puis abat le bras sur la durée de l'attaque.
      const p = m.attackProgress
      rArmX = -2.4 + p * 3.6 // de ~-2.4 (armé) à ~+1.2 (frappe basse)
    }

    // Applique en douceur pour éviter les à-coups.
    const t = 1 - Math.exp(-18 * delta)
    lArm.rotation.x += (lArmX - lArm.rotation.x) * t
    rArm.rotation.x += (rArmX - rArm.rotation.x) * t
  })

  return (
    <group ref={groupRef} position={[SPAWN.x, PLAYER.BODY_HEIGHT, SPAWN.z]}>
      <group ref={bodyRef}>
        {/* Torse (veste) */}
        <mesh position={[0, 0.15, 0]} castShadow>
          <capsuleGeometry args={[0.4, 0.7, 6, 12]} />
          <meshToonMaterial color={CHIBRUX_COLORS.jacket} gradientMap={toonGradient} />
          <Outlines thickness={0.03} color="#1a1a1a" />
        </mesh>

        {/* Tête (peau) */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <sphereGeometry args={[0.33, 20, 20]} />
          <meshToonMaterial color={CHIBRUX_COLORS.skin} gradientMap={toonGradient} />
          <Outlines thickness={0.03} color="#1a1a1a" />
        </mesh>

        {/* Cheveux (petite calotte) */}
        <mesh position={[0, 1.12, -0.02]} castShadow>
          <sphereGeometry args={[0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
          <meshToonMaterial color={CHIBRUX_COLORS.hair} gradientMap={toonGradient} />
        </mesh>

        {/* Bras gauche (pivot à l'épaule) */}
        <group ref={leftArmRef} position={[-0.52, 0.5, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.5, 5, 10]} />
            <meshToonMaterial color={CHIBRUX_COLORS.jacket} gradientMap={toonGradient} />
            <Outlines thickness={0.03} color="#1a1a1a" />
          </mesh>
        </group>

        {/* Bras droit (celui qui attaque) */}
        <group ref={rightArmRef} position={[0.52, 0.5, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.5, 5, 10]} />
            <meshToonMaterial color={CHIBRUX_COLORS.jacket} gradientMap={toonGradient} />
            <Outlines thickness={0.03} color="#1a1a1a" />
          </mesh>
        </group>

        {/* Jambe gauche */}
        <group ref={leftLegRef} position={[-0.18, -0.2, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow>
            <capsuleGeometry args={[0.15, 0.6, 5, 10]} />
            <meshToonMaterial color={CHIBRUX_COLORS.pants} gradientMap={toonGradient} />
            <Outlines thickness={0.03} color="#1a1a1a" />
          </mesh>
        </group>

        {/* Jambe droite */}
        <group ref={rightLegRef} position={[0.18, -0.2, 0]}>
          <mesh position={[0, -0.4, 0]} castShadow>
            <capsuleGeometry args={[0.15, 0.6, 5, 10]} />
            <meshToonMaterial color={CHIBRUX_COLORS.pants} gradientMap={toonGradient} />
            <Outlines thickness={0.03} color="#1a1a1a" />
          </mesh>
        </group>
      </group>
    </group>
  )
}
