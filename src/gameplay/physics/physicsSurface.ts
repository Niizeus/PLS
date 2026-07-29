import { groundHeight } from '../../world/beauvais/roadway'

/**
 * Surface solide lue par Rapier pour les appuis vehicule.
 *
 * Elle doit rester coherente avec la surface finale visible/praticable de Beauvais :
 * relief nu hors route, dessus de chaussee, bordures et accotements sur les routes.
 * Si on ne lit que le bitume central, le mesh physique cree des coutures invisibles
 * entre route et terrain, que les suspensions Rapier transforment en saccades.
 */
export function driveSurfaceHeightAt(x: number, z: number): number {
  return groundHeight(x, z)
}
