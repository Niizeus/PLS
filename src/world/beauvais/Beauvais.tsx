import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { usePlayerStore } from '../../gameplay/stats/playerStore'
import { BUILDINGS, SPAWN, pointInFootprint, terrainHeight, type Building } from './cityData'

/**
 * 🏙️  Beauvais généré depuis OpenStreetMap (le "Temps 3" du pipeline, voir docs/04).
 *
 * ⚠️ Toute la ville = ~34 000 bâtiments : impossible de tout afficher. Or le
 * brouillard (voir GameCanvas) masque déjà tout au-delà de ~110 m. On ne construit
 * donc et n'affiche QUE les TUILES proches du joueur (streaming) :
 *  - les bâtiments sont regroupés par tuile de TILE mètres (calcul léger, sans 3D) ;
 *  - à chaque fois que le joueur change de tuile, on monte les tuiles voisines et on
 *    démonte les autres. La géométrie d'une tuile n'est construite qu'à son montage,
 *    et libérée à son démontage.
 * → chargement quasi instantané et rendu léger, quelle que soit la taille de la ville.
 */

const TILE = 180 // côté d'une tuile, en mètres
const REACH = 1 // nombre d'anneaux de tuiles autour du joueur (1 = 3×3 tuiles)
const BUILDING_SKIRT = 6 // hauteur enterrée sous le terrain (anti-flottement sur pente)

const FACADES = [
  '#d8cdb8', '#cdbfa6', '#c8c4b9', '#d3c3a4', '#bfb4a0',
  '#c9b79a', '#baa98f', '#d6cbb0', '#c2a98c', '#cfc7bd',
]
const ROOFS = ['#8a7f72', '#7f7d79', '#9a6b57', '#6f6b64', '#8b6f5e', '#767c7a']
const CENTRE_FACADES = ['#dfd3bb', '#d4c5aa', '#cbb99b', '#e1d7c5', '#c7b79f', '#d8c8ad']
const CENTRE_ROOFS = ['#5f6970', '#6f5a4d', '#766f66', '#485a63']
const SHOP_SIGNS = ['#b94f4b', '#2f6f82', '#d0a63e', '#4b658f']
const AWNINGS = ['#b8423e', '#2c7280', '#c89d3a', '#5c6f94']
const SHUTTERS = ['#586f66', '#6b5f7f', '#8f6a4b', '#4f6f8a']
const CHIMNEYS = ['#7d4b3d', '#6b5a4d', '#8b5a48']
const CENTRE_RADIUS = 560
const DETAIL_DEPTH = 0.045

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

function isCentreVille(b: Building): boolean {
  return Math.abs(b.cx) <= CENTRE_RADIUS && Math.abs(b.cz) <= CENTRE_RADIUS
}

function signedArea(pts: number[][]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i]
    const [x2, z2] = pts[(i + 1) % pts.length]
    a += x1 * z2 - x2 * z1
  }
  return a / 2
}

