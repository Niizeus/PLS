import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FRAME } from './framePriority'
import {
  getCelestialCycle,
  writeMoonSkyPosition,
  writeSunSkyPosition,
} from '../gameplay/time/celestialCycle'
import { getSkyColors, useGameTimeStore } from '../gameplay/time/gameTimeStore'

const SKY_DISTANCE = 180
const STAR_COUNT = 1600
const CLOUD_COUNT = 22

function makeGradient(topColor: string, horizonColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, topColor)
  gradient.addColorStop(0.48, topColor)
  gradient.addColorStop(0.78, horizonColor)
  gradient.addColorStop(1, horizonColor)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const haze = ctx.createLinearGradient(0, 0, 0, canvas.height)
  haze.addColorStop(0, 'rgba(255, 255, 255, 0)')
  haze.addColorStop(0.66, 'rgba(255, 255, 255, 0.08)')
  haze.addColorStop(0.9, 'rgba(255, 246, 220, 0.14)')
  haze.addColorStop(1, 'rgba(255, 255, 255, 0.04)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeSunTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 192
  const ctx = canvas.getContext('2d')!

  ctx.translate(96, 96)
  for (let i = 0; i < 28; i += 1) {
    ctx.rotate((Math.PI * 2) / 28)
    const ray = ctx.createLinearGradient(18, 0, 92, 0)
    ray.addColorStop(0, 'rgba(255, 230, 150, 0.045)')
    ray.addColorStop(0.4, 'rgba(255, 204, 106, 0.018)')
    ray.addColorStop(1, 'rgba(255, 188, 80, 0)')
    ctx.fillStyle = ray
    ctx.beginPath()
    ctx.moveTo(18, -4)
    ctx.lineTo(94, -16)
    ctx.lineTo(94, 16)
    ctx.lineTo(18, 4)
    ctx.closePath()
    ctx.fill()
  }
  ctx.resetTransform()

  const glow = ctx.createRadialGradient(96, 96, 10, 96, 96, 88)
  glow.addColorStop(0, 'rgba(255, 248, 205, 1)')
  glow.addColorStop(0.22, 'rgba(255, 223, 103, 1)')
  glow.addColorStop(0.42, 'rgba(255, 195, 86, 0.42)')
  glow.addColorStop(0.76, 'rgba(255, 170, 90, 0.12)')
  glow.addColorStop(1, 'rgba(255, 162, 81, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 192, 192)

  ctx.fillStyle = 'rgba(255, 250, 210, 0.95)'
  ctx.beginPath()
  ctx.arc(96, 96, 26, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function makeSunGlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const glow = ctx.createRadialGradient(128, 128, 4, 128, 128, 126)
  glow.addColorStop(0, 'rgba(255, 250, 220, 0.95)')
  glow.addColorStop(0.1, 'rgba(255, 238, 178, 0.5)')
  glow.addColorStop(0.28, 'rgba(255, 218, 128, 0.16)')
  glow.addColorStop(0.58, 'rgba(255, 202, 122, 0.045)')
  glow.addColorStop(1, 'rgba(255, 202, 122, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 256, 256)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function makeMoonTexture(phase: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(canvas.width, canvas.height)
  const phaseCos = Math.cos(phase * Math.PI * 2)
  const litSide = phase > 0.5 ? 1 : -1

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const nx = (x - 128) / 84
      const ny = (y - 128) / 84
      const radius = Math.sqrt(nx * nx + ny * ny)
      if (radius > 1) continue

      const terminator = -phaseCos * Math.sqrt(Math.max(0, 1 - ny * ny * 0.82))
      const lit = smoothstep(terminator - 0.055, terminator + 0.075, litSide * nx)
      const rim = 1 - smoothstep(0.9, 1, radius)
      const sphereShade = 0.66 + Math.sqrt(Math.max(0, 1 - radius * radius)) * 0.34
      const terrain = moonTerrain(nx, ny)
      const relief = 1 + terrain * 0.18
      const litR = 220 * sphereShade * relief
      const litG = 222 * sphereShade * relief
      const litB = 224 * sphereShade * relief
      const darkR = 35 + terrain * 18
      const darkG = 43 + terrain * 18
      const darkB = 58 + terrain * 22
      const surface = 0.24 + lit * 0.76
      const idx = (y * canvas.width + x) * 4
      image.data[idx] = mix(darkR, litR, lit)
      image.data[idx + 1] = mix(darkG, litG, lit)
      image.data[idx + 2] = mix(darkB, litB, lit)
      image.data[idx + 3] = Math.round((0.42 + surface * 0.58) * rim * 255)
    }
  }
  ctx.putImageData(image, 0, 0)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.beginPath()
  ctx.arc(98, 104, 10, 0, Math.PI * 2)
  ctx.arc(118, 156, 8, 0, Math.PI * 2)
  ctx.arc(80, 134, 6, 0, Math.PI * 2)
  ctx.arc(148, 92, 7, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function makeMoonGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const glow = ctx.createRadialGradient(64, 64, 20, 64, 64, 63)
  glow.addColorStop(0, 'rgba(220, 235, 255, 0.45)')
  glow.addColorStop(0.46, 'rgba(174, 204, 255, 0.16)')
  glow.addColorStop(1, 'rgba(174, 204, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 128, 128)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function makeCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const puff = (x: number, y: number, rx: number, ry: number, alpha: number) => {
    const gradient = ctx.createRadialGradient(x, y, 3, x, y, Math.max(rx, ry))
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    gradient.addColorStop(0.62, `rgba(255, 255, 255, ${alpha * 0.7})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  puff(68, 72, 56, 24, 0.72)
  puff(104, 58, 52, 31, 0.78)
  puff(142, 70, 64, 25, 0.68)
  puff(176, 61, 42, 20, 0.48)
  puff(126, 82, 84, 21, 0.34)

  ctx.fillStyle = 'rgba(190, 215, 235, 0.16)'
  ctx.beginPath()
  ctx.ellipse(126, 91, 82, 14, 0, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createStarGeometry(): THREE.BufferGeometry {
  let seed = 13579
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const color = new THREE.Color()

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const azimuth = random() * Math.PI * 2
    const elevation = Math.pow(random(), 0.62) * Math.PI * 0.54 + 0.04
    const radius = SKY_DISTANCE - 3 + random() * 5
    const x = Math.cos(azimuth) * Math.cos(elevation) * radius
    const y = Math.sin(elevation) * radius
    const z = Math.sin(azimuth) * Math.cos(elevation) * radius

    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z

    color.set(random() > 0.82 ? '#d7e7ff' : '#fff9df')
    const brightness = 0.58 + random() * 0.42
    colors[i * 3] = color.r * brightness
    colors[i * 3 + 1] = color.g * brightness
    colors[i * 3 + 2] = color.b * brightness
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function createCloudSprites() {
  return Array.from({ length: CLOUD_COUNT }, (_, index) => {
    const angle = (index / CLOUD_COUNT) * Math.PI * 2
    const radius = SKY_DISTANCE - 34 - (index % 3) * 8
    const height = 42 + (index % 6) * 10
    const width = 32 + (index % 5) * 8
    return {
      position: [
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius,
      ] as [number, number, number],
      scale: [width, width * 0.42, 1] as [number, number, number],
      rotation: [0, 0, ((index % 5) - 2) * 0.08] as [number, number, number],
    }
  })
}

export default function DynamicSky() {
  const { camera, scene } = useThree()
  const root = useRef<THREE.Group>(null)
  const starLayer = useRef<THREE.Group>(null)
  const cloudLayer = useRef<THREE.Group>(null)
  const stars = useRef<THREE.PointsMaterial>(null)
  const sun = useRef<THREE.SpriteMaterial>(null)
  const sunGlare = useRef<THREE.SpriteMaterial>(null)
  const moonGlow = useRef<THREE.SpriteMaterial>(null)
  const moon = useRef<THREE.SpriteMaterial>(null)
  const displayMinute = useGameTimeStore((state) => Math.floor(state.totalMinutes))
  const displayCycle = useMemo(() => getCelestialCycle(displayMinute), [displayMinute])
  const moonPhaseStep = displayCycle.moonPhase
  const colors = useMemo(() => getSkyColors(displayMinute), [displayMinute])
  const background = useMemo(() => makeGradient(colors.top, colors.horizon), [colors.horizon, colors.top])
  const starGeometry = useMemo(() => createStarGeometry(), [])
  const clouds = useMemo(() => createCloudSprites(), [])
  const sunTexture = useMemo(() => makeSunTexture(), [])
  const sunGlareTexture = useMemo(() => makeSunGlareTexture(), [])
  const moonTexture = useMemo(() => makeMoonTexture(moonPhaseStep), [moonPhaseStep])
  const moonGlowTexture = useMemo(() => makeMoonGlowTexture(), [])
  const cloudTexture = useMemo(() => makeCloudTexture(), [])
  const cloudMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: cloudTexture,
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        fog: false,
        toneMapped: false,
      }),
    [cloudTexture],
  )
  const scratch = useMemo(
    () => ({
      sunPosition: new THREE.Vector3(),
      moonPosition: new THREE.Vector3(),
      cameraPosition: new THREE.Vector3(),
      cameraForward: new THREE.Vector3(),
      sunDirection: new THREE.Vector3(),
    }),
    [],
  )

  useEffect(() => {
    const previous = scene.background
    scene.background = background
    return () => {
      if (scene.background === background) scene.background = previous
      background.dispose()
    }
  }, [background, scene])

  useEffect(() => {
    return () => {
      starGeometry.dispose()
      sunTexture.dispose()
      sunGlareTexture.dispose()
      moonGlowTexture.dispose()
      cloudTexture.dispose()
      cloudMaterial.dispose()
    }
  }, [cloudMaterial, cloudTexture, moonGlowTexture, starGeometry, sunGlareTexture, sunTexture])

  useEffect(() => {
    return () => moonTexture.dispose()
  }, [moonTexture])

  useFrame(() => {
    const totalMinutes = useGameTimeStore.getState().totalMinutes
    const cycle = getCelestialCycle(totalMinutes)

    if (root.current) {
      camera.getWorldPosition(scratch.cameraPosition)
      root.current.position.copy(scratch.cameraPosition)
    }

    if (starLayer.current) {
      starLayer.current.rotation.y = -cycle.starRotation * 0.055
    }

    if (cloudLayer.current) {
      cloudLayer.current.rotation.y = cycle.starRotation * 0.026
    }

    if (stars.current) {
      stars.current.opacity = cycle.starsVisibility
      stars.current.size = 0.55 + cycle.starsVisibility * 0.45
    }

    if (sun.current) sun.current.opacity = cycle.sunVisibility
    if (sunGlare.current) {
      writeSunSkyPosition(totalMinutes, 1, scratch.sunDirection)
      camera.getWorldDirection(scratch.cameraForward)
      const lookAlignment = scratch.cameraForward.dot(scratch.sunDirection.normalize())
      sunGlare.current.opacity = smoothstep(0.955, 0.997, lookAlignment) * cycle.sunVisibility * 0.38
    }
    if (moonGlow.current) {
      moonGlow.current.opacity = cycle.moonVisibility * 0.95
      moonGlow.current.rotation = 0
    }
    if (moon.current) {
      moon.current.opacity = cycle.moonVisibility
      moon.current.rotation = 0
    }
    cloudMaterial.opacity = cycle.cloudVisibility
  }, FRAME.CAMERA + 0.1)

  const totalMinutes = useGameTimeStore.getState().totalMinutes
  const sunPosition = writePosition(totalMinutes, SKY_DISTANCE - 18, scratch.sunPosition, writeSunSkyPosition)
  const moonPosition = writePosition(totalMinutes, SKY_DISTANCE - 20, scratch.moonPosition, writeMoonSkyPosition)

  return (
    <group ref={root} renderOrder={-1000}>
      <group ref={starLayer}>
        <points geometry={starGeometry} renderOrder={-980}>
          <pointsMaterial
            ref={stars}
            vertexColors
            transparent
            opacity={0}
            size={0.8}
            sizeAttenuation
            depthWrite={false}
            depthTest
            fog={false}
          />
        </points>
      </group>
      <group ref={cloudLayer}>
        {clouds.map((cloud, index) => (
          <sprite
            key={index}
            material={cloudMaterial}
            position={cloud.position}
            rotation={cloud.rotation}
            scale={cloud.scale}
            renderOrder={-975}
          />
        ))}
      </group>
      <sprite position={sunPosition} scale={[68, 68, 1]} renderOrder={-970}>
        <spriteMaterial
          ref={sunGlare}
          map={sunGlareTexture}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          fog={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite position={sunPosition} scale={[24, 24, 1]} renderOrder={-969}>
        <spriteMaterial
          ref={sun}
          map={sunTexture}
          transparent
          opacity={1}
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
        />
      </sprite>
      <sprite position={moonPosition} scale={[21, 21, 1]} renderOrder={-965}>
        <spriteMaterial
          ref={moonGlow}
          map={moonGlowTexture}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
        />
      </sprite>
      <sprite position={moonPosition} scale={[13, 13, 1]} renderOrder={-960}>
        <spriteMaterial
          ref={moon}
          map={moonTexture}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest
          fog={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}

function writePosition(
  totalMinutes: number,
  distance: number,
  out: THREE.Vector3,
  writer: (totalMinutes: number, distance: number, out: THREE.Vector3) => void,
) {
  writer(totalMinutes, distance, out)
  return [out.x, out.y, out.z] as [number, number, number]
}

const MOON_CRATERS = [
  { x: -0.46, y: -0.12, r: 0.17, d: 0.55 },
  { x: -0.22, y: 0.34, r: 0.13, d: 0.42 },
  { x: 0.18, y: -0.28, r: 0.2, d: 0.48 },
  { x: 0.38, y: 0.08, r: 0.15, d: 0.38 },
  { x: 0.05, y: 0.48, r: 0.11, d: 0.32 },
  { x: -0.08, y: -0.02, r: 0.26, d: 0.24 },
] as const

function moonTerrain(nx: number, ny: number): number {
  const broad = fbm(nx * 1.55 + 8.2, ny * 1.55 - 3.4, 4)
  const maria = fbm(nx * 3.1 - 2.8, ny * 2.7 + 5.6, 3)
  const grain = fbm(nx * 11.5 + 1.1, ny * 11.5 - 6.7, 3)
  let terrain = (broad - 0.5) * 0.72 + (maria - 0.5) * 0.5 + (grain - 0.5) * 0.16

  for (const crater of MOON_CRATERS) {
    const dx = nx - crater.x
    const dy = ny - crater.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const bowl = 1 - smoothstep(crater.r * 0.2, crater.r, dist)
    const rim = smoothstep(crater.r * 0.68, crater.r, dist) * (1 - smoothstep(crater.r, crater.r * 1.28, dist))
    terrain -= bowl * crater.d * 0.28
    terrain += rim * crater.d * 0.2
  }

  return Math.min(1, Math.max(-1, terrain))
}

function fbm(x: number, y: number, octaves: number): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  let total = 0

  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise(x * frequency, y * frequency) * amplitude
    total += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return value / total
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = fade(x - x0)
  const ty = fade(y - y0)
  const a = hash2(x0, y0)
  const b = hash2(x0 + 1, y0)
  const c = hash2(x0, y0 + 1)
  const d = hash2(x0 + 1, y0 + 1)
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty)
}

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10)
}

function mix(from: number, to: number, amount: number): number {
  return Math.round(Math.min(255, Math.max(0, from + (to - from) * amount)))
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return x * x * (3 - 2 * x)
}
