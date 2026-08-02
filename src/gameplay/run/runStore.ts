import { create } from 'zustand'
import { GAME_MINUTES_PER_REAL_SECOND, RUN_REAL_DURATION_SECONDS, RUN_STATUS_VALUES } from './runConstants'
import { getRunClockSnapshot, type RunClockSnapshot } from './runTime'

export type RunStatus = (typeof RUN_STATUS_VALUES)[number]

export interface RunEndPayload {
  reason: string
  source?: string
  endingId?: string
  context?: Record<string, unknown>
}

interface StoredRunEnd extends RunEndPayload {
  status: Exclude<RunStatus, 'active'>
  at: RunClockSnapshot
}

interface RunState extends RunClockSnapshot {
  status: RunStatus
  timeScale: number
  isPaused: boolean
  endedBy: StoredRunEnd | null
  firedEventIds: string[]
  advance: (realDeltaSeconds: number) => void
  setPaused: (isPaused: boolean) => void
  setTimeScale: (timeScale: number) => void
  setRealElapsedSeconds: (realElapsedSeconds: number) => void
  setGameElapsedMinutes: (gameElapsedMinutes: number) => void
  setWorldTotalMinutes: (worldTotalMinutes: number) => void
  restartRun: () => void
  markEventFired: (eventId: string) => void
  hasEventFired: (eventId: string) => boolean
  escapeRun: (payload: RunEndPayload) => void
  killRun: (payload: RunEndPayload) => void
  failRun: (payload: RunEndPayload) => void
  endRun: (payload: RunEndPayload) => void
}

const initialClock = getRunClockSnapshot(0)

export const useRunStore = create<RunState>((set, get) => ({
  ...initialClock,
  status: 'active',
  timeScale: 1,
  isPaused: false,
  endedBy: null,
  firedEventIds: [],

  advance: (realDeltaSeconds) =>
    set((state) => {
      if (state.status !== 'active' || state.isPaused || state.timeScale <= 0) return state

      const nextElapsed = state.realElapsedSeconds + Math.max(0, realDeltaSeconds) * state.timeScale
      const clock = getRunClockSnapshot(nextElapsed)
      if (clock.realElapsedSeconds >= RUN_REAL_DURATION_SECONDS) {
        return finishRun({ ...state, ...clock }, 'dead', { reason: 'time_expired', source: 'run_clock' })
      }
      return { ...state, ...clock }
    }),

  setPaused: (isPaused) => set({ isPaused }),
  setTimeScale: (timeScale) => set({ timeScale: Math.max(0, timeScale) }),

  setRealElapsedSeconds: (realElapsedSeconds) =>
    set((state) => {
      const clock = getRunClockSnapshot(realElapsedSeconds)
      if (state.status === 'active' && clock.realElapsedSeconds >= RUN_REAL_DURATION_SECONDS) {
        return finishRun({ ...state, ...clock }, 'dead', { reason: 'time_expired', source: 'run_clock' })
      }
      return { ...state, ...clock }
    }),

  setGameElapsedMinutes: (gameElapsedMinutes) => {
    const realElapsedSeconds = Math.max(0, gameElapsedMinutes) / GAME_MINUTES_PER_REAL_SECOND
    get().setRealElapsedSeconds(realElapsedSeconds)
  },

  setWorldTotalMinutes: (worldTotalMinutes) => {
    get().setGameElapsedMinutes(worldTotalMinutes - initialClock.worldTotalMinutes)
  },

  restartRun: () =>
    set({
      ...getRunClockSnapshot(0),
      status: 'active',
      endedBy: null,
      firedEventIds: [],
    }),

  markEventFired: (eventId) =>
    set((state) =>
      state.firedEventIds.includes(eventId)
        ? state
        : { firedEventIds: [...state.firedEventIds, eventId] },
    ),

  hasEventFired: (eventId) => get().firedEventIds.includes(eventId),

  escapeRun: (payload) => set((state) => finishRun(state, 'escaped', payload)),
  killRun: (payload) => set((state) => finishRun(state, 'dead', payload)),
  failRun: (payload) => set((state) => finishRun(state, 'failed', payload)),
  endRun: (payload) => set((state) => finishRun(state, 'ended', payload)),
}))

function finishRun(state: RunState, status: Exclude<RunStatus, 'active'>, payload: RunEndPayload): RunState {
  if (state.status !== 'active') return state
  return {
    ...state,
    status,
    endedBy: {
      ...payload,
      status,
      at: getRunClockSnapshot(state.realElapsedSeconds),
    },
  }
}
