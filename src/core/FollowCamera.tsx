import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { useCarStore } from '../entities/vehicles/carStore'
import { useScooterStore } from '../entities/vehicles/scooterStore'
import { buildingHeightAt } from '../world/beauvais/collision'
import { terrainHeight } from '../world/beauvais/cityData'
import { useCameraStore } from './cameraStore'
import { FRAME } from './framePriority'

interface CameraRig {
  distance: number
  minDistance: number
  lookHeight: number
  follow: number
  wallMargin: number
}

const ON_FOOT: CameraRig = {
  distance: 6.4,
  minDistance: 2.4,
  lookHeight: 0.78,
  follow: 24,
  wallMargin: 0.45,
}

const SCOOTER_RIG: CameraRig = {
  distance: 6.9,
  minDistance: 2.8,
  lookHeight: 0.55,
  follow: 20,
  wallMargin: 0.5,
}

const CAR_RIG: CameraRig = {
  distance: 7.4,
  minDistance: 3.1,
  lookHeight: 0.48,
  follow: 26,
  wallMargin: 0.55,
}

/**
 * 🧱 Recherche du mur devant la caméra.
 *
 * On balaie grossièrement le rayon qui va du perso à la caméra (`COLLISION_STEPS`),
 * puis on AFFINE par dichotomie autour du premier point bloqué (`COLLISION_REFINE`).
 *
 * L'affinage n'est pas un luxe : sans lui, la distance trouvée ne pouvait valoir
 * que 1/36e, 2/36e… de la distance nominale. Elle sautait donc d'un cran entier
 * d'une image à l'autre, et la caméra "pompait" en longeant une rangée
 * d'immeubles. Avec la dichotomie, la distance varie de façon CONTINUE.
 * Bonus : 12 pas + 5 affinages coûtent deux fois moins cher que les 36 d'avant.
 */
const COLLISION_STEPS = 12
const COLLISION_REFINE = 5
const CAMERA_RADIUS = 0.35
const LOOK_AHEAD = 0.45
const DISTANCE_CLOSE_SPEED = 28
const DISTANCE_RELEASE_SPEED = 3.2
const CAR_TARGET_FOLLOW_XZ = 12
const CAR_TARGET_FOLLOW_Y = 8
const CAR_TARGET_PREDICT_SECONDS = 0.045

/**
 * Regarder vers le haut, sans enterrer la caméra.
 *
 * Quand le pitch devient négatif (voir `cameraStore.ts`), la caméra descend sous
 * la ligne des yeux. Sur terrain plat elle toucherait le sol tout de suite et le
 * mouvement serait bloqué au bout de 2°. On combine donc deux choses :
 *  - `GROUND_CLEARANCE` : la caméra ne passe jamais sous le sol ;
 *  - `LOOK_UP_GAIN` : plus on lève les yeux, plus le point VISÉ monte. C'est lui
 *    qui fait vraiment lever la tête, la caméra n'ayant plus qu'à s'écarter un peu.
 * Résultat : on voit le haut de la cathédrale depuis le parvis.
 */
const GROUND_CLEARANCE = 0.6
const LOOK_UP_GAIN = 4.5

