import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { GREENS } from './cityData'

/**
 * 🌿 Les espaces verts (parcs, pelouses, bois) d'OpenStreetMap.
 *
 * Chaque zone est son contour réel, rempli à plat juste au-dessus du sol.
 * Deux teintes seulement : herbe pour les parcs, plus foncé pour les bois.
 * Tout est fusionné en une géométrie par teinte (2 draw calls).
 */

const GRASS = '#7ba055'
const WOOD = '#5d8544'
const Y_GRASS = 0.01 // au ras du sol, et SOUS les routes (qui sont à 0.03)

/** Remplit un contour [x, z] par une surface plate posée à Y_GRASS. */
function fill(pts: number[][]): THREE.BufferGeometry | null {
  if (pts.length < 3) return null
  // Une Shape vit dans le plan XY : on dessine en (x, -z) puis on couche la surface.
  const shape = new THREE.Shape()
  shape.moveTo(pts[0][0], -pts[0][1])
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1])
  shape.closePath()

  const geo = new THREE.ShapeGeometry(shape)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, Y_GRASS, 0)
  return geo
}

function buildGeometry(wooded: boolean): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []
  for (const green of GREENS) {
    if (Boolean(green.wood) !== wooded) continue
    const geo = fill(green.pts)
    if (geo) parts.push(geo)
  }
  if (parts.length === 0) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

function Patch({ wooded, color }: { wooded: boolean; color: string }) {
  const geometry = useMemo(() => buildGeometry(wooded), [wooded])
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} receiveShadow>
      {/* DoubleSide : le sens des triangles dépend du sens de tracé OSM. */}
      <meshToonMaterial color={color} gradientMap={toonGradient} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function GreenAreas() {
  return (
    <>
      <Patch wooded={false} color={GRASS} />
      <Patch wooded color={WOOD} />
    </>
  )
}
