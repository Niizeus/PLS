import { facadeAtlas, STYLE_KEYS } from '../world/beauvais/archetypes/facadeAtlas'

/**
 * 🖼️ atlasPreview.ts — juger les façades sans lancer le jeu.
 *
 * Outil de développement, servi par `atlas.html`. Il n'entre pas dans le build.
 *
 * Pourquoi il existe : régler une façade en se promenant dans le jeu est très lent
 * — il faut charger la ville, trouver la bonne rue, le bon angle, la bonne heure
 * pour l'éclairage. Ici on voit les sept styles côte à côte, montés comme de vrais
 * immeubles (socle en bas, corniche en haut), et on recharge la page après chaque
 * modification de `facadeAtlas.ts`.
 */

const BANDE = 160
const PALETTE_H = 32
const REGISTRES = 3
/** Largeur d'aperçu par style : deux travées, assez pour juger le rythme. */
const LARGEUR_APERCU = 256

function titre(texte: string, aide: string) {
  const h = document.createElement('h2')
  h.textContent = texte
  const p = document.createElement('p')
  p.textContent = aide
  document.getElementById('app')!.append(h, p)
}

/**
 * Un immeuble témoin par style : socle, deux étages courants, couronnement.
 *
 * C'est l'empilement qui compte. Une bande isolée ne dit rien ; ce qu'on veut
 * vérifier, c'est que le bâtiment se LIT — qu'il a un pied, un corps et une tête.
 */
function plancheParStyle(atlas: HTMLCanvasElement) {
  const etagesCourants = 2
  const hauteur = (1 + etagesCourants + 1) * BANDE
  const canvas = document.createElement('canvas')
  canvas.width = STYLE_KEYS.length * LARGEUR_APERCU
  canvas.height = hauteur
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  STYLE_KEYS.forEach((_key, s) => {
    const bandeDe = (registre: number) => PALETTE_H + (s * REGISTRES + registre) * BANDE
    // De haut en bas : attique (2), étages courants (1), socle (0).
    const ordre = [2, 1, 1, 0]
    ordre.forEach((registre, ligne) => {
      ctx.drawImage(
        atlas,
        0, bandeDe(registre), LARGEUR_APERCU, BANDE,
        s * LARGEUR_APERCU, ligne * BANDE, LARGEUR_APERCU, BANDE,
      )
    })
  })

  const wrap = document.createElement('div')
  wrap.append(canvas)
  const legende = document.createElement('div')
  legende.className = 'legende'
  STYLE_KEYS.forEach((key) => {
    const s = document.createElement('span')
    s.style.width = `${LARGEUR_APERCU}px`
    s.textContent = key
    legende.append(s)
  })
  wrap.append(legende)
  document.getElementById('app')!.append(wrap)
}

/** L'atlas brut, tel qu'il part sur la carte graphique. */
function atlasBrut(atlas: HTMLCanvasElement) {
  const canvas = document.createElement('canvas')
  canvas.width = atlas.width
  canvas.height = atlas.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(atlas, 0, 0)
  canvas.style.width = `${atlas.width / 2}px`
  document.getElementById('app')!.append(canvas)
}

const texture = facadeAtlas()
const image = texture.image as HTMLCanvasElement

titre(
  'Immeubles témoins',
  'Un bâtiment par style, monté comme en jeu : socle en bas, deux étages courants, ' +
    'couronnement et corniche en haut. C\'est cette hiérarchie qui distingue un immeuble ' +
    'd\'un mur percé de trous.',
)
plancheParStyle(image)

titre(
  'Atlas brut',
  `L'atlas complet tel qu'il est envoyé à la carte graphique (${image.width} × ${image.height} px, ` +
    'affiché à 50 %). Chaque bande fait toute la largeur et se raccorde à elle-même, ce qui ' +
    'permet de répéter les travées horizontalement.',
)
atlasBrut(image)
