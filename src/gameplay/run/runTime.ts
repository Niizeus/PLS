import {
  GAME_MINUTES_PER_REAL_SECOND,
  RUN_GAME_DAYS,
  RUN_GAME_MINUTES,
  RUN_REAL_DURATION_SECONDS,
  RUN_START_GAME_MINUTES,
} from './runConstants'

export interface RunClockSnapshot {
  realElapsedSeconds: number
  realRemainingSeconds: number
  gameElapsedMinutes: number
  worldTotalMinutes: number
  runDay: number
  gameHour: number
  gameMinute: number
  progress: number
}

export function getRunClockSnapshot(realElapsedSeconds: number): RunClockSnapshot {
  const elapsed = clamp(realElapsedSeconds, 0, RUN_REAL_DURATION_SECONDS)
  const gameElapsedMinutes = elapsed * GAME_MINUTES_PER_REAL_SECOND
  const worldTotalMinutes = RUN_START_GAME_MINUTES + gameElapsedMinutes
  const elapsedMinuteOfRun = Math.min(Math.floor(gameElapsedMinutes), RUN_GAME_MINUTES - 1)
  const runDay = Math.min(RUN_GAME_DAYS, Math.floor(elapsedMinuteOfRun / (24 * 60)) + 1)
  const minuteOfDay = positiveModulo(Math.floor(worldTotalMinutes), 24 * 60)

  return {
    realElapsedSeconds: elapsed,
    realRemainingSeconds: RUN_REAL_DURATION_SECONDS - elapsed,
    gameElapsedMinutes,
    worldTotalMinutes,
    runDay,
    gameHour: Math.floor(minuteOfDay / 60),
    gameMinute: minuteOfDay % 60,
    progress: RUN_REAL_DURATION_SECONDS <= 0 ? 1 : elapsed / RUN_REAL_DURATION_SECONDS,
  }
}

export function realSecondsToGameMinutes(realSeconds: number): number {
  return Math.max(0, realSeconds) * GAME_MINUTES_PER_REAL_SECOND
}

export function formatRunCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const rest = safeSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${rest.toString().padStart(2, '0')}`
}

export function formatRunGameTime(snapshot: Pick<RunClockSnapshot, 'runDay' | 'gameHour' | 'gameMinute'>): string {
  return `Jour ${snapshot.runDay}, ${snapshot.gameHour.toString().padStart(2, '0')}:${snapshot.gameMinute
    .toString()
    .padStart(2, '0')}`
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
