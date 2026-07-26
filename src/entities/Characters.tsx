import ItemPickups from './items/ItemPickups'
import Player from './player/Player'
import Scooter from './vehicles/Scooter'
import Car from './vehicles/Car'

/**
 * LES PERSONNAGES & VÉHICULES : le joueur (Chibrux), le scooter, et plus tard les PNJ.
 *
 * 👉 Domaine "Entités" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un personnage/véhicule, tu l'ajoutes ICI —
 * pas besoin de toucher GameCanvas.
 * Comme ça, celui qui bosse sur les persos et celui qui bosse sur le monde
 * n'éditent jamais le même fichier → pas de conflit Git.
 */
export default function Characters() {
  return (
    <>
      <Player />
      <Scooter />
      <Car />
      <ItemPickups />
    </>
  )
}
