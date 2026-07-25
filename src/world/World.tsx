import { useEffect, useState } from 'react'
import Terrain from './Terrain'
import TerrainLidar from './beauvais/TerrainLidar'
import GreenAreas from './beauvais/GreenAreas'
import Water from './beauvais/Water'
import Roads from './beauvais/Roads'
import Walls from './beauvais/Walls'
import Beauvais from './beauvais/Beauvais'
import Trees from './beauvais/Trees'
import Lamps from './beauvais/Lamps'
import { getGlobalMap, loadLidarTerrain } from './beauvais/lidarTerrain'

/**
 * LE MONDE : tout le décor et la map de Beauvais.
 *
 * 👉 Domaine "Monde & rendu" (voir docs/02-ARCHITECTURE.md).
 * Pour ajouter un élément au monde, tu l'ajoutes ICI — pas besoin de toucher GameCanvas.
 *
 * ⚠️ Le sol vient du LiDAR HD (chargement ASYNCHRONE, cf. docs/06). On attend qu'il
 * soit chargé AVANT d'afficher le décor : routes/bâtiments/verdure se posent sur
 * `terrainHeight`, qui doit déjà renvoyer le relief LiDAR — sinon ils seraient calés
 * sur l'ancienne grille et « flotteraient ». Si le LiDAR échoue, on retombe sur
 * l'ancien Terrain (jamais d'écran sans sol).
 *
 * Ordre = superposition au sol : sol → verdure → eau → routes, puis le relief
 * (murs, bâtiments) et enfin le mobilier (arbres, lampadaires).
 */
export default function World() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadLidarTerrain().then(() => setLoaded(true))
  }, [])

  if (!loaded) return null // court instant de chargement du relief global (un fichier ~4 Mo)

  const hasLidar = getGlobalMap() !== null

  return (
    <>
      {hasLidar ? <TerrainLidar /> : <Terrain />}
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
