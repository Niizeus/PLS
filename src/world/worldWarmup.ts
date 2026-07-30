export interface WorldWarmupStats {
  status: 'idle' | 'running' | 'done' | 'failed'
  label: string
  done: number
  total: number
  startedAt: number | null
  endedAt: number | null
  durationMs: number | null
}

let stats: WorldWarmupStats = {
  status: 'idle',
  label: 'En attente',
  done: 0,
  total: 0,
  startedAt: null,
  endedAt: null,
  durationMs: null,
}

export function getWarmupStats(): WorldWarmupStats {
  return { ...stats }
}

export function setWarmupStats(next: Partial<WorldWarmupStats>) {
  stats = { ...stats, ...next }
}
