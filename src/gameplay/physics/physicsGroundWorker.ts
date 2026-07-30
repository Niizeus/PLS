import { loadTerrain } from '../../world/beauvais/terrain'
import { driveSurfaceHeightAt } from './physicsSurface'

interface BuildRequest {
  id: number
  key: string
  tx: number
  tz: number
  chunkSize: number
  sampleStep: number
}

interface BuildResponse {
  id: number
  key: string
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

const workerSelf = self as unknown as {
  onmessage: ((event: MessageEvent<BuildRequest>) => void) | null
  postMessage: (message: BuildResponse, transfer: Transferable[]) => void
}

workerSelf.onmessage = async (event: MessageEvent<BuildRequest>) => {
  const startedAt = performance.now()
  const request = event.data
  await loadTerrain()
  const response = buildTileHeightfield(request, startedAt)
  workerSelf.postMessage(response, [response.heights.buffer])
}

function buildTileHeightfield(
  { id, key, tx, tz, chunkSize, sampleStep }: BuildRequest,
  startedAt: number,
): BuildResponse {
  const steps = Math.round(chunkSize / sampleStep)
  const vertsPerSide = steps + 1
  const minX = tx * chunkSize
  const minZ = tz * chunkSize
  const heights = new Float32Array(vertsPerSide * vertsPerSide)

  for (let x = 0; x <= steps; x++) {
    for (let z = 0; z <= steps; z++) {
      const worldX = minX + x * sampleStep
      const worldZ = minZ + z * sampleStep
      heights[x * vertsPerSide + z] = driveSurfaceHeightAt(worldX, worldZ)
    }
  }

  return {
    id,
    key,
    nrows: steps,
    ncols: steps,
    heights,
    scale: { x: chunkSize, y: 1, z: chunkSize },
    workerMs: performance.now() - startedAt,
  }
}
