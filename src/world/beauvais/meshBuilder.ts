import * as THREE from 'three'
import { orientRing } from './footprintField'

/**
 * 🧰 meshBuilder.ts — une petite boîte à outils pour fabriquer un décor à la main.
 *
 * Le rendu du jeu est « cell-shading avec couleur par sommet » : un seul matériau,
 * un seul maillage, et la couleur voyage dans la géométrie. Ce fichier fournit les
 * briques de base pour empiler des triangles dans ce format sans se tromper de
 * sens (une face à l'envers = un trou dans le décor).
 *
 * ⚠️ CONVENTION DE SENS — c'est tout l'intérêt du fichier :
 *  - un contour est toujours passé en sens « aire positive » (voir `orientRing`) ;
 *  - `quad()` accepte une normale de RÉFÉRENCE : au lieu de deviner l'ordre des
 *    sommets, on dit « cette face doit regarder par là » et le sens est corrigé
 *    tout seul. C'est ce qui permet d'écrire des arcs-boutants sans y passer
 *    l'après-midi.
 *
 * Le maillage produit n'est pas indexé : chaque triangle a ses propres sommets,
 * donc `computeVertexNormals()` donne des facettes bien nettes — exactement le
 * look voulu.
 */

/** Un point au sol : [x, z] en mètres monde. */
export type P2 = number[]
/** Un point dans l'espace : [x, y, z] en mètres monde. */
export type P3 = [number, number, number]

const EPS = 1e-9

export class MeshBuilder {
  private pos: number[] = []
  private col: number[] = []

  /** Nombre de triangles empilés (pratique pour un log de debug). */
  get triangleCount(): number {
    return this.pos.length / 9
  }

