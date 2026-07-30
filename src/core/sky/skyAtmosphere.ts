import { MINUTES_PER_DAY, getMinuteOfDay } from '../../gameplay/time/gameTimeStore'

export interface PaintSkyPalette {
  horizon: string
  zenith: string
  paintA: string
  paintB: string
  paintC: string
  glow: string
}

export interface PaintSkyShapeProfile {
  opacity: number
  primaryShapeScale: number
  secondaryShapeScale: number
  warpStrength: number
  shapeSoftness: number
  horizontalStretch: number
  animationSpeed: number
  horizonIntensity: number
  zenithIntensity: number
  sunHaloIntensity: number
  moonHaloIntensity: number
}

export interface SkyEnvironmentProfile {
  fog: string
  fogNear: number
  fogFar: number
  sunLight: string
  ambientLight: string
  hemisphereSky: string
  hemisphereGround: string
  cloudLight: string
  cloudSoft: string
  cloudShadow: string
  particleColor: string
  particleBaseOpacity: number
  materialTintStrength: number
  fogIntensity: number
  cloudTintStrength: number
  particleIntensity: number
  horizonGlowStrength: number
}

export interface SkyAtmosphere extends PaintSkyPalette, PaintSkyShapeProfile, SkyEnvironmentProfile {
  dayProgress: number
}

export interface SkyTuning {
  paint: {
    enabled: number
    opacity: number
    primaryShapeScale: number
    secondaryShapeScale: number
    warpStrength: number
    shapeSoftness: number
    horizontalStretch: number
    animationSpeed: number
    horizonIntensity: number
    zenithIntensity: number
    sunHaloIntensity: number
    moonHaloIntensity: number
    materialTint: number
    fogIntensity: number
    cloudTint: number
    particleIntensity: number
    horizonGlowIntensity: number
  }
}

export const SKY_TUNING_DEFAULTS: SkyTuning = {
  paint: {
    enabled: 1,
    opacity: 0.72,
    primaryShapeScale: 1,
    secondaryShapeScale: 1,
    warpStrength: 1,
    shapeSoftness: 1,
    horizontalStretch: 1,
    animationSpeed: 1,
    horizonIntensity: 1,
    zenithIntensity: 1,
    sunHaloIntensity: 1,
    moonHaloIntensity: 1,
    materialTint: 1,
    fogIntensity: 1,
    cloudTint: 1,
    particleIntensity: 1,
    horizonGlowIntensity: 1,
  },
}

const NIGHT: SkyAtmosphere = {
  dayProgress: 0,
  horizon: '#241f3f',
  zenith: '#080f2d',
  paintA: '#1f315f',
  paintB: '#4a2d68',
  paintC: '#8d3d79',
  glow: '#d26a72',
  opacity: 0.54,
  primaryShapeScale: 0.72,
  secondaryShapeScale: 1.14,
  warpStrength: 0.32,
  shapeSoftness: 0.42,
  horizontalStretch: 2.55,
  animationSpeed: 0.26,
  horizonIntensity: 0.72,
  zenithIntensity: 0.72,
  sunHaloIntensity: 0.04,
  moonHaloIntensity: 0.52,
  fog: '#171e35',
  fogNear: 56,
  fogFar: 134,
  sunLight: '#8ca5ff',
  ambientLight: '#4e5d92',
  hemisphereSky: '#1d2850',
  hemisphereGround: '#271d2c',
  cloudLight: '#8190bc',
  cloudSoft: '#414973',
  cloudShadow: '#252a4d',
  particleColor: '#bd8cff',
  particleBaseOpacity: 0.045,
  materialTintStrength: 0.58,
  fogIntensity: 1.05,
  cloudTintStrength: 0.78,
  particleIntensity: 0.72,
  horizonGlowStrength: 0.7,
}

const DAWN: SkyAtmosphere = {
  dayProgress: 0,
  horizon: '#ffd46f',
  zenith: '#6d80c7',
  paintA: '#ff9a67',
  paintB: '#ff7cab',
  paintC: '#9b7ad5',
  glow: '#ffe0a0',
  opacity: 0.76,
  primaryShapeScale: 0.94,
  secondaryShapeScale: 1.35,
  warpStrength: 0.46,
  shapeSoftness: 0.5,
  horizontalStretch: 2.25,
  animationSpeed: 0.34,
  horizonIntensity: 1.18,
  zenithIntensity: 0.84,
  sunHaloIntensity: 0.7,
  moonHaloIntensity: 0.15,
  fog: '#d98d84',
  fogNear: 56,
  fogFar: 144,
  sunLight: '#ffd29c',
  ambientLight: '#956fa0',
  hemisphereSky: '#b17bc1',
  hemisphereGround: '#6f4c45',
  cloudLight: '#ffd0b5',
  cloudSoft: '#ff9fb8',
  cloudShadow: '#b36e94',
  particleColor: '#ffd08a',
  particleBaseOpacity: 0.09,
  materialTintStrength: 0.55,
  fogIntensity: 1.1,
  cloudTintStrength: 0.9,
  particleIntensity: 0.95,
  horizonGlowStrength: 1.05,
}