/** Extrude + colore un bâtiment (façade + toit). */
function buildOne(b: Building, facade: THREE.Color, roof: THREE.Color): THREE.BufferGeometry | null {
  if (b.pts.length < 3) return null
  const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts

  const shape = new THREE.Shape()
  shape.moveTo(ring[0][0], -ring[0][1])
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], -ring[i][1])
  shape.closePath()

  // Cours intérieures (patios) : découpées comme des trous dans l'extrusion.
  if (b.holes) {
    for (const hole of b.holes) {
      if (hole.length < 3) continue
      const path = new THREE.Path()
      path.moveTo(hole[0][0], -hole[0][1])
      for (let i = 1; i < hole.length; i++) path.lineTo(hole[i][0], -hole[i][1])
      path.closePath()
      shape.holes.push(path)
    }
  }

  // On extrude un peu PLUS haut que la hauteur reelle : le surplus (SKIRT) sera
  // enterre sous le terrain pour que le batiment ne "flotte" pas sur une pente.
  const depth = b.h + BUILDING_SKIRT
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)

  if (b.kind) {
    // Monuments (cathédrale, églises) : pierre claire + toit ardoise → repères nets.
    facade.set('#e7e1d2')
    roof.set('#4d5b66')
  } else if (isCentreVille(b)) {
    facade.set(CENTRE_FACADES[Math.floor(hash01(b.cx, b.cz) * CENTRE_FACADES.length)])
    roof.set(CENTRE_ROOFS[Math.floor(hash01(b.cz, b.cx) * CENTRE_ROOFS.length)])
  } else {
    facade.set(FACADES[Math.floor(hash01(b.cx, b.cz) * FACADES.length)])
    roof.set(ROOFS[Math.floor(hash01(b.cz, b.cx) * ROOFS.length)])
  }

  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let v = 0; v < pos.count; v++) {
    const c = pos.getY(v) >= depth - 0.05 ? roof : facade
    colors[v * 3] = c.r
    colors[v * 3 + 1] = c.g
    colors[v * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  // Pose le bâtiment sur le relief (base enterrée de SKIRT, toit à terrain + hauteur).
  geo.translate(0, terrainHeight(b.cx, b.cz) - BUILDING_SKIRT, 0)
  return geo
}

function addFacadeQuad(
  out: number[],
  colorOut: number[],
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  y1: number,
  y2: number,
  color: THREE.Color,
) {
  out.push(x1, y1, z1, x2, y1, z2, x2, y2, z2, x1, y1, z1, x2, y2, z2, x1, y2, z1)
  for (let i = 0; i < 6; i++) colorOut.push(color.r, color.g, color.b)
}

function addWorldQuad(
  out: number[],
  colorOut: number[],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
  color: THREE.Color,
) {
  out.push(...a, ...b, ...c, ...a, ...c, ...d)
  for (let i = 0; i < 6; i++) colorOut.push(color.r, color.g, color.b)
}

function makeCentreDetails(buildings: Building[]): THREE.BufferGeometry | null {
  const positions: number[] = []
  const colors: number[] = []
  const window = new THREE.Color('#2f4650')
  const litWindow = new THREE.Color('#e9c36a')
  const shop = new THREE.Color('#6e8e91')
  const line = new THREE.Color('#9a866d')
  const sign = new THREE.Color()
  const awning = new THREE.Color()
  const shutter = new THREE.Color()

  for (const b of buildings) {
    if (!isCentreVille(b) || b.kind || b.h < 4 || b.pts.length < 3) continue
    const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts
    const baseY = terrainHeight(b.cx, b.cz) + 0.22
    const topY = baseY + Math.max(3, b.h - 0.6)
    const floors = Math.max(1, Math.min(5, Math.floor((b.h - 1.5) / 3)))

    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 7 || len > 42) continue

      const ux = dx / len
      const uz = dz / len
      const nx = dz / len
      const nz = -dx / len
      const slots = Math.max(1, Math.min(5, Math.floor(len / 6)))
      const margin = Math.min(2.2, len * 0.16)
      const usable = len - margin * 2
      const step = usable / slots

      if (len > 11 && b.h < 12 && hash01(b.cx + i * 7, b.cz - i * 3) > 0.38) {
        const sx1 = ax + ux * margin + nx * DETAIL_DEPTH
        const sz1 = az + uz * margin + nz * DETAIL_DEPTH
        const sx2 = ax + ux * (len - margin) + nx * DETAIL_DEPTH
        const sz2 = az + uz * (len - margin) + nz * DETAIL_DEPTH
        addFacadeQuad(positions, colors, sx1, sz1, sx2, sz2, baseY + 0.25, baseY + 2.2, shop)
        sign.set(SHOP_SIGNS[Math.floor(hash01(b.cz + i * 11, b.cx - i * 5) * SHOP_SIGNS.length)])
        addFacadeQuad(positions, colors, sx1, sz1, sx2, sz2, baseY + 2.25, baseY + 2.65, sign)
        if (hash01(b.cx - i * 2, b.cz + i * 9) > 0.35) {
          awning.set(AWNINGS[Math.floor(hash01(b.cx + i * 41, b.cz - i * 37) * AWNINGS.length)])
          const out = 0.95
          const yBack = baseY + 2.22
          const yFront = baseY + 2.02
          addWorldQuad(
            positions,
            colors,
            [sx1, yBack, sz1],
            [sx2, yBack, sz2],
            [sx2 + nx * out, yFront, sz2 + nz * out],
            [sx1 + nx * out, yFront, sz1 + nz * out],
            awning,
          )
        }
      }

      for (let f = 0; f < floors; f++) {
        const cy = baseY + 2.8 + f * 2.8
        if (cy + 0.95 > topY) continue
        const bandStartX = ax + ux * 0.8 + nx * DETAIL_DEPTH
        const bandStartZ = az + uz * 0.8 + nz * DETAIL_DEPTH
        const bandEndX = ax + ux * (len - 0.8) + nx * DETAIL_DEPTH
        const bandEndZ = az + uz * (len - 0.8) + nz * DETAIL_DEPTH
        addFacadeQuad(positions, colors, bandStartX, bandStartZ, bandEndX, bandEndZ, cy - 0.2, cy - 0.08, line)

        for (let s = 0; s < slots; s++) {
          const center = margin + step * (s + 0.5)
          const w = Math.min(1.25, step * 0.45)
          const x1 = ax + ux * (center - w / 2) + nx * DETAIL_DEPTH
          const z1 = az + uz * (center - w / 2) + nz * DETAIL_DEPTH
          const x2 = ax + ux * (center + w / 2) + nx * DETAIL_DEPTH
          const z2 = az + uz * (center + w / 2) + nz * DETAIL_DEPTH
          const c = hash01(b.cx + s * 13, b.cz + f * 17) > 0.86 ? litWindow : window
          addFacadeQuad(positions, colors, x1, z1, x2, z2, cy, cy + 1.05, c)
          if (f > 0 && hash01(b.cx + s * 31, b.cz + f * 29) > 0.72) {
            const sw = Math.min(0.35, w * 0.28)
            shutter.set(SHUTTERS[Math.floor(hash01(b.cz + s * 7, b.cx + f * 11) * SHUTTERS.length)])
            addFacadeQuad(
              positions,
              colors,
              x1 - ux * (sw + 0.08),
              z1 - uz * (sw + 0.08),
              x1 - ux * 0.08,
              z1 - uz * 0.08,
              cy - 0.03,
              cy + 1.08,
              shutter,
            )
            addFacadeQuad(
              positions,
              colors,
              x2 + ux * 0.08,
              z2 + uz * 0.08,
              x2 + ux * (sw + 0.08),
              z2 + uz * (sw + 0.08),
              cy - 0.03,
              cy + 1.08,
              shutter,
            )
          }
        }
      }
    }
  }

  if (positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  geo.computeVertexNormals()
  return geo
}

