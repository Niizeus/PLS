import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getSkyTuning, useDevTuningStore } from '../../devtools/devTuningStore'
import { getCelestialCycle } from '../../gameplay/time/celestialCycle'
import { useGameTimeStore } from '../../gameplay/time/gameTimeStore'
import { applySkyTuning, getSkyAtmosphere } from './skyAtmosphere'

const PARTICLE_COUNT = 118

export default function AtmosphereParticles() {
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.PointsMaterial>(null)
  const skyOverrides = useDevTuningStore((state) => state.overrides.sky)
  const tuning = useMemo(() => getSkyTuning(), [skyOverrides])
  const geometry = useMemo(() => createParticleGeometry(), [])
  const scratch = useMemo(
    () => ({
      color: new THREE.Color(),
    }),
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    if (!group.current || !material.current) return

    const totalMinutes = useGameTimeStore.getState().totalMinutes
    const isEnabled = tuning.paint.enabled >= 0.5 && tuning.paint.particleIntensity > 0
    group.current.visible = isEnabled
    if (!isEnabled) return

    const cycle = getCelestialCycle(totalMinutes)
    const atmosphere = applySkyTuning(getSkyAtmosphere(totalMinutes), tuning)
    const sunrise = pulse(cycle.hour, 6.65, 1.8)
    const sunset = pulse(cycle.hour, 18.65, 2.35)
    const warmAir = Math.max(sunrise, sunset) * smoothstep(0.05, 0.85, cycle.daylight)
    const nightAir = smoothstep(0.38, 0.96, 1 - cycle.daylight)
    const targetOpacity =
      atmosphere.particleBaseOpacity *
      atmosphere.particleIntensity *
      (0.38 + warmAir * 0.9 + nightAir * 0.32)
    const follow = 1 - Math.exp(-2.2 * delta)

    group.current.rotation.y = totalMinutes * 0.0007
    group.current.rotation.z = Math.sin(totalMinutes * 0.004) * 0.015
    material.current.opacity = lerp(material.current.opacity, targetOpacity, follow)
    material.current.size = 0.42 + warmAir * 0.22 + nightAir * 0.16
    material.current.color.copy(scratch.color.set(atmosphere.particleColor))
  })

  return (
    <group ref={group} renderOrder={-990} frustumCulled={false}>
      <points geometry={geometry} renderOrder={-990} frustumCulled={false}>
        <pointsMaterial
          ref={material}
          transparent
          opacity={0}
          size={0.5}
          sizeAttenuation
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

function createParticleGeometry(): THREE.BufferGeometry {
  const random = createSeededRandom(46021)
  const positions = new Float32Array(PARTICLE_COUNT * 3)

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const angle = random() * Math.PI * 2
    const radius = 18 + Math.pow(random(), 0.68) * 118
    const height = 7 + Math.pow(random(), 0.72) * 54

    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = height
    positions[i * 3 + 2] = Math.sin(angle) * radius
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function pulse(value: number, center: number, radius: number): number {
  return Math.max(0, 1 - Math.abs(value - center) / radius)
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return x * x * (3 - 2 * x)
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}
