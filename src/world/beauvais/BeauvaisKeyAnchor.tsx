import { Text } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonGradient } from '../../shaders/toonGradient'
import { ORIGIN, terrainHeight } from './cityData'

const EARTH_RADIUS = 6378137
const deg2rad = (d: number) => (d * Math.PI) / 180

type AnchorId = 'jeu-paume' | 'felix-faure' | 'jeanne-hachette-lycee' | 'truffaut'
type AnchorTone = 'mall' | 'heritage-school' | 'school' | 'cinema-school'

interface Anchor {
  id: AnchorId
  title: string
  subtitle: string
  lat: number
  lon: number
  rot: number
  tone: AnchorTone
}

const ANCHORS: Record<AnchorId, Anchor> = {
  'jeu-paume': {
    id: 'jeu-paume',
    title: 'JEU DE PAUME',
    subtitle: 'Centre commercial',
    lat: 49.43295,
    lon: 2.08911,
    rot: -0.1,
    tone: 'mall',
  },
  'felix-faure': {
    id: 'felix-faure',
    title: 'FELIX FAURE',
    subtitle: 'Lycee',
    lat: 49.43541,
    lon: 2.08994,
    rot: 0.22,
    tone: 'heritage-school',
  },
  'jeanne-hachette-lycee': {
    id: 'jeanne-hachette-lycee',
    title: 'JEANNE HACHETTE',
    subtitle: 'Lycee',
    lat: 49.435928704095936,
    lon: 2.0819803168938127,
    rot: -0.08,
    tone: 'school',
  },
  truffaut: {
    id: 'truffaut',
    title: 'TRUFFAUT',
    subtitle: 'Arts cinema',
    lat: 49.4233836161901,
    lon: 2.0837003907692133,
    rot: 0.18,
    tone: 'cinema-school',
  },
}

const COLORS = {
  stone: '#c7b89d',
  darkStone: '#8d806d',
  glass: '#314d5a',
  steel: '#293136',
  cream: '#f0e7d4',
  blue: '#2f7184',
  red: '#b84a42',
  gold: '#d0a63e',
  purple: '#7a5287',
  slate: '#3d4951',
  brick: '#a85a4d',
  green: '#4d7048',
}

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

function addCylinder(
  geos: THREE.BufferGeometry[],
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  rt: number,
  rb: number,
  h: number,
  segments = 10,
) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, segments)
  tintGeometry(geo, color)
  geo.translate(x, y, z)
  geos.push(geo)
}

function local(cx: number, cz: number, rot: number, ox: number, oz: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return { x: cx + ox * c - oz * s, z: cz + ox * s + oz * c }
}

function addFlag(geos: THREE.BufferGeometry[], cx: number, cz: number, rot: number, ox: number, color: string) {
  const p = local(cx, cz, rot, ox, 8.8)
  const y = terrainHeight(p.x, p.z)
  addBox(geos, new THREE.Color(COLORS.steel), p.x, y + 1.25, p.z, 0.08, 2.5, 0.08, rot)
  addBox(geos, new THREE.Color(color), p.x + Math.cos(rot) * 0.36, y + 2.05, p.z + Math.sin(rot) * 0.36, 0.66, 0.34, 0.05, rot)
}

function addMall(geos: THREE.BufferGeometry[], cx: number, cz: number, rot: number) {
  const y = terrainHeight(cx, cz)
  addBox(geos, new THREE.Color(COLORS.steel), cx, y + 1.85, cz, 34, 3.7, 14, rot)
  addBox(geos, new THREE.Color(COLORS.glass), cx, y + 1.75, cz - 7.25, 30, 2.6, 0.24, rot)
  addBox(geos, new THREE.Color(COLORS.blue), cx, y + 3.85, cz - 7.35, 16, 0.7, 0.18, rot)
  addBox(geos, new THREE.Color(COLORS.gold), cx - 13, y + 0.82, cz - 7.55, 4.2, 1.2, 0.12, rot)
  addBox(geos, new THREE.Color(COLORS.red), cx + 13, y + 0.82, cz - 7.55, 4.2, 1.2, 0.12, rot)
  addBox(geos, new THREE.Color('#4f5b62'), cx + 13, y + 4.25, cz + 7.4, 8.4, 0.45, 0.18, rot)
  addBox(geos, new THREE.Color(COLORS.cream), cx + 13, y + 4.3, cz + 7.6, 1.5, 0.26, 0.1, rot)
}

function addHeritageSchool(geos: THREE.BufferGeometry[], cx: number, cz: number, rot: number) {
  const y = terrainHeight(cx, cz)
  addBox(geos, new THREE.Color(COLORS.stone), cx, y + 1.7, cz, 30, 3.4, 8.5, rot)
  addBox(geos, new THREE.Color(COLORS.slate), cx, y + 3.62, cz, 31, 0.42, 9.2, rot)
  addBox(geos, new THREE.Color(COLORS.darkStone), cx, y + 0.28, cz - 4.45, 31, 0.32, 0.5, rot)
  for (let i = -5; i <= 5; i++) {
    const p = local(cx, cz, rot, i * 2.35, -4.65)
    addBox(geos, new THREE.Color(COLORS.glass), p.x, terrainHeight(p.x, p.z) + 1.72, p.z, 0.82, 1.0, 0.08, rot)
    addBox(geos, new THREE.Color(COLORS.darkStone), p.x, terrainHeight(p.x, p.z) + 2.32, p.z, 1.02, 0.12, 0.1, rot)
  }
  for (const ox of [-5.2, 5.2]) {
    const p = local(cx, cz, rot, ox, 8.6)
    addCylinder(geos, new THREE.Color(COLORS.stone), p.x, terrainHeight(p.x, p.z) + 1.05, p.z, 0.42, 0.5, 2.1, 10)
  }
}