const DAY: SkyAtmosphere = {
  dayProgress: 0,
  horizon: '#dff7ff',
  zenith: '#70b5eb',
  paintA: '#fff3dc',
  paintB: '#83ddea',
  paintC: '#4c9fe0',
  glow: '#fff7d6',
  opacity: 0.43,
  primaryShapeScale: 1.22,
  secondaryShapeScale: 1.8,
  warpStrength: 0.28,
  shapeSoftness: 0.58,
  horizontalStretch: 2.0,
  animationSpeed: 0.3,
  horizonIntensity: 0.84,
  zenithIntensity: 0.98,
  sunHaloIntensity: 0.46,
  moonHaloIntensity: 0.03,
  fog: '#c7edf1',
  fogNear: 70,
  fogFar: 166,
  sunLight: '#fff4d6',
  ambientLight: '#abcde8',
  hemisphereSky: '#bfeaff',
  hemisphereGround: '#68725a',
  cloudLight: '#fff7e8',
  cloudSoft: '#bceef3',
  cloudShadow: '#93b8cc',
  particleColor: '#fff4d5',
  particleBaseOpacity: 0.022,
  materialTintStrength: 0.18,
  fogIntensity: 0.82,
  cloudTintStrength: 0.45,
  particleIntensity: 0.35,
  horizonGlowStrength: 0.32,
}

const SUNSET: SkyAtmosphere = {
  dayProgress: 0,
  horizon: '#ff8848',
  zenith: '#3c356b',
  paintA: '#ff563e',
  paintB: '#ff4fa2',
  paintC: '#aa46cc',
  glow: '#ffd07a',
  opacity: 0.88,
  primaryShapeScale: 0.78,
  secondaryShapeScale: 1.12,
  warpStrength: 0.5,
  shapeSoftness: 0.46,
  horizontalStretch: 2.85,
  animationSpeed: 0.32,
  horizonIntensity: 1.38,
  zenithIntensity: 0.78,
  sunHaloIntensity: 0.9,
  moonHaloIntensity: 0.05,
  fog: '#bf6d76',
  fogNear: 50,
  fogFar: 136,
  sunLight: '#ff9a66',
  ambientLight: '#a05489',
  hemisphereSky: '#73436f',
  hemisphereGround: '#6f463f',
  cloudLight: '#ffc0a7',
  cloudSoft: '#ff829e',
  cloudShadow: '#8d5b82',
  particleColor: '#ffb36a',
  particleBaseOpacity: 0.11,
  materialTintStrength: 0.68,
  fogIntensity: 1.22,
  cloudTintStrength: 1,
  particleIntensity: 1,
  horizonGlowStrength: 1.25,
}

export function getSkyAtmosphere(totalMinutes: number): SkyAtmosphere {
  const hour = getMinuteOfDay(totalMinutes) / 60
  const dayProgress = getMinuteOfDay(totalMinutes) / MINUTES_PER_DAY
  const atmosphere = getTimedAtmosphere(hour)
  return { ...atmosphere, dayProgress }
}

export function applySkyTuning(atmosphere: SkyAtmosphere, tuning: SkyTuning): SkyAtmosphere {
  const paint = tuning.paint
  return {
    ...atmosphere,
    opacity: clamp(atmosphere.opacity * paint.opacity, 0, 1.2),
    primaryShapeScale: atmosphere.primaryShapeScale * paint.primaryShapeScale,
    secondaryShapeScale: atmosphere.secondaryShapeScale * paint.secondaryShapeScale,
    warpStrength: atmosphere.warpStrength * paint.warpStrength,
    shapeSoftness: atmosphere.shapeSoftness * paint.shapeSoftness,
    horizontalStretch: atmosphere.horizontalStretch * paint.horizontalStretch,
    animationSpeed: atmosphere.animationSpeed * paint.animationSpeed,
    horizonIntensity: atmosphere.horizonIntensity * paint.horizonIntensity,
    zenithIntensity: atmosphere.zenithIntensity * paint.zenithIntensity,
    sunHaloIntensity: atmosphere.sunHaloIntensity * paint.sunHaloIntensity,
    moonHaloIntensity: atmosphere.moonHaloIntensity * paint.moonHaloIntensity,
    materialTintStrength: atmosphere.materialTintStrength * paint.materialTint,
    fogIntensity: atmosphere.fogIntensity * paint.fogIntensity,
    cloudTintStrength: atmosphere.cloudTintStrength * paint.cloudTint,
    particleIntensity: atmosphere.particleIntensity * paint.particleIntensity,
    horizonGlowStrength: atmosphere.horizonGlowStrength * paint.horizonGlowIntensity,
  }
}

