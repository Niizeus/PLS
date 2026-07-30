import { create } from 'zustand'
import { getWarmupStats, type WorldWarmupStats } from '../world/worldWarmup'
import type { TileResourceCacheStats } from '../world/beauvais/tileResourceCache'

export const PERF_REPORT_ENDPOINT = '/__pls/perf-report'
const SLOW_FRAME_MS = 33.34
const VERY_SLOW_FRAME_MS = 50
const MAX_FRAME_RECORDS = 20_000
const SAMPLE_EVERY_MS = 500
const STATUS_EVERY_MS = 250

type PerfPhase =
  | 'afterInput'
  | 'afterLogic'
  | 'beforePhysics'
  | 'afterPhysics'
  | 'afterAttached'
  | 'beforeRender'
  | 'afterRender'

export interface PerfMicroEvent {
  name: string
  atMs: number
  durationMs: number
  detail?: string
}

export interface BrowserLongTaskRecord {
  atMs: number
  durationMs: number
  name: string
}

export interface RendererPerfSnapshot {
  calls: number
  triangles: number
  points: number
  lines: number
  geometries: number
  textures: number
  programs: number
}

export interface ScenePerfSnapshot {
  objects: number
  meshes: number
  instancedMeshes: number
  sprites: number
  points: number
  lights: number
  geometries: number
  materials: number
}

export interface BrowserMemorySnapshot {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

export interface RuntimePerfContext {
  player: {
    x: number
    y: number
    z: number
    action: string
    zoneName: string | null
  } | null
  car: {
    riding: boolean
    x: number
    y: number
    z: number
    speed: number
    rpm: number
    gear: number
  }
  gameTime: {
    totalMinutes: number
    timeScale: number
    isPaused: boolean
  }
  camera: {
    x: number
    y: number
    z: number
  }
  tileCaches: TileResourceCacheStats[]
}

export interface PerfFrameRecord {
  index: number
  atMs: number
  frameMs: number
  cpuMeasuredMs: number
  inputDefaultMs: number | null
  logicMs: number | null
  prePhysicsMs: number | null
  physicsMs: number | null
  postPhysicsAttachedMs: number | null
  attachedMs: number | null
  cameraPrepMs: number | null
  renderMs: number | null
}

export interface PerfSampleRecord {
  atMs: number
  renderer: RendererPerfSnapshot
  scene: ScenePerfSnapshot
  memory: BrowserMemorySnapshot | null
  runtime: RuntimePerfContext
}

export interface SlowFrameRecord extends PerfFrameRecord {
  renderer: RendererPerfSnapshot
  scene: ScenePerfSnapshot
  memory: BrowserMemorySnapshot | null
  runtime: RuntimePerfContext
}

export interface PerfReport {
  schemaVersion: 1
  id: string
  createdAt: string
  endedAt: string
  durationMs: number
  environment: {
    url: string
    userAgent: string
    devicePixelRatio: number
    viewport: { width: number; height: number }
  }
  summary: {
    frames: number
    truncatedFrames: number
    avgFps: number
    avgFrameMs: number
    p50FrameMs: number
    p95FrameMs: number
    p99FrameMs: number
    worstFrameMs: number
    slowFramesOver33ms: number
    slowFramesOver50ms: number
    slowFramesOver100ms: number
    avgRenderMs: number | null
    p95RenderMs: number | null
    avgCpuMeasuredMs: number
    p95CpuMeasuredMs: number
  }
  diagnostics: string[]
  warmup: WorldWarmupStats
  microEvents: PerfMicroEvent[]
  longTasks: BrowserLongTaskRecord[]
  frames: PerfFrameRecord[]
  samples: PerfSampleRecord[]
  slowFrames: SlowFrameRecord[]
}

interface PerfProfilerStatus {
  isRecording: boolean
  startedAt: number | null
  frameCount: number
  slowFrameCount: number
  lastReportFile: string | null
  lastError: string | null
}

interface CurrentFrame {
  index: number
  startedAt: number
  deltaMs: number
  marks: Partial<Record<PerfPhase, number>>
}

interface CaptureSession {
  id: string
  createdAt: string
  startedAt: number
  lastSampleAt: number
  lastStatusAt: number
  frameCount: number
  slowFrameCount: number
  truncatedFrames: number
  frames: PerfFrameRecord[]
  samples: PerfSampleRecord[]
  slowFrames: SlowFrameRecord[]
  microEvents: PerfMicroEvent[]
  longTasks: BrowserLongTaskRecord[]
  currentFrame: CurrentFrame | null
  environment: PerfReport['environment']
}

export const usePerfProfilerStatus = create<PerfProfilerStatus>(() => ({
  isRecording: false,
  startedAt: null,
  frameCount: 0,
  slowFrameCount: 0,
  lastReportFile: null,
  lastError: null,
}))

let session: CaptureSession | null = null
let longTaskObserver: PerformanceObserver | null = null

export function isPerformanceCaptureActive(): boolean {
  return session !== null
}

export function startPerformanceCapture() {
  const now = performance.now()
  const id = makeReportId()
  session = {
    id,
    createdAt: new Date().toISOString(),
    startedAt: now,
    lastSampleAt: 0,
    lastStatusAt: now,
    frameCount: 0,
    slowFrameCount: 0,
    truncatedFrames: 0,
    frames: [],
    samples: [],
    slowFrames: [],
    microEvents: [],
    longTasks: [],
    currentFrame: null,
    environment: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio || 1,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    },
  }

