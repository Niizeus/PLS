// @ts-nocheck
/**
 * ✍️  annotate.mjs — fabriquer la VÉRITÉ TERRAIN, à la main.
 *
 * Tant qu'aucun humain n'a dit ce que sont VRAIMENT les bâtiments, le « 87 % »
 * affiché par le classifieur est un chiffre décoratif : il mesure la cohérence du
 * modèle avec lui-même, pas sa justesse. Ce script produit une page web autonome
 * où l'on tranche à la main, bâtiment par bâtiment.
 *
 * ⚠️ L'échantillon est TIRÉ AU HASARD, pas pris en haut de la file de validation.
 * C'est essentiel : mesurer la précision sur les cas les plus douteux donnerait un
 * score faussement bas, et sur les plus sûrs un score faussement haut. Seul un
 * tirage aléatoire donne la précision réelle sur la ville.
 *
 * Pour chaque bâtiment, la page montre :
 *   - son emprise et celles de ses voisins (on reconnaît une maison de ville à sa
 *     position dans l'îlot, pas à ses chiffres) ;
 *   - toutes ses données brutes ;
 *   - la prédiction, sa confiance et les indices qui ont voté ;
 *   - des liens vers Géoportail et Street View — **c'est là qu'on regarde vraiment**.
 *
 * ▶️  npm run chunk:annotate            → public/debug/chunk-annotate.html
 *     puis on ouvre la page, on annote, on clique « Exporter »,
 *     et on enregistre le fichier sous :
 *       src/world/beauvais/data/chunks/centre-ville.truth.json
 *     enfin : npm run chunk:calibrate
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unproject } from '../geo.mjs'

const CITY_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'beauvais-buildings.json')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..', '..')
const DATA_DIR = join(__dirname, '..', 'data', 'chunks')
const OUT_DIR = join(ROOT, 'public', 'debug')

/**
 * Taille de l'échantillon aléatoire.
 *
 * ⚠️ Celui-là ne peut PAS être filtré par le consensus de voisinage : un
 * échantillon dont on retire les cas faciles ne mesure plus la précision sur la
 * ville, mais sur les cas difficiles — donc un score faussement bas. C'est le prix
 * d'une mesure honnête.
 *
 * En revanche, on peut le raccourcir. 60 bâtiments donnent la précision à environ
 * ±12 points, ce qui suffit largement à répondre à la seule question qui compte
 * pour l'instant : « est-ce que ça marche à peu près, ou pas du tout ? »
 * On pourra remonter à 150 (±4 points) le jour où on voudra affiner les poids.
 */
const N_ALEATOIRE = 60

/**
 * Le haut de la file de validation : là, on corrige pour de bon. Les bâtiments
 * déjà couverts par le consensus de voisinage en sont retirés — c'est exactement
 * l'idée « si les 3-4 voisins sont pareils, on estime que celui-là l'est aussi ».
 */
const N_FILE = 30

/**
 * Rayon du contexte affiché autour du bâtiment (m).
 *
 * Assez large pour qu'on voie la rue et de quel côté de l'îlot on se trouve :
 * c'est ce qui permet de retrouver le bâtiment sur Street View. En dessous de
 * ~50 m, on ne voit qu'un tas de rectangles sans repère.
 */
const RAYON = 65

/**
 * Tirage pseudo-aléatoire REPRODUCTIBLE. Deux personnes qui lancent le script
 * doivent annoter le même échantillon, sinon les mesures ne se comparent pas.
 */
