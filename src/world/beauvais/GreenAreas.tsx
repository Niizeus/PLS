import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { GREENS, terrainHeight } from './cityData'
import { GROUND_LAYERS, conformToTerrain, layerDepthProps, type GroundLayer } from './groundLayers'

/**
 * 🌿 Les espaces verts (parcs, pelouses, bois) d'OpenStreetMap.
 *
 * Chaque zone est son contour réel, rempli à plat juste au-dessus du sol.
 * Deux teintes seulement : herbe pour les parcs, plus foncé pour les bois.
 * Tout est fusionné en une géométrie par teinte (2 draw calls).
 */

const GRASS = '#7ba055'
const WOOD = '#5d8544'

/** Remplit un contour [x, z] par une surface plate posée à la hauteur de la couche. */
function fill(pts: number[][], layer: GroundLayer): THREE.BufferGeometry | null {
  if (pts.length < 3) return null
  // Une Shape vit dans le plan XY : on dessine en (x, -z) puis on couche la surface.
  const shape = new THREE.Shape()
  shape.moveTo(pts[0][0], -pts[0][1])
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1])
  shape.closePath()

  // Découpée finement et collée au relief : une grande pelouse de coteau doit
  // suivre la pente, pas la trancher.
  return conformToTerrain(new THREE.ShapeGeometry(shape), layer, terrainHeight)
}

function buildGeometry(wooded: boolean, layer: GroundLayer): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []
  for (const green of GREENS) {
    if (Boolean(green.wood) !== wooded) continue
    const geo = fill(green.pts, layer)
    if (geo) parts.push(geo)
  }
  if (parts.length === 0) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

function Patch({
  wooded,
  color,
  layer,
}: {
  wooded: boolean
  color: string
  layer: GroundLayer
}) {
  const geometry = useMemo(() => buildGeometry(wooded, layer), [wooded, layer])
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} receiveShadow>
      {/* Face avant seulement (défaut) : `ShapeGeometry` sort déjà tous les
          triangles à l'endroit, quel que soit le sens de tracé OSM (vérifié sur
          les 841 zones). Avec DoubleSide, une surface vue de dos serait éclairée
          par en dessous, donc sombre — et clignoterait contre sa voisine. */}
      <meshToonMaterial color={color} gradientMap={toonGradient} {...layerDepthProps(layer)} />
    </mesh>
  )
}

/**
 * ⚠️ Herbe et bois sont à la MÊME hauteur : 26 bois d'OSM sont tracés à
 * l'intérieur d'une pelouse. C'est `groundLayers.ts` qui les départage.
 */
export default function GreenAreas() {
  return (
    <>
      <Patch wooded={false} color={GRASS} layer={GROUND_LAYERS.grass} />
      <Patch wooded color={WOOD} layer={GROUND_LAYERS.wood} />
    </>
  )
}
