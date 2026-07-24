import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { LAMPS, terrainHeight } from './cityData'

/**
 * 💡 Lampadaires (OSM `highway=street_lamp`), en INSTANCES (un seul draw call).
 *
 * Modèle soigné : socle + mât + bras qui déborde sur la rue + tête lumineuse
 * (couleur chaude vive). Chaque lampadaire est tourné aléatoirement pour que les
 * bras ne pointent pas tous dans le même sens.
 */

const H = 5.5 // hauteur du mât
const METAL = '#33363b'
const GLOW = '#ffdf87'

function hash01(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return s - Math.floor(s)
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

function lampGeometry(): THREE.BufferGeometry {
  const metal = new THREE.Color(METAL)
  const glow = new THREE.Color(GLOW)

  const base = new THREE.CylinderGeometry(0.2, 0.28, 0.5, 8)
  base.translate(0, 0.25, 0)
  paint(base, metal)

  const pole = new THREE.CylinderGeometry(0.08, 0.13, H, 8)
  pole.translate(0, H / 2, 0)
  paint(pole, metal)

  // Bras horizontal qui déborde sur la rue.
  const arm = new THREE.BoxGeometry(1.1, 0.1, 0.1)
  arm.translate(0.55, H, 0)
  paint(arm, metal)

  // Tête / lanterne (couleur chaude vive = "allumée").
  const head = new THREE.CylinderGeometry(0.14, 0.26, 0.4, 8)
  head.translate(1.05, H - 0.2, 0)
  paint(head, glow)

  return mergeGeometries([base, pole, arm, head], false)
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
      dummy.rotation.set(0, hash01(p[0], p[1]) * Math.PI * 2, 0)
      dummy.updateMatrix()
      ref.current!.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])

  return <instancedMesh ref={ref} args={[geometry, material, LAMPS.length]} castShadow />
}
