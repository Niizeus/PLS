import * as THREE from 'three'
import {
  MINUTES_PER_DAY,
  getDaylightFactor,
  getMinuteOfDay,
  getSolarElevationFactor,
} from './gameTimeStore'

const LUNAR_HALF_CYCLE_DAYS = 7
const LUNAR_FULL_CYCLE_DAYS = LUNAR_HALF_CYCLE_DAYS * 2

export interface CelestialCycle {
  hour: number
  daylight: number
  night: number
  solarElevation: number
  moonPhase: number
  sunVisibility: number
  moonVisibility: number
  starsVisibility: number
  cloudVisibility: number
  starRotation: number
}

export function getCelestialCycle(totalMinutes: number): CelestialCycle {
  const hour = getMinuteOfDay(totalMinutes) / 60
  const daylight = getDaylightFactor(totalMinutes)
  const night = 1 - daylight
  const solarElevation = getSolarElevationFactor(totalMinutes)
  const moonElevation = getMoonElevationFactor(totalMinutes)
  const moonTimeVisibility =
    hour >= 12
      ? smoothstep(18.35, 19.3, hour)
      : 1 - smoothstep(5.0, 5.65, hour)

  return {
    hour,
    daylight,
    night,
    solarElevation,
    moonPhase: getMoonPhase(totalMinutes),
    sunVisibility: smoothstep(0.02, 0.16, daylight),
    moonVisibility:
      smoothstep(0.1, 0.32, night) * smoothstep(0.18, 0.42, moonElevation) * moonTimeVisibility,
    starsVisibility: smoothstep(0.18, 0.72, night),
    cloudVisibility: 0.08 + daylight * 0.58,
    starRotation: (totalMinutes / MINUTES_PER_DAY) * Math.PI * 2,
  }
}

export function writeSunLightOffset(totalMinutes: number, out: THREE.Vector3) {
  const cycle = getCelestialCycle(totalMinutes)
  const dayAngle = ((cycle.hour - 6) / 12) * Math.PI
  const orbitRadius = cycle.sunVisibility > 0.03 ? 34 : 22
  const height = cycle.sunVisibility > 0.03 ? 12 + cycle.solarElevation * 46 : 24
  out.set(Math.cos(dayAngle) * orbitRadius, height, Math.sin(dayAngle) * orbitRadius)
}

export function writeSunSkyPosition(totalMinutes: number, distance: number, out: THREE.Vector3) {
  const hour = getMinuteOfDay(totalMinutes) / 60
  const dayArc = clamp01((hour - 6) / 12)
  const dayAngle = dayArc * Math.PI
  out
    .set(Math.cos(dayAngle) * 0.82, Math.sin(dayAngle) * 0.74 + 0.06, Math.sin(dayAngle) * 0.82)
    .normalize()
    .multiplyScalar(distance)
}

export function writeMoonSkyPosition(totalMinutes: number, distance: number, out: THREE.Vector3) {
  const hour = getMinuteOfDay(totalMinutes) / 60
  const nightArc = (((hour - 18 + 24) % 24) / 12) * Math.PI
  out
    .set(-Math.cos(nightArc) * 0.78, Math.sin(nightArc) * 0.64 + 0.1, -Math.sin(nightArc) * 0.78)
    .normalize()
    .multiplyScalar(distance)
}

function getMoonElevationFactor(totalMinutes: number): number {
  const hour = getMinuteOfDay(totalMinutes) / 60
  const hoursSinceMoonrise = (hour - 18 + 24) % 24
  if (hoursSinceMoonrise > 12) return 0
  return Math.sin((hoursSinceMoonrise / 12) * Math.PI)
}

function getMoonPhase(totalMinutes: number): number {
  // La phase change autour de midi, quand la lune est cachée. Une même nuit garde
  // donc la même forme, ce qui évite l'effet "toupie" pendant qu'on la regarde.
  const lunarDay = Math.max(0, Math.floor((totalMinutes - 12 * 60) / MINUTES_PER_DAY))
  const cycleDay = lunarDay % LUNAR_FULL_CYCLE_DAYS
  const amount = cycleDay < LUNAR_HALF_CYCLE_DAYS
    ? cycleDay / LUNAR_HALF_CYCLE_DAYS
    : (LUNAR_FULL_CYCLE_DAYS - cycleDay) / LUNAR_HALF_CYCLE_DAYS
  return amount * 0.92
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp01((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
