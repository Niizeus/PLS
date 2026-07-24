import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { GREENS, terrainHeight } from './cityData'

/**
 * 🌳 Espaces verts (parcs, pelouses, bois) depuis OpenStreetMap.
 *
 * Remplis à plat, en deux teintes : pelouse/parc (clair) et boisé (plus foncé).
 * C'est ce qui aide le plus à reconnaître la ville (le vert casse le gris et colle
 * à une vraie carte). Tout fusionné en 2 meshes (1 par teinte).
 */

const GREEN_Y = 0.012 // au-dessus du sol, sous les routes et l'eau
const GRASS = '#7ba05b'
const WOOD = '#5c8449'

function mergePolys(filter: (wood: number | undefined) => boolean): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = []
  for (const g of GREENS) {
    if (!filter(g.wood) || g.pts.length < 3) continue
    const shape = new THREE.Shape()
    shape.moveTo(g.pts[0][0], -g.pts[0][1])
    for (let i = 1; i < g.pts.length; i++) shape.lineTo(g.pts[i][0], -g.pts[i][1])
    shape.closePath()
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    // Drape la surface sur le relief (chaque sommet à l'altitude du terrain).
    const pos = geo.attributes.position
    for (let v = 0; v < pos.count; v++) {
      pos.setY(v, terrainHeight(pos.getX(v), pos.getZ(v)) + GREEN_Y)
    }
    geos.push(geo)
  }
  if (geos.length === 0) return null
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function GreenAreas() {
  const grass = useMemo(() => mergePolys((wood) => !wood), [])
  const wood = useMemo(() => mergePolys((w) => !!w), [])

  return (
    <>
      {grass && (
        <mesh geometry={grass} receiveShadow>
          <meshToonMaterial color={GRASS} gradientMap={toonGradient} />
        </mesh>
      )}
      {wood && (
        <mesh geometry={wood} receiveShadow>
          <meshToonMaterial color={WOOD} gradientMap={toonGradient} />
        </mesh>
      )}
    </>
  )
}
