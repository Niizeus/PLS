// @ts-nocheck
/**
 * 📏 calibrate.mjs — le classifieur a-t-il RAISON ?
 *
 * Compare les prédictions à la vérité terrain annotée à la main (`annotate.mjs`)
 * et répond à trois questions, dans cet ordre d'importance :
 *
 *  1. **Précision** — quelle part des bâtiments est bien classée ?
 *     Mesurée sur l'échantillon ALÉATOIRE uniquement : la file de validation ne
 *     contient que des cas difficiles, l'inclure fausserait le résultat vers le bas.
 *
 *  2. **La confiance est-elle honnête ?** C'est la question la plus utile, et la
 *     plus oubliée. Un classifieur qui annonce 90 % doit avoir raison ~9 fois sur 10.
 *     S'il a raison 6 fois sur 10, le nombre affiché est un mensonge et tous les
 *     seuils du projet reposent sur du vide. On compare donc, par tranche de
 *     confiance, ce qui est annoncé et ce qui est constaté.
 *
 *  3. **Où sont les erreurs ?** Quelles familles se confondent — c'est ça qui dit
 *     quelle règle d'`archetypes.json` corriger.
 *
 * ▶️  npm run chunk:calibrate
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'chunks')

const pct = (n, t) => (t ? ((100 * n) / t).toFixed(1) : '—').padStart(5) + ' %'

function main() {
  const name = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'centre-ville'
  const predFile = join(DATA_DIR, `${name}.classified.json`)
  const truthFile = join(DATA_DIR, `${name}.truth.json`)

  if (!existsSync(truthFile)) {
    console.error(`\n❌ Pas de vérité terrain : ${truthFile}`)
    console.error(`\n   Il faut d'abord annoter à la main :`)
    console.error(`     npm run chunk:annotate`)
    console.error(`   puis ouvrir public/debug/chunk-annotate.html, annoter, exporter,`)
    console.error(`   et enregistrer le fichier à l'emplacement ci-dessus.\n`)
    console.error(`   ⚠️ Sans cette étape, le pourcentage de confiance affiché par le`)
    console.error(`      classifieur n'est PAS vérifié : il mesure la cohérence du modèle`)
    console.error(`      avec lui-même, pas sa justesse.\n`)
    process.exit(1)
  }

  const { passports } = JSON.parse(readFileSync(predFile, 'utf8'))
  const { truth } = JSON.parse(readFileSync(truthFile, 'utf8'))
  const byId = new Map(passports.map((p) => [p.id, p]))

  const paires = []
  for (const [id, t] of Object.entries(truth)) {
    const p = byId.get(id)
    if (!p) continue
    paires.push({ id, vrai: t.archetype, predit: p.archetype, conf: p.confidence, lot: t.lot, p })
  }
  if (!paires.length) {
    console.error('❌ Aucun bâtiment annoté ne correspond aux prédictions.')
    process.exit(1)
  }

  const alea = paires.filter((x) => x.lot === 'aleatoire')
  const base = alea.length >= 20 ? alea : paires

  // Une précision annoncée sans sa marge d'erreur invite à surinterpréter un
  // chiffre tiré de 20 bâtiments. La marge d'un pourcentage sur n tirages vaut
  // environ 1/√n, en points.
  const marge = Math.round(100 / Math.sqrt(Math.max(1, base.length)))
  if (alea.length < 40) {
    console.log(
      `\n⚠️ Échantillon aléatoire réduit (${alea.length}) : le résultat est INDICATIF,` +
        `\n   à ±${marge} points près. Utile pour voir si ça marche à peu près ; insuffisant` +
        `\n   pour régler finement les poids.`,
    )
  }

  console.log(`\n📏 CALIBRATION — « ${name} »`)
  console.log(`   ${paires.length} bâtiments annotés, dont ${alea.length} tirés au hasard\n`)

  // --- 1. Précision globale.
  const bons = base.filter((x) => x.vrai === x.predit).length
  console.log(`🎯 PRÉCISION : ${pct(bons, base.length)}  (${bons}/${base.length}, ±${marge} pts)`)

  // Précision « utile » : on tolère que le second candidat soit le bon, puisque
  // l'éditeur le propose en un clic au relecteur.
  const top2 = base.filter((x) => x.vrai === x.predit || x.p.runnerUp?.[0] === x.vrai).length
  console.log(`   dont bon 1er OU 2e candidat : ${pct(top2, base.length)}`)

  // --- 2. La confiance est-elle honnête ?
  console.log('\n🎚️  HONNÊTETÉ DE LA CONFIANCE')
  console.log('   (annoncé vs constaté — c\'est le tableau qui valide les seuils du projet)\n')
  const tranches = [
    [0.8, 1.01, '≥ 80 % — « sûrs »'],
    [0.55, 0.8, '55-80 % — « à confirmer »'],
    [0.3, 0.55, '30-55 % — « à valider »'],
    [0, 0.3, '< 30 % — très incertain'],
  ]
  for (const [lo, hi, label] of tranches) {
    const sub = base.filter((x) => x.conf >= lo && x.conf < hi)
    if (!sub.length) {
      console.log(`   ${label.padEnd(28)} —`)
      continue
    }
    const ok = sub.filter((x) => x.vrai === x.predit).length
    const annonce = sub.reduce((s, x) => s + x.conf, 0) / sub.length
    const reel = ok / sub.length
    const ecart = reel - annonce
    const verdict = Math.abs(ecart) < 0.1 ? '✅ honnête' : ecart < 0 ? '⚠️ TROP SÛR' : '↗️ trop prudent'
    console.log(
      `   ${label.padEnd(28)} ${String(sub.length).padStart(3)} bât. · ` +
        `annoncé ${(100 * annonce).toFixed(0).padStart(3)} % · réel ${(100 * reel).toFixed(0).padStart(3)} % · ${verdict}`,
    )
  }

  // --- 3. Par famille : ce qu'on rate, et ce qu'on invente.
  console.log('\n🧱 PAR ARCHÉTYPE (sur toutes les annotations)\n')
  const familles = [...new Set(paires.flatMap((x) => [x.vrai, x.predit]))].sort()
  console.log('   famille                        rappel   précision')
  for (const f of familles) {
    const attendus = paires.filter((x) => x.vrai === f)
    const proposes = paires.filter((x) => x.predit === f)
    const justes = paires.filter((x) => x.vrai === f && x.predit === f).length
    if (!attendus.length && !proposes.length) continue
    console.log(
      `   ${f.padEnd(28)} ${pct(justes, attendus.length)}   ${pct(justes, proposes.length)}` +
        `   (${attendus.length} réels, ${proposes.length} prédits)`,
    )
  }

  // --- 4. Les confusions les plus fréquentes : la liste des règles à corriger.
  const conf = new Map()
  for (const x of paires) {
    if (x.vrai === x.predit) continue
    const k = `${x.vrai} → prédit ${x.predit}`
    conf.set(k, (conf.get(k) ?? 0) + 1)
  }
  if (conf.size) {
    console.log('\n🔀 CONFUSIONS LES PLUS FRÉQUENTES (= les règles à corriger en priorité)\n')
    for (const [k, n] of [...conf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`   ${String(n).padStart(3)} ×  ${k}`)
    }
  }

  console.log('\n👉 Reporte la précision mesurée dans docs/08-CHUNKFORGE.md (critère de fin du lot 2).\n')
}

main()