function addSchool(geos: THREE.BufferGeometry[], cx: number, cz: number, rot: number) {
  const y = terrainHeight(cx, cz)
  addBox(geos, new THREE.Color('#d4c7b0'), cx, y + 1.4, cz, 28, 2.8, 9, rot)
  addBox(geos, new THREE.Color(COLORS.red), cx, y + 2.95, cz - 4.65, 15, 0.52, 0.12, rot)
  for (let i = -4; i <= 4; i++) {
    const p = local(cx, cz, rot, i * 2.7, -4.82)
    addBox(geos, new THREE.Color(COLORS.glass), p.x, terrainHeight(p.x, p.z) + 1.58, p.z, 0.94, 0.82, 0.08, rot)
  }
  addFlag(geos, cx, cz, rot, -2.0, '#2f5fba')
  addFlag(geos, cx, cz, rot, -1.15, '#ffffff')
  addFlag(geos, cx, cz, rot, -0.3, '#c9463d')
}

function addCinemaSchool(geos: THREE.BufferGeometry[], cx: number, cz: number, rot: number) {
  const y = terrainHeight(cx, cz)
  addBox(geos, new THREE.Color('#cbc0aa'), cx, y + 1.45, cz, 28, 2.9, 9.5, rot)
  addBox(geos, new THREE.Color(COLORS.purple), cx, y + 3.15, cz - 4.85, 13, 0.62, 0.14, rot)
  addBox(geos, new THREE.Color(COLORS.steel), cx - 10.5, y + 1.55, cz - 5.0, 5.2, 1.8, 0.12, rot)
  for (let i = 0; i < 5; i++) {
    addBox(geos, new THREE.Color(i % 2 === 0 ? COLORS.cream : COLORS.steel), cx - 12.4 + i * 0.95, y + 2.3, cz - 5.12, 0.48, 0.38, 0.08, rot)
  }
  addBox(geos, new THREE.Color(COLORS.glass), cx + 7.5, y + 1.55, cz - 5.0, 7.2, 1.55, 0.12, rot)
}

function addGround(geos: THREE.BufferGeometry[], cx: number, cz: number, rot: number, tone: AnchorTone) {
  const y = terrainHeight(cx, cz)
  addBox(geos, new THREE.Color(tone === 'mall' ? '#777d80' : '#b8ad99'), cx, y + 0.07, cz, 42, 0.12, 22, rot)
  for (const [ox, oz] of [
    [-18, 9],
    [18, 9],
    [-18, -9],
    [18, -9],
  ] as Array<[number, number]>) {
    const p = local(cx, cz, rot, ox, oz)
    addBox(geos, new THREE.Color(COLORS.green), p.x, terrainHeight(p.x, p.z) + 0.35, p.z, 2.4, 0.58, 1.1, rot)
  }
}

function buildAnchor(id: AnchorId) {
  const anchor = ANCHORS[id]
  const { x, z } = project(anchor.lat, anchor.lon)
  const geos: THREE.BufferGeometry[] = []

  addGround(geos, x, z, anchor.rot, anchor.tone)
  if (anchor.tone === 'mall') addMall(geos, x, z, anchor.rot)
  if (anchor.tone === 'heritage-school') addHeritageSchool(geos, x, z, anchor.rot)
  if (anchor.tone === 'school') addSchool(geos, x, z, anchor.rot)
  if (anchor.tone === 'cinema-school') addCinemaSchool(geos, x, z, anchor.rot)

  const geometry = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return { anchor, center: { x, z }, geometry }
}

export default function BeauvaisKeyAnchor({ id }: { id: AnchorId }) {
  const { anchor, center, geometry } = useMemo(() => buildAnchor(id), [id])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonGradient} />
      </mesh>
      <Text
        position={[center.x, terrainHeight(center.x, center.z) + 4.08, center.z - 7.75]}
        rotation={[0, anchor.rot, 0]}
        fontSize={0.6}
        color={COLORS.cream}
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.034}
        maxWidth={10}
      >
        {anchor.title}
      </Text>
      <Text
        position={[center.x, terrainHeight(center.x, center.z) + 3.5, center.z - 7.78]}
        rotation={[0, anchor.rot, 0]}
        fontSize={0.34}
        color={COLORS.cream}
        anchorX="center"
        anchorY="middle"
        outlineColor="#24201d"
        outlineWidth={0.024}
        maxWidth={8}
      >
        {anchor.subtitle}
      </Text>
    </>
  )
}
