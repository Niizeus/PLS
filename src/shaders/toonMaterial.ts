import * as THREE from 'three'
import { toonGradient } from './toonGradient'

/**
 * 🎨 toonMaterial.ts — remettre au style maison les matériaux des modèles importés.
 *
 * Les FBX du projet (Chibrux, les véhicules) sortent d'outils qui exportent en
 * `MeshPhongMaterial` : spéculaire, brillance, carte de normales de scan. Posés
 * tels quels au milieu d'une ville entièrement en aplats, ils jurent. Tout ce qui
 * entre dans le jeu repasse donc par ici : `MeshToonMaterial` + la gradient map
 * partagée, comme le décor.
 *
 * ⚠️ **LE PIÈGE DES TEXTURES MANQUANTES.** Nos FBX référencent leurs textures par
 * un chemin de la machine d'export (`.../skins_xxx.fbm/Color_xxx.png`), un dossier
 * qui n'a jamais été livré avec le fichier. Le chargeur crée quand même un objet
 * `Texture`… avec `image === null`. Et une texture sans image ne se contente pas
 * d'être ignorée : le shader échantillonne du **noir opaque**, donc le modèle
 * s'affiche entièrement NOIR. C'est vérifiable en deux lignes (rendu hors écran,
 * `readPixels`) : `{ color: 0xcccccc, map: textureVide }` → `rgb(0,0,0)`, le même
 * matériau sans `map` → `rgb(200,200,200)`.
 *
 * D'où la règle appliquée par `usableTexture` : **une texture ne sert que si elle
 * a réellement une image**. Le jour où les PNG sont déposés à côté du FBX, ils
 * sont pris en compte tout seuls, sans toucher au code.
 */

/** Relief conservé des cartes de normales de scan (0 = lissé, 1 = brut). */
export const IMPORTED_NORMAL_STRENGTH = 0.35

/**
 * La texture si elle est exploitable, `null` sinon. Voir l'avertissement du
 * fichier : une texture sans image peint le modèle en noir.
 */
export function usableTexture(texture: THREE.Texture | null | undefined): THREE.Texture | null {
  return texture && texture.image ? texture : null
}

const cache = new WeakMap<THREE.Material, THREE.MeshToonMaterial>()

/**
 * Convertit un matériau importé en matériau toon.
 *
 * On garde la texture de couleur quand elle existe (c'est elle, le personnage),
 * on jette la brillance (le toon n'a pas de spéculaire : sa lumière est un simple
 * escalier) et on calme le relief. `overrideColor` sert aux modèles qu'on repeint
 * aux couleurs du jeu — la voiture, par exemple.
 *
 * Le résultat est mis en cache : les FBX sont partagés par `useFBX`, il ne faut
 * pas empiler une conversion à chaque montage de composant.
 */
export function toonFromImported(source: THREE.Material, overrideColor?: string): THREE.Material {
  if (source instanceof THREE.MeshToonMaterial && !overrideColor) return source
  const cached = !overrideColor ? cache.get(source) : undefined
  if (cached) return cached

  const from = source as THREE.MeshPhongMaterial
  const map = usableTexture(from.map)
  const normalMap = usableTexture(from.normalMap)
  const toon = new THREE.MeshToonMaterial({
    color: overrideColor ?? from.color ?? new THREE.Color('#ffffff'),
    map,
    normalMap,
    gradientMap: toonGradient,
    // ⚠️ Les exports FBX cochent souvent `transparent` sans aucune raison : ça
    // sort le modèle du rendu opaque et fait clignoter le tri des faces. On ne le
    // garde que s'il est réellement utile.
    transparent: from.transparent && from.opacity < 1,
    opacity: from.opacity,
    alphaTest: from.alphaTest,
    side: from.side,
  })
  if (toon.map) toon.map.colorSpace = THREE.SRGBColorSpace
  if (toon.normalMap) toon.normalScale.set(IMPORTED_NORMAL_STRENGTH, IMPORTED_NORMAL_STRENGTH)

  if (!overrideColor) cache.set(source, toon)
  return toon
}