function rngFrom(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function main() {
  const name = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'centre-ville'
  const src = join(DATA_DIR, `${name}.classified.json`)
  if (!existsSync(src)) {
    console.error(`❌ ${src} introuvable. Lance d'abord : npm run chunk:classify`)
    process.exit(1)
  }
  const { passports } = JSON.parse(readFileSync(src, 'utf8'))
  const { archetypes } = JSON.parse(readFileSync(join(__dirname, 'archetypes.json'), 'utf8'))

  // Les emprises aberrantes sont exclues : il n'y a rien à y décider tant que la
  // géométrie n'est pas réparée.
  const eligibles = passports.filter((p) => !p.suspect)

  const rnd = rngFrom(20260801)
  const melange = eligibles.slice()
  for (let i = melange.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[melange[i], melange[j]] = [melange[j], melange[i]]
  }
  const echantillon = melange.slice(0, N_ALEATOIRE).map((p) => ({ ...p, lot: 'aleatoire' }))

  const dejaPris = new Set(echantillon.map((p) => p.id))
  const file = eligibles
    .filter((p) => !dejaPris.has(p.id) && p.confidence < 0.55 && !p.consensus)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, N_FILE)
    .map((p) => ({ ...p, lot: 'file' }))

  const items = [...echantillon, ...file]

  // Contexte : les voisins proches, pour lire la position dans l'îlot.
  const index = new Map()
  for (const p of passports) {
    const k = Math.floor(p.cx / 50) + ':' + Math.floor(p.cz / 50)
    if (!index.has(k)) index.set(k, [])
    index.get(k).push(p)
  }
  const voisinsDe = (p) => {
    const out = []
    const cx = Math.floor(p.cx / 50)
    const cz = Math.floor(p.cz / 50)
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        for (const q of index.get(cx + i + ':' + (cz + j)) ?? []) {
          if (q.id === p.id) continue
          if (Math.hypot(q.cx - p.cx, q.cz - p.cz) > RAYON) continue
          // Le numéro du voisin est le meilleur repère qui soit : on lit « 27 »
          // sur le plan, on cherche « 27 » sur la façade dans Street View.
          const num = (q.osm?.addr ?? '').replace(/^~ /, '').match(/^\d+\w*/)?.[0] ?? null
          out.push({ pts: q.pts, cx: q.cx, cz: q.cz, num })
        }
      }
    }
    return out
  }

  // Les routes viennent du fichier de la ville : l'IGN donne leur tracé, leur
  // largeur ET leur nom. Sans elles, le plan est un tas de rectangles flottants.
  const city = JSON.parse(readFileSync(CITY_FILE, 'utf8'))
  const routesDe = (p) => {
    const out = []
    for (const r of city.roads ?? []) {
      if (r.cls === 'track') continue // sentiers : du bruit sur un plan de rue
      const seg = []
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const a = r.pts[i]
        const b = r.pts[i + 1]
        const proche = (q) => Math.hypot(q[0] - p.cx, q[1] - p.cz) <= RAYON * 1.6
        if (proche(a) || proche(b)) seg.push([a, b])
      }
      if (seg.length) out.push({ seg, w: r.w, name: r.name ?? null, cls: r.cls })
    }
    return out
  }

  /**
   * Où se placer, et dans quelle direction regarder, pour voir ce bâtiment.
   *
   * Ouvrir Street View sur le centroïde du bâtiment place la caméra dans la rue
   * avec une orientation arbitraire — on tombe une fois sur deux sur la façade
   * d'en face. On se place donc sur le point de voie le plus proche, et on vise
   * le bâtiment. Le relecteur arrive face à ce qu'il doit juger.
   */
  const vueDe = (p) => {
    let bx = null
    let bz = null
    let bd = Infinity
    for (const r of city.roads ?? []) {
      if (r.cls === 'track') continue
      for (const [x, z] of r.pts) {
        const d = Math.hypot(x - p.cx, z - p.cz)
        if (d < bd) {
          bd = d
          bx = x
          bz = z
        }
      }
    }
    if (bx == null || bd > 60) return null
    const { lat, lon } = unproject(bx, bz)
    // Cap en degrés depuis le nord, sens horaire. Rappel : z négatif = nord.
    const cap = (Math.atan2(p.cx - bx, -(p.cz - bz)) * 180) / Math.PI
    return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, cap: Math.round((cap + 360) % 360) }
  }

  const data = items.map((p) => {
    const { lat, lon } = unproject(p.cx, p.cz)
    return {
      id: p.id,
      vue: vueDe(p),
      lot: p.lot,
      lat: Math.round(lat * 1e6) / 1e6,
      lon: Math.round(lon * 1e6) / 1e6,
      pts: p.pts,
      cx: p.cx,
      cz: p.cz,
      voisins: voisinsDe(p),
      routes: routesDe(p),
      num: (p.osm.addr ?? '').replace(/^~ /, '').match(/^\d+\w*/)?.[0] ?? null,
      pred: p.archetype,
      conf: p.confidence,
      evidence: (p.evidence ?? []).map((e) => e.text),
      runnerUp: p.runnerUp,
      flags: [p.exclusive ? 'exclusif' : null, p.capped ? 'plafonné' : null, p.devine ? 'sans preuve' : null]
        .filter(Boolean)
        .join(' · '),
      infos: {
        adresse: p.osm.addr ?? null,
        aire: p.geom.area,
        hauteur: p.h,
        toit: p.rh ?? null,
        pente: p.pitch ?? null,
        largeur: p.geom.width,
        allongement: p.geom.elongation,
        etages: p.ign.etages ?? null,
        logements: p.ign.logements ?? null,
        annee: p.ign.annee ?? null,
        usage1: p.ign.usage1 ?? null,
        usage2: p.ign.usage2 ?? null,
        murs: p.ign.murMat ?? null,
        toiture: p.rm ?? null,
        mitoyen: p.ctx.sharedRatio,
        voisins50: p.ctx.neighbours50,
        rue: p.ctx.roadName ?? null,
        distRue: p.ctx.roadDist ?? null,
        pois: (p.osm.pois ?? []).map((x) => `${x.k}=${x.v}`).join(', ') || null,
        nom: p.osm.name ?? null,
      },
    }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  const out = join(OUT_DIR, 'chunk-annotate.html')
  writeFileSync(out, page(data, archetypes, name))
  console.log(`\n✍️  Page d'annotation écrite → ${out}`)
  console.log(`   ${echantillon.length} bâtiments tirés au hasard (mesure de précision)`)
  console.log(`   + ${file.length} en tête de file de validation (correction utile)`)
  console.log(`\n   Ouvre-la, annote, clique « Exporter », enregistre sous :`)
  console.log(`     src/world/beauvais/data/chunks/${name}.truth.json`)
  console.log(`   puis : npm run chunk:calibrate\n`)
}

// ─────────────────────────────────────────────────────────────────────────────
// LA PAGE
// ─────────────────────────────────────────────────────────────────────────────

function page(data, archetypes, name) {
  // ⚠️ On envoie `label` et `critere`, pas `name`. Les noms techniques
  // (« Barre ou tour de grand ensemble ») sont ambigus pour qui n'est pas
  // spécialiste : la première calibration a montré qu'ils étaient lus comme
  // « grand bâtiment », et des immeubles de la Reconstruction se retrouvaient
  // étiquetés HLM. Sans le critère affiché, l'annotation ne mesure rien.
  const familles = archetypes.map((a) => ({
    key: a.key,
    name: a.label ?? a.name,
    critere: a.critere ?? '',
  }))
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>ChunkForge — annotation « ${name} »</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; font:14px/1.5 system-ui,sans-serif; background:#15171c; color:#e6e6e6; }
  header { position:sticky; top:0; background:#1d2027; padding:10px 16px; border-bottom:1px solid #333;
           display:flex; gap:16px; align-items:center; flex-wrap:wrap; z-index:10; }
  header b { color:#e8b84b; }
  button { font:inherit; background:#2a2e37; color:#e6e6e6; border:1px solid #3a3f4a;
           border-radius:6px; padding:6px 10px; cursor:pointer; }
  button:hover { background:#343945; }
  button.go { background:#e8b84b; color:#15171c; border-color:#e8b84b; font-weight:600; }
  main { display:grid; grid-template-columns:minmax(300px,420px) minmax(0,1fr); gap:20px;
         padding:20px; align-items:start; }
  /* En fenêtre étroite, on empile : la grille des familles déborderait sinon. */
  @media (max-width:900px) { main { grid-template-columns:1fr; } }
  svg { background:#0e1014; border:1px solid #333; border-radius:8px; width:100%; height:auto; }
  table { border-collapse:collapse; font-size:13px; }
  td { padding:2px 10px 2px 0; vertical-align:top; }
  td:first-child { color:#8b93a3; white-space:nowrap; }
  .pred { font-size:16px; margin:10px 0; }
  .conf { font-weight:700; }
  .ev { color:#9aa4b5; font-size:12px; margin:6px 0 14px; }
  .fam { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:6px; }
  .fam button { text-align:left; display:flex; gap:8px; align-items:flex-start; padding:8px 10px; }
  .fam button kbd { background:#3a3f4a; border-radius:4px; padding:0 5px; min-width:16px;
                    text-align:center; flex:none; margin-top:1px; }
  .fam button b { display:block; font-weight:600; }
  /* Le critère de décision : sans lui, l'annotateur devine le sens de l'étiquette. */
  .fam button i { display:block; font-style:normal; font-size:11.5px; color:#98a2b3;
                  line-height:1.35; margin-top:2px; }
  .fam button.sel i { color:#cfe8cf; }
  .fam button.sel { background:#2e7d32; border-color:#2e7d32; }
  .links a { color:#7cb3ff; margin-right:14px; }
  .done { color:#6bbf6b; }
  .lot { font-size:11px; padding:2px 6px; border-radius:4px; background:#3a3f4a; }
</style></head><body>
<header>
  <span>ChunkForge — <b>${name}</b></span>
  <span id="pos"></span>
  <span class="done" id="done"></span>
  <button onclick="prev()">← Précédent</button>
  <button onclick="next()">Suivant →</button>
  <button onclick="skip()">Passer (S)</button>
  <button class="go" onclick="exporter()">Exporter la vérité terrain</button>
</header>
<main>
  <div>
    <svg id="plan" viewBox="0 0 400 400"></svg>
    <p class="links" id="links"></p>
    <table id="infos"></table>
  </div>
  <div>
    <div class="pred" id="pred"></div>
    <div class="ev" id="ev"></div>
    <p style="color:#8b93a3">Qu'est-ce que c'est <b>vraiment</b> ? (touches 1-9, A-G)</p>
    <div class="fam" id="fam"></div>
  </div>
</main>
<script>
const DATA = ${JSON.stringify(data)};
const FAM = ${JSON.stringify(familles)};
const TOUCHES = '123456789abcdefg'.split('');
let i = 0;
const verdicts = JSON.parse(localStorage.getItem('chunkforge-truth-${name}') || '{}');

function sauver() { localStorage.setItem('chunkforge-truth-${name}', JSON.stringify(verdicts)); }

function dessiner(d) {
  // Cadrage : toujours centré sur le bâtiment, à échelle FIXE. Un cadrage qui
  // s'ajuste au contenu ferait varier l'échelle d'un bâtiment à l'autre et on
  // perdrait tout sens des distances entre deux fiches.
  const R = ${RAYON};
  const S = 400;                       // côté du dessin, en unités SVG
  const px = p => [ (p[0]-d.cx)/(2*R)*S + S/2, (p[1]-d.cz)/(2*R)*S + S/2 ];
  const f = v => v.toFixed(1);
  const poly = (r,fill,stroke,sw) =>
    '<polygon points="'+r.map(p=>px(p).map(f).join(',')).join(' ')+
    '" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+(sw||1)+'"/>';

  let out = '';

  // --- Les rues, dessinées à leur VRAIE largeur (donnée IGN).
  for (const r of d.routes) {
    const wpx = Math.max(2, r.w/(2*R)*S);
    const col = r.cls === 'pedestrian' ? '#39414d' : '#454c59';
    for (const [a,b] of r.seg) {
      const A = px(a), B = px(b);
      out += '<line x1="'+f(A[0])+'" y1="'+f(A[1])+'" x2="'+f(B[0])+'" y2="'+f(B[1])+
             '" stroke="'+col+'" stroke-width="'+f(wpx)+'" stroke-linecap="round"/>';
    }
  }

  // --- Les bâtiments : voisins en gris, le nôtre en jaune, bien détaché.
  out += d.voisins.map(v=>poly(v.pts,'#242830','#39404b')).join('');
  out += poly(d.pts,'#e8b84b','#ffffff',2);

  // --- Les numéros de rue : LE repère pour retrouver la façade dans Street View.
  for (const v of d.voisins) {
    if (!v.num) continue;
    const c = px([v.cx, v.cz]);
    if (c[0]<8||c[0]>S-8||c[1]<8||c[1]>S-8) continue;
    out += '<text x="'+f(c[0])+'" y="'+f(c[1]+3)+'" fill="#7b8494" font-size="10"'+
           ' text-anchor="middle">'+v.num+'</text>';
  }
  if (d.num) {
    const c = px([d.cx, d.cz]);
    out += '<text x="'+f(c[0])+'" y="'+f(c[1]+5)+'" fill="#15171c" font-size="15"'+
           ' font-weight="700" text-anchor="middle">'+d.num+'</text>';
  }

  // --- Les noms de rue, posés le long du plus long tronçon visible de chaque rue.
  const vus = new Set();
  for (const r of d.routes) {
    if (!r.name || vus.has(r.name)) continue;
    let best = null, bestLen = 0;
    for (const [a,b] of r.seg) {
      const A = px(a), B = px(b);
      const mx = (A[0]+B[0])/2, my = (A[1]+B[1])/2;
      if (mx<30||mx>S-30||my<14||my>S-14) continue;   // hors cadre : illisible
      const len = Math.hypot(B[0]-A[0], B[1]-A[1]);
      if (len > bestLen) { bestLen = len; best = [A,B,mx,my]; }
    }
    if (!best || bestLen < 45) continue;              // trop court pour un libellé
    vus.add(r.name);
    const [A,B,mx,my] = best;
    // On garde le texte lisible de gauche à droite, jamais à l'envers.
    let ang = Math.atan2(B[1]-A[1], B[0]-A[0]) * 180/Math.PI;
    if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    out += '<text x="'+f(mx)+'" y="'+f(my)+'" fill="#9fb0c8" font-size="11"'+
           ' text-anchor="middle" transform="rotate('+f(ang)+' '+f(mx)+' '+f(my)+')"'+
           ' paint-order="stroke" stroke="#0e1014" stroke-width="3">'+r.name+'</text>';
  }

  // --- Le nord. Dans le repère du jeu, z négatif = nord (voir geo.mjs) :
  // le nord est donc vers le HAUT du dessin, comme sur une carte normale.
  out += '<g opacity="0.65"><line x1="'+(S-24)+'" y1="34" x2="'+(S-24)+'" y2="14"'+
         ' stroke="#9fb0c8" stroke-width="1.5"/>'+
         '<text x="'+(S-24)+'" y="11" fill="#9fb0c8" font-size="10" text-anchor="middle">N</text></g>';

  // --- Échelle : 20 m, pour juger les tailles d'un coup d'œil.
  const l20 = 20/(2*R)*S;
  out += '<g opacity="0.65"><line x1="14" y1="'+(S-14)+'" x2="'+f(14+l20)+'" y2="'+(S-14)+
         '" stroke="#9fb0c8" stroke-width="2"/>'+
         '<text x="'+f(14+l20/2)+'" y="'+(S-19)+'" fill="#9fb0c8" font-size="10"'+
         ' text-anchor="middle">20 m</text></g>';

  document.getElementById('plan').innerHTML = out;
}

function afficher() {
  const d = DATA[i];
  document.getElementById('pos').textContent = (i+1)+' / '+DATA.length;
  document.getElementById('done').textContent = Object.keys(verdicts).length+' annotés';
  dessiner(d);
  document.getElementById('links').innerHTML =
    '<span class="lot">'+(d.lot==='aleatoire'?'échantillon aléatoire':'file de validation')+'</span> '+
    '<a target="_blank" href="https://www.geoportail.gouv.fr/carte?c='+d.lon+','+d.lat+'&z=19&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)">Vue aérienne</a>'+
    '<a target="_blank" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+
      (d.vue ? d.vue.lat+','+d.vue.lon+'&heading='+d.vue.cap : d.lat+','+d.lon)+
      '">Street View'+(d.vue ? ' (face au bâtiment)' : '')+'</a>';
  const inf = d.infos;
  document.getElementById('infos').innerHTML = Object.entries(inf)
    .filter(([,v]) => v !== null && v !== undefined && v !== '')
    .map(([k,v]) => '<tr><td>'+k+'</td><td>'+v+'</td></tr>').join('');
  const c = Math.round(d.conf*100);
  const col = c>=80 ? '#6bbf6b' : c>=55 ? '#e8b84b' : '#e07b7b';
  document.getElementById('pred').innerHTML =
    'Prédiction : <b>'+d.pred+'</b> — <span class="conf" style="color:'+col+'">'+c+' %</span>'+
    (d.runnerUp ? ' <span style="color:#8b93a3">(2e : '+d.runnerUp[0]+')</span>' : '')+
    (d.flags ? ' <span style="color:#8b93a3">['+d.flags+']</span>' : '');
  document.getElementById('ev').textContent = d.evidence.join('  ·  ') || '(aucun indice fort)';
  document.getElementById('fam').innerHTML = FAM.map((f,k) =>
    '<button class="'+(verdicts[d.id]===f.key?'sel':'')+'" onclick="choisir(\\''+f.key+'\\')">'+
    '<kbd>'+(TOUCHES[k]||'').toUpperCase()+'</kbd>'+
    '<span><b>'+f.name+'</b><i>'+f.critere+'</i></span></button>').join('');
}

function choisir(key) { verdicts[DATA[i].id] = key; sauver(); next(); }
function next() { if (i < DATA.length-1) { i++; afficher(); } }
function prev() { if (i > 0) { i--; afficher(); } }
function skip() { next(); }

addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') return next();
  if (e.key === 'ArrowLeft') return prev();
  if (e.key.toLowerCase() === 's') return skip();
  const k = TOUCHES.indexOf(e.key.toLowerCase());
  if (k >= 0 && FAM[k]) choisir(FAM[k].key);
});

function exporter() {
  const lots = Object.fromEntries(DATA.map(d => [d.id, d.lot]));
  const out = { chunk: '${name}', annotatedAt: new Date().toISOString(),
                count: Object.keys(verdicts).length,
                truth: Object.fromEntries(Object.entries(verdicts).map(([id,a]) => [id, {archetype:a, lot:lots[id]||'?'}])) };
  const b = new Blob([JSON.stringify(out,null,1)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = '${name}.truth.json'; a.click();
}

afficher();
</script></body></html>`
}

main()
