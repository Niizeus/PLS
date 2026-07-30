import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useCarStore } from './carStore'

/**
 * 💡 PHARES DE LA VOITURE (touche L).
 *
 * ## Deux choses différentes, souvent confondues
 *
 * 1. **Les optiques** : les blocs lumineux qu'on voit sur la carrosserie. Ce
 *    sont de simples disques en `MeshBasicMaterial` — un matériau non éclairé,
 *    donc lumineux par nature, sans coûter le moindre calcul de lumière.
 * 2. **Les faisceaux** : deux `SpotLight` qui éclairent vraiment la route.
 *
 * ## Le coût, et comment on le tient
 *
 * Une `SpotLight` qui projette des ombres est l'une des choses les plus chères
 * d'une scène three.js : elle impose un rendu supplémentaire de la scène par
 * lumière et par image. Ici elles sont donc en **`castShadow={false}`** — on
 * éclaire, on ne projette pas. Et surtout : quand les phares sont éteints, les
 * lumières ne sont pas seulement invisibles, elles sont **démontées**. Une
 * lumière éteinte mais présente compte quand même dans les uniformes de chaque
 * matériau et force three.js à recompiler les shaders.
 *
 * ⚠️ Ne remplace pas ce démontage par `intensity={0}` ou `visible={false}` : ça
 * ramènerait le coût permanent qu'on cherche justement à éviter.
 */

/** Position des optiques dans le repère de la caisse (m). */
const LAMP_OFFSET_X = 0.68
const LAMP_OFFSET_Y = 0.72
const LAMP_OFFSET_Z = 2.15
/** Distance devant la voiture où pointe le faisceau. */
const BEAM_TARGET_Z = 26
const BEAM_TARGET_Y = -1.6

export default function CarHeadlights() {
  const headlightsOn = useCarStore((state) => state.headlightsOn)

  const lensGeometry = useMemo(() => new THREE.CircleGeometry(0.15, 16), [])
  const lensMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#fff4d0',
        toneMapped: false,
      }),
    [],
  )
  const lensOffMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#5b5f6b' }), [])

  useEffect(() => {
    return () => {
      lensGeometry.dispose()
      lensMaterial.dispose()
      lensOffMaterial.dispose()
    }
  }, [lensGeometry, lensMaterial, lensOffMaterial])

  return (
    <>
      <mesh
        geometry={lensGeometry}
        material={headlightsOn ? lensMaterial : lensOffMaterial}
        position={[-LAMP_OFFSET_X, LAMP_OFFSET_Y, LAMP_OFFSET_Z]}
      />
      <mesh
        geometry={lensGeometry}
        material={headlightsOn ? lensMaterial : lensOffMaterial}
        position={[LAMP_OFFSET_X, LAMP_OFFSET_Y, LAMP_OFFSET_Z]}
      />
      {headlightsOn && (
        <>
          <Beam side={-1} />
          <Beam side={1} />
        </>
      )}
    </>
  )
}

/** Un faisceau. La cible est un objet enfant : elle suit donc la voiture. */
function Beam({ side }: { side: -1 | 1 }) {
  const light = useRef<THREE.SpotLight>(null)
  const target = useRef<THREE.Object3D>(null)

  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current
  }, [])

  return (
    <>
      <spotLight
        ref={light}
        position={[side * LAMP_OFFSET_X, LAMP_OFFSET_Y, LAMP_OFFSET_Z]}
        color="#fff1c9"
        // ⚙️ Intensité en candelas (three ≥ r155). Avec `decay` 1,4 et 48 m de
        // portée, ~200 cd donnent une flaque de lumière lisible à 10-20 m.
        // C'est LE réglage à toucher si les phares te paraissent trop faibles
        // ou trop cramés — pas la portée.
        intensity={200}
        distance={48}
        angle={0.52}
        penumbra={0.55}
        decay={1.4}
        castShadow={false}
      />
      <object3D ref={target} position={[side * LAMP_OFFSET_X * 2.2, BEAM_TARGET_Y, BEAM_TARGET_Z]} />
    </>
  )
}