/** Camera 3e personne proche, type GTA arcade, avec collision mur plus stricte. */
export default function FollowCamera() {
  const { camera } = useThree()
  const desiredPos = useRef(new THREE.Vector3())
  const lookAt = useRef(new THREE.Vector3())
  const smoothedTarget = useRef(new THREE.Vector3())
  const predictedCarTarget = useRef(new THREE.Vector3())
  const currentDistance = useRef<number | null>(null)
  const smoothedTargetReady = useRef(false)
  const target = usePlayerStore((s) => s.playerObject)

  useFrame((_, delta) => {
    if (!target) return

    const rig = currentRig()
    const car = useCarStore.getState()
    const targetPosition = cameraTargetPosition(
      target.position,
      car,
      delta,
      smoothedTarget,
      smoothedTargetReady,
      predictedCarTarget,
    )
    // Orientation BRUTE, sans lissage : la souris est déjà synchronisée à l'image
    // (voir cameraStore.ts). L'amortissement qui existait ici ne compensait que
    // cette irrégularité — il ne servait plus qu'à ajouter du retard au regard.
    const { yaw, pitch } = useCameraStore.getState()

    const ox = targetPosition.x
    const oy = targetPosition.y + rig.lookHeight
    const oz = targetPosition.z

    const horiz = Math.cos(pitch) * rig.distance
    const dirX = Math.sin(yaw) * horiz
    const dirZ = Math.cos(yaw) * horiz
    const upY = Math.sin(pitch) * rig.distance

    const obstructedAt = (t: number) => cameraObstructed(ox + dirX * t, oy + upY * t, oz + dirZ * t)

    let targetDistance = rig.distance
    for (let s = 1; s <= COLLISION_STEPS; s++) {
      const t = s / COLLISION_STEPS
      if (!obstructedAt(t)) continue
      // Dichotomie entre le dernier point libre et le premier point bloqué :
      // on obtient une distance continue, donc pas de saut d'une image à l'autre.
      let free = (s - 1) / COLLISION_STEPS
      let blocked = t
      for (let r = 0; r < COLLISION_REFINE; r++) {
        const mid = (free + blocked) * 0.5
        if (obstructedAt(mid)) blocked = mid
        else free = mid
      }
      targetDistance = Math.max(rig.minDistance, rig.distance * free - rig.wallMargin)
      break
    }

    if (currentDistance.current === null || currentDistance.current > rig.distance + 1.5) {
      currentDistance.current = targetDistance
    } else {
      const speed = targetDistance < currentDistance.current ? DISTANCE_CLOSE_SPEED : DISTANCE_RELEASE_SPEED
      const t = 1 - Math.exp(-speed * delta)
      currentDistance.current += (targetDistance - currentDistance.current) * t
    }

    const f = currentDistance.current / rig.distance
    desiredPos.current.set(ox + dirX * f, oy + upY * f, oz + dirZ * f)

    const follow = 1 - Math.exp(-rig.follow * delta)
    camera.position.lerp(desiredPos.current, follow)

    // La caméra ne s'enfonce jamais dans le sol (indispensable dès que le pitch
    // devient négatif, mais utile aussi dans les descentes).
    const floorY = terrainHeight(camera.position.x, camera.position.z) + GROUND_CLEARANCE
    if (camera.position.y < floorY) camera.position.y = floorY

    // Point visé : il MONTE quand on lève les yeux. C'est ce qui permet de voir
    // le ciel et le haut des bâtiments sans avoir à enterrer la caméra.
    const lookUp = Math.max(0, -pitch) * LOOK_UP_GAIN
    lookAt.current.set(
      ox - Math.sin(yaw) * LOOK_AHEAD,
      oy + lookUp,
      oz - Math.cos(yaw) * LOOK_AHEAD,
    )
    camera.lookAt(lookAt.current)
  }, FRAME.CAMERA)

  return null
}

function currentRig(): CameraRig {
  if (useCarStore.getState().riding) return CAR_RIG
  if (useScooterStore.getState().riding) return SCOOTER_RIG
  return ON_FOOT
}

function cameraTargetPosition(
  target: THREE.Vector3,
  car: ReturnType<typeof useCarStore.getState>,
  delta: number,
  smoothed: MutableRefObject<THREE.Vector3>,
  ready: MutableRefObject<boolean>,
  predicted: MutableRefObject<THREE.Vector3>,
) {
  if (!car.riding) {
    ready.current = false
    return target
  }

  predicted.current.set(
    car.driverX + car.velocityX * CAR_TARGET_PREDICT_SECONDS,
    car.driverY + car.velocityY * CAR_TARGET_PREDICT_SECONDS * 0.35,
    car.driverZ + car.velocityZ * CAR_TARGET_PREDICT_SECONDS,
  )

  if (!ready.current) {
    smoothed.current.copy(predicted.current)
    ready.current = true
    return smoothed.current
  }

  if (smoothed.current.distanceToSquared(predicted.current) > 64) {
    smoothed.current.copy(predicted.current)
    return smoothed.current
  }

  const txz = 1 - Math.exp(-CAR_TARGET_FOLLOW_XZ * delta)
  const ty = 1 - Math.exp(-CAR_TARGET_FOLLOW_Y * delta)
  smoothed.current.x += (predicted.current.x - smoothed.current.x) * txz
  smoothed.current.z += (predicted.current.z - smoothed.current.z) * txz
  smoothed.current.y += (predicted.current.y - smoothed.current.y) * ty
  return smoothed.current
}

function cameraObstructed(x: number, y: number, z: number): boolean {
  // ⚠️ `buildingHeightAt` renvoie 0 quand il n'y a AUCUN bâtiment. Sans le test
  // `> 0`, tout point sous l'altitude 0 était déclaré "dans un mur" — donc dans
  // les quartiers bas de Beauvais (le relief passe sous la cathédrale, qui est le
  // zéro du monde) la caméra se collait au perso en permanence, sans raison.
  const blocked = (sx: number, sz: number) => {
    const top = buildingHeightAt(sx, sz)
    return top > 0 && y < top + 0.35
  }
  return (
    blocked(x, z) ||
    blocked(x + CAMERA_RADIUS, z) ||
    blocked(x - CAMERA_RADIUS, z) ||
    blocked(x, z + CAMERA_RADIUS) ||
    blocked(x, z - CAMERA_RADIUS)
  )
}
