import { create } from 'zustand'

export const MINUTES_PER_DAY = 24 * 60
export const START_TIME_MINUTES = 8 * 60
export const REAL_SECONDS_PER_GAME_DAY = 60 * 60
export const GAME_MINUTES_PER_REAL_SECOND = MINUTES_PER_DAY / REAL_SECONDS_PER_GAME_DAY

export type DayPhase = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night'

interface GameTimeState {
  totalMinutes: number
  timeScale: number
  isPaused: boolean
  advance: (realDeltaSeconds: number) => void
  setPaused: (isPaused: boolean) => void
  setTimeScale: (timeScale: number) => void
  setTotalMinutes: (totalMinutes: number) => void
}

export const useGameTimeStore = create<GameTimeState>((set) => ({
  totalMinutes: START_TIME_MINUTES,
  timeScale: 1,
  isPaused: false,
  advance: (realDeltaSeconds) =>
    set((state) => {
      if (state.isPaused || state.timeScale <= 0) return state
      return {
        totalMinutes:
          state.totalMinutes + realDeltaSeconds * GAME_MINUTES_PER_REAL_SECOND * state.timeScale,
      }
    }),
  setPaused: (isPaused) => set({ isPaused }),
  setTimeScale: (timeScale) => set({ timeScale: Math.max(0, timeScale) }),
  setTotalMinutes: (totalMinutes) => set({ totalMinutes: Math.max(0, totalMinutes) }),
}))

export function getMinuteOfDay(totalMinutes: number): number {
  return Math.floor(((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY)
}

export function getDayNumber(totalMinutes: number): number {
  return Math.floor(totalMinutes / MINUTES_PER_DAY) + 1
}

export function getDayIndex(totalMinutes: number): number {
  return Math.floor(totalMinutes / MINUTES_PER_DAY) % DAY_NAMES.length
}

export function formatGameTime(totalMinutes: number): string {
  const minuteOfDay = getMinuteOfDay(totalMinutes)
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

export function getDayName(totalMinutes: number): string {
  return DAY_NAMES[getDayIndex(totalMinutes)]
}

export function getDayPhase(totalMinutes: number): DayPhase {
  const hour = getMinuteOfDay(totalMinutes) / 60
  if (hour >= 5 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export function getDayPhaseLabel(phase: DayPhase): string {
  return DAY_PHASE_LABELS[phase]
}

export function getDaylightFactor(totalMinutes: number): number {
  const hour = getMinuteOfDay(totalMinutes) / 60
  const sunrise = smoothstep(5.35, 7.25, hour)
  const sunset = 1 - smoothstep(18.25, 20.35, hour)
  return clamp01(sunrise * sunset)
}

export function getSolarElevationFactor(totalMinutes: number): number {
  const hour = getMinuteOfDay(totalMinutes) / 60
  const dayArc = clamp01((hour - 6) / 12)
  return Math.sin(dayArc * Math.PI) * getDaylightFactor(totalMinutes)
}

export interface SkyColors {
  top: string
  horizon: string
  fog: string
}

export function getSkyColors(totalMinutes: number): SkyColors {
  const hour = getMinuteOfDay(totalMinutes) / 60

  if (hour >= 5.25 && hour < 6.5) {
    return mixSky(NIGHT_SKY, DAWN_SKY, smoothstep(5.25, 6.5, hour))
  }
  if (hour >= 6.5 && hour < 7.6) {
    return mixSky(DAWN_SKY, DAY_SKY, smoothstep(6.5, 7.6, hour))
  }
  if (hour >= 17.2 && hour < 18.8) {
    return mixSky(DAY_SKY, EVENING_SKY, smoothstep(17.2, 18.8, hour))
  }
  if (hour >= 18.8 && hour < 20.8) {
    return mixSky(EVENING_SKY, NIGHT_SKY, smoothstep(18.8, 20.8, hour))
  }
  if (hour >= 7.6 && hour < 17.2) return DAY_SKY

  return NIGHT_SKY
}

function mixSky(from: SkyColors, to: SkyColors, amount: number): SkyColors {
  return {
    top: mixHex(from.top, to.top, amount),
    horizon: mixHex(from.horizon, to.horizon, amount),
    fog: mixHex(from.fog, to.fog, amount),
  }
}

function mixHex(from: string, to: string, amount: number): string {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const t = clamp01(amount)
  return rgbToHex({
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
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

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp01((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const DAY_PHASE_LABELS: Record<DayPhase, string> = {
  dawn: 'Aube',
  morning: 'Matin',
  afternoon: 'Apres-midi',
  evening: 'Soiree',
  night: 'Nuit',
}

const DAY_SKY: SkyColors = {
  top: '#6f9ed4',
  horizon: '#d6e8ee',
  fog: '#d6e8ee',
}

const DAWN_SKY: SkyColors = {
  top: '#536f9c',
  horizon: '#ffc38a',
  fog: '#c29b89',
}

const EVENING_SKY: SkyColors = {
  top: '#485d86',
  horizon: '#f0a05a',
  fog: '#977077',
}

const NIGHT_SKY: SkyColors = {
  top: '#101a38',
  horizon: '#28324f',
  fog: '#20283f',
}
