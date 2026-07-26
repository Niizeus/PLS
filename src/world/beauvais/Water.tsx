import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WATERS } from './cityData'

/**
 * 💧 Les plans d'eau de Beauvais (dont le plan d'eau du Canada et le Thérain).
 *
 * Le monde étant plat, l'eau est simplement une surface bleue posée au ras du
 * sol : pas de bassin creusé, pas de reflet. On ne peut pas encore nager ni se
 * noyer — l'eau est purement visuelle pour l'instant.
 */

const WATER_COLOR = '#3f79a8'
const Y_WATER = 0.02 // entre l'herbe (0.01) et les routes (0.03)

function buildWaterGeometry(): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []
  for (const water of WATERS) {
    if (water.pts.length < 3) continue
    const shape = new THREE.Shape()
    shape.moveTo(water.pts[0][0], -water.pts[0][1])
    for (let i = 1; i < water.pts.length; i++) shape.lineTo(water.pts[i][0], -water.pts[i][1])
    shape.closePath()

    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, Y_WATER, 0)
    parts.push(geo)
  }
  if (parts.length === 0) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

export default function Water() {
  const geometry = useMemo(buildWaterGeometry, [])
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshBasicMaterial color={WATER_COLOR} side={THREE.DoubleSide} />
    </mesh>
  )
}
