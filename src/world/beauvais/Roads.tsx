import { useMemo } from 'react'
import * as THREE from 'three'
import { toonGradient } from '../../shaders/toonGradient'
import { ROADS, terrainHeight } from './cityData'

/**
 * 🛣️  Les routes de Beauvais (depuis OpenStreetMap), en version soignée.
 *
 * Chaque route = un ruban continu (raccords propres aux angles). Pour que ce soit
 * "plus qu'un plan", on empile 3 couches qui suivent le relief :
 *   1. une BORDURE claire (trottoir) un peu plus large et plus basse,
 *   2. le BITUME foncé par-dessus,
 *   3. une LIGNE centrale claire sur les grandes voies.
 * On FILTRE aussi les tout petits chemins (piétons) qui encombraient pour rien.
 * Tout est fusionné → peu de draw calls.
 */

const MIN_WIDTH = 3 // en dessous (chemins/trottoirs OSM) → on n'affiche pas
const MAJOR_WIDTH = 6.5 // à partir de ça → ligne centrale

const ASPHALT = '#3f444b'
const KERB = '#b4b0a7' // trottoir / bordure
const LINE = '#eee7d4' // marquage au sol

// Les routes ÉPOUSENT le sol (offsets minimes) : avant, l'asphalte à +0.18 m
// passait au-dessus des pieds du perso (posés au sol) → il semblait « traverser »
// la route. On garde des offsets minuscules pour l'ordre des 3 couches, et on
// s'appuie sur `polygonOffset` (biais de profondeur) pour éviter le z-fighting
// avec le terrain sans avoir à surélever la géométrie.
const Y_KERB = 0.02
const Y_ASPHALT = 0.04
const Y_LINE = 0.06

/** Ajoute au tableau les triangles d'un ruban (miter + suivi du relief). */
function addRibbon(pts: number[][], half: number, yOff: number, out: number[]) {
  const n = pts.length
  if (n < 2) return
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < n; i++) {
    let d0x = 0, d0z = 0, d1x = 0, d1z = 0
    if (i > 0) {
      d0x = pts[i][0] - pts[i - 1][0]; d0z = pts[i][1] - pts[i - 1][1]
      const l = Math.hypot(d0x, d0z) || 1; d0x /= l; d0z /= l
    }
    if (i < n - 1) {
      d1x = pts[i + 1][0] - pts[i][0]; d1z = pts[i + 1][1] - pts[i][1]
      const l = Math.hypot(d1x, d1z) || 1; d1x /= l; d1z /= l
    }
    if (i === 0) { d0x = d1x; d0z = d1z }
    if (i === n - 1) { d1x = d0x; d1z = d0z }
    let mx = -d0z - d1z
    let mz = d0x + d1x
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml
    const cos = Math.max(0.35, mx * -d1z + mz * d1x)
    const off = half / cos
    left.push([pts[i][0] + mx * off, pts[i][1] + mz * off])
    right.push([pts[i][0] - mx * off, pts[i][1] - mz * off])
  }
  const push = (p: [number, number]) => out.push(p[0], terrainHeight(p[0], p[1]) + yOff, p[1])
  for (let i = 0; i < n - 1; i++) {
    push(left[i]); push(right[i]); push(right[i + 1])
    push(left[i]); push(right[i + 1]); push(left[i + 1])
  }
}

function geoFrom(out: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3))
  g.computeVertexNormals()
  return g
}

export default function Roads() {
  const { kerb, asphalt, lines } = useMemo(() => {
    const kerbA: number[] = []
    const asphaltA: number[] = []
    const linesA: number[] = []
    for (const r of ROADS) {
      if (r.w < MIN_WIDTH) continue // on saute les petits chemins piétons
      addRibbon(r.pts, r.w / 2 + 0.8, Y_KERB, kerbA) // bordure/trottoir (plus large)
      addRibbon(r.pts, r.w / 2, Y_ASPHALT, asphaltA) // bitume
      if (r.w >= MAJOR_WIDTH) addRibbon(r.pts, 0.16, Y_LINE, linesA) // ligne centrale
    }
    return { kerb: geoFrom(kerbA), asphalt: geoFrom(asphaltA), lines: geoFrom(linesA) }
  }, [])

  return (
    <>
      {/* polygonOffset (négatif = tiré vers la caméra) : chaque couche se dessine
          au-dessus du terrain puis les unes des autres (trottoir < bitume < ligne),
          même quasi coplanaires — plus de scintillement (z-fighting). */}
      <mesh geometry={kerb} receiveShadow>
        <meshToonMaterial
          color={KERB}
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh geometry={asphalt} receiveShadow>
        <meshToonMaterial
          color={ASPHALT}
          gradientMap={toonGradient}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh geometry={lines}>
        <meshBasicMaterial
          color={LINE}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>
    </>
  )
}
