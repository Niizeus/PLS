import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const sourceDir = path.resolve('public/textures/clouds/source')
const outputDir = path.resolve('public/textures/clouds/sprites')
const softOutputDir = path.resolve('public/textures/clouds/soft')
const manifestPath = path.resolve('src/core/cloudSpriteManifest.ts')
const padding = 4
const cropInset = 0
const minArea = 900
const minSpriteWidth = 120
const minSpriteHeight = 70
const fringeCleanupPasses = 7
const alphaCloseRadius = 7

if (!existsSync(sourceDir)) {
  throw new Error(`Missing source directory: ${sourceDir}`)
}

const sourceSheets = readdirSync(sourceDir)
  .filter((file) => /^cloud-sheet-\d+\.png$/i.test(file))
  .sort()

mkdirSync(outputDir, { recursive: true })
mkdirSync(softOutputDir, { recursive: true })
for (const file of readdirSync(outputDir)) {
  if (file.endsWith('.png')) rmSync(path.join(outputDir, file))
}
for (const file of readdirSync(softOutputDir)) {
  if (file.endsWith('.png')) rmSync(path.join(softOutputDir, file))
}

const sprites = []

for (const sheetFile of sourceSheets) {
  const inputPath = path.join(sourceDir, sheetFile)
  const source = PNG.sync.read(readFileSync(inputPath))
  const { width, height } = source
  const background = new Uint8Array(width * height)
  const component = new Int32Array(width * height)
  component.fill(-1)

  floodFillBackground(source, background)
  cleanConnectedBackgroundFringe(source, background, fringeCleanupPasses)

  let componentIndex = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x
      if (background[start] || component[start] !== -1) continue

      const bounds = { minX: x, minY: y, maxX: x, maxY: y, area: 0 }
      const queue = [start]
      component[start] = componentIndex

      for (let head = 0; head < queue.length; head += 1) {
        const current = queue[head]
        const cx = current % width
        const cy = Math.floor(current / width)
        bounds.area += 1
        bounds.minX = Math.min(bounds.minX, cx)
        bounds.minY = Math.min(bounds.minY, cy)
        bounds.maxX = Math.max(bounds.maxX, cx)
        bounds.maxY = Math.max(bounds.maxY, cy)

        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (ox === 0 && oy === 0) continue
            const nx = cx + ox
            const ny = cy + oy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const next = ny * width + nx
            if (background[next] || component[next] !== -1) continue
            component[next] = componentIndex
            queue.push(next)
          }
        }
      }

      if (bounds.area >= minArea && !touchesSheetEdge(bounds, width, height)) {
        const sprite = writeSprite(source, component, componentIndex, bounds, sprites.length + 1)
        if (sprite) sprites.push(sprite)
      }

      componentIndex += 1
    }
  }
}

writeFileSync(
  manifestPath,
  `export const CLOUD_SPRITE_PATHS = ${JSON.stringify(
    sprites.map((sprite) => sprite.normalPath),
    null,
    2,
  )} as const\n\nexport const CLOUD_SOFT_SPRITE_PATHS = ${JSON.stringify(
    sprites.map((sprite) => sprite.softPath),
    null,
  2,
  )} as const\n\nexport const CLOUD_SPRITE_SIZES = ${JSON.stringify(
    sprites.map((sprite) => ({ width: sprite.width, height: sprite.height })),
    null,
    2,
  )} as const\n`,
)

console.log(`Extracted ${sprites.length} cloud sprites.`)

function floodFillBackground(source, background) {
  const { width, height } = source
  const queue = []

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(source, background, queue, x, 0)
    pushIfBackground(source, background, queue, x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushIfBackground(source, background, queue, 0, y)
    pushIfBackground(source, background, queue, width - 1, y)
  }

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]
    const x = current % width
    const y = Math.floor(current / width)
    pushIfBackground(source, background, queue, x + 1, y)
    pushIfBackground(source, background, queue, x - 1, y)
    pushIfBackground(source, background, queue, x, y + 1)
    pushIfBackground(source, background, queue, x, y - 1)
  }
}

