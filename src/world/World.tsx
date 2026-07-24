import TestGround from './TestGround'
import Obstacles from './Obstacles'

/**
 * LE MONDE : tout le décor et la map de Beauvais.
 *
 * 👉 Domaine "Monde & rendu" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un élément au monde (sol, bâtiments, futur Beauvais...),
 * tu l'ajoutes ICI — pas besoin de toucher GameCanvas.
 * Comme ça, celui qui bosse sur le monde et celui qui bosse sur les persos
 * n'éditent jamais le même fichier → pas de conflit Git.
 */
export default function World() {
  return (
    <>
      <TestGround />
      <Obstacles />
    </>
  )
}
