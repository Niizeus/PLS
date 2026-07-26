import * as THREE from 'three'

/**
 * 🥞 L'ORDRE D'EMPILEMENT DES SURFACES PLATES DU SOL.
 *
 * Le sol de Beauvais est un mille-feuille : le terrain, puis l'herbe, les bois,
 * l'eau et les routes posés dessus. Toutes ces surfaces sont PLATES et quasiment
 * à la même hauteur → la carte de profondeur a du mal à dire laquelle est devant,
 * et elles se mettent à clignoter l'une sur l'autre quand la caméra bouge
 * (« z-fighting »). C'était très visible en scooter.
 *
 * ⚠️ Écarter les couches de quelques centimètres NE SUFFIT PAS. La profondeur
 * n'est pas calculée exactement : elle est interpolée sur chaque triangle, et
 * l'erreur grandit avec la taille des triangles et la distance. Monter les
 * couches davantage n'est pas une option non plus — à 10 cm, le perso a les
 * pieds enfoncés dans le bitume (on a déjà eu ce bug).
 *
 * La vraie solution est `polygonOffset` : il décale la profondeur d'un nombre de
 * CRANS de la carte de profondeur, appliqué APRÈS l'interpolation. Le résultat ne
 * dépend donc ni de la distance, ni de la taille des triangles. C'est la technique
 * standard pour poser des « décalques » sur un sol.
 *
 * 👉 Pour ajouter une couche : donne-lui sa place dans CE fichier, et rien
 * d'autre à faire ailleurs. Plus le cran est négatif, plus la couche est DEVANT.
 */

export interface GroundLayer {
  /** Hauteur au-dessus du terrain (m). Reste petite : elle sert de repère lisible. */
  y: number
  /** Crans de profondeur. Plus c'est négatif, plus la couche passe devant. */
  offset: number
}

/** Le terrain nu (`Ground.tsx`) est la base : y = 0, aucun décalage. */
export const GROUND_LAYERS = {
  grass: { y: 0.01, offset: -2 },
  /** Les bois sont souvent tracés DANS une pelouse → ils doivent passer devant. */
  wood: { y: 0.01, offset: -4 },
  water: { y: 0.02, offset: -6 },
  road: { y: 0.03, offset: -8 },
} as const satisfies Record<string, GroundLayer>

/**
 * Réglages à étaler sur le matériau d'une couche.
 *
 * À utiliser tel quel : `<meshToonMaterial {...layerDepthProps(GROUND_LAYERS.road)} />`
 */
export function layerDepthProps(layer: GroundLayer) {
  return {
    polygonOffset: true,
    // `factor` agit selon l'inclinaison à l'écran : c'est LUI qui compte quand on
    // regarde le sol de biais (le cas normal, caméra derrière le perso).
    polygonOffsetFactor: layer.offset,
    // `units` est un décalage fixe : il couvre le cas où on regarde le sol de face.
    polygonOffsetUnits: layer.offset,
  }
}

/**
 * Écart toléré (m) entre une surface de sol et le vrai relief.
 *
 * ⚠️ On découpe selon l'ERREUR, pas selon la taille des triangles. C'est ce qui
 * rend la chose abordable : une pelouse plate reste 2 triangles, seul un bois de
 * coteau est finement découpé. Découper « tous les 10 m » sans regarder le
 * terrain produisait 1,2 MILLION de triangles pour la seule verdure ; en visant
 * l'erreur, on tombe à quelques dizaines de milliers pour un résultat meilleur.
 */
const HEIGHT_TOLERANCE = 0.35
/** Inutile de descendre sous la moitié de la maille du relief (8 m) : pas d'info. */
const MIN_EDGE = 4
/**
 * Garde-fou : on ne découpe jamais un polygone au-delà de ce nombre de triangles.
 * Réglé à la mesure — à 4 000, cinq grands bois de coteau butaient sur le plafond
 * et gardaient 7,3 m d'écart avec le sol ; à 30 000 plus aucun ne plafonne et
 * l'écart maximal tombe à 0,6 m, pour seulement 13 % de triangles en plus.
 */
const MAX_TRIANGLES = 30000