function pushIfBackground(source, background, queue, x, y) {
  const { width, height, data } = source
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const index = y * width + x
  if (background[index]) return
  const offset = index * 4
  if (!isSheetBackground(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) return
  background[index] = 1
  queue.push(index)
}

function isSheetBackground(r, g, b, a) {
  if (a < 8) return true
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return r >= 202 && g >= 198 && b >= 184 && max - min <= 72
}

function cleanConnectedBackgroundFringe(source, background, passes) {
  const { width, height, data } = source

  for (let pass = 0; pass < passes; pass += 1) {
    const next = []
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x
        if (background[index]) continue
        if (
          !background[index - 1] &&
          !background[index + 1] &&
          !background[index - width] &&
          !background[index + width]
        ) {
          continue
        }

        const offset = index * 4
        if (isBackgroundFringe(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
          next.push(index)
        }
      }
    }

    for (const index of next) background[index] = 1
  }
}

function isBackgroundFringe(r, g, b, a) {
  if (a < 16) return true
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return r >= 164 && g >= 158 && b >= 136 && max - min <= 110
}

function touchesSheetEdge(bounds, width, height) {
  return bounds.minX <= 1 || bounds.minY <= 1 || bounds.maxX >= width - 2 || bounds.maxY >= height - 2
}

function writeSprite(source, component, componentIndex, bounds, spriteNumber) {
  const { width, data } = source
  const safeInsetX = Math.min(cropInset, Math.max(0, Math.floor((bounds.maxX - bounds.minX) / 18)))
  const safeInsetY = Math.min(cropInset, Math.max(0, Math.floor((bounds.maxY - bounds.minY) / 18)))
  const minX = Math.max(0, bounds.minX - padding + safeInsetX)
  const minY = Math.max(0, bounds.minY - padding + safeInsetY)
  const maxX = Math.min(source.width - 1, bounds.maxX + padding - safeInsetX)
  const maxY = Math.min(source.height - 1, bounds.maxY + padding - safeInsetY)
  const spriteWidth = maxX - minX + 1
  const spriteHeight = maxY - minY + 1
  const output = new PNG({ width: spriteWidth, height: spriteHeight })

  for (let y = 0; y < spriteHeight; y += 1) {
    for (let x = 0; x < spriteWidth; x += 1) {
      const sx = minX + x
      const sy = minY + y
      const sourceIndex = sy * width + sx
      const sourceOffset = sourceIndex * 4
      const outputOffset = (y * spriteWidth + x) * 4
      output.data[outputOffset] = data[sourceOffset]
      output.data[outputOffset + 1] = data[sourceOffset + 1]
      output.data[outputOffset + 2] = data[sourceOffset + 2]
      output.data[outputOffset + 3] =
        component[sourceIndex] === componentIndex ? data[sourceOffset + 3] : 0
    }
  }

  closeAlphaGaps(output, alphaCloseRadius)
  fillTransparentHoles(output)
  if (!isUsableSprite(output)) return null

  const file = `cloud-${String(spriteNumber).padStart(2, '0')}.png`
  const softFile = `cloud-soft-${String(spriteNumber).padStart(2, '0')}.png`
  writeFileSync(path.join(outputDir, file), PNG.sync.write(output))
  writeFileSync(path.join(softOutputDir, softFile), PNG.sync.write(makeSoftSprite(output)))
  return {
    normalPath: `/textures/clouds/sprites/${file}`,
    softPath: `/textures/clouds/soft/${softFile}`,
    width: spriteWidth,
    height: spriteHeight,
  }
}

function isUsableSprite(source) {
  const { width, height, data } = source
  if (width < minSpriteWidth || height < minSpriteHeight) return false
  if (height > width * 0.85) return false
  if (width > 760 || height > 430) return false

  let opaque = 0
  let flatDarkPixels = 0
  let transparentInsideBounds = 0
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      const offset = (y * width + x) * 4
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const average = (r + g + b) / 3
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      opaque += 1
      if (average < 165 && chroma < 35) flatDarkPixels += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (opaque < minArea) return false
  const boundsArea = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1))
  const fillRatio = opaque / boundsArea
  if (fillRatio < 0.18) return false
  if (flatDarkPixels / opaque > 0.42) return false

  for (let y = minY + 4; y <= maxY - 4; y += 1) {
    for (let x = minX + 4; x <= maxX - 4; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) transparentInsideBounds += 1
    }
  }

  return transparentInsideBounds / boundsArea < 0.22
}