/** Contours fins façon BD pour les bâtiments du centre-ville uniquement. */
function makeMonumentDetails(buildings: Building[]): THREE.BufferGeometry | null {
  const positions: number[] = []
  const colors: number[] = []
  const glass = new THREE.Color('#263f54')
  const litGlass = new THREE.Color('#85aeb3')
  const stoneLine = new THREE.Color('#b7aa91')

  for (const b of buildings) {
    if (!b.kind || b.pts.length < 3) continue
    const ring = signedArea(b.pts) < 0 ? [...b.pts].reverse() : b.pts
    const baseY = terrainHeight(b.cx, b.cz) + 0.3
    const topY = baseY + b.h - 1
    const windowH = Math.max(4.5, Math.min(13, b.h * 0.28))
    const windowBottom = baseY + Math.max(2.2, b.h * 0.22)

    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]
      const [bx, bz] = ring[(i + 1) % ring.length]
      const dx = bx - ax
      const dz = bz - az
      const len = Math.hypot(dx, dz)
      if (len < 9 || len > 70) continue

      const ux = dx / len
      const uz = dz / len
      const nx = dz / len
      const nz = -dx / len
      const slots = Math.max(1, Math.min(7, Math.floor(len / 8)))
      const margin = Math.min(3, len * 0.18)
      const usable = len - margin * 2
      const step = usable / slots

      const bandStartX = ax + ux * 0.8 + nx * DETAIL_DEPTH
      const bandStartZ = az + uz * 0.8 + nz * DETAIL_DEPTH
      const bandEndX = ax + ux * (len - 0.8) + nx * DETAIL_DEPTH
      const bandEndZ = az + uz * (len - 0.8) + nz * DETAIL_DEPTH
      addFacadeQuad(positions, colors, bandStartX, bandStartZ, bandEndX, bandEndZ, topY - 1.2, topY - 0.95, stoneLine)
      addFacadeQuad(positions, colors, bandStartX, bandStartZ, bandEndX, bandEndZ, windowBottom - 0.35, windowBottom - 0.15, stoneLine)

      for (let s = 0; s < slots; s++) {
        const center = margin + step * (s + 0.5)
        const w = Math.min(1.45, step * 0.38)
        const x1 = ax + ux * (center - w / 2) + nx * DETAIL_DEPTH
        const z1 = az + uz * (center - w / 2) + nz * DETAIL_DEPTH
        const x2 = ax + ux * (center + w / 2) + nx * DETAIL_DEPTH
        const z2 = az + uz * (center + w / 2) + nz * DETAIL_DEPTH
        const c = hash01(b.cx + s * 23, b.cz + i * 19) > 0.78 ? litGlass : glass
        addFacadeQuad(positions, colors, x1, z1, x2, z2, windowBottom, Math.min(topY - 1.5, windowBottom + windowH), c)

        if (s === 0 || s === slots - 1 || hash01(b.cz + s * 5, b.cx + i * 3) > 0.68) {
          const px = ax + ux * center + nx * DETAIL_DEPTH
          const pz = az + uz * center + nz * DETAIL_DEPTH
          addFacadeQuad(positions, colors, px - ux * 0.12, pz - uz * 0.12, px + ux * 0.12, pz + uz * 0.12, baseY + 0.5, topY - 0.7, stoneLine)
        }
      }
    }
  }

  if (positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))
  geo.computeVertexNormals()
  return geo
}

