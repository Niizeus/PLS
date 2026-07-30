import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSkyTuning, useDevTuningStore } from '../devtools/devTuningStore'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { getCelestialCycle, writeSunLightOffset } from '../gameplay/time/celestialCycle'
import { useGameTimeStore } from '../gameplay/time/gameTimeStore'
import { applySkyTuning, getSkyAtmosphere } from './sky/skyAtmosphere'

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
  const skyOverrides = useDevTuningStore((state) => state.overrides.sky)
  const skyTuning = useMemo(() => getSkyTuning(), [skyOverrides])
  // Cible du soleil, ajoutée à la scène pour que le soleil "regarde" le joueur.
  const target = useMemo(() => new THREE.Object3D(), [])

  // Vecteurs réutilisés chaque image (on n'alloue pas dans la boucle de rendu).
  const scratch = useMemo(
    () => ({
      sunOffset: new THREE.Vector3(),
      center: new THREE.Vector3(),
      axes: { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() },
      sunLight: new THREE.Color(),
      ambientLight: new THREE.Color(),
      hemisphereSky: new THREE.Color(),
      hemisphereGround: new THREE.Color(),
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
    const cycle = getCelestialCycle(totalMinutes)
    const atmosphere = applySkyTuning(getSkyAtmosphere(totalMinutes), skyTuning)
    const tint = Math.min(1.25, Math.max(0, atmosphere.materialTintStrength))

    // Position du soleil PAR RAPPORT au joueur (il tourne au fil des heures).
    writeSunLightOffset(totalMinutes, scratch.sunOffset)

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
    light.current.intensity = 0.18 + cycle.daylight * (0.82 + cycle.solarElevation * 1.08) + tint * 0.08
    light.current.color.copy(scratch.sunLight.set(atmosphere.sunLight))

    if (hemisphere.current) {
      hemisphere.current.intensity = 0.17 + cycle.daylight * 0.38 + tint * 0.1
      hemisphere.current.color.copy(scratch.hemisphereSky.set(atmosphere.hemisphereSky))
      hemisphere.current.groundColor.copy(scratch.hemisphereGround.set(atmosphere.hemisphereGround))
    }

    if (ambient.current) {
      ambient.current.intensity = 0.08 + cycle.daylight * 0.16 + tint * 0.05
      ambient.current.color.copy(scratch.ambientLight.set(atmosphere.ambientLight))
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