/**
 * Couche une surface plate, la découpe assez finement, et **colle chacun de ses
 * sommets au relief**.
 *
 * C'est LA fonction qui fait qu'une pelouse ou un plan d'eau épouse le terrain
 * au lieu de le trancher. Elle prend une `ShapeGeometry` (à plat dans le plan XY)
 * et renvoie une géométrie posée sur le sol.
 *
 * `heightAt` est passé en paramètre plutôt qu'importé pour éviter une dépendance
 * circulaire avec `cityData.ts` — passe-lui toujours `terrainHeight`.
 */
export function conformToTerrain(
  geometry: THREE.BufferGeometry,
  layer: GroundLayer,
  heightAt: (x: number, z: number) => number,
): THREE.BufferGeometry {
  geometry.rotateX(-Math.PI / 2) // le plan XY se couche → coordonnées (x, 0, z)
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  if (flat !== geometry) geometry.dispose()

  const src = flat.attributes.position.array as ArrayLike<number>

  // File de triangles à traiter ; on redécoupe tant qu'une arête est trop longue.
  let queue: number[][] = []
  for (let i = 0; i < flat.attributes.position.count; i += 3) {
    queue.push([
      src[i * 3], src[i * 3 + 2],
      src[(i + 1) * 3], src[(i + 1) * 3 + 2],
      src[(i + 2) * 3], src[(i + 2) * 3 + 2],
    ])
  }
  flat.dispose()

  // Un triangle est-il assez proche du terrain ? On compare le plan du triangle
  // au vrai relief en 4 points (les 3 milieux d'arête + le centre) : c'est là que
  // l'écart est maximal si la surface « pontait » un creux ou une bosse.
  const followsTerrain = (t: number[]) => {
    const [ax, az, bx, bz, cx, cz] = t
    const ha = heightAt(ax, az)
    const hb = heightAt(bx, bz)
    const hc = heightAt(cx, cz)
    const checks: [number, number, number][] = [
      [(ax + bx) / 2, (az + bz) / 2, (ha + hb) / 2],
      [(bx + cx) / 2, (bz + cz) / 2, (hb + hc) / 2],
      [(cx + ax) / 2, (cz + az) / 2, (hc + ha) / 2],
      [(ax + bx + cx) / 3, (az + bz + cz) / 3, (ha + hb + hc) / 3],
    ]
    for (const [x, z, planeY] of checks) {
      if (Math.abs(heightAt(x, z) - planeY) > HEIGHT_TOLERANCE) return false
    }
    return true
  }

  const done: number[][] = []
  while (queue.length > 0 && done.length + queue.length < MAX_TRIANGLES) {
    const next: number[][] = []
    for (const t of queue) {
      const [ax, az, bx, bz, cx, cz] = t
      const ab = Math.hypot(bx - ax, bz - az)
      const bc = Math.hypot(cx - bx, cz - bz)
      const ca = Math.hypot(ax - cx, az - cz)
      const longest = Math.max(ab, bc, ca)
      // Assez fidèle, ou déjà plus fin que la donnée de relief → on s'arrête.
      if (longest <= MIN_EDGE || followsTerrain(t)) {
        done.push(t)
        continue
      }
      // On coupe la plus longue arête en deux : le triangle reste bien formé.
      if (longest === ab) {
        const mx = (ax + bx) / 2
        const mz = (az + bz) / 2
        next.push([ax, az, mx, mz, cx, cz], [mx, mz, bx, bz, cx, cz])
      } else if (longest === bc) {
        const mx = (bx + cx) / 2
        const mz = (bz + cz) / 2
        next.push([ax, az, bx, bz, mx, mz], [ax, az, mx, mz, cx, cz])
      } else {
        const mx = (cx + ax) / 2
        const mz = (cz + az) / 2
        next.push([ax, az, bx, bz, mx, mz], [mx, mz, bx, bz, cx, cz])
      }
    }
    queue = next
  }
  done.push(...queue) // ce qui reste si le garde-fou a coupé la découpe

  // Chaque sommet prend sa hauteur sur le terrain.
  const positions = new Float32Array(done.length * 9)
  for (let t = 0; t < done.length; t++) {
    const tri = done[t]
    for (let v = 0; v < 3; v++) {
      const x = tri[v * 2]
      const z = tri[v * 2 + 1]
      const k = (t * 3 + v) * 3
      positions[k] = x
      positions[k + 1] = heightAt(x, z) + layer.y
      positions[k + 2] = z
    }
  }

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  out.computeVertexNormals()
  return out
}
