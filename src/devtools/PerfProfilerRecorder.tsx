import { useFrame } from '@react-three/fiber'
import { useAfterPhysicsStep, useBeforePhysicsStep } from '@react-three/rapier'
import type * as THREE from 'three'
import { useCarStore } from '../entities/vehicles/carStore'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { useGameTimeStore } from '../gameplay/time/gameTimeStore'
import { FRAME } from '../core/framePriority'
import { getTileResourceCacheStats } from '../world/beauvais/tileResourceCache'
import {
  beginPerfFrame,
  finishPerfFrame,
  isPerformanceCaptureActive,
  markPerfPhase,
  type BrowserMemorySnapshot,
  type RendererPerfSnapshot,
  type RuntimePerfContext,
  type ScenePerfSnapshot,
} from './perfProfiler'

type PerformanceWithMemory = Performance & {
  memory?: BrowserMemorySnapshot
}

export default function PerfProfilerRecorder() {
  useFrame((_, delta) => {
    if (!import.meta.env.DEV || !isPerformanceCaptureActive()) return
    beginPerfFrame(delta)
  }, -100)

  useFrame(() => markPerfPhase('afterInput'), FRAME.INPUT + 0.01)
  useFrame(() => markPerfPhase('afterLogic'), FRAME.LOGIC + 0.01)
  useBeforePhysicsStep(() => markPerfPhase('beforePhysics'))
  useAfterPhysicsStep(() => markPerfPhase('afterPhysics'))
  useFrame(() => markPerfPhase('afterAttached'), FRAME.ATTACHED + 0.01)
  useFrame(() => markPerfPhase('beforeRender'), FRAME.RENDER - 0.01)

  useFrame(({ gl, scene, camera }) => {
    if (!import.meta.env.DEV || !isPerformanceCaptureActive()) return
    finishPerfFrame({
      renderer: readRendererSnapshot(gl),
      scene: readSceneSnapshot(scene),
      memory: readBrowserMemory(),
      runtime: readRuntimeContext(camera),
    })
  }, FRAME.RENDER + 0.01)

  return null
}

function readRendererSnapshot(gl: THREE.WebGLRenderer): RendererPerfSnapshot {
  return {
    calls: gl.info.render.calls,
    triangles: gl.info.render.triangles,
    points: gl.info.render.points,
    lines: gl.info.render.lines,
    geometries: gl.info.memory.geometries,
    textures: gl.info.memory.textures,
    programs: gl.info.programs?.length ?? 0,
  }
}

function readSceneSnapshot(scene: THREE.Scene): ScenePerfSnapshot {
  const geometries = new Set<unknown>()
  const materials = new Set<unknown>()
  const snapshot: ScenePerfSnapshot = {
    objects: 0,
    meshes: 0,
    instancedMeshes: 0,
    sprites: 0,
    points: 0,
    lights: 0,
    geometries: 0,
    materials: 0,
  }

  scene.traverse((object) => {
    snapshot.objects += 1
    if ('isMesh' in object && object.isMesh) snapshot.meshes += 1
    if ('isInstancedMesh' in object && object.isInstancedMesh) snapshot.instancedMeshes += 1
    if ('isSprite' in object && object.isSprite) snapshot.sprites += 1
    if ('isPoints' in object && object.isPoints) snapshot.points += 1
    if ('isLight' in object && object.isLight) snapshot.lights += 1

    const maybeRenderable = object as THREE.Object3D & {
      geometry?: unknown
      material?: unknown | unknown[]
    }
    if (maybeRenderable.geometry) geometries.add(maybeRenderable.geometry)
    if (Array.isArray(maybeRenderable.material)) {
      for (const material of maybeRenderable.material) materials.add(material)
    } else if (maybeRenderable.material) {
      materials.add(maybeRenderable.material)
    }
  })

  snapshot.geometries = geometries.size
  snapshot.materials = materials.size
  return snapshot
}

function readRuntimeContext(camera: THREE.Camera): RuntimePerfContext {
  const playerStore = usePlayerStore.getState()
  const playerObject = playerStore.playerObject
  const car = useCarStore.getState()
  const gameTime = useGameTimeStore.getState()

  return {
    player: playerObject
      ? {
          x: round(playerObject.position.x),
          y: round(playerObject.position.y),
          z: round(playerObject.position.z),
          action: playerStore.action,
          zoneName: playerStore.zoneName,
        }
      : null,
    car: {
      riding: car.riding,
      x: round(car.physicsX),
      y: round(car.physicsY),
      z: round(car.physicsZ),
      speed: round(car.speed),
      rpm: Math.round(car.rpm),
      gear: car.gear,
    },
    gameTime: {
      totalMinutes: round(gameTime.totalMinutes),
      timeScale: gameTime.timeScale,
      isPaused: gameTime.isPaused,
    },
    camera: {
      x: round(camera.position.x),
      y: round(camera.position.y),
      z: round(camera.position.z),
    },
    tileCaches: getTileResourceCacheStats(),
  }
}

function readBrowserMemory(): BrowserMemorySnapshot | null {
  return (performance as PerformanceWithMemory).memory ?? null
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
