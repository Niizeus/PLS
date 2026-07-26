// @ts-nocheck
/**
 * 📏 update-heights-ign.mjs — remet à jour SEULEMENT les hauteurs et les toits.
 *
 * `build-beauvais.mjs` régénère tout le monde (bâtiments, routes, verdure, eau,
 * arbres, lampadaires) en interrogeant OpenStreetMap. C'est long, et surtout ça
 * réécrit des milliers de lignes qui n'ont pas changé — donc un diff Git énorme
 * et des risques de conflit entre nous deux.
 *
 * Ce script-ci ne touche QUE les bâtiments du fichier déjà généré : il va
 * chercher les hauteurs mesurées de l'IGN (BD TOPO) et calcule l'orientation des
 * toits, puis réécrit le fichier. Les routes et le reste ne bougent pas d'un pixel.
 *
 * ▶️  Pour l'exécuter :
 *       node src/world/beauvais/update-heights-ign.mjs
 *
 *     Avec un cache local du téléchargement IGN (pratique pour ré-essayer) :
 *       BDTOPO_FILE=bdtopo-cache.json node src/world/beauvais/update-heights-ign.mjs
 *
 * Quand faut-il relancer `build-beauvais.mjs` à la place ? Quand la GÉOMÉTRIE
 * change : nouvelle zone, nouveaux contours OSM, nouvelles routes. Pour un simple
 * rafraîchissement des hauteurs, ce script suffit.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchBdTopo, joinBdTopo } from './bdtopo.mjs'
import { computeRidgeAngles } from './roofs.mjs'
import { BBOX, project } from './geo.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = join(__dirname, 'data', 'beauvais-buildings.json')

async function main() {
  const data = JSON.parse(readFileSync(FILE, 'utf8'))
  const before = data.buildings.map((b) => b.h)

  const { features } = await fetchBdTopo(BBOX)
  const report = joinBdTopo(data.buildings, features, project)
  const roofs = computeRidgeAngles(data.buildings)

  data.ign = report
  data.source = 'OpenStreetMap contributors (ODbL) — hauteurs et toits : IGN BD TOPO (Licence Ouverte)'
  data.generatedAt = new Date().toISOString()
  writeFileSync(FILE, JSON.stringify(data))

  // ── Rapport : c'est le seul moyen de voir d'un coup d'œil que ça a marché.
  const pc = (n) => ((n / report.total) * 100).toFixed(1) + ' %'
  console.log(`\n✅ ${report.total} bâtiments traités`)
  console.log(`   hauteurs mesurées IGN : ${pc(report.inside + report.near)}`)
  console.log(`     · centre dans un polygone IGN : ${pc(report.inside)}`)
  console.log(`     · repli par proximité (<8 m)  : ${pc(report.near)}`)
  console.log(`   sans correspondance (estimation conservée) : ${pc(report.missed)}`)
  console.log(`   donnée IGN refusée car aberrante           : ${report.refused}`)
  console.log(`   toits en pente : ${report.withRoof} (${pc(report.withRoof)})`)
  console.log(`     · orientés sur une façade libre : ${roofs.withFree}`)
  console.log(`     · entièrement mitoyens (repli)  : ${roofs.allShared}`)
  console.log(`     · pente plafonnée à 55°         : ${roofs.capped}`)

  // De combien la devinette se trompait-elle, en vrai ?
  const errs = []
  data.buildings.forEach((b, i) => {
    if (b.bdtopo) errs.push(Math.abs(before[i] - b.h))
  })
  errs.sort((a, b) => a - b)
  const mean = errs.reduce((s, v) => s + v, 0) / errs.length
  console.log(`\n   écart avec l'ancienne estimation : moyenne ${mean.toFixed(2)} m,`)
  console.log(`   médiane ${errs[errs.length >> 1].toFixed(1)} m, p90 ${errs[Math.floor(errs.length * 0.9)].toFixed(1)} m, max ${errs.at(-1).toFixed(1)} m`)
  console.log(`   corrigés de plus de 3 m : ${((errs.filter((v) => v >= 3).length / errs.length) * 100).toFixed(1)} %`)

  const hs = data.buildings.map((b) => b.h).sort((a, b) => a - b)
  const q = (p) => hs[Math.floor(p * hs.length)]
  console.log(`\n   hauteurs finales (m) — min ${hs[0]} / médiane ${q(0.5)} / p90 ${q(0.9)} / max ${hs.at(-1)}`)
  console.log(`   fichier : ${(readFileSync(FILE).length / 1024 / 1024).toFixed(2)} Mo`)
}

main().catch((err) => {
  console.error('❌ Échec :', err.message)
  process.exit(1)
})
