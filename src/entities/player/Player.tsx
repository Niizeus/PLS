import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useKeyboard } from '../../gameplay/input/useKeyboard'
import { useMouse } from '../../gameplay/input/useMouse'
import { usePlayerMovement } from './usePlayerMovement'
import { PLAYER } from './playerConfig'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { useCharacterStatsStore } from '../../gameplay/stats/characterStatsStore'
import { SPAWN } from '../../world/beauvais/cityData'
import { groundHeight } from '../../world/beauvais/roadway'
import PlayerModel from './PlayerModel'

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
  const groupRef = useRef<THREE.Group>(null)

  // Publie le perso dans le store à son montage (retiré au démontage).
  const setPlayerObject = usePlayerStore((s) => s.setPlayerObject)
  useEffect(() => {
    setPlayerObject(groupRef.current)
    return () => setPlayerObject(null)
  }, [setPlayerObject])

  // Dégâts → animation "Hurt".
  // On surveille simplement la barre de vie : dès qu'elle BAISSE (coup reçu,
  // faim, chute...), on joue l'animation. Quand un vrai système de combat
  // arrivera, il pourra aussi appeler `usePlayerStore.getState().takeHit()`
  // directement, sans toucher à ce fichier.
  useEffect(() => {
    let previousHealth = useCharacterStatsStore.getState().health
    return useCharacterStatsStore.subscribe((state) => {
      if (state.health < previousHealth) usePlayerStore.getState().takeHit()
      previousHealth = state.health
    })
  }, [])

  // Branche les entrées + la logique de déplacement/combat (déplace le groupe,
  // met à jour l'action dans le store).
  const keys = useKeyboard()
  const mouse = useMouse()
  usePlayerMovement(groupRef, keys, mouse)

  return (
    <group ref={groupRef} position={[SPAWN.x, groundHeight(SPAWN.x, SPAWN.z) + PLAYER.BODY_HEIGHT, SPAWN.z]}>
      <Suspense fallback={null}>
        <PlayerModel />
      </Suspense>
    </group>
  )
}
