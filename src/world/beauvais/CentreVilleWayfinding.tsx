import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

interface WaySign {
  label: string
  lat: number
  lon: number
  rot: number
  arrows: Array<{ text: string; y: number }>
}

const SIGNS: WaySign[] = [
  {
    label: 'cathedral-crossing',
    lat: 49.43212,
    lon: 2.08112,
    rot: -0.25,
    arrows: [
      { text: 'Cathedrale', y: 1.75 },
      { text: 'MUDO', y: 1.28 },
    ],
  },
  {
    label: 'place-jeanne',
    lat: 49.43047,
    lon: 2.08318,
    rot: 0.12,
    arrows: [
      { text: 'Mairie', y: 1.75 },
      { text: 'Halles', y: 1.28 },
    ],
  },
  {
    label: 'saint-etienne-way',
    lat: 49.42916,
    lon: 2.0809,
    rot: 0.35,
    arrows: [
      { text: 'Saint-Etienne', y: 1.75 },
      { text: 'Place', y: 1.28 },
    ],
  },
  {
    label: 'rue-carnot',
    lat: 49.43128,
    lon: 2.08378,
    rot: -0.62,
    arrows: [
      { text: 'Rue Carnot', y: 1.75 },
      { text: 'Commerces', y: 1.28 },
    ],
  },
]

function project(lat: number, lon: number) {
  const x = deg2rad(lon - ORIGIN.lon) * EARTH_RADIUS * Math.cos(deg2rad(ORIGIN.lat))
  const z = -deg2rad(lat - ORIGIN.lat) * EARTH_RADIUS
  return { x, z }
}

function tintGeometry(geo: THREE.BufferGeometry, color: THREE.Color) {
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

function addBox(
  geos: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotY = 0,
) {
  const geo = new THREE.BoxGeometry(sx, sy, sz)
  tintGeometry(geo, color)
  geo.rotateY(rotY)
  geo.translate(x, y, z)
  geos.push(geo)
}

function buildSigns() {
  const geos: THREE.BufferGeometry[] = []
  const post = new THREE.Color('#30383d')
  const board = new THREE.Color('#596773')
  const boardAlt = new THREE.Color('#6a5b4a')

  for (const sign of SIGNS) {
    const { x, z } = project(sign.lat, sign.lon)
    const y = terrainHeight(x, z)
    addBox(geos, post, x, y + 0.85, z, 0.12, 1.7, 0.12, sign.rot)
    addBox(geos, board, x, y + 1.75, z, 2.75, 0.34, 0.12, sign.rot)
    addBox(geos, boardAlt, x, y + 1.28, z, 2.4, 0.32, 0.12, sign.rot)
    addBox(geos, post, x, y + 0.12, z, 0.48, 0.16, 0.48, sign.rot)
  }

  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

export default function CentreVilleWayfinding() {
  const geometry = useMemo(buildSigns, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      {SIGNS.flatMap((sign) => {
        const { x, z } = project(sign.lat, sign.lon)
        const baseY = terrainHeight(x, z)
        return sign.arrows.map((arrow) => (
          <Text
            key={`${sign.label}-${arrow.text}`}
            position={[x, baseY + arrow.y, z + 0.07]}
            rotation={[0, sign.rot, 0]}
            fontSize={0.32}
            color="#f5ecd9"
            anchorX="center"
            anchorY="middle"
            outlineColor="#24201d"
            outlineWidth={0.022}
          >
            {arrow.text}
          </Text>
        ))
      })}
    </>
  )
}
