import { create } from 'zustand'
import type { ItemEffectKey } from '../../data/items'

export type CharacterStats = Record<ItemEffectKey, number>
export type HealthLossSource = 'direct' | 'needs' | null
export interface ActiveStatusEffect {
  id: string
  sourceItemId?: string
  label: string
  effects: Partial<Record<ItemEffectKey, number>>
  expiresAt: number
}

interface CharacterStatsState extends CharacterStats {
  activeEffects: ActiveStatusEffect[]
  lastHealthLossSource: HealthLossSource
  applyEffects: (effects: Partial<Record<ItemEffectKey, number>>) => void
  applyConsumableEffects: (
    label: string,
    effects: Partial<Record<ItemEffectKey, number>>,
    durationMs?: number,
    sourceItemId?: string,
  ) => void
  decayNeeds: () => void
  purgeExpiredEffects: () => void
}

const STORAGE_KEY = 'pls.character-stats.v1'
interface StoredCharacterState {
  stats: CharacterStats
  activeEffects: ActiveStatusEffect[]
}

const DEFAULT_STATS: CharacterStats = {
  health: 80,
  hunger: 70,
  thirst: 65,
  mental: 75,
  attack: 1,
  defense: 0,
  agility: 1,
  chance: 1,
  speed: 1,
  chaos: 0,
}

const VITAL_KEYS: ItemEffectKey[] = ['health', 'hunger', 'thirst', 'mental']
const isVitalKey = (key: ItemEffectKey) => VITAL_KEYS.includes(key)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const cleanNumber = (value: number) => Math.round(value)

const sanitizeStats = (stats: Partial<CharacterStats>): CharacterStats => ({
  health: cleanNumber(clamp(stats.health ?? DEFAULT_STATS.health, 0, 100)),
  hunger: cleanNumber(clamp(stats.hunger ?? DEFAULT_STATS.hunger, 0, 100)),
  thirst: cleanNumber(clamp(stats.thirst ?? DEFAULT_STATS.thirst, 0, 100)),
  mental: cleanNumber(clamp(stats.mental ?? DEFAULT_STATS.mental, 0, 100)),
  attack: cleanNumber(clamp(stats.attack ?? DEFAULT_STATS.attack, 0, 99)),
  defense: cleanNumber(clamp(stats.defense ?? DEFAULT_STATS.defense, 0, 99)),
  agility: cleanNumber(clamp(stats.agility ?? DEFAULT_STATS.agility, 0, 99)),
  chance: cleanNumber(clamp(stats.chance ?? DEFAULT_STATS.chance, 0, 99)),
  speed: cleanNumber(clamp(stats.speed ?? DEFAULT_STATS.speed, 0, 99)),
  chaos: cleanNumber(clamp(stats.chaos ?? DEFAULT_STATS.chaos, 0, 99)),
})

const sanitizeActiveEffects = (effects: ActiveStatusEffect[] = []): ActiveStatusEffect[] => {
  const now = Date.now()
  return effects
    .filter((effect) => effect.expiresAt > now && effect.label && effect.effects)
    .map((effect) => ({
      id: effect.id || `effect-${effect.expiresAt}`,
      sourceItemId: effect.sourceItemId,
      label: effect.label,
      effects: Object.fromEntries(
        Object.entries(effect.effects)
          .filter((entry): entry is [ItemEffectKey, number] => typeof entry[1] === 'number')
          .map(([key, value]) => [key, cleanNumber(value)]),
      ) as Partial<Record<ItemEffectKey, number>>,
      expiresAt: effect.expiresAt,
    }))
}

const pickStats = (state: CharacterStats): CharacterStats =>
  sanitizeStats({
    health: state.health,
    hunger: state.hunger,
    thirst: state.thirst,
    mental: state.mental,
    attack: state.attack,
    defense: state.defense,
    agility: state.agility,
    chance: state.chance,
    speed: state.speed,
    chaos: state.chaos,
  })