function makeMonumentRoofLines(buildings: Building[]): THREE.BufferGeometry | null {
  const positions: number[] = []
  for (const b of buildings) {
    if (!b.kind || b.pts.length < 3) continue
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const [x, z] of b.pts) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }

    const width = maxX - minX
    const depth = maxZ - minZ
    if (width < 8 || depth < 8) continue
    const y = terrainHeight(b.cx, b.cz) + b.h + 0.14
    positions.push(minX + width * 0.16, y, b.cz, maxX - width * 0.16, y, b.cz)
    positions.push(b.cx, y, minZ + depth * 0.16, b.cx, y, maxZ - depth * 0.16)
    positions.push(minX + width * 0.22, y, minZ + depth * 0.22, maxX - width * 0.22, y, maxZ - depth * 0.22)
    positions.push(maxX - width * 0.22, y, minZ + depth * 0.22, minX + width * 0.22, y, maxZ - depth * 0.22)
  }

  if (positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geo
}

function makeCentreOutline(buildings: Building[]): THREE.BufferGeometry | null {
  const facade = new THREE.Color()
  const roof = new THREE.Color()
  const geos: THREE.BufferGeometry[] = []
  for (const b of buildings) {
    if (!isCentreVille(b)) continue
    const g = buildOne(b, facade, roof)
    if (g) geos.push(g)
  }
  if (geos.length === 0) return null
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  const edges = new THREE.EdgesGeometry(merged, 35)
  merged.dispose()
  return edges
}