  usePerfProfilerStatus.setState({
    isRecording: true,
    startedAt: now,
    frameCount: 0,
    slowFrameCount: 0,
    lastError: null,
    lastReportFile: null,
  })

  startLongTaskObserver()
}

export function beginPerfFrame(deltaSeconds: number, now = performance.now()) {
  if (!session) return
  session.currentFrame = {
    index: session.frameCount + 1,
    startedAt: now,
    deltaMs: roundMs(deltaSeconds * 1000),
    marks: {},
  }
}

export function markPerfPhase(phase: PerfPhase, now = performance.now()) {
  if (!session?.currentFrame) return
  session.currentFrame.marks[phase] = now
}

export function recordPerfSpan(name: string, startedAt: number, detail?: string, endedAt = performance.now()) {
  if (!session) return
  session.microEvents.push({
    name,
    atMs: roundMs(startedAt - session.startedAt),
    durationMs: roundMs(Math.max(0, endedAt - startedAt)),
    detail,
  })
  if (session.microEvents.length > 5000) session.microEvents.shift()
}

export function finishPerfFrame({
  renderer,
  scene,
  memory,
  runtime,
  now = performance.now(),
}: {
  renderer: RendererPerfSnapshot
  scene: ScenePerfSnapshot
  memory: BrowserMemorySnapshot | null
  runtime: RuntimePerfContext
  now?: number
}) {
  if (!session?.currentFrame) return

  const current = session.currentFrame
  current.marks.afterRender = now
  const record = buildFrameRecord(current, session.startedAt)
  session.frameCount += 1

  if (session.frames.length < MAX_FRAME_RECORDS) session.frames.push(record)
  else session.truncatedFrames += 1

  if (record.frameMs >= SLOW_FRAME_MS) {
    session.slowFrameCount += 1
    session.slowFrames.push({ ...record, renderer, scene, memory, runtime })
  }

  if (now - session.lastSampleAt >= SAMPLE_EVERY_MS) {
    session.lastSampleAt = now
    session.samples.push({
      atMs: roundMs(now - session.startedAt),
      renderer,
      scene,
      memory,
      runtime,
    })
  }

  if (now - session.lastStatusAt >= STATUS_EVERY_MS) {
    session.lastStatusAt = now
    usePerfProfilerStatus.setState({
      frameCount: session.frameCount,
      slowFrameCount: session.slowFrameCount,
    })
  }
}

