// @ts-nocheck
/**
 * 🔮 classify.mjs — LOT 2 de ChunkForge : déduire CE QU'EST chaque bâtiment.
 *
 * Lit les passeports du lot 1, confronte chacun aux 16 archétypes d'`archetypes.json`
 * via les poids de `signals.mjs`, et écrit pour chaque bâtiment :
 *
 *   archetype   la famille retenue
 *   confidence  entre 0 et 1 — À QUEL POINT on y croit
 *   evidence    les indices qui ont voté, et leur contribution chiffrée
 *   runnerUp    le second candidat, pour la revue à la main
 *   impact      la priorité de relecture (voir plus bas)
 *
 * ⚠️ Pas de machine learning, et c'est un choix. Un modèle appris donnerait « 84 % »
 * sans jamais dire pourquoi. Ici l'éditeur affiche les indices qui ont voté : on voit
 * quelle règle est mal réglée, et on la corrige. Un score qui s'explique est un score
 * qu'on peut améliorer.
 *
 * ▶️  npm run chunk:classify
 *     npm run chunk:classify -- --explain 12   (détaille 12 bâtiments au hasard)
 *
 * Spécification : `docs/08-CHUNKFORGE.md`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluate, meetsRequirements } from './signals.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'chunks')
const OVERRIDES_FILE = join(__dirname, '..', 'data', 'chunk-overrides.json')

// ─────────────────────────────────────────────────────────────────────────────
// RÉGLAGES DE DÉCISION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Température du passage « accord → confiance ».
 *
 * On convertit les accords (dans [-1, +1]) en probabilités par une exponentielle.
 * K règle la sévérité : plus il est grand, plus un petit écart entre le premier et
 * le second se traduit par une grosse différence de confiance. 5 donne une échelle
 * lisible — deux candidats à 0,8 et 0,5 d'accord ressortent à ~78 % et ~17 %.
 */
const K = 5

/**
 * En dessous de cet accord, on ne sait pas : le bâtiment part en `inconnu`.
 * Mieux vaut l'avouer que d'afficher un archétype tiré au sort avec 40 % de confiance.
 */
const ACCORD_MIN = 0.15

/**
 * Plafond quand les deux signaux forts manquent (`usage_1` exploitable ET année).
 *
 * Sans ce plafond, un bâtiment classé sur sa seule géométrie afficherait fièrement
 * 92 % — le pire des cas, parce qu'on lui ferait confiance. Mesuré au lot 1 : ça
 * concerne une part importante de la zone, et c'est le comportement voulu.
 */
const CAP_SANS_ATTRIBUTS = 0.7

/**
 * Plafond des suggestions faites SANS aucune preuve d'appartenance (repli du
 * point 2 du classement). Volontairement sous le seuil de validation : ces
 * bâtiments doivent tous passer devant un humain.
 */
const CAP_DEVINE = 0.5

/** Seuils de traitement (voir docs/08-CHUNKFORGE.md). */
const SEUIL_SUR = 0.8
const SEUIL_VALIDER = 0.55

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLES EXCLUSIVES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Certaines preuves ne se discutent pas : quand l'IGN écrit « Eglise » ou qu'OSM
 * dit « cathedral », aucun faisceau d'indices ne doit pouvoir en décider autrement.
 * Ces règles court-circuitent le vote et imposent une confiance plancher.
 *
 * Elles sont rares (`nature` ne sort que sur 2 % de la zone) mais elles portent
 * exactement les cas où une erreur se verrait le plus : les monuments.
 */