function makeCentreRoofMarks(buildings: Building[]): THREE.BufferGeometry | null {
  const positions: number[] = []
  for (const b of buildings) {
    if (!isCentreVille(b) || b.kind || b.h < 4 || b.pts.length < 3) continue
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const [x, z] of b.pts) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }

    const width = maxX - minX
    const depth = maxZ - minZ
    if (width < 7 || depth < 7) continue
    const y = terrainHeight(b.cx, b.cz) + b.h + 0.08
    const strokes = Math.max(1, Math.min(3, Math.floor(Math.min(width, depth) / 9)))

    for (let i = 0; i < strokes; i++) {
      const t = strokes === 1 ? 0 : i / (strokes - 1) - 0.5
      if (width >= depth) {
        const xHalf = width * 0.32
        const z = b.cz + t * depth * 0.38
        positions.push(b.cx - xHalf, y, z, b.cx + xHalf, y, z)
      } else {
        const zHalf = depth * 0.32
        const x = b.cx + t * width * 0.38
        positions.push(x, y, b.cz - zHalf, x, y, b.cz + zHalf)
      }
    }
  }

  if (positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geo
}

/** Regroupe les bâtiments par tuile (léger : pas de géométrie ici). */
function tintGeometry(geo: THREE.BufferGeometry, color: THREE.Color) {
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

function makeCentreRoofProps(buildings: Building[]): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = []
  const color = new THREE.Color()

  for (const b of buildings) {
    if (!isCentreVille(b) || b.kind || b.h < 5 || b.h > 16 || b.pts.length < 3) continue
    if (hash01(b.cx * 0.7, b.cz * 1.3) < 0.42) continue

    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const [x, z] of b.pts) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }

    const width = maxX - minX
    const depth = maxZ - minZ
    if (width < 8 || depth < 8) continue

    const count = hash01(b.cz * 1.7, b.cx * 0.9) > 0.78 ? 2 : 1
    for (let i = 0; i < count; i++) {
      const ox = (hash01(b.cx + i * 31, b.cz - i * 17) - 0.5) * width * 0.42
      const oz = (hash01(b.cz + i * 29, b.cx + i * 13) - 0.5) * depth * 0.42
      const x = b.cx + ox
      const z = b.cz + oz
      if (!pointInFootprint(x, z, b.pts)) continue

      const sx = 0.55 + hash01(x, z) * 0.35
      const sz = 0.45 + hash01(z, x) * 0.3
      const sy = 0.9 + hash01(x + z, b.h) * 0.75
      const y = terrainHeight(b.cx, b.cz) + b.h + sy / 2
      const geo = new THREE.BoxGeometry(sx, sy, sz)
      geo.translate(x, y, z)
      color.set(CHIMNEYS[Math.floor(hash01(x * 3, z * 5) * CHIMNEYS.length)])
      tintGeometry(geo, color)
      geos.push(geo)
    }
  }

  if (geos.length === 0) return null
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

function groupByTile(): Map<string, Building[]> {
  const map = new Map<string, Building[]>()
  for (const b of BUILDINGS) {
    const key = Math.floor(b.cx / TILE) + ':' + Math.floor(b.cz / TILE)
    let g = map.get(key)
    if (!g) map.set(key, (g = []))
    g.push(b)
  }
  return map
}

/** Clés des tuiles existantes autour d'une position monde. */
function tilesAround(px: number, pz: number, tiles: Map<string, Building[]>): string[] {
  const tx = Math.floor(px / TILE)
  const tz = Math.floor(pz / TILE)
  const out: string[] = []
  for (let dx = -REACH; dx <= REACH; dx++) {
    for (let dz = -REACH; dz <= REACH; dz++) {
      const k = tx + dx + ':' + (tz + dz)
      if (tiles.has(k)) out.push(k)
    }
  }
  return out
}

