import CityGround from './CityGround'
import Water from './beauvais/Water'
import Roads from './beauvais/Roads'
import Beauvais from './beauvais/Beauvais'

/**
 * LE MONDE : tout le décor et la map de Beauvais.
 *
 * 👉 Domaine "Monde & rendu" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un élément au monde (sol, bâtiments, futur Beauvais...),
 * tu l'ajoutes ICI — pas besoin de toucher GameCanvas.
 *
 * Note : le décor de test (TestGround, Obstacles) a été retiré au profit de la
 * vraie ville. Les fichiers existent encore si on veut les remettre.
 */
export default function World() {
  return (
    <>
      {/* Sol couvrant toute la zone générée. */}
      <CityGround />
      {/* Les plans d'eau (posés sur le sol). */}
      <Water />
      {/* Les routes (posées sur le sol, sous les bâtiments). */}
      <Roads />
      {/* La vraie ville de Beauvais générée depuis OpenStreetMap. */}
      <Beauvais />
    </>
  )
}