export async function stopPerformanceCapture(): Promise<PerfReport | null> {
  if (!session) return null

  const finished = session
  session = null
  stopLongTaskObserver()
  const report = buildReport(finished)
  usePerfProfilerStatus.setState({
    isRecording: false,
    startedAt: null,
    frameCount: report.summary.frames,
    slowFrameCount: report.summary.slowFramesOver33ms,
  })

  try {
    const response = await fetch(PERF_REPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    })
    if (!response.ok) throw new Error(await response.text())
    const saved = (await response.json()) as { file?: string }
    usePerfProfilerStatus.setState({ lastReportFile: saved.file ?? null, lastError: null })
  } catch (error) {
    downloadReport(report)
    usePerfProfilerStatus.setState({
      lastReportFile: `${report.id}.json telecharge par le navigateur`,
      lastError: error instanceof Error ? error.message : 'Sauvegarde projet impossible',
    })
  }

  return report
}

function buildFrameRecord(current: CurrentFrame, sessionStart: number): PerfFrameRecord {
  const marks = current.marks
  const afterRender = marks.afterRender ?? performance.now()
  return {
    index: current.index,
    atMs: roundMs(current.startedAt - sessionStart),
    frameMs: current.deltaMs,
    cpuMeasuredMs: roundMs(afterRender - current.startedAt),
    inputDefaultMs: diff(current.startedAt, marks.afterInput),
    logicMs: diff(marks.afterInput, marks.afterLogic),
    prePhysicsMs: diff(marks.afterLogic, marks.beforePhysics),
    physicsMs: diff(marks.beforePhysics, marks.afterPhysics),
    postPhysicsAttachedMs: diff(marks.afterPhysics, marks.afterAttached),
    attachedMs: diff(marks.afterLogic, marks.afterAttached),
    cameraPrepMs: diff(marks.afterAttached, marks.beforeRender),
    renderMs: diff(marks.beforeRender, afterRender),
  }
}

function buildReport(source: CaptureSession): PerfReport {
  const durationMs = roundMs(performance.now() - source.startedAt)
  const frameMs = source.frames.map((frame) => frame.frameMs)
  const renderMs = source.frames.map((frame) => frame.renderMs).filter(isNumber)
  const cpuMs = source.frames.map((frame) => frame.cpuMeasuredMs)
  const summary = {
    frames: source.frameCount,
    truncatedFrames: source.truncatedFrames,
    avgFps: roundNumber(source.frameCount / Math.max(0.001, durationMs / 1000), 1),
    avgFrameMs: average(frameMs),
    p50FrameMs: percentile(frameMs, 0.5),
    p95FrameMs: percentile(frameMs, 0.95),
    p99FrameMs: percentile(frameMs, 0.99),
    worstFrameMs: frameMs.length ? roundMs(Math.max(...frameMs)) : 0,
    slowFramesOver33ms: frameMs.filter((value) => value >= SLOW_FRAME_MS).length,
    slowFramesOver50ms: frameMs.filter((value) => value >= VERY_SLOW_FRAME_MS).length,
    slowFramesOver100ms: frameMs.filter((value) => value >= 100).length,
    avgRenderMs: renderMs.length ? average(renderMs) : null,
    p95RenderMs: renderMs.length ? percentile(renderMs, 0.95) : null,
    avgCpuMeasuredMs: average(cpuMs),
    p95CpuMeasuredMs: percentile(cpuMs, 0.95),
  }

  return {
    schemaVersion: 1,
    id: source.id,
    createdAt: source.createdAt,
    endedAt: new Date().toISOString(),
    durationMs,
    environment: source.environment,
    summary,
    diagnostics: makeDiagnostics(summary, source),
    warmup: getWarmupStats(),
    microEvents: source.microEvents,
    longTasks: source.longTasks,
    frames: source.frames,
    samples: source.samples,
    slowFrames: source.slowFrames.slice(-240),
  }
}