const EXCLUSIVES = [
  {
    archetype: 'monument',
    conf: 0.98,
    why: 'monument déjà identifié dans les données du jeu (kind)',
    test: (p) => p.kind === 'cathedral' || p.kind === 'monument',
  },
  {
    archetype: 'religieux',
    conf: 0.96,
    why: 'IGN nature=Eglise',
    test: (p) => p.ign?.nature === 'Eglise',
  },
  {
    archetype: 'religieux',
    conf: 0.95,
    why: 'OSM building=church/chapel/cathedral',
    test: (p) => ['church', 'chapel', 'cathedral'].includes(p.osm?.building),
  },
  {
    archetype: 'religieux',
    conf: 0.9,
    why: 'IGN usage_1=Religieux',
    test: (p) => p.ign?.usage1 === 'Religieux',
  },
  {
    archetype: 'monument',
    conf: 0.9,
    why: 'IGN nature=Monument/Château',
    test: (p) => ['Monument', 'Château'].includes(p.ign?.nature),
  },
  {
    // ⚠️ Uniquement si c'est PETIT. « Construction légère » sur un grand volume,
    // c'est une halle ou une serre, pas un abri de jardin.
    archetype: 'dependance',
    conf: 0.95,
    why: 'IGN construction_legere sur une petite emprise',
    test: (p) => p.ign?.legere && p.geom?.area <= 60,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// CLASSEMENT
// ─────────────────────────────────────────────────────────────────────────────

function classify(p, archetypes) {
  // --- 1. Une preuve incontestable ? On tranche tout de suite.
  for (const rule of EXCLUSIVES) {
    if (rule.test(p)) {
      return {
        archetype: rule.archetype,
        confidence: rule.conf,
        exclusive: rule.why,
        evidence: [{ signal: 'exclusif', value: rule.why, contrib: null, text: `⚡ ${rule.why}` }],
        runnerUp: null,
      }
    }
  }

  // --- 2. Sinon, tous les archétypes votent — sauf ceux qui n'ont aucune preuve
  // d'appartenance (voir `meetsRequirements` dans signals.mjs).
  const collect = (filtrer) => {
    const out = []
    for (const a of archetypes) {
      if (a.key === 'inconnu') continue // pas d'attentes : il ne peut pas gagner un vote
      if (filtrer && !meetsRequirements(p, a)) continue
      const r = evaluate(p, a)
      if (r.engaged === 0) continue
      out.push({ key: a.key, prior: a.prior ?? 1, ...r })
    }
    return out
  }

  let scored = collect(true)

  // Repli : aucun archétype n'a de preuve à faire valoir (ni usage, ni date, ni
  // POI…). Plutôt que de rendre une case vide, on rejoue SANS le filtre et on
  // plafonne durement. Le relecteur préfère toujours « probablement un immeuble
  // de la Reconstruction, mais sans preuve » à « inconnu » : il a quelque chose à
  // confirmer ou à infirmer, au lieu de repartir de zéro. Mesuré : 46 bâtiments
  // de plus de 150 m² tombaient dans ce trou.
  let devine = false
  if (!scored.length) {
    scored = collect(false)
    devine = true
  }
  if (!scored.length) {
    return { archetype: 'inconnu', confidence: 0, evidence: [], runnerUp: null }
  }

  // --- 3. Accords → confiance. On ne garde que les candidats crédibles : faire
  // voter des archétypes en désaccord franc diluerait le dénominateur et gonflerait
  // artificiellement la confiance du premier.
  //
  // `prior` entre ici : un bâti rare (pan de bois, grand ensemble) doit apporter
  // plus de preuves qu'un bâti courant pour l'emporter. On l'applique en log, ce
  // qui revient à multiplier la probabilité — la règle de Bayes, en pratique.
  //
  // ⚠️ Le classement final se fait sur ce score-là, pas sur l'accord brut : sinon
  // l'archétype retenu et la confiance affichée pourraient désigner deux familles
  // différentes.
  const pool = scored.filter((s) => s.accord > 0)
  if (!pool.length) {
    const best = scored.sort((x, y) => y.accord - x.accord)[0]
    return {
      archetype: 'inconnu',
      confidence: 0,
      evidence: best.evidence.slice(0, 4),
      runnerUp: [best.key, Math.round(best.accord * 100) / 100],
      weak: 1,
    }
  }
  for (const s of pool) s.exp = Math.exp(K * s.accord + Math.log(s.prior))
  pool.sort((x, y) => y.exp - x.exp)

  const top = pool[0]
  const second = pool[1]

  if (top.accord < ACCORD_MIN) {
    return {
      archetype: 'inconnu',
      confidence: 0,
      evidence: top.evidence.slice(0, 4),
      runnerUp: [top.key, Math.round(top.accord * 100) / 100],
      weak: 1,
    }
  }

  const total = pool.reduce((a, s) => a + s.exp, 0)
  let confidence = top.exp / total

  // --- 4. Plafond en l'absence des deux attributs forts.
  const aUsage = p.ign?.usage1 && p.ign.usage1 !== 'Indifférencié'
  const aAnnee = p.ign?.annee != null
  let capped = false
  if (!aUsage && !aAnnee && confidence > CAP_SANS_ATTRIBUTS) {
    confidence = CAP_SANS_ATTRIBUTS
    capped = true
  }
  // Une suggestion sans preuve reste une suggestion : elle doit atterrir dans la
  // file de validation, jamais dans les « sûrs ».
  if (devine) confidence = Math.min(confidence, CAP_DEVINE)

  return {
    archetype: top.key,
    confidence: Math.round(confidence * 1000) / 1000,
    accord: Math.round(top.accord * 1000) / 1000,
    evidence: top.evidence.slice(0, 6),
    runnerUp: second ? [second.key, Math.round(second.accord * 1000) / 1000] : null,
    ...(capped ? { capped: 1 } : {}),
    ...(devine ? { devine: 1 } : {}),
  }
}

/**
 * Priorité de relecture.
 *
 * ⚠️ Le point qui rend la validation supportable : on NE trie PAS par confiance.
 * Trié ainsi, on passerait la journée sur des cabanons de fond de cour où se
 * tromper ne se verra jamais. On trie par ce que l'erreur COÛTERAIT à l'écran :
 * une grande façade en bord de rue passe avant un appentis invisible.
 */
// ─────────────────────────────────────────────────────────────────────────────
// CONSENSUS DE VOISINAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * « Si les 3-4 bâtiments autour sont pareils, celui-là l'est probablement aussi. »
 *
 * Le tissu urbain est très corrélé dans l'espace : un îlot de la Reconstruction
 * a été bâti d'un coup, un lotissement aussi. Un bâtiment mal renseigné entouré
 * de voisins bien renseignés et unanimes hérite donc raisonnablement de leur
 * famille — c'est de l'information réelle, pas un raccourci.
 *
 * ⚠️ Deux garde-fous, sans lesquels ça propagerait des erreurs en chaîne :
 *
 *  1. **Comparaison à échelle comparable.** Un garage de 20 m² au fond d'une cour
 *     est entouré d'immeubles : sans ce filtre, il deviendrait un immeuble. On ne
 *     compare donc qu'à des voisins de gabarit voisin (surface et hauteur).
 *  2. **Une seule passe, sur les prédictions d'origine.** Si on relisait au fur et
 *     à mesure les résultats déjà modifiés, une erreur unique se propagerait de
 *     proche en proche à tout un quartier.
 *
 * Le résultat est toujours marqué (`consensus`) : on doit pouvoir distinguer ce
 * qui est déduit du bâtiment lui-même de ce qui vient de ses voisins.
 */
const CONS_RAYON = 35 // m
const CONS_MIN_VOISINS = 3
const CONS_PART = 0.7 // part du voisinage qui doit être d'accord
const CONS_CONF_VOISINS = 0.6 // ...et à quel point ces voisins sont sûrs d'eux
const CONS_PLAFOND_CONFIRME = 0.8 // un voisinage ne rend jamais « sûr » à lui seul
const CONS_CONF_ADOPTE = 0.6

function appliquerConsensus(passports) {
  const CELL = 40
  const grid = new Map()
  for (const p of passports) {
    if (p.suspect || p.reviewed) continue
    const k = Math.floor(p.cx / CELL) + ':' + Math.floor(p.cz / CELL)
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(p)
  }

  // Photographie des prédictions AVANT modification (garde-fou n°2).
  const avant = new Map(passports.map((p) => [p.id, { a: p.archetype, c: p.confidence }]))
  const stats = { confirme: 0, adopte: 0 }

  for (const p of passports) {
    if (p.suspect || p.reviewed || p.exclusive) continue

    const aire = p.geom?.area ?? 0
    const h = p.h ?? 0
    const cx = Math.floor(p.cx / CELL)
    const cz = Math.floor(p.cz / CELL)
    const voisins = []
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const q of grid.get(cx + i + ':' + (cz + j)) ?? []) {
          if (q.id === p.id) continue
          if (Math.hypot(q.cx - p.cx, q.cz - p.cz) > CONS_RAYON) continue
          // Garde-fou n°1 : même ordre de grandeur, sinon on compare un garage
          // à l'immeuble qui le surplombe.
          const qa = q.geom?.area ?? 0
          const qh = q.h ?? 0
          if (aire > 0 && qa > 0 && (qa / aire > 2.5 || aire / qa > 2.5)) continue
          if (Math.abs(qh - h) > 4) continue
          voisins.push(avant.get(q.id))
        }
      }
    }
    if (voisins.length < CONS_MIN_VOISINS) continue

    const poids = new Map()
    for (const v of voisins) poids.set(v.a, (poids.get(v.a) ?? 0) + v.c)
    const total = [...poids.values()].reduce((a, b) => a + b, 0)
    if (!total) continue
    const [famille, part] = [...poids.entries()].sort((a, b) => b[1] - a[1])[0]
    if (part / total < CONS_PART) continue
    if (famille === 'inconnu') continue

    const sub = voisins.filter((v) => v.a === famille)
    const confVoisins = sub.reduce((s, v) => s + v.c, 0) / sub.length
    if (confVoisins < CONS_CONF_VOISINS) continue

    if (p.archetype === famille) {
      // Le voisinage confirme : on peut monter, mais jamais jusqu'à « sûr » seul.
      const neuf = Math.min(CONS_PLAFOND_CONFIRME, p.confidence + 0.15)
      if (neuf > p.confidence) {
        p.confidence = Math.round(neuf * 1000) / 1000
        p.consensus = 'confirme'
        p.consensusVoisins = voisins.length
        stats.confirme++
      }
    } else if (p.confidence < 0.5) {
      // Le bâtiment ne sait pas ce qu'il est, ses voisins si : il les suit.
      p.archetype = famille
      p.confidence = CONS_CONF_ADOPTE
      p.consensus = 'adopte'
      p.consensusVoisins = voisins.length
      p.evidence = [
        {
          signal: 'voisinage',
          value: famille,
          text: `🏘️ ${sub.length}/${voisins.length} voisins de même gabarit sont « ${famille} »`,
        },
        ...(p.evidence ?? []).slice(0, 3),
      ]
      stats.adopte++
    }
  }
  return stats
}

