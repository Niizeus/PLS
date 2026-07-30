import { recordPerfSpan } from '../../devtools/perfProfiler'

type DisposableResource = {
  dispose?: () => void
}

interface CacheEntry<T> {
  resource: T
  refs: number
  lastUsed: number
}

interface TileResourceCacheOptions<T> {
  name: string
  maxEntries: number
  build: (key: string) => T
}

interface AsyncCacheEntry<T> {
  resource: T | null
  promise: Promise<T> | null
  refs: number
  lastUsed: number
}

interface AsyncTileResourceCacheOptions<T> {
  name: string
  maxEntries: number
  build: (key: string) => Promise<T>
}

export interface TileResourceCacheStats {
  name: string
  entries: number
  active: number
  inactive: number
  maxEntries: number
  builds: number
  hits: number
  evictions: number
  totalBuildMs: number
  maxBuildMs: number
  lastBuildMs: number
  lastBuiltKey: string | null
}

const cacheRegistry = new Map<string, () => TileResourceCacheStats>()

/**
 * Cache LRU pour les ressources de tuiles construites au streaming.
 *
 * React monte/demonte les tuiles autour du joueur. Sans cache, revenir sur ses
 * pas reconstruit les memes geometries/colliders et provoque des petits hitches.
 * Le trimming est differe d'un tick pour laisser les nouveaux effets React
 * marquer leurs tuiles comme actives avant toute eviction.
 */
export function createTileResourceCache<T>({
  name,
  maxEntries,
  build,
}: TileResourceCacheOptions<T>) {
  const entries = new Map<string, CacheEntry<T>>()
  let clock = 0
  let trimTimer: ReturnType<typeof setTimeout> | null = null
  let builds = 0
  let hits = 0
  let evictions = 0
  let totalBuildMs = 0
  let maxBuildMs = 0
  let lastBuildMs = 0
  let lastBuiltKey: string | null = null

  cacheRegistry.set(name, () => {
    let active = 0
    for (const entry of entries.values()) {
      if (entry.refs > 0) active += 1
    }
    return {
      name,
      entries: entries.size,
      active,
      inactive: entries.size - active,
      maxEntries,
      builds,
      hits,
      evictions,
      totalBuildMs: roundMs(totalBuildMs),
      maxBuildMs: roundMs(maxBuildMs),
      lastBuildMs: roundMs(lastBuildMs),
      lastBuiltKey,
    }
  })

  function get(key: string): T {
    let entry = entries.get(key)
    if (!entry) {
      const startedAt = performance.now()
      entry = { resource: build(key), refs: 0, lastUsed: 0 }
      lastBuildMs = performance.now() - startedAt
      recordPerfSpan(`cache.build:${name}`, startedAt, key)
      totalBuildMs += lastBuildMs
      maxBuildMs = Math.max(maxBuildMs, lastBuildMs)
      lastBuiltKey = key
      entries.set(key, entry)
      builds += 1
    } else {
      hits += 1
    }
    entry.lastUsed = ++clock
    return entry.resource
  }

  function has(key: string): boolean {
    return entries.has(key)
  }

  function retain(key: string) {
    const entry = entries.get(key)
    if (!entry) return
    entry.refs += 1
    entry.lastUsed = ++clock
  }

  function release(key: string) {
    const entry = entries.get(key)
    if (!entry) return
    entry.refs = Math.max(0, entry.refs - 1)
    entry.lastUsed = ++clock
    scheduleTrim()
  }

  function scheduleTrim() {
    if (trimTimer) return
    trimTimer = setTimeout(() => {
      trimTimer = null
      trim()
    }, 0)
  }

  function trim() {
    if (entries.size <= maxEntries) return

    const inactive = [...entries.entries()]
      .filter(([, entry]) => entry.refs === 0)
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed)

    for (const [key, entry] of inactive) {
      if (entries.size <= maxEntries) break
      disposeResource(entry.resource)
      entries.delete(key)
      evictions += 1
    }
  }

  return { get, has, retain, release }
}

export function createAsyncTileResourceCache<T>({
  name,
  maxEntries,
  build,
}: AsyncTileResourceCacheOptions<T>) {
  const entries = new Map<string, AsyncCacheEntry<T>>()
  let clock = 0
  let trimTimer: ReturnType<typeof setTimeout> | null = null
  let builds = 0
  let hits = 0
  let evictions = 0
  let totalBuildMs = 0
  let maxBuildMs = 0
  let lastBuildMs = 0
  let lastBuiltKey: string | null = null

  cacheRegistry.set(name, () => {
    let active = 0
    for (const entry of entries.values()) {
      if (entry.refs > 0) active += 1
    }
    return {
      name,
      entries: entries.size,
      active,
      inactive: entries.size - active,
      maxEntries,
      builds,
      hits,
      evictions,
      totalBuildMs: roundMs(totalBuildMs),
      maxBuildMs: roundMs(maxBuildMs),
      lastBuildMs: roundMs(lastBuildMs),
      lastBuiltKey,
    }
  })

  function prepare(key: string): Promise<T> {
    let entry = entries.get(key)
    if (entry?.resource) {
      hits += 1
      entry.lastUsed = ++clock
      return Promise.resolve(entry.resource)
    }
    if (entry?.promise) {
      hits += 1
      entry.lastUsed = ++clock
      return entry.promise
    }

    const startedAt = performance.now()
    entry = { resource: null, promise: null, refs: 0, lastUsed: ++clock }
    entries.set(key, entry)
    builds += 1
    lastBuiltKey = key
    entry.promise = build(key).then((resource) => {
      lastBuildMs = performance.now() - startedAt
      recordPerfSpan(`worker.build:${name}`, startedAt, key)
      totalBuildMs += lastBuildMs
      maxBuildMs = Math.max(maxBuildMs, lastBuildMs)
      entry!.resource = resource
      entry!.promise = null
      entry!.lastUsed = ++clock
      scheduleTrim()
      return resource
    })
    return entry.promise
  }

  function get(key: string): T | null {
    const entry = entries.get(key)
    if (!entry?.resource) return null
    hits += 1
    entry.lastUsed = ++clock
    return entry.resource
  }

  function has(key: string): boolean {
    return Boolean(entries.get(key)?.resource)
  }

  function retain(key: string) {
    const entry = entries.get(key)
    if (!entry) return
    entry.refs += 1
    entry.lastUsed = ++clock
  }

  function release(key: string) {
    const entry = entries.get(key)
    if (!entry) return
    entry.refs = Math.max(0, entry.refs - 1)
    entry.lastUsed = ++clock
    scheduleTrim()
  }

  function scheduleTrim() {
    if (trimTimer) return
    trimTimer = setTimeout(() => {
      trimTimer = null
      trim()
    }, 0)
  }

  function trim() {
    if (entries.size <= maxEntries) return
    const inactive = [...entries.entries()]
      .filter(([, entry]) => entry.refs === 0 && !entry.promise)
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed)

    for (const [key, entry] of inactive) {
      if (entries.size <= maxEntries) break
      disposeResource(entry.resource)
      entries.delete(key)
      evictions += 1
    }
  }

  return { prepare, get, has, retain, release }
}

export function getTileResourceCacheStats(): TileResourceCacheStats[] {
  return [...cacheRegistry.values()].map((readStats) => readStats())
}

function disposeResource<T>(resource: T) {
  if (!resource || typeof resource !== 'object' || !('dispose' in resource)) return
  const dispose = (resource as DisposableResource).dispose
  if (typeof dispose === 'function') dispose.call(resource)
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100
}
