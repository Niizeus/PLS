import * as THREE from 'three'
import { BOUNDS } from './beauvais/cityData'

interface ViewportSize {
  width: number
  height: number
}

const CITY_SPAN = Math.max(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ)
const VIEW_REACH_FACTOR = 0.72

export function editorTileReach(
  camera: THREE.Camera,
  size: ViewportSize,
  tileSize: number,
  minReach: number,
) {
  if (!(camera instanceof THREE.OrthographicCamera) || camera.zoom <= 0) return minReach

  const visibleSpan = Math.max(size.width, size.height) / camera.zoom
  const wantedRadius = Math.min(CITY_SPAN, visibleSpan * VIEW_REACH_FACTOR)
  return Math.max(minReach, Math.ceil(wantedRadius / tileSize) + 1)
}