const saveCharacterState = (stats: CharacterStats, activeEffects: ActiveStatusEffect[] = []) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: pickStats(stats), activeEffects: sanitizeActiveEffects(activeEffects) }))
}

const loadCharacterState = (): StoredCharacterState => {
  if (typeof localStorage === 'undefined') return { stats: DEFAULT_STATS, activeEffects: [] }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { stats: DEFAULT_STATS, activeEffects: [] }

    const parsed = JSON.parse(raw) as Partial<StoredCharacterState> | Partial<CharacterStats>
    if ('stats' in parsed) {
      return {
        stats: sanitizeStats(parsed.stats ?? DEFAULT_STATS),
        activeEffects: sanitizeActiveEffects(parsed.activeEffects),
      }
    }

    return { stats: sanitizeStats(parsed as Partial<CharacterStats>), activeEffects: [] }
  } catch {
    return { stats: DEFAULT_STATS, activeEffects: [] }
  }
}

const initialState = loadCharacterState()

export const useCharacterStatsStore = create<CharacterStatsState>((set) => ({
  ...initialState.stats,
  activeEffects: initialState.activeEffects,
  lastHealthLossSource: null,

  applyEffects: (effects) =>
    set((state) => {
      const next = { ...state }
      for (const [key, value] of Object.entries(effects) as [ItemEffectKey, number][]) {
        const max = VITAL_KEYS.includes(key) ? 100 : 99
        next[key] = clamp(state[key] + value, 0, max)
      }
      const clean = sanitizeStats(next)
      saveCharacterState(clean, state.activeEffects)
      return {
        ...clean,
        lastHealthLossSource: clean.health < state.health ? 'direct' : state.lastHealthLossSource,
      }
    }),

  applyConsumableEffects: (label, effects, durationMs = 30_000, sourceItemId) =>
    set((state) => {
      const instantEffects: Partial<Record<ItemEffectKey, number>> = {}
      const timedEffects: Partial<Record<ItemEffectKey, number>> = {}

      for (const [key, value] of Object.entries(effects) as [ItemEffectKey, number][]) {
        if (isVitalKey(key)) instantEffects[key] = value
        else timedEffects[key] = value
      }

      const next = { ...state }
      for (const [key, value] of Object.entries(instantEffects) as [ItemEffectKey, number][]) {
        next[key] = clamp(state[key] + value, 0, 100)
      }

      const clean = sanitizeStats(next)

      const now = Date.now()
      const activeEffects = state.activeEffects.filter(
        (effect) =>
          effect.expiresAt > now &&
          (sourceItemId ? effect.sourceItemId !== sourceItemId : effect.label !== label),
      )
      if (Object.keys(timedEffects).length > 0) {
        activeEffects.push({
          id: `effect-${now}-${Math.random().toString(36).slice(2)}`,
          sourceItemId,
          label,
          effects: timedEffects,
          expiresAt: now + durationMs,
        })
      }

      saveCharacterState(clean, activeEffects)
      return {
        ...clean,
        activeEffects,
        lastHealthLossSource: clean.health < state.health ? 'direct' : state.lastHealthLossSource,
      }
    }),

  decayNeeds: () =>
    set((state) => {
      const starving = state.hunger <= 0
      const dehydrated = state.thirst <= 0
      const next = sanitizeStats({
        ...state,
        hunger: state.hunger - 1,
        thirst: state.thirst - 1,
        mental: state.mental - (state.hunger < 15 || state.thirst < 15 ? 1 : 0),
        health: state.health - (starving || dehydrated ? 1 : 0),
      })
      saveCharacterState(next, state.activeEffects)
      return {
        ...next,
        lastHealthLossSource: next.health < state.health ? 'needs' : state.lastHealthLossSource,
      }
    }),

  purgeExpiredEffects: () =>
    set((state) => {
      const activeEffects = state.activeEffects.filter((effect) => effect.expiresAt > Date.now())
      if (activeEffects.length !== state.activeEffects.length) saveCharacterState(pickStats(state), activeEffects)
      return { activeEffects }
    }),
}))