  tri(a: P3, b: P3, c: P3, color: THREE.Color): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b)
  }

  /**
   * Un quadrilatère a → b → c → d. Si `ref` est fourni, l'ordre est inversé au
   * besoin pour que la face regarde dans cette direction.
   */
  quad(a: P3, b: P3, c: P3, d: P3, color: THREE.Color, ref?: P3): void {
    if (ref) {
      const ux = b[0] - a[0]
      const uy = b[1] - a[1]
      const uz = b[2] - a[2]
      const vx = c[0] - a[0]
      const vy = c[1] - a[1]
      const vz = c[2] - a[2]
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      if (nx * ref[0] + ny * ref[1] + nz * ref[2] < 0) {
        this.tri(a, c, b, color)
        this.tri(a, d, c, color)
        return
      }
    }
    this.tri(a, b, c, color)
    this.tri(a, c, d, color)
  }

  /**
   * Les MURS d'un volume : le contour `ring` monté de `yBottom` jusqu'à `yTop`
   * (une hauteur fixe, ou une fonction du point — c'est comme ça que naissent les
   * pignons : le haut du mur suit la pente du toit).
   *
   * ⚠️ Quand `yTop` est une fonction, les longs segments sont REDÉCOUPÉS tous les
   * `maxStep` mètres. Sans ça, le haut du mur relierait les deux bouts du segment
   * en ligne droite : sur une façade de 60 m qui doit se terminer en pointe au
   * milieu, la pointe est purement et simplement rabotée — et il reste un trou
   * triangulaire entre le mur et le toit.
   */
  walls(
    ring: P2[],
    yBottom: number,
    yTop: number | ((p: P2) => number),
    color: THREE.Color,
    maxStep = 2,
  ): void {
    const fixed = typeof yTop !== 'function'
    const top = fixed ? () => yTop as number : (yTop as (p: P2) => number)
    const pts = orientRing(ring)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const steps = fixed ? 1 : Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxStep))
      for (let s = 0; s < steps; s++) {
        const p0 = [a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps]
        const p1 = [a[0] + ((b[0] - a[0]) * (s + 1)) / steps, a[1] + ((b[1] - a[1]) * (s + 1)) / steps]
        this.quad(
          [p0[0], yBottom, p0[1]],
          [p0[0], top(p0), p0[1]],
          [p1[0], top(p1), p1[1]],
          [p1[0], yBottom, p1[1]],
          color,
        )
      }
    }
  }

  /**
   * Une SURFACE horizontale (dalle, toit) posée sur le contour `ring`, dont la
   * hauteur est donnée par `yAt`.
   *
   * Les triangles sont redécoupés jusqu'à ce que leur plus grand côté passe sous
   * `maxEdge` : c'est ce qui permet à `yAt` d'avoir des arêtes (faîtages, croupes,
   * noues) sans qu'on ait à les calculer — la subdivision les approche d'assez
   * près pour que l'œil n'y voie que du feu.
   */
  surface(
    ring: P2[],
    yAt: (p: P2) => number,
    color: THREE.Color,
    maxEdge = 2.5,
    up = true,
  ): void {
    const contour = ring.map(([x, z]) => new THREE.Vector2(x, z))
    let faces: number[][]
    try {
      faces = THREE.ShapeUtils.triangulateShape(contour, [])
    } catch {
      return // contour dégénéré : on laisse tomber cette surface
    }

    for (const [i0, i1, i2] of faces) {
      const stack: P2[][] = [[ring[i0], ring[i1], ring[i2]]]
      while (stack.length) {
        const t = stack.pop()!
        // Côté le plus long ; on coupe en deux par son milieu.
        let worst = 0
        let len = 0
        for (let k = 0; k < 3; k++) {
          const a = t[k]
          const b = t[(k + 1) % 3]
          const l = Math.hypot(b[0] - a[0], b[1] - a[1])
          if (l > len) {
            len = l
            worst = k
          }
        }
        const area = Math.abs(
          (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0]),
        )
        // Une écharde (grande longueur mais aire ridicule) ne sert à rien à
        // subdiviser : elle ne porte aucune forme, et ça partirait en boucle.
        if (len > maxEdge && area > 0.6) {
          const a = t[worst]
          const b = t[(worst + 1) % 3]
          const c = t[(worst + 2) % 3]
          const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
          stack.push([a, m, c], [m, b, c])
          continue
        }
        // ⚠️ Triangle presque PLAT vu du dessus (trois points quasi alignés) : la
        // triangulation en sème le long des murs droits. Il ne couvre rien au sol,
        // mais comme ses sommets sont à des hauteurs différentes il devient une
        // lame VERTICALE plantée dans le toit, orientée au hasard. Un toit ne
        // pouvant pas être vertical, on le jette : c'est sans perte.
        const y = t.map((p) => yAt(p))
        const hMax = Math.max(...y) - Math.min(...y)
        if (area < 0.08 * hMax * len) continue

        // La face doit regarder le CIEL (ou le sol si `up` est faux, pour fermer
        // le dessous d'un débord) : on inverse si la normale part du mauvais côté.
        const ax = t[1][0] - t[0][0]
        const az = t[1][1] - t[0][1]
        const bx = t[2][0] - t[0][0]
        const bz = t[2][1] - t[0][1]
        const order = ax * bz - az * bx > 0 === up ? [0, 2, 1] : [0, 1, 2]
        const p = order.map((k) => [t[k][0], y[k], t[k][1]] as P3)
        this.tri(p[0], p[1], p[2], color)
      }
    }
  }

  /**
   * Un volume droit : le contour `base` extrudé de `y0` à `y1`, fermé en haut ET
   * en bas. `top` permet de donner un contour différent en haut (un pilier qui
   * s'affine, par exemple) — il doit avoir le même nombre de points.
   *
   * Le fond est fermé lui aussi : dès qu'un volume DÉBORDE de ce qu'il y a en
   * dessous (le larmier d'un contrefort, par exemple), on voit son dessous — et
   * s'il est ouvert, on voit à travers.
   */
  prism(base: P2[], y0: number, y1: number, color: THREE.Color, top = base): void {
    const b = orientRing(base)
    const t = base === top ? b : orientRing(top)
    for (let i = 0; i < b.length; i++) {
      const a0 = b[i]
      const b0 = b[(i + 1) % b.length]
      const a1 = t[i]
      const b1 = t[(i + 1) % t.length]
      this.quad(
        [a0[0], y0, a0[1]],
        [a1[0], y1, a1[1]],
        [b1[0], y1, b1[1]],
        [b0[0], y0, b0[1]],
        color,
      )
    }
    this.surface(t, () => y1, color, 1e9)
    this.surface(b, () => y0, color, 1e9, false)
  }

  /** Une pointe : le contour `base` qui se referme sur un sommet unique. */
  pyramid(base: P2[], y0: number, apexY: number, color: THREE.Color): void {
    const b = orientRing(base)
    let cx = 0
    let cz = 0
    for (const [x, z] of b) {
      cx += x
      cz += z
    }
    const apex: P3 = [cx / b.length, apexY, cz / b.length]
    for (let i = 0; i < b.length; i++) {
      const a = b[i]
      const c = b[(i + 1) % b.length]
      this.tri([a[0], y0, a[1]], apex, [c[0], y0, c[1]], color)
    }
  }

  /**
   * Une PLAQUE plaquée sur un mur : vitrail, portail, rosace, remplage…
   *
   * Le polygone est décrit en 2D dans le plan du mur : `du` = décalage horizontal
   * le long du mur, `y` = altitude absolue. Il est ensuite posé à `offset` mètres
   * DEVANT le mur (sinon les deux surfaces se disputent le même pixel et ça
   * clignote).
   *
   * `tangent` est la direction du mur ; la face regarde du côté (tz, −tx), qui est
   * l'extérieur pour un contour en sens direct.
   */
  wallPanel(
    origin: P2,
    tangent: P2,
    poly: number[][],
    offset: number,
    color: THREE.Color,
  ): void {
    const tl = Math.hypot(tangent[0], tangent[1])
    if (tl < EPS) return
    const tx = tangent[0] / tl
    const tz = tangent[1] / tl
    const nx = tz // normale sortante
    const nz = -tx
    const ox = origin[0] + nx * offset
    const oz = origin[1] + nz * offset
    const to = (p: number[]): P3 => [ox + tx * p[0], p[1], oz + tz * p[0]]

    // Aire signée dans le repère (du, y). La normale de ce repère est l'opposé de
    // la normale sortante, donc un polygone en sens direct doit être RETOURNÉ.
    let area = 0
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      area += a[0] * b[1] - b[0] * a[1]
    }
    const pts = area > 0 ? poly.slice().reverse() : poly
    const a0 = to(pts[0])
    for (let i = 1; i < pts.length - 1; i++) this.tri(a0, to(pts[i]), to(pts[i + 1]), color)
  }

  /**
   * Une POUTRE courbe suivant un chemin : arc-boutant, arceau, garde-corps…
   *
   * Chaque étape du chemin donne un point au sol, le dessous et le dessus de la
   * poutre à cet endroit. La section est un rectangle de largeur 2 × `halfWidth`,
   * toujours à plat, perpendiculaire au chemin.
   */
  beam(
    path: { c: P2; yBottom: number; yTop: number }[],
    halfWidth: number,
    color: THREE.Color,
  ): void {
    if (path.length < 2) return
    // Section (4 coins) à chaque étape : gauche-bas, droite-bas, droite-haut, gauche-haut.
    const rings: P3[][] = path.map((s, i) => {
      const prev = path[Math.max(0, i - 1)].c
      const next = path[Math.min(path.length - 1, i + 1)].c
      let dx = next[0] - prev[0]
      let dz = next[1] - prev[1]
      const l = Math.hypot(dx, dz) || 1
      dx /= l
      dz /= l
      const px = dz * halfWidth // perpendiculaire horizontale
      const pz = -dx * halfWidth
      return [
        [s.c[0] - px, s.yBottom, s.c[1] - pz],
        [s.c[0] + px, s.yBottom, s.c[1] + pz],
        [s.c[0] + px, s.yTop, s.c[1] + pz],
        [s.c[0] - px, s.yTop, s.c[1] - pz],
      ]
    })

    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i]
      const b = rings[i + 1]
      const mid: P3 = [
        (a[0][0] + a[1][0]) / 2,
        (a[0][1] + a[3][1]) / 2,
        (a[0][2] + a[1][2]) / 2,
      ]
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4
        // Normale de référence : « en s'éloignant de l'axe de la poutre ».
        const fx = (a[k][0] + a[k2][0]) / 2 - mid[0]
        const fy = (a[k][1] + a[k2][1]) / 2 - mid[1]
        const fz = (a[k][2] + a[k2][2]) / 2 - mid[2]
        this.quad(a[k], a[k2], b[k2], b[k], color, [fx, fy, fz])
      }
    }
    // Bouchons aux deux extrémités (visibles là où la poutre rentre dans un mur).
    for (const [ring, other] of [
      [rings[0], rings[1]],
      [rings[rings.length - 1], rings[rings.length - 2]],
    ]) {
      // Le bouchon regarde vers l'extérieur, donc « en s'éloignant du voisin ».
      const ref: P3 = [ring[0][0] - other[0][0], 0, ring[0][2] - other[0][2]]
      this.quad(ring[0], ring[1], ring[2], ring[3], color, ref)
    }
  }

  geometry(): THREE.BufferGeometry | null {
    if (this.pos.length === 0) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    geo.computeVertexNormals()
    return geo
  }
}
