export interface PhysicsGroundTileRequest {
  key: string
  tx: number
  tz: number
  chunkSize: number
  sampleStep: number
}

export interface PhysicsGroundTileData {
  nrows: number
  ncols: number
  heights: Float32Array
  scale: {
    x: number
    y: number
    z: number
  }
  workerMs: number
}

interface WorkerResponse extends PhysicsGroundTileData {
  id: number
  key: string
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (data: PhysicsGroundTileData) => void; reject: (error: Error) => void }>()

export function buildPhysicsGroundTileInWorker(request: PhysicsGroundTileRequest): Promise<PhysicsGroundTileData> {
  const id = nextId++
  const activeWorker = getWorker()
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    activeWorker.postMessage({ id, ...request })
  })
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./physicsGroundWorker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const item = pending.get(event.data.id)
    if (!item) return
    pending.delete(event.data.id)
    item.resolve({
      nrows: event.data.nrows,
      ncols: event.data.ncols,
      heights: event.data.heights,
      scale: event.data.scale,
      workerMs: event.data.workerMs,
    })
  }
  worker.onerror = (event) => {
    const error = new Error(event.message || 'physics ground worker failed')
    for (const item of pending.values()) item.reject(error)
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}
