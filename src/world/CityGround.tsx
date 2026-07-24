import { toonGradient } from '../shaders/toonGradient'
import { BOUNDS } from './beauvais/cityData'

/**
 * Sol qui couvre TOUTE la zone générée de Beauvais.
 *
 * On lit les limites réelles de la ville (cityData.BOUNDS) et on pose un grand
 * plan un peu plus large, centré sur la ville. Comme ça, quel que soit le
 * quartier généré, il y a toujours du sol dessous.
 */

const MARGIN = 60 // mètres de sol en plus tout autour de la ville

export default function CityGround() {
  const width = BOUNDS.maxX - BOUNDS.minX + MARGIN * 2
  const depth = BOUNDS.maxZ - BOUNDS.minZ + MARGIN * 2
  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2
  const cz = (BOUNDS.minZ + BOUNDS.maxZ) / 2

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      {/* Ton gris-vert neutre (bitume/herbe) ; les vraies routes viendront plus tard. */}
      <meshToonMaterial color="#8f9581" gradientMap={toonGradient} />
    </mesh>
  )
}
