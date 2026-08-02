import programmingFile from '../data/radioProgramming.json'
import type { RadioStationId } from './radioCatalog'

export interface RadioBreakRule {
  enabled: boolean
  musicInterval: number
  maxPerBreak: number
}

export interface RadioStationProgramming {
  jingles: RadioBreakRule
  ads: RadioBreakRule
}

interface RadioProgrammingFile {
  version: number
  stations: Partial<Record<RadioStationId, Partial<RadioStationProgramming>>>
}

const DEFAULT_STATION_PROGRAMMING: RadioStationProgramming = {
  jingles: {
    enabled: true,
    musicInterval: 2,
    maxPerBreak: 1,
  },
  ads: {
    enabled: false,
    musicInterval: 0,
    maxPerBreak: 0,
  },
}

const PROGRAMMING = programmingFile as RadioProgrammingFile

export function getStationProgramming(stationId: RadioStationId): RadioStationProgramming {
  const station = PROGRAMMING.stations?.[stationId] ?? {}
  return {
    jingles: normalizeRule(station.jingles, DEFAULT_STATION_PROGRAMMING.jingles),
    ads: normalizeRule(station.ads, DEFAULT_STATION_PROGRAMMING.ads),
  }
}

function normalizeRule(rule: Partial<RadioBreakRule> | undefined, fallback: RadioBreakRule): RadioBreakRule {
  const musicInterval = Number(rule?.musicInterval ?? fallback.musicInterval)
  const maxPerBreak = Number(rule?.maxPerBreak ?? fallback.maxPerBreak)
  return {
    enabled: Boolean(rule?.enabled ?? fallback.enabled),
    musicInterval: Number.isFinite(musicInterval) ? Math.max(0, Math.floor(musicInterval)) : fallback.musicInterval,
    maxPerBreak: Number.isFinite(maxPerBreak) ? Math.max(0, Math.floor(maxPerBreak)) : fallback.maxPerBreak,
  }
}
