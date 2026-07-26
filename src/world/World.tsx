import { useEffect, useState } from 'react'
import Ground from './Ground'
import GreenAreas from './beauvais/GreenAreas'
import Water from './beauvais/Water'
import Roads from './beauvais/Roads'
import Beauvais from './beauvais/Beauvais'
import Trees from './beauvais/Trees'
import Lamps from './beauvais/Lamps'
import ScaleReferences from './beauvais/ScaleReferences'
import { loadTerrain } from './beauvais/terrain'

/**
 * LE MONDE : tout le décor et la map de Beauvais.
 *
 * 👉 Domaine "Monde & rendu" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un élément au monde, tu l'ajoutes ICI — pas besoin de toucher GameCanvas.
 *
 * 🧱 BASE VOLONTAIREMENT SIMPLE. La ville est faite de blocs d'une seule couleur,
 * sans texture. La géométrie (rues, places, emprises des bâtiments) est la VRAIE
 * donnée OpenStreetMap, et le relief le VRAI relief IGN : c'est le décor qui est
 * minimal, pas la carte.
 *
 * ⚠️ LE CHARGEMENT DU RELIEF EST BLOQUANT, ET C'EST VOLONTAIRE.
 * Tout le décor ci-dessous construit sa géométrie UNE FOIS, à son montage, en
 * lisant `terrainHeight()`. Si on l'affichait avant que le relief soit chargé,
 * il se calerait sur un monde plat et resterait planté là quand le relief
 * arriverait → routes et pelouses qui flottent ou s'enfoncent. C'est exactement
 * le bug qui avait cassé la version précédente. On attend donc.
 *
 * Trois règles à ne pas casser en ajoutant du décor :
 *  1. tout se pose sur `terrainHeight()` (cityData.ts) — pas de hauteur en dur ;
 *  2. ce qui BLOQUE le joueur doit être VISIBLE (sinon : murs invisibles) ;
 *  3. rien ne s'affiche avant que `loadTerrain()` soit terminé.
 *
 * Ordre = superposition au sol : sol → verdure → eau → routes, puis les volumes
 * (bâtiments) et enfin le mobilier (arbres, lampadaires).
 */
export default function World() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    loadTerrain().finally(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // Court instant de chargement de la carte de relief (un fichier de ~3,8 Mo).
  if (!ready) return null

  return (
    <>
      <Ground />
      <GreenAreas />
      <Water />
      <Roads />
      <Beauvais />
      <Trees />
      <Lamps />
      <ScaleReferences />
    </>
  )
}
