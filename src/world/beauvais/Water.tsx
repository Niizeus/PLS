import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WATERS, WATER_INFO } from './cityData'

/**
 * 💧 Les plans d'eau de Beauvais (dont le plan d'eau du Canada), depuis OpenStreetMap.
 *
 * Chaque plan d'eau est un contour rempli à plat (triangulé), posé à la hauteur de
 * SURFACE calculée dans cityData (`WATER_INFO`) : pour les grands lacs le bassin a
 * été CREUSÉ dans le relief, et la surface se pose un peu sous la berge → l'eau a
 * l'air d'un vrai plan d'eau, pas d'un patch bleu sur le sol. Tout est fusionné.
 */

const WATER_COLOR = '#3f79a8'

function buildWaterGeometry(): THREE.BufferGeometry | null {
  const geometries: THREE.BufferGeometry[] = []
  for (let i = 0; i < WATERS.length; i++) {
    const w = WATERS[i]
    if (w.pts.length < 3) continue
    const shape = new THREE.Shape()
    shape.moveTo(w.pts[0][0], -w.pts[0][1])
    for (let k = 1; k < w.pts.length; k++) shape.lineTo(w.pts[k][0], -w.pts[k][1])
    shape.closePath()

    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2) // à plat
    geo.translate(0, WATER_INFO[i]?.surfaceY ?? 0, 0) // hauteur de surface du plan d'eau
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