function makeDiagnostics(summary: PerfReport['summary'], source: CaptureSession): string[] {
  const diagnostics: string[] = []
  if (summary.p95FrameMs >= SLOW_FRAME_MS) {
    diagnostics.push('Le p95 frame depasse 33 ms : les saccades sont reproductibles dans cette capture.')
  }
  if ((summary.p95RenderMs ?? 0) >= 14) {
    diagnostics.push('Le rendu GPU/Three prend une part importante des frames lentes : regarder draw calls, triangles, ombres et transparences.')
  } else if (summary.p95FrameMs >= SLOW_FRAME_MS) {
    diagnostics.push('Les frames lentes ne semblent pas venir uniquement du render() : regarder streaming, physique Rapier, generation de geometries ou GC.')
  }

  const lastCaches = source.samples.at(-1)?.runtime.tileCaches ?? []
  const hotCaches = lastCaches.filter((cache) => cache.builds > 0 || cache.evictions > 0)
  if (hotCaches.length > 0) {
    diagnostics.push(
      `Caches actifs pendant la capture : ${hotCaches
        .map(
          (cache) =>
            `${cache.name} builds=${cache.builds} maxBuildMs=${cache.maxBuildMs} evictions=${cache.evictions} entries=${cache.entries}`,
        )
        .join(' | ')}.`,
    )
  }
  const expensiveCaches = lastCaches.filter((cache) => cache.maxBuildMs >= 8)
  if (expensiveCaches.length > 0) {
    diagnostics.push(
      `Builds de tuiles couteux : ${expensiveCaches
        .map((cache) => `${cache.name} max=${cache.maxBuildMs}ms last=${cache.lastBuildMs}ms key=${cache.lastBuiltKey}`)
        .join(' | ')}.`,
    )
  }
  if (summary.slowFramesOver100ms > 0) {
    diagnostics.push('Au moins une frame depasse 100 ms : chercher un hitch ponctuel de chargement/generation plutot qu un cout stable.')
  }
  const topEvents = topMicroEvents(source.microEvents)
  if (topEvents.length > 0) {
    diagnostics.push(
      `Micro-profiler top events : ${topEvents
        .map((event) => `${event.name} max=${event.max}ms count=${event.count}`)
        .join(' | ')}.`,
    )
  }
  if (source.longTasks.length > 0) {
    const maxLongTask = Math.max(...source.longTasks.map((task) => task.durationMs))
    diagnostics.push(`Long tasks navigateur : count=${source.longTasks.length} max=${roundMs(maxLongTask)}ms.`)
  }
  return diagnostics
}

function topMicroEvents(events: PerfMicroEvent[]): { name: string; count: number; max: number }[] {
  const groups = new Map<string, { count: number; max: number }>()
  for (const event of events) {
    const group = groups.get(event.name) ?? { count: 0, max: 0 }
    group.count += 1
    group.max = Math.max(group.max, event.durationMs)
    groups.set(event.name, group)
  }
  return [...groups.entries()]
    .map(([name, group]) => ({ name, count: group.count, max: roundMs(group.max) }))
    .sort((a, b) => b.max - a.max)
    .slice(0, 8)
}

function startLongTaskObserver() {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    longTaskObserver?.disconnect()
    longTaskObserver = new PerformanceObserver((list) => {
      if (!session) return
      for (const entry of list.getEntries()) {
        session.longTasks.push({
          atMs: roundMs(entry.startTime - session.startedAt),
          durationMs: roundMs(entry.duration),
          name: entry.name,
        })
        if (session.longTasks.length > 1000) session.longTasks.shift()
      }
    })
    longTaskObserver.observe({ entryTypes: ['longtask'] })
  } catch {
    longTaskObserver = null
  }
}

function stopLongTaskObserver() {
  longTaskObserver?.disconnect()
  longTaskObserver = null
}

function diff(from: number | undefined, to: number | undefined): number | null {
  if (typeof from !== 'number' || typeof to !== 'number') return null
  return roundMs(Math.max(0, to - from))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return roundMs(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function percentile(values: number[], amount: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * amount) - 1))
  return roundMs(sorted[index])
}

function isNumber(value: number | null): value is number {
  return typeof value === 'number'
}

function roundMs(value: number): number {
  return roundNumber(value, 2)
}

function roundNumber(value: number, digits: number): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function makeReportId(): string {
  return `pls-perf-${new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '')}`
}

function downloadReport(report: PerfReport) {
  const blob = new Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${report.id}.json`
  link.click()
  URL.revokeObjectURL(url)
}
