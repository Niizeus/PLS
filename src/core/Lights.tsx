import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import {
  getDaylightFactor,
  getMinuteOfDay,
  getSolarElevationFactor,
  useGameTimeStore,
} from '../gameplay/time/gameTimeStore'

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
const DAY_LIGHT_COLOR = new THREE.Color('#fff3e0')
const NIGHT_LIGHT_COLOR = new THREE.Color('#8fb4ff')
const DAWN_LIGHT_COLOR = new THREE.Color('#ffd0a0')
const HEMISPHERE_DAY_SKY = new THREE.Color('#cfe8ff')
const HEMISPHERE_NIGHT_SKY = new THREE.Color('#273a67')
const HEMISPHERE_GROUND = new THREE.Color('#5a4a3a')

export default function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  const hemisphere = useRef<THREE.HemisphereLight>(null)
  const ambient = useRef<THREE.AmbientLight>(null)
  // Cible du soleil, ajoutée à la scène pour que le soleil "regarde" le joueur.
  const target = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (light.current) light.current.target = target
  }, [target])

  useFrame(() => {
    const p = usePlayerStore.getState().playerObject
    if (!p || !light.current) return
    const totalMinutes = useGameTimeStore.getState().totalMinutes
    const minuteOfDay = getMinuteOfDay(totalMinutes)
    const hour = minuteOfDay / 60
    const daylight = getDaylightFactor(totalMinutes)
    const solarElevation = getSolarElevationFactor(totalMinutes)
    const dayAngle = ((hour - 6) / 12) * Math.PI
    const nightAngle = ((hour - 18) / 12) * Math.PI
    const isSunVisible = daylight > 0.03
    const orbitAngle = isSunVisible ? dayAngle : nightAngle
    const orbitRadius = isSunVisible ? 34 : 22
    const height = isSunVisible ? 12 + solarElevation * 46 : 24
    const lightColor = DAY_LIGHT_COLOR.clone().lerp(NIGHT_LIGHT_COLOR, 1 - daylight)

    if (hour >= 5 && hour < 8) {
      lightColor.lerp(DAWN_LIGHT_COLOR, 0.35)
    } else if (hour >= 17 && hour < 20) {
      lightColor.lerp(DAWN_LIGHT_COLOR, 0.45)
    }

    light.current.position.set(
      p.position.x + Math.cos(orbitAngle) * orbitRadius,
      height,
      p.position.z + Math.sin(orbitAngle) * orbitRadius,
    )
    light.current.intensity = 0.32 + daylight * (0.85 + solarElevation * 1.1)
    light.current.color.copy(lightColor)

    if (hemisphere.current) {
      hemisphere.current.intensity = 0.28 + daylight * 0.34
      hemisphere.current.color.copy(HEMISPHERE_NIGHT_SKY).lerp(HEMISPHERE_DAY_SKY, daylight)
      hemisphere.current.groundColor.copy(HEMISPHERE_GROUND)
    }

    if (ambient.current) {
      ambient.current.intensity = 0.16 + daylight * 0.12
    }

    target.position.set(p.position.x, 0, p.position.z)
    target.updateMatrixWorld()
  })

  return (
    <>
      <hemisphereLight ref={hemisphere} args={['#cfe8ff', '#5a4a3a', 0.6]} />
      <ambientLight ref={ambient} intensity={0.25} />
      <directionalLight
        ref={light}
        intensity={2.1}
        color="#fff3e0"
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
