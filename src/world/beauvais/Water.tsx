import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WATERS, terrainHeight } from './cityData'
import { GROUND_LAYERS, conformToTerrain, layerDepthProps } from './groundLayers'

/**
 * 💧 Les plans d'eau de Beauvais (dont le plan d'eau du Canada et le Thérain).
 *
 * Une surface bleue posée au ras du sol : pas de bassin creusé, pas de reflet.
 * On ne peut pas encore nager ni se noyer — l'eau est purement visuelle.
 *
 * ⚠️ Simplification assumée : l'eau SUIT le relief au lieu d'être horizontale.
 * Une vraie surface d'eau est plane, mais le Thérain descend la vallée et les
 * contours OSM couvrent en médiane 1 m de dénivelé (jusqu'à 8,6 m). Une surface
 * plane par plan d'eau flotterait donc au-dessus d'une berge et s'enfoncerait
 * sous l'autre. Tant qu'on ne creuse pas les berges, coller au sol est le moindre
 * mal : ça se lit comme « il y a de l'eau ici », sans artefact.
 */

const WATER_COLOR = '#3f79a8'

function buildWaterGeometry(): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []
  for (const water of WATERS) {
    if (water.pts.length < 3) continue
    const shape = new THREE.Shape()
    shape.moveTo(water.pts[0][0], -water.pts[0][1])
    for (let i = 1; i < water.pts.length; i++) shape.lineTo(water.pts[i][0], -water.pts[i][1])
    shape.closePath()

    parts.push(conformToTerrain(new THREE.ShapeGeometry(shape), GROUND_LAYERS.water, terrainHeight))
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
      {/* Face avant seulement : les 141 plans d'eau sortent déjà à l'endroit. */}
      <meshBasicMaterial color={WATER_COLOR} {...layerDepthProps(GROUND_LAYERS.water)} />
    </mesh>
  )
}
