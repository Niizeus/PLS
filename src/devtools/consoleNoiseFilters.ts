const DEDUPED_WARNINGS = ['THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex']

let installed = false

export function installConsoleNoiseFilters() {
  if (installed) return
  installed = true

  const originalWarn = console.warn.bind(console)
  const seen = new Set<string>()

  console.warn = (...args: unknown[]) => {
    const text = args.map(String).join(' ')
    const dedupeKey = DEDUPED_WARNINGS.find((warning) => text.includes(warning))
    if (dedupeKey) {
      if (seen.has(dedupeKey)) return
      seen.add(dedupeKey)
    }
    originalWarn(...args)
  }
}
