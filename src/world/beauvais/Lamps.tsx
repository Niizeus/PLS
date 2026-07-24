import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { LAMPS, terrainHeight } from './cityData'

/**
 * 💡 Lampadaires (OSM `highway=street_lamp`), en INSTANCES (un seul draw call).
 * Un mât + une tête lumineuse. Simple mais ça pose bien l'ambiance des rues.
 */

const HEIGHT = 4 // hauteur du mât

/** Géométrie d'un lampadaire (mât + tête), colorée par sommet. */
function lampGeometry(): THREE.BufferGeometry {
  const pole = new THREE.CylinderGeometry(0.07, 0.09, HEIGHT, 6)
  pole.translate(0, HEIGHT / 2, 0)
  paint(pole, new THREE.Color('#3a3d42'))

  const head = new THREE.BoxGeometry(0.5, 0.18, 0.28)
  head.translate(0, HEIGHT, 0)
  paint(head, new THREE.Color('#ffe08a')) // tête "allumée" (jaune clair)

  return mergeGeometries([pole, head], false)
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

export default function Lamps() {
  const geometry = useMemo(lampGeometry, [])
  const material = useMemo(
    () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient }),
    [],
  )
  const ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!ref.current) return
    const dummy = new THREE.Object3D()
    LAMPS.forEach((p, i) => {
      dummy.position.set(p[0], terrainHeight(p[0], p[1]), p[1])
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])

  return <instancedMesh ref={ref} args={[geometry, material, LAMPS.length]} castShadow />
}
