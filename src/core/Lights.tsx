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
 *
 * ✨ Anti-scintillement (important, ne pas défaire) : justement PARCE QUE la zone
 * d'ombre suit le joueur, il faut la déplacer par SAUTS D'UN TEXEL, jamais en
 * continu. L'ombre est calculée dans une petite texture (la "shadow map") : si sa
 * grille glisse sous le décor à chaque image, les mêmes points du sol basculent
 * sans arrêt entre "à l'ombre" et "éclairé" → la route clignote dès qu'on bouge.
 * En arrondissant le centre de la zone à un multiple de texel, la grille reste
 * alignée sur le monde et l'ombre arrête de vibrer. Voir `snapShadowCenter`.
 */

// Zone d'ombre : demi-largeur (m) et résolution de la shadow map.
// ⚠️ Ces deux constantes servent AUSSI dans le JSX plus bas : elles doivent rester
// d'accord avec `shadow-camera-*` et `shadow-mapSize`, sinon le calage tombe à côté.
const SHADOW_HALF = 35
const SHADOW_MAP = 2048
/** Taille d'un texel d'ombre au sol, en mètres (~3,4 cm). Le pas de déplacement. */
const SHADOW_TEXEL = (SHADOW_HALF * 2) / SHADOW_MAP

const WORLD_UP = new THREE.Vector3(0, 1, 0)

// Direction du soleil, en décalage par rapport au joueur.
const DAY_LIGHT_COLOR = new THREE.Color('#fff3e0')
const NIGHT_LIGHT_COLOR = new THREE.Color('#8fb4ff')
const DAWN_LIGHT_COLOR = new THREE.Color('#ffd0a0')
const HEMISPHERE_DAY_SKY = new THREE.Color('#cfe8ff')
const HEMISPHERE_NIGHT_SKY = new THREE.Color('#273a67')
const HEMISPHERE_GROUND = new THREE.Color('#5a4a3a')

/**
 * Arrondit le centre de la zone d'ombre au texel le plus proche, et écrit le
 * résultat dans `out`. C'est CE calcul qui supprime le clignotement.
 *
 * On travaille dans le repère de la caméra d'ombre, construit exactement comme
 * three.js le fait (`Matrix4.lookAt`) : `z` va du joueur vers le soleil, `x` et `y`
 * sont les axes de la texture d'ombre. On arrondit seulement `x` et `y` (la grille
 * de texels) ; la profondeur `z`, elle, n'a pas de grille à respecter.
 *
 * Les vecteurs de travail sont passés en paramètres : on ne veut RIEN allouer dans
 * la boucle de rendu (60 fois par seconde).
 */
function snapShadowCenter(
  centerX: number,
  centerY: number,
  centerZ: number,
  sunOffset: THREE.Vector3,
  axes: { x: THREE.Vector3; y: THREE.Vector3; z: THREE.Vector3 },
  out: THREE.Vector3,
) {
  // Repère de la caméra d'ombre.
  axes.z.copy(sunOffset).normalize()
  axes.x.crossVectors(WORLD_UP, axes.z)
  // Cas limite : soleil parfaitement à la verticale → le produit vectoriel s'annule.
  if (axes.x.lengthSq() < 1e-8) axes.x.set(1, 0, 0)
  axes.x.normalize()
  axes.y.crossVectors(axes.z, axes.x)

  // Centre voulu (le joueur), projeté sur ce repère.
  //
  // ⚠️ L'ALTITUDE DU JOUEUR COMPTE. Le relief de Beauvais monte à plus de 100 m
  // au-dessus du fond de vallée : si on visait toujours y = 0, le soleil (posé
  // quelques dizaines de mètres plus haut) se retrouverait SOUS la colline dès
  // qu'on grimpe sur les coteaux, et les ombres partiraient en vrille.
  out.set(centerX, centerY, centerZ)
  const alongX = Math.round(out.dot(axes.x) / SHADOW_TEXEL) * SHADOW_TEXEL
  const alongY = Math.round(out.dot(axes.y) / SHADOW_TEXEL) * SHADOW_TEXEL
  const alongZ = out.dot(axes.z)

  // Reconstruction du centre, cette fois collé à la grille de texels.
  out
    .copy(axes.x)
    .multiplyScalar(alongX)
    .addScaledVector(axes.y, alongY)
    .addScaledVector(axes.z, alongZ)
}

export default function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  const hemisphere = useRef<THREE.HemisphereLight>(null)
  const ambient = useRef<THREE.AmbientLight>(null)
  // Cible du soleil, ajoutée à la scène pour que le soleil "regarde" le joueur.
  const target = useMemo(() => new THREE.Object3D(), [])

  // Vecteurs réutilisés chaque image (on n'alloue pas dans la boucle de rendu).
  const scratch = useMemo(
    () => ({
      sunOffset: new THREE.Vector3(),
      center: new THREE.Vector3(),
      axes: { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() },
    }),
    [],
  )

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

    // Position du soleil PAR RAPPORT au joueur (il tourne au fil des heures).
    scratch.sunOffset.set(Math.cos(orbitAngle) * orbitRadius, height, Math.sin(orbitAngle) * orbitRadius)

    // Le centre de la zone d'ombre saute de texel en texel au lieu de glisser
    // → plus de clignotement sur la route quand le joueur se déplace.
    snapShadowCenter(
      p.position.x,
      p.position.y,
      p.position.z,
      scratch.sunOffset,
      scratch.axes,
      scratch.center,
    )

    // Le soleil garde exactement le même décalage : sa DIRECTION ne change pas,
    // seul le cadrage de la zone d'ombre est arrondi.
    light.current.position.addVectors(scratch.center, scratch.sunOffset)
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

    // La cible reprend le MÊME centre arrondi que le soleil (sinon la direction
    // de la lumière changerait légèrement à chaque image → le calage serait perdu).
    target.position.copy(scratch.center)
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
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        // Zone d'ombre serrée autour du joueur (elle le suit, par sauts d'un texel).
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        // Décale le test d'ombre le long de la normale du sol. Le matin/soir, le
        // soleil est rasant : sans cette marge, une surface plate et large comme la
        // route se raye d'ombres parasites (« acné ») qui réapparaissent au moindre
        // mouvement. 4 cm suffisent et restent invisibles à l'œil.
        shadow-normalBias={0.04}
      />
      <primitive object={target} />
    </>
  )
}
