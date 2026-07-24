import CityGround from './CityGround'
import GreenAreas from './beauvais/GreenAreas'
import Water from './beauvais/Water'
import Roads from './beauvais/Roads'
import Walls from './beauvais/Walls'
import Beauvais from './beauvais/Beauvais'
import Trees from './beauvais/Trees'
import Lamps from './beauvais/Lamps'

/**
 * LE MONDE : tout le décor et la map de Beauvais.
 *
 * 👉 Domaine "Monde & rendu" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un élément au monde, tu l'ajoutes ICI — pas besoin de toucher GameCanvas.
 *
 * Ordre = superposition au sol : sol → verdure → eau → routes, puis le relief
 * (murs, bâtiments) et enfin le mobilier (arbres, lampadaires).
 */
export default function World() {
  return (
    <>
      <CityGround />
      <GreenAreas />
      <Water />
      <Roads />
      <Walls />
      <Beauvais />
      <Trees />
      <Lamps />
    </>
  )
}