function getTimedAtmosphere(hour: number): SkyAtmosphere {
  if (hour >= 5.05 && hour < 6.65) return mixAtmosphere(NIGHT, DAWN, smoothstep(5.05, 6.65, hour))
  if (hour >= 6.65 && hour < 8.0) return mixAtmosphere(DAWN, DAY, smoothstep(6.65, 8.0, hour))
  if (hour >= 8.0 && hour < 16.4) return DAY
  if (hour >= 16.4 && hour < 18.75) return mixAtmosphere(DAY, SUNSET, smoothstep(16.4, 18.75, hour))
  if (hour >= 18.75 && hour < 21.1) return mixAtmosphere(SUNSET, NIGHT, smoothstep(18.75, 21.1, hour))
  return NIGHT
}

function mixAtmosphere(from: SkyAtmosphere, to: SkyAtmosphere, amount: number): SkyAtmosphere {
  const t = clamp(amount, 0, 1)
  return {
    dayProgress: 0,
    horizon: mixHex(from.horizon, to.horizon, t),
    zenith: mixHex(from.zenith, to.zenith, t),
    paintA: mixHex(from.paintA, to.paintA, t),
    paintB: mixHex(from.paintB, to.paintB, t),
    paintC: mixHex(from.paintC, to.paintC, t),
    glow: mixHex(from.glow, to.glow, t),
    opacity: lerp(from.opacity, to.opacity, t),
    primaryShapeScale: lerp(from.primaryShapeScale, to.primaryShapeScale, t),
    secondaryShapeScale: lerp(from.secondaryShapeScale, to.secondaryShapeScale, t),
    warpStrength: lerp(from.warpStrength, to.warpStrength, t),
    shapeSoftness: lerp(from.shapeSoftness, to.shapeSoftness, t),
    horizontalStretch: lerp(from.horizontalStretch, to.horizontalStretch, t),
    animationSpeed: lerp(from.animationSpeed, to.animationSpeed, t),
    horizonIntensity: lerp(from.horizonIntensity, to.horizonIntensity, t),
    zenithIntensity: lerp(from.zenithIntensity, to.zenithIntensity, t),
    sunHaloIntensity: lerp(from.sunHaloIntensity, to.sunHaloIntensity, t),
    moonHaloIntensity: lerp(from.moonHaloIntensity, to.moonHaloIntensity, t),
    fog: mixHex(from.fog, to.fog, t),
    fogNear: lerp(from.fogNear, to.fogNear, t),
    fogFar: lerp(from.fogFar, to.fogFar, t),
    sunLight: mixHex(from.sunLight, to.sunLight, t),
    ambientLight: mixHex(from.ambientLight, to.ambientLight, t),
    hemisphereSky: mixHex(from.hemisphereSky, to.hemisphereSky, t),
    hemisphereGround: mixHex(from.hemisphereGround, to.hemisphereGround, t),
    cloudLight: mixHex(from.cloudLight, to.cloudLight, t),
    cloudSoft: mixHex(from.cloudSoft, to.cloudSoft, t),
    cloudShadow: mixHex(from.cloudShadow, to.cloudShadow, t),
    particleColor: mixHex(from.particleColor, to.particleColor, t),
    particleBaseOpacity: lerp(from.particleBaseOpacity, to.particleBaseOpacity, t),
    materialTintStrength: lerp(from.materialTintStrength, to.materialTintStrength, t),
    fogIntensity: lerp(from.fogIntensity, to.fogIntensity, t),
    cloudTintStrength: lerp(from.cloudTintStrength, to.cloudTintStrength, t),
    particleIntensity: lerp(from.particleIntensity, to.particleIntensity, t),
    horizonGlowStrength: lerp(from.horizonGlowStrength, to.horizonGlowStrength, t),
  }
}

function mixHex(from: string, to: string, amount: number): string {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  return rgbToHex({
    r: Math.round(lerp(a.r, b.r, amount)),
    g: Math.round(lerp(a.g, b.g, amount)),
    b: Math.round(lerp(a.b, b.b, amount)),
  })
}

function hexToRgb(hex: string) {
  const raw = hex.replace('#', '')
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  }
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

function toHex(value: number): string {
  return clamp(value, 0, 255).toString(16).padStart(2, '0')
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return x * x * (3 - 2 * x)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
