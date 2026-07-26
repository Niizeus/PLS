import Ground from './Ground'
import GreenAreas from './beauvais/GreenAreas'
import Water from './beauvais/Water'
import Roads from './beauvais/Roads'
import Beauvais from './beauvais/Beauvais'
import Trees from './beauvais/Trees'
import Lamps from './beauvais/Lamps'

/**
 * LE MONDE : tout le décor et la map de Beauvais.
 *
 * 👉 Domaine "Monde & rendu" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un élément au monde, tu l'ajoutes ICI — pas besoin de toucher GameCanvas.
 *
 * 🧱 BASE VOLONTAIREMENT SIMPLE. Le monde est PLAT (altitude 0 partout) et la
 * ville est faite de blocs d'une seule couleur, sans texture. La géométrie de la
 * ville (rues, places, emprises des bâtiments) reste la VRAIE donnée
 * OpenStreetMap : c'est le décor qui est minimal, pas la carte.
 *
 * Deux règles à ne pas casser en ajoutant du décor :
 *  1. tout se pose sur `terrainHeight()` (cityData.ts) — pas de hauteur en dur ;
 *  2. ce qui BLOQUE le joueur doit être VISIBLE (sinon : murs invisibles).
 *
 * Ordre = superposition au sol : sol → verdure → eau → routes, puis les volumes
 * (bâtiments) et enfin le mobilier (arbres, lampadaires).
 */
export default function World() {
  return (
    <>
      <Ground />
      <GreenAreas />
      <Water />
      <Roads />
      <Beauvais />
      <Trees />
      <Lamps />
    </>
  )
}
