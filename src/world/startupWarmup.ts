import { warmBuildingColliderTilesAround } from '../gameplay/physics/WorldBuildingColliders'
import { warmPhysicsGroundTilesAround } from '../gameplay/physics/WorldPhysicsColliders'
import { SPAWN } from './beauvais/cityData'
import { warmCityTilesAround } from './beauvais/Beauvais'
import { loadTerrain } from './beauvais/terrain'
import { warmRoadTilesAround } from './beauvais/Roads'
import { warmGroundChunksAround } from './Ground'
import { setWarmupStats, type WorldWarmupStats } from './worldWarmup'

export interface WarmupProgress {
  label: string
  done: number
  total: number
}

type WarmupTask = {
  label: string
  run: () => number | Promise<number>
}

const WARMUP_POINTS = [
  { x: SPAWN.x, z: SPAWN.z },
  { x: SPAWN.x + 192, z: SPAWN.z },
  { x: SPAWN.x + 384, z: SPAWN.z + 128 },
  { x: SPAWN.x + 576, z: SPAWN.z + 256 },
]

export async function runWorldStartupWarmup(onProgress: (progress: WarmupProgress) => void): Promise<void> {
  const startedAt = performance.now()
  const tasks = buildWarmupTasks()
  setWarmupStats({
    status: 'running',
    label: 'Chargement relief',
    done: 0,
    total: tasks.length,
    startedAt,
    endedAt: null,
    durationMs: null,
  })

  try {
    await loadTerrain()

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      onProgress({ label: task.label, done: i, total: tasks.length })
      setWarmupStats({ label: task.label, done: i, total: tasks.length })
      await task.run()
      await nextTick()
    }

    const endedAt = performance.now()
    const doneStats: Partial<WorldWarmupStats> = {
      status: 'done',
      label: 'Pret',
      done: tasks.length,
      total: tasks.length,
      endedAt,
      durationMs: Math.round((endedAt - startedAt) * 100) / 100,
    }
    setWarmupStats(doneStats)
    onProgress({ label: 'Pret', done: tasks.length, total: tasks.length })
  } catch (error) {
    const endedAt = performance.now()
    setWarmupStats({
      status: 'failed',
      label: error instanceof Error ? error.message : 'Warmup impossible',
      endedAt,
      durationMs: Math.round((endedAt - startedAt) * 100) / 100,
    })
    throw error
  }
}

function buildWarmupTasks(): WarmupTask[] {
  const tasks: WarmupTask[] = []
  for (const [index, point] of WARMUP_POINTS.entries()) {
    const zone = index === 0 ? 'spawn' : `route ${index}`
    tasks.push(
      { label: `Sol ${zone}`, run: () => warmGroundChunksAround(point.x, point.z, 1) },
      { label: `Routes ${zone}`, run: () => warmRoadTilesAround(point.x, point.z, 1) },
      { label: `Ville ${zone}`, run: () => warmCityTilesAround(point.x, point.z, 1) },
      { label: `Colliders terrain ${zone}`, run: () => warmPhysicsGroundTilesAround(point.x, point.z, 2) },
      { label: `Colliders batiments ${zone}`, run: () => warmBuildingColliderTilesAround(point.x, point.z, 1) },
    )
  }
  return tasks
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}