function fillTransparentHoles(source) {
  const { width, height, data } = source
  const exterior = new Uint8Array(width * height)
  const queue = []

  for (let x = 0; x < width; x += 1) {
    pushTransparent(source, exterior, queue, x, 0)
    pushTransparent(source, exterior, queue, x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushTransparent(source, exterior, queue, 0, y)
    pushTransparent(source, exterior, queue, width - 1, y)
  }

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]
    const x = current % width
    const y = Math.floor(current / width)
    pushTransparent(source, exterior, queue, x + 1, y)
    pushTransparent(source, exterior, queue, x - 1, y)
    pushTransparent(source, exterior, queue, x, y + 1)
    pushTransparent(source, exterior, queue, x, y - 1)
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const offset = index * 4
      if (data[offset + 3] !== 0 || exterior[index]) continue

      const color = nearestOpaqueColor(source, x, y)
      data[offset] = color.r
      data[offset + 1] = color.g
      data[offset + 2] = color.b
      data[offset + 3] = 255
    }
  }
}

function closeAlphaGaps(source, radius) {
  const { width, height, data } = source
  const pixelCount = width * height
  const dilated = new Uint8Array(pixelCount)
  const closed = new Uint8Array(pixelCount)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let hit = false
      for (let oy = -radius; oy <= radius && !hit; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          if (ox * ox + oy * oy > radius * radius) continue
          const sx = x + ox
          const sy = y + oy
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
          if (data[(sy * width + sx) * 4 + 3] > 0) {
            hit = true
            break
          }
        }
      }
      if (hit) dilated[y * width + x] = 1
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let filled = true
      for (let oy = -radius; oy <= radius && filled; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          if (ox * ox + oy * oy > radius * radius) continue
          const sx = x + ox
          const sy = y + oy
          if (sx < 0 || sy < 0 || sx >= width || sy >= height || !dilated[sy * width + sx]) {
            filled = false
            break
          }
        }
      }
      if (filled) closed[y * width + x] = 1
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const offset = index * 4
      if (!closed[index] || data[offset + 3] !== 0) continue
      const color = nearestOpaqueColor(source, x, y)
      data[offset] = color.r
      data[offset + 1] = color.g
      data[offset + 2] = color.b
      data[offset + 3] = 255
    }
  }
}

function pushTransparent(source, exterior, queue, x, y) {
  const { width, height, data } = source
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const index = y * width + x
  if (exterior[index] || data[index * 4 + 3] !== 0) return
  exterior[index] = 1
  queue.push(index)
}

function nearestOpaqueColor(source, x, y) {
  const { width, height, data } = source
  for (let radius = 1; radius <= 10; radius += 1) {
    let r = 0
    let g = 0
    let b = 0
    let count = 0

    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue
        const sx = x + ox
        const sy = y + oy
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
        const offset = (sy * width + sx) * 4
        if (data[offset + 3] === 0) continue
        r += data[offset]
        g += data[offset + 1]
        b += data[offset + 2]
        count += 1
      }
    }

    if (count > 0) {
      return {
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count),
      }
    }
  }

  return { r: 245, g: 242, b: 228 }
}

function makeSoftSprite(source) {
  const output = new PNG({ width: source.width, height: source.height })
  const radius = 2

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      let total = 0
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          const sx = Math.min(source.width - 1, Math.max(0, x + ox))
          const sy = Math.min(source.height - 1, Math.max(0, y + oy))
          const weight = ox === 0 && oy === 0 ? 3 : 1
          const offset = (sy * source.width + sx) * 4
          r += source.data[offset] * weight
          g += source.data[offset + 1] * weight
          b += source.data[offset + 2] * weight
          a += source.data[offset + 3] * weight
          total += weight
        }
      }

      const outputOffset = (y * source.width + x) * 4
      output.data[outputOffset] = Math.round(r / total)
      output.data[outputOffset + 1] = Math.round(g / total)
      output.data[outputOffset + 2] = Math.round(b / total)
      output.data[outputOffset + 3] = Math.round((a / total) * 0.72)
    }
  }

  return output
}
