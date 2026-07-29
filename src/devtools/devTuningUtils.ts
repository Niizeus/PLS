import type { DeepPartial } from './devTuningTypes'

export function mergeDeep<T>(base: T, overrides: DeepPartial<T> | undefined): T {
  if (!overrides) return cloneValue(base)

  const result = cloneValue(base) as Record<string, unknown>
  for (const [key, overrideValue] of Object.entries(overrides)) {
    if (overrideValue === undefined) continue
    const baseValue = (result as Record<string, unknown>)[key]
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = mergeDeep(baseValue, overrideValue as DeepPartial<typeof baseValue>)
    } else {
      result[key] = cloneValue(overrideValue)
    }
  }
  return result as T
}

export function getPathValue(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isPlainObject(current) && !Array.isArray(current)) return undefined
    return (current as Record<string, unknown>)[segment]
  }, source)
}

export function setPathValue<T extends Record<string, unknown>>(source: T, path: string, value: unknown): T {
  const next = cloneValue(source)
  const segments = path.split('.')
  let cursor: Record<string, unknown> = next

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]
    const nextSegment = segments[i + 1]
    const existing = cursor[segment]
    if (Array.isArray(existing)) cursor[segment] = [...existing]
    else if (isPlainObject(existing)) cursor[segment] = { ...existing }
    else cursor[segment] = /^\d+$/.test(nextSegment) ? [] : {}
    cursor = cursor[segment] as Record<string, unknown>
  }

  cursor[segments[segments.length - 1]] = value
  return next
}

export function pruneEmpty<T>(value: T): T | undefined {
  if (Array.isArray(value)) return value.length > 0 ? value : undefined
  if (!isPlainObject(value)) return value

  const entries = Object.entries(value)
    .map(([key, entry]) => [key, pruneEmpty(entry)] as const)
    .filter(([, entry]) => entry !== undefined)

  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as T
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T
  if (isPlainObject(value)) return { ...value } as T
  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
