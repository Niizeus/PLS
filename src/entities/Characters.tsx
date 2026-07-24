import Player from './player/Player'

/**
 * LES PERSONNAGES : le joueur (Chibrux) et, plus tard, les PNJ.
 *
 * 👉 Domaine "Entités" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un personnage (un PNJ, un ennemi...), tu l'ajoutes ICI —
 * pas besoin de toucher GameCanvas.
 * Comme ça, celui qui bosse sur les persos et celui qui bosse sur le monde
 * n'éditent jamais le même fichier → pas de conflit Git.
 */
export default function Characters() {
  return (
    <>
      <Player />
    </>
  )
}