/**
 * Emprise manifestement aberrante ?
 *
 * Repéré sur les exemples du lot 2 : des bâtiments de 3,5 m² au sol annoncés à
 * 11 m de haut avec 3 étages. Ce ne sont pas des tours — ce sont des ÉCLATS
 * d'emprise OSM (un contour découpé en morceaux) auxquels la jointure a greffé
 * les attributs du gros bâtiment voisin. Aucun archétype ne peut les décrire.
 *
 * On ne les corrige pas ici : on les MARQUE, pour que l'éditeur (lot 3) propose
 * de les fusionner avec leur voisin plutôt que de demander de les classer.
 */
function suspectOf(p) {
  const a = p.geom?.area ?? 0
  const h = p.h ?? 0
  if (a < 12 && h > 6) return 'eclat' // colonne impossible : trop haut pour sa base
  if (a < 4) return 'micro' // plus petit qu'une table : résidu de découpe
  return null
}

function impactOf(p, confidence) {
  const surface = Math.min(1, (p.geom?.area ?? 0) / 400)
  const hauteur = Math.min(1, (p.h ?? 0) / 20)
  const visible = (p.ctx?.roadDist ?? 999) <= 15 ? 1 : 0.3
  return Math.round((1 - confidence) * surface * hauteur * visible * 1000) / 1000
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRAMME PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2)
  const explainAt = args.indexOf('--explain')
  const explainN = explainAt >= 0 ? parseInt(args[explainAt + 1] ?? '10', 10) : 0
  // Le nom de la zone = le premier argument libre — sans confondre avec la valeur
  // qui suit `--explain`.
  const name =
    args.find((a, i) => !a.startsWith('--') && i !== explainAt + 1) || 'centre-ville'

  const src = join(DATA_DIR, `${name}.passports.json`)
  if (!existsSync(src)) {
    console.error(`❌ ${src} est introuvable. Lance d'abord : npm run chunk:collect`)
    process.exit(1)
  }
  const { passports, box, ...meta } = JSON.parse(readFileSync(src, 'utf8'))
  const { archetypes } = JSON.parse(readFileSync(join(__dirname, 'archetypes.json'), 'utf8'))

  // Les corrections faites à la main gagnent TOUJOURS sur la prédiction, et ce
  // fichier n'est jamais réécrit ici — même modèle que road-overrides.json.
  const overrides = existsSync(OVERRIDES_FILE)
    ? JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'))
    : {}

  console.log(`\n🔮 ChunkForge — classement « ${name} » (${passports.length} bâtiments)\n`)

  let forced = 0
  for (const p of passports) {
    const r = classify(p, archetypes)
    Object.assign(p, r)

    const ov = overrides[p.id]
    if (ov?.archetype) {
      p.archetype = ov.archetype
      p.confidence = 1
      p.reviewed = 1
      p.evidence = [{ signal: 'humain', value: ov.archetype, text: '✋ corrigé à la main' }]
      forced++
    }
    const suspect = suspectOf(p)
    if (suspect) p.suspect = suspect
  }
  if (forced) console.log(`✋ ${forced} corrections manuelles appliquées\n`)

  // Le voisinage a son mot à dire — mais seulement une fois tout le monde classé.
  const cons = appliquerConsensus(passports)
  console.log(
    `🏘️  Consensus de voisinage : ${cons.confirme} confirmés, ${cons.adopte} alignés sur leurs voisins\n`,
  )

  // L'impact se calcule EN DERNIER : il dépend de la confiance finale.
  for (const p of passports) {
    p.impact = p.suspect ? 0 : impactOf(p, p.confidence)
  }

  report(passports, archetypes)
  if (explainN) explain(passports, explainN)

  const out = join(DATA_DIR, `${name}.classified.json`)
  writeFileSync(
    out,
    JSON.stringify({ ...meta, box, chunk: name, classifiedAt: new Date().toISOString(), passports }),
  )
  console.log(`\n✅ écrit → ${out}`)

  // --- Le CHUNK PUBLIÉ : la version minuscule que le jeu embarque.
  //
  // Le fichier ci-dessus fait plusieurs Mo (emprises, indices, mesures) : c'est un
  // fichier de TRAVAIL, pour l'éditeur et les scripts. Le jeu, lui, n'a besoin que
  // de « ce bâtiment est de telle famille et compte tant d'étages » — il a déjà les
  // emprises dans `beauvais-buildings.json`. On sort donc un index positionnel,
  // ~50 fois plus léger, et c'est LUI qui part dans le build.
  // Identifiant de rue : un petit entier tiré du NOM de la voie la plus proche.
  // C'est lui qui donnera sa teinte commune à toute une rue dans le jeu — une rue
  // a été bâtie à une époque, avec les mêmes briques, et ça doit se voir.
  const rues = new Map()
  const idRue = (nom) => {
    if (!nom) return 0
    if (!rues.has(nom)) rues.set(nom, rues.size + 1)
    return rues.get(nom)
  }

  const cle = (p) => `${Math.round(p.cx * 10)}:${Math.round(p.cz * 10)}`
  const index = {}
  for (const p of passports) {
    if (p.archetype === 'monument') continue // asset fait main (lot 6), pas généré
    index[cle(p)] = [p.archetype, p.ign?.etages ?? 0, idRue(p.ctx?.roadName)]
  }
  console.log(`   ${rues.size} rues distinctes → autant de teintes cohérentes`)
  const publie = join(DATA_DIR, `${name}.json`)
  writeFileSync(publie, JSON.stringify({ chunk: name, box, index }))
  const ko = (readFileSync(publie).length / 1024).toFixed(0)
  console.log(`📦 chunk publié → ${publie} (${ko} Ko, ${Object.keys(index).length} bâtiments)`)
  console.log('   Prochaine étape : annoter la vérité terrain (npm run chunk:annotate)\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT
// ─────────────────────────────────────────────────────────────────────────────

const pct = (n, t) => ((100 * n) / t).toFixed(1).padStart(5) + ' %'

function report(passports, archetypes) {
  const T = passports.length
  const names = Object.fromEntries(archetypes.map((a) => [a.key, a.name]))

  const counts = new Map()
  for (const p of passports) counts.set(p.archetype, (counts.get(p.archetype) ?? 0) + 1)

  console.log('🧱 RÉPARTITION PAR ARCHÉTYPE\n')
  for (const [key, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const sub = passports.filter((p) => p.archetype === key)
    const conf = sub.reduce((s, p) => s + p.confidence, 0) / sub.length
    const w = Math.round((30 * n) / T)
    console.log(
      `   ${'█'.repeat(w).padEnd(30, '·')} ${String(n).padStart(4)} ${pct(n, T)}  ` +
        `conf.moy ${(100 * conf).toFixed(0).padStart(3)} %  ${names[key] ?? key}`,
    )
  }

  const sur = passports.filter((p) => p.confidence >= SEUIL_SUR).length
  const moyen = passports.filter((p) => p.confidence >= SEUIL_VALIDER && p.confidence < SEUIL_SUR).length
  const valider = passports.filter((p) => p.confidence < SEUIL_VALIDER).length
  console.log('\n🎯 CONFIANCE\n')
  console.log(`   ✅ sûrs (≥ 80 %)          ${String(sur).padStart(4)}  ${pct(sur, T)}`)
  console.log(`   🟠 à confirmer (55-80 %)  ${String(moyen).padStart(4)}  ${pct(moyen, T)}`)
  console.log(`   🔴 à VALIDER (< 55 %)     ${String(valider).padStart(4)}  ${pct(valider, T)}`)

  const capped = passports.filter((p) => p.capped).length
  const excl = passports.filter((p) => p.exclusive).length
  const devine = passports.filter((p) => p.devine).length
  console.log(
    `\n   dont ${capped} plafonnés à 70 % (ni usage ni date) · ${excl} tranchés par règle exclusive` +
      ` · ${devine} suggérés sans preuve (plafond 50 %)`,
  )

  const suspects = passports.filter((p) => p.suspect)
  if (suspects.length) {
    const eclats = suspects.filter((p) => p.suspect === 'eclat').length
    console.log(
      `\n⚠️  ${suspects.length} emprises aberrantes écartées de la file ` +
        `(${eclats} éclats trop hauts pour leur base, ${suspects.length - eclats} micro-résidus).`,
    )
    console.log('   Ce sont des découpes OSM à réparer, pas des bâtiments à classer.')
  }

  // La file de validation réellement à traiter : celle qui se VERRA.
  const queue = passports.filter((p) => p.confidence < SEUIL_VALIDER).sort((a, b) => b.impact - a.impact)
  const utiles = queue.filter((p) => p.impact >= 0.05).length
  console.log(`\n📋 FILE DE VALIDATION — triée par impact visuel, pas par confiance\n`)
  console.log(`   ${queue.length} bâtiments sous le seuil, dont ${utiles} à impact réel (≥ 0,05).`)
  console.log(`   👉 relire les ${Math.min(150, utiles)} premiers couvre l'essentiel de ce qui se voit.`)
  if (queue.length) {
    console.log('\n   Les 8 plus prioritaires :')
    for (const p of queue.slice(0, 8)) {
      console.log(
        `     impact ${p.impact.toFixed(2)}  conf ${(100 * p.confidence).toFixed(0)}%  ` +
          `${p.geom.area} m²  h${p.h}  → ${p.archetype}` +
          (p.runnerUp ? ` (ou ${p.runnerUp[0]})` : ''),
      )
    }
  }
}

function explain(passports, n) {
  console.log(`\n🔍 ${n} EXEMPLES DÉTAILLÉS\n`)
  // Échantillon régulier plutôt qu'aléatoire : le résultat est reproductible.
  const step = Math.max(1, Math.floor(passports.length / n))
  for (let i = 0; i < passports.length && i / step < n; i += step) {
    const p = passports[i]
    console.log(
      `   ─ ${p.id.slice(-8)}  ${p.geom.area} m² · h ${p.h} · ${p.ign.etages ?? '?'} ét. · ` +
        `${p.ign.annee ?? '?'} · mitoyen ${p.ctx.sharedRatio}`,
    )
    console.log(
      `     → ${p.archetype}  ${(100 * p.confidence).toFixed(0)} %` +
        (p.runnerUp ? `   (2e : ${p.runnerUp[0]})` : ''),
    )
    console.log(`       ${p.evidence.map((e) => e.text).join(' · ') || '(aucun indice fort)'}`)
  }
}

main()
