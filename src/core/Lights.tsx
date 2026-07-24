import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayerStore } from '../gameplay/stats/playerStore'

/**
 * Éclairage de la scène, pensé "cartoon" : lumière franche + remplissage doux.
 * - hemisphereLight : lumière d'ambiance (ciel clair / sol sombre), gratuite en perf.
 * - directionalLight : le "soleil", seule source qui projette des ombres.
 * - ambientLight : petit fond pour que les zones sombres ne soient pas noires.
 *
 * ⚡ Optimisation : le soleil et sa zone d'ombre SUIVENT le joueur. La zone d'ombre
 * reste donc petite (~60 m autour du perso) → ombres nettes ET peu coûteuses, quelle
 * que soit la taille de la ville. (Avant, les ombres ne couvraient que l'origine.)
 */

// Direction du soleil, en décalage par rapport au joueur.
const SUN_OFFSET = new THREE.Vector3(30, 45, 22)

export default function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  // Cible du soleil, ajoutée à la scène pour que le soleil "regarde" le joueur.
  const target = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (light.current) light.current.target = target
  }, [target])

  useFrame(() => {
    const p = usePlayerStore.getState().playerObject
    if (!p || !light.current) return
    light.current.position.set(
      p.position.x + SUN_OFFSET.x,
      SUN_OFFSET.y,
      p.position.z + SUN_OFFSET.z,
    )
    target.position.set(p.position.x, 0, p.position.z)
    target.updateMatrixWorld()
  })

  return (
    <>
      <hemisphereLight args={['#cfe8ff', '#5a4a3a', 0.6]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={light}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        // Zone d'ombre serrée autour du joueur (elle le suit).
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
      />
      <primitive object={target} />
    </>
  )
}
