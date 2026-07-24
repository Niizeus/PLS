import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WATERS } from './cityData'

/**
 * 💧 Les plans d'eau de Beauvais (dont le plan d'eau du Canada), depuis OpenStreetMap.
 *
 * Chaque plan d'eau est un contour rempli à plat (triangulé), posé juste au-dessus
 * du sol, en bleu. Tout est fusionné en une seule géométrie.
 */

const WATER_Y = 0.02 // juste au-dessus du sol (sous les routes)
const WATER_COLOR = '#3f79a8'

function buildWaterGeometry(): THREE.BufferGeometry | null {
  const geometries: THREE.BufferGeometry[] = []
  for (const w of WATERS) {
    if (w.pts.length < 3) continue
    const shape = new THREE.Shape()
    shape.moveTo(w.pts[0][0], -w.pts[0][1])
    for (let i = 1; i < w.pts.length; i++) shape.lineTo(w.pts[i][0], -w.pts[i][1])
    shape.closePath()

    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2) // à plat au sol
    geo.translate(0, WATER_Y, 0)
    geometries.push(geo)
  }
  if (geometries.length === 0) return null
  const merged = mergeGeometries(geometries, false)
  geometries.forEach((g) => g.dispose())
  return merged
}

export default function Water() {
  const geometry = useMemo(buildWaterGeometry, [])
  if (!geometry) return null

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshBasicMaterial color={WATER_COLOR} side={THREE.DoubleSide} />
    </mesh>
  )
}
