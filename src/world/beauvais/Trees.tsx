import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { GREENS, TREES, pointInFootprint, terrainHeight } from './cityData'

/**
 * 🌲 Arbres, en INSTANCES (un seul draw call pour tous).
 *
 * On prend les arbres cartographiés (OSM) + on en sème dans les zones boisées pour
 * qu'elles aient l'air d'un vrai bois. Chaque arbre = tronc + houppier, avec une
 * petite variation d'échelle/rotation pour que ça ne fasse pas "copié-collé".
 */

const MAX_SCATTER = 3000 // plafond d'arbres semés (perf)
const SCATTER_AREA = 140 // ~1 arbre par 140 m² de bois

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** Géométrie d'un arbre (tronc + houppier), colorée par sommet. */
function treeGeometry(): THREE.BufferGeometry {
  // ⚠️ mergeGeometries refuse de mélanger une géométrie INDEXÉE (cylindre) et une
  // NON indexée (icosaèdre). On passe donc le tronc en non-indexé pour que les deux
  // soient compatibles (sinon la fusion renvoie null → écran noir).
  const trunkIndexed = new THREE.CylinderGeometry(0.13, 0.18, 1.4, 6)
  trunkIndexed.translate(0, 0.7, 0)
  const trunk = trunkIndexed.toNonIndexed()
  trunkIndexed.dispose()
  paint(trunk, new THREE.Color('#6b4a2f'))

  const foliage = new THREE.IcosahedronGeometry(1.15, 0) // déjà non indexée
  foliage.scale(1, 1.15, 1)
  foliage.translate(0, 2.2, 0)
  paint(foliage, new THREE.Color('#5a8a44'))

  return mergeGeometries([trunk, foliage], false)
}

function paint(geo: THREE.BufferGeometry, color: THREE.Color) {
  const n = geo.attributes.position.count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/** Positions des arbres : OSM + semis déterministe dans les bois. */
function treePositions(): number[][] {
  const pos: number[][] = TREES.slice()
  let scattered = 0
  for (const g of GREENS) {
    if (!g.wood || scattered >= MAX_SCATTER) continue
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const [x, z] of g.pts) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (z < minZ) minZ = z
      if (z > maxZ) maxZ = z
    }
    const target = Math.min(((maxX - minX) * (maxZ - minZ)) / SCATTER_AREA, 300)
    for (let k = 0; k < target && scattered < MAX_SCATTER; k++) {
      // Échantillons déterministes dans la bbox, gardés s'ils sont dans le polygone.
      const rx = hash01(minX + k, maxZ + g.pts.length)
      const rz = hash01(maxX - k, minZ - g.pts.length * 2)
      const x = minX + rx * (maxX - minX)
      const z = minZ + rz * (maxZ - minZ)
      if (pointInFootprint(x, z, g.pts)) {
        pos.push([x, z])
        scattered++
      }
    }
  }
  return pos
}

export default function Trees() {
  const geometry = useMemo(treeGeometry, [])
  const material = useMemo(
    () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient }),
    [],
  )
  const positions = useMemo(treePositions, [])
  const ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!ref.current) return
    const dummy = new THREE.Object3D()
    positions.forEach((p, i) => {
      const s = 0.75 + hash01(p[0], p[1]) * 0.7
      dummy.position.set(p[0], terrainHeight(p[0], p[1]), p[1])
      dummy.scale.setScalar(s)
      dummy.rotation.y = hash01(p[1], p[0]) * Math.PI * 2
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [positions])

  return (
    <instancedMesh ref={ref} args={[geometry, material, positions.length]} castShadow />
  )
}
