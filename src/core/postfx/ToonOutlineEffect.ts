import * as THREE from 'three'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'

/**
 * ✒️ ToonOutlineEffect — le trait noir du cell-shading, sur TOUTE l'image.
 *
 * ## Pourquoi une passe d'image et pas un `<Outlines>` de plus
 *
 * Jusqu'ici, chaque objet qui voulait un contour embarquait un `<Outlines>` de
 * drei : une COPIE de sa géométrie, gonflée le long des normales et rendue à
 * l'envers (`BackSide`). Ça marche sur une canette, mais pas sur le décor :
 *
 *  - ça DOUBLE la géométrie — or les bâtiments sont des tuiles fusionnées et les
 *    arbres/lampes des `instancedMesh`, c'est-à-dire précisément les objets les
 *    plus lourds de la scène ;
 *  - ça se DÉCHIRE sur les angles vifs (une coque gonflée s'ouvre aux coins d'un
 *    cube, et un bâtiment n'est qu'une pile de cubes) ;
 *  - ça ne dessine que la SILHOUETTE : aucune ligne entre un mur et son toit ;
 *  - son épaisseur est en unités MONDE — à l'échelle 1:1 de Beauvais, le même
 *    réglage est invisible sur la cathédrale et énorme sur une canette.
 *
 * Ici on travaille sur l'image finie : on relit le tampon de PROFONDEUR et on
 * repeint en noir les pixels où il « casse ». Tout ce qui est à l'écran est
 * traité pareil, y compris ce qu'on ajoutera demain, et l'épaisseur est en
 * PIXELS — donc constante de la canette à la cathédrale.
 *
 * ## Comment on trouve un contour : la DÉRIVÉE SECONDE de la profondeur
 *
 * L'idée naïve serait de comparer la profondeur de deux pixels voisins et de
 * tracer un trait quand l'écart est grand. Mauvaise idée : une route vue de
 * biais s'éloigne beaucoup d'un pixel à l'autre alors qu'elle est parfaitement
 * plate — elle se remplirait de traits parasites.
 *
 * On compare donc le pixel courant à la MOYENNE de ses deux voisins opposés
 * (`|a + b - 2·centre|`). Sur n'importe quelle surface plane, même très inclinée,
 * le centre est pile au milieu de ses voisins : le résultat est zéro. Ça ne
 * réagit qu'à ce qui nous intéresse vraiment :
 *
 *  - une SILHOUETTE (le vide derrière un bâtiment) → écart énorme ;
 *  - une ARÊTE (un mur qui devient un toit) → la pente change d'un coup.
 *
 * Le seuil est RELATIF à la distance (`/ dist`) : sans ça, un immeuble à 200 m
 * déclencherait dix fois plus facilement que le même immeuble à 20 m.
 *
 * ## Ce que cette passe ne fait pas (encore)
 *
 * Elle ne voit que la géométrie, pas l'orientation des faces : sur une surface
 * COURBE et lisse (une carrosserie), il n'y a pas de cassure de profondeur, donc
 * pas de ligne intérieure. Le jour où on en voudra, il faudra ajouter un
 * `NormalPass` — mais il re-rend toute la scène une deuxième fois, et il peint
 * les objets transparents (particules, nuages) comme s'ils étaient opaques.
 * D'où le choix de s'en passer tant que le décor est le sujet.
 */

/** Réglages par défaut du trait. Modifie ici, c'est fait pour. */
export const TOON_OUTLINE = {
  /** Couleur de l'encre. Le même noir bleuté que les `<Outlines>` des objets. */
  color: '#17171d',
  /** Épaisseur du trait, en PIXELS écran. Au-delà de ~2.5 ça devient un feutre. */
  thickness: 1.6,
  /**
   * Sensibilité : cassure de profondeur (relative à la distance) à partir de
   * laquelle on trace. Plus BAS = plus de traits (et plus de bruit sur les
   * surfaces courbes). Plus HAUT = seules les grosses arêtes ressortent.
   */
  sensitivity: 0.012,
  /** Opacité du trait (1 = encre franche). */
  opacity: 0.95,
  /** Distance (m) à partir de laquelle le trait commence à s'effacer. */
  fadeStart: 160,
  /** Distance (m) où il a complètement disparu — au-delà, le brouillard prend le relais. */
  fadeEnd: 380,
} as const

const fragmentShader = /* glsl */ `
uniform vec3 uInk;
uniform float uThickness;
uniform float uSensitivity;
uniform float uOpacity;
uniform float uFadeStart;
uniform float uFadeEnd;

// Distance à la caméra, en mètres (getViewZ est négatif : il regarde vers -Z).
float sceneDistance(const in vec2 coord) {
  return -getViewZ(readDepth(coord));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float dist = -getViewZ(depth);

  vec2 offset = texelSize * uThickness;

  // Deux paires de voisins opposés : une horizontale, une verticale.
  float left  = sceneDistance(uv - vec2(offset.x, 0.0));
  float right = sceneDistance(uv + vec2(offset.x, 0.0));
  float down  = sceneDistance(uv - vec2(0.0, offset.y));
  float up    = sceneDistance(uv + vec2(0.0, offset.y));

  // « Le centre est-il au milieu de ses voisins ? » — nul sur toute surface plane.
  float break_ = abs(left + right - 2.0 * dist) + abs(up + down - 2.0 * dist);

  // Seuil relatif : un écart de 10 cm compte à 5 m, plus à 200 m.
  float edge = step(uSensitivity, break_ / max(dist, 1.0));

  // Au loin, on rend la main au brouillard plutôt que d'empiler du trait noir.
  edge *= 1.0 - smoothstep(uFadeStart, uFadeEnd, dist);

  outputColor = vec4(mix(inputColor.rgb, uInk, edge * uOpacity), inputColor.a);
}
`

export interface ToonOutlineOptions {
  color?: string
  thickness?: number
  sensitivity?: number
  opacity?: number
  fadeStart?: number
  fadeEnd?: number
}

export class ToonOutlineEffect extends Effect {
  constructor(options: ToonOutlineOptions = {}) {
    const o = { ...TOON_OUTLINE, ...options }
    super('ToonOutlineEffect', fragmentShader, {
      // Réclame le tampon de profondeur : c'est lui qui donne le `depth` de
      // `mainImage` et la fonction `readDepth`.
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        // `THREE.Color` convertit le code hexa sRGB vers l'espace linéaire du
        // rendu tout seul : l'encre sort donc du même noir que les `<Outlines>`.
        ['uInk', new THREE.Uniform(new THREE.Color(o.color))],
        ['uThickness', new THREE.Uniform(o.thickness)],
        ['uSensitivity', new THREE.Uniform(o.sensitivity)],
        ['uOpacity', new THREE.Uniform(o.opacity)],
        ['uFadeStart', new THREE.Uniform(o.fadeStart)],
        ['uFadeEnd', new THREE.Uniform(o.fadeEnd)],
      ]),
    })
  }

  /** Épaisseur du trait en pixels — réglable à chaud (console, panneau dev...). */
  set thickness(value: number) {
    this.uniforms.get('uThickness')!.value = value
  }

  /** Sensibilité de la détection d'arêtes. */
  set sensitivity(value: number) {
    this.uniforms.get('uSensitivity')!.value = value
  }

  /** Opacité de l'encre (0 = contours éteints, pratique pour comparer). */
  set opacity(value: number) {
    this.uniforms.get('uOpacity')!.value = value
  }
}