/** Une tuile : construit sa géométrie fusionnée à son montage, la libère au démontage. */
function BuildingTile({ buildings, material }: { buildings: Building[]; material: THREE.Material }) {
  const geometry = useMemo(() => {
    const facade = new THREE.Color()
    const roof = new THREE.Color()
    const geos: THREE.BufferGeometry[] = []
    for (const b of buildings) {
      const g = buildOne(b, facade, roof)
      if (g) geos.push(g)
    }
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    return merged
  }, [buildings])
  const details = useMemo(() => makeCentreDetails(buildings), [buildings])
  const monumentDetails = useMemo(() => makeMonumentDetails(buildings), [buildings])
  const monumentRoofLines = useMemo(() => makeMonumentRoofLines(buildings), [buildings])
  const outline = useMemo(() => makeCentreOutline(buildings), [buildings])
  const roofMarks = useMemo(() => makeCentreRoofMarks(buildings), [buildings])
  const roofProps = useMemo(() => makeCentreRoofProps(buildings), [buildings])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => details?.dispose(), [details])
  useEffect(() => () => monumentDetails?.dispose(), [monumentDetails])
  useEffect(() => () => monumentRoofLines?.dispose(), [monumentRoofLines])
  useEffect(() => () => outline?.dispose(), [outline])
  useEffect(() => () => roofMarks?.dispose(), [roofMarks])
  useEffect(() => () => roofProps?.dispose(), [roofProps])

  return (
    <>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      {details ? (
        <mesh geometry={details} renderOrder={2}>
          <meshToonMaterial
            vertexColors
            gradientMap={toonGradient}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        </mesh>
      ) : null}
      {monumentDetails ? (
        <mesh geometry={monumentDetails} renderOrder={3}>
          <meshToonMaterial
            vertexColors
            gradientMap={toonGradient}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-5}
            polygonOffsetUnits={-5}
          />
        </mesh>
      ) : null}
      {outline ? (
        <lineSegments geometry={outline} renderOrder={4}>
          <lineBasicMaterial color="#24201d" transparent opacity={0.72} depthTest />
        </lineSegments>
      ) : null}
      {roofMarks ? (
        <lineSegments geometry={roofMarks} renderOrder={5}>
          <lineBasicMaterial color="#40352c" transparent opacity={0.62} depthTest />
        </lineSegments>
      ) : null}
      {roofProps ? <mesh geometry={roofProps} material={material} castShadow receiveShadow /> : null}
      {monumentRoofLines ? (
        <lineSegments geometry={monumentRoofLines} renderOrder={6}>
          <lineBasicMaterial color="#20282c" transparent opacity={0.78} depthTest />
        </lineSegments>
      ) : null}
    </>
  )
}

export default function Beauvais() {
  const tiles = useMemo(groupByTile, [])
  const material = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        vertexColors: true,
        gradientMap: toonGradient,
        side: THREE.DoubleSide,
      }),
    [],
  )

  // On sème les tuiles autour du spawn dès le départ (rendu immédiat, pas de trou).
  const [active, setActive] = useState<string[]>(() => tilesAround(SPAWN.x, SPAWN.z, tiles))
  const lastKey = useRef(Math.floor(SPAWN.x / TILE) + ':' + Math.floor(SPAWN.z / TILE))

  useFrame(() => {
    const p = usePlayerStore.getState().playerObject
    const px = p ? p.position.x : SPAWN.x
    const pz = p ? p.position.z : SPAWN.z
    const key = Math.floor(px / TILE) + ':' + Math.floor(pz / TILE)
    // On ne recalcule la liste que quand le joueur CHANGE de tuile (rare).
    if (key === lastKey.current) return
    lastKey.current = key
    setActive(tilesAround(px, pz, tiles))
  })

  return (
    <>
      {active.map((key) => (
        <BuildingTile key={key} buildings={tiles.get(key)!} material={material} />
      ))}
    </>
  )
}
