# 08 — ChunkForge : générer des quartiers crédibles

**Statut : spécification validée, pas encore implémentée.** Ce document est le **contrat** du
système. On l'écrit AVANT le code (règle n°1 de [`AGENTS.md`](../AGENTS.md)) pour que les deux devs
et leurs IA travaillent sur la même cible sans se marcher dessus.

> ⚠️ Tant qu'un lot n'est pas coché dans le [suivi des lots](#-les-lots-le-plan-à-suivre), il
> **n'existe pas**. Ne décris jamais ici du code qui n'est pas écrit comme s'il tournait.

---

## 🎯 Le but en une phrase

> Sélectionner une zone sur le plan de Beauvais → obtenir un quartier jouable dont les bâtiments
> **ressemblent vraiment** à ceux de Beauvais, dans le style BD du jeu.

Ce qui existe déjà est **géographiquement juste mais visuellement nu** : les emprises, les
hauteurs IGN, les toits et les routes sont bons (voir [`04-MONDE-BEAUVAIS.md`](04-MONDE-BEAUVAIS.md)),
mais un bâtiment est un volume peint en aplat, sans fenêtre ni porte. ChunkForge ne refait pas la
donnée géographique : **il ajoute la couche « qu'est-ce que c'est, et à quoi ça ressemble »**.

---

## 🧭 Décisions actées

Ces cinq points sont tranchés. Les remettre en cause demande une discussion, pas un commit.

### 1. Un chunk est un **JSON de passeports**, jamais un `.glb` cuit

La géométrie n'est pas stockée : elle est **fabriquée dans le jeu**, à la volée, par un générateur
déterministe qui lit le passeport de chaque bâtiment.

**Pourquoi.** La priorité absolue du projet est d'éviter les conflits Git (voir
[`01-WORKFLOW-GIT.md`](01-WORKFLOW-GIT.md)). Des chunks binaires, c'est des dizaines de Mo que Git
ne sait pas fusionner : à deux sur GitHub Desktop, on s'écraserait des quartiers entiers sans le
voir. Un JSON de passeports fait ~200 Ko, se relit, se diffe, se corrige à la main et se merge.

**Bonus décisif** : quand le générateur de façades s'améliorera dans six mois, **toute la ville se
met à jour** sans rien réanalyser.

**Seuls binaires autorisés dans le monde** : les monuments faits main (lot 6), qu'une seule
personne édite à la fois.

### 2. On ne supprime rien : on **bascule**

À l'intérieur de la bbox d'un chunk publié, [`Beauvais.tsx`](../src/world/beauvais/Beauvais.tsx) ne
monte plus les tuiles historiques — le chunk prend la main. Partout ailleurs, l'ancien pipeline
continue de tourner. On peut comparer ancien/nouveau d'un raccourci.

L'ancien code de bâtiment n'est supprimé **que** quand les chunks couvrent toute la ville et ont
gagné. Pas avant.

### 3. Le terrain LiDAR est **gardé**

C'est la donnée la plus solide du projet (MNT LiDAR HD de l'IGN, tout le territoire communal).
Le refaire reviendrait à retélécharger exactement la même chose.

Ce qui progresse, c'est la **résolution** : la carte globale est à 8 m
([`build-terrain-global.mjs`](../src/world/beauvais/build-terrain-global.mjs)). Le lot 5 produira
une heightmap **2 m pour la zone du chunk uniquement**, la globale 8 m restant le fond. Même
source, même code, même repère `geo.mjs` → aucun risque de décalage.

**Ciel, nuages, météo Open-Meteo : rien à changer**, ils ne dépendent pas de tout ça.

### 4. Les façades sont en **texture**, pas en géométrie modulaire

> 🚫 **PARTI PRIS SUSPENDU — l'atlas de façades est débranché du jeu (`FACADES_TEXTUREES = false`).**
>
> **Ce qu'on voyait.** Une grille de fenêtres identiques, répétée travée après travée et étage
> après étage, sur toute la hauteur de chaque volume. Sur un bâtiment long — lycée, grand
> ensemble, îlot de la Reconstruction — le résultat est un damier de rectangles sombres. Ça ne
> ressemble pas à Beauvais, et ça n'a pas d'âme : c'est le motif qui se lit, pas le bâtiment.
>
> **Pourquoi ce n'est pas un problème de réglage.** Changer les couleurs, les proportions de baie
> ou le nombre de registres ne change rien au fond : un motif répété à l'identique sur toutes les
> travées ne peut pas produire une façade. Une vraie façade a des travées de largeurs
> différentes, des ouvertures qui ne sont pas toutes au même endroit, un rez-de-chaussée qui suit
> le commerce et pas la grille, et des accidents (porte cochère, arrière décrépi, mur aveugle).
>
> **Ce qui tourne à la place.** Les bâtiments de chunk sortent en **aplats cel-shading** :
> `buildingGen.ts` garde les niveaux, les pignons et les toits, mais peint chaque surface avec une
> couleur de sommet — socle plus sombre, corps, couronnement plus clair, toits sur la palette avec
> une nuance par bâtiment. Pas de fenêtre.
>
> **Ce qui n'est pas supprimé.** Tout le code de l'atlas reste en place, ainsi que la page
> `atlas.html` : la palette d'aplats sert toujours de référence de couleurs, et l'atelier reste
> disponible pour expérimenter hors jeu. **Ne repasse `FACADES_TEXTUREES` à `true` que le jour où
> une méthode de génération de façades a été validée en jeu**, pas sur la page de test.
>
> Tout ce qui suit dans cette section décrit le parti pris d'origine, conservé pour ce jour-là.

Fenêtres, portes, vitrines et appareillage vivent dans un **atlas toon** partagé. Seuls les
éléments qui se voient en silhouette sortent en relief (corniche, débord de toit, encadrement).

**Pourquoi.** Sur ~2 000 bâtiments streamés en tuiles de 180 m, de la géométrie modulaire fait
exploser le budget triangles et provoque des à-coups au chargement de tuile. L'atlas ne coûte
quasiment rien au GPU, se marie nativement avec le `MeshToonMaterial` du jeu, et tient en 3–4 PNG
stables dans Git.

### 5. Les corrections à la main ne sont **jamais écrasées**

Elles vivent dans un fichier séparé, indexé par `cleabs` IGN, que le build ne réécrit jamais.
C'est exactement le modèle de [`road-overrides.json`](../src/world/beauvais/data/road-overrides.json),
qui marche déjà. On peut relancer l'analyse cent fois sans perdre son travail.

---

## 📐 La zone pilote (figée)

**Carré de ±400 m centré sur la cathédrale Saint-Pierre**, qui est déjà l'origine `(0, 0)` du monde
(voir [`geo.mjs`](../src/world/beauvais/geo.mjs)).

```
CHUNK_PILOTE = { minX: -400, maxX: 400, minZ: -400, maxZ: 400 }   // mètres monde
nom          = "centre-ville"
```

Mesuré sur les données actuelles :

| Indicateur | Valeur | Ce que ça implique |
|---|---|---|
| Bâtiments | **1 991** | assez pour prouver la méthode, assez peu pour tout relire |
| Hauteur mesurée IGN (`bdtopo`) | 99 % | la volumétrie est fiable |
| Toit renseigné (`rh`) | 85 % | bon |
| Matériau de toiture (`rm`) | **30 %** | ⚠️ **on ne peut PAS fonder le classement dessus** |
| Aire au sol médiane | **44 m²** | ⚠️ **plus de la moitié sont des garages / appentis / remises de cour** |

Ces deux avertissements pilotent toute la conception qui suit. La zone couvre cathédrale,
Saint-Étienne, les halles, les rues piétonnes et les bords du Thérain.

> 📌 On ne passe à d'autres quartiers qu'une fois la méthode validée sur celui-là.

---

## 🪪 Le passeport de bâtiment

L'objet central. Un passeport = ce qu'on **sait** (mesuré) + ce qu'on **déduit** (prédit) + ce
qu'on a **tranché** (humain).

```jsonc
{
  // ── IDENTITÉ ────────────────────────────────────────────────────────────
  "id":   "BATIMENT0000000302867412",   // cleabs IGN ; à défaut "osm:1234567"
  "cx": 12.4, "cz": -88.1,              // centroïde, mètres monde

  // ── MESURÉ (ne jamais inventer) ─────────────────────────────────────────
  "pts":   [[12.4,-88.1], ...],         // emprise OSM, sens horaire
  "holes": [ [...] ],                   // cours intérieures, optionnel
  "h":  9.2,                            // murs sol → gouttière (m), IGN
  "rh": 3.8,                            // gouttière → faîtage (m), IGN
  "ra": 1.57,                           // orientation du faîtage (rad), roofs.mjs
  "rm": "t",                            // toiture : t tuile / a ardoise / z zinc / b béton
  "pitch": 38.5,                        // pente du toit (°), déduite de rh et ra

  // ── COLLECTÉ (lot 1) — regroupé par source, pour qu'on sache d'où ça vient ─
  "geom": { "area": 96.3, "perimeter": 41.2, "width": 7.8, "length": 12.4,
            "elongation": 1.59, "compactness": 0.71, "rectFill": 0.99,
            "orthogonality": 1, "vertices": 5 },
  "ign":  { "usage1": "Résidentiel", "usage2": "Commercial et services",
            "etages": 3, "logements": 4, "annee": 1952, "murMat": "brique" },
  "osm":  { "building": "yes",
            "pois": [ { "k": "shop", "v": "bakery", "name": "…" } ] },
  "ctx":  { "sharedSides": 2, "sharedLen": 18.4, "sharedRatio": 0.45,
            "neighbours50": 37, "builtRatio50": 0.42,
            "roadDist": 4.1, "roadClass": "drivable", "roadName": "Rue …",
            "zone": "centre-ville" },

  // ── DÉDUIT (lot 2) ──────────────────────────────────────────────────────
  "archetype":  "reconstruction-brique",
  "confidence": 0.87,                   // 0–1
  "runnerUp":   ["maison-ville-brique", 0.09],
  "evidence": [                          // pourquoi — affiché dans l'éditeur
    "usage_1=Résidentiel (+3.0)",
    "date_d_apparition=1952 (+3.0)",
    "nombre_d_etages=3 (+2.5)",
    "mitoyen 2 côtés (+2.0)"
  ],

  // ── TRANCHÉ / RENDU ─────────────────────────────────────────────────────
  "reviewed": true,                     // absent = jamais relu par un humain
  "impact":   0.34,                     // priorité de revue, voir plus bas
  "seed":     48213                     // variations déterministes du générateur
}
```

**Règles de fer :**

- Un champ **mesuré** absent reste **absent**. On ne le remplace pas par une estimation dans le
  passeport — l'estimation est le rôle du générateur, au rendu.
- `seed` est dérivé de `id`, pas tiré au hasard : deux builds donnent la même ville.
- `confidence` sans `evidence` est interdit. Un score qu'on ne peut pas expliquer ne se corrige pas.

---

## 🧱 Les 16 archétypes

Liste de départ, **à ajuster au lot 2** quand les vrais chiffres de couverture tomberont.

### Centre ancien

| Clé | Nom | Signes attendus |
|---|---|---|
| `maison-ville-brique` | Maison de ville mitoyenne brique/tuile | R+1–R+2, 60–150 m², mitoyen 1–2 côtés, étroite sur rue, toit 2 pans |
| `immeuble-centre-commerce` | Immeuble de centre-ville, commerce en RDC | R+2–R+4, sur rue commerçante, tag OSM `shop`/`amenity`, mitoyen |
| `pan-de-bois` | Maison à pan de bois | hyper-centre, < 100 m², antérieur à 1800, souvent `historic` OSM. **Rare** |
| `reconstruction-brique` | Immeuble de la Reconstruction (1945–60) | **La signature de Beauvais** — la ville a brûlé en juin 1940. Brique, gabarits alignés, R+2/R+3, tuile, `date_d_apparition` 1945–1962, mitoyen |

> 💡 Si un seul archétype doit être parfait, c'est `reconstruction-brique`. C'est lui qui rend le
> centre reconnaissable.

### Pavillonnaire

| Clé | Nom | Signes attendus |
|---|---|---|
| `pavillon-brique` | Pavillon brique 1930–60 | isolé/jumelé, 70–130 m², R+1, toit 2 ou 4 pans |
| `pavillon-crepi` | Pavillon crépi 1970–90 | isolé, 90–160 m², R+0/R+1, souvent 4 pans, garage accolé |
| `pavillon-recent` | Pavillon récent | postérieur à 1995, compact, toit franc |
| `dependance` | **Garage / appentis / remise** | ⚠️ **pilier de la zone** — < 40 m², h < 3,5 m, `usage_1/2 = Annexe` (413 cas), `construction_legere`, en fond de parcelle |

### Collectif

| Clé | Nom | Signes attendus |
|---|---|---|
| `petit-collectif` | Petit collectif R+3/R+4 | `nombre_de_logements` 6–30, toit plat ou faible pente |
| `grand-ensemble` | Barre ou tour | très allongé ou très haut, `nombre_de_logements` > 30, toit plat, quartiers Argentine / Saint-Jean |

### Activité

| Clé | Nom | Signes attendus |
|---|---|---|
| `hangar` | Hangar / entrepôt métal | `usage=Industriel`, > 300 m², très rectangulaire, faible pente, peu de sommets |
| `commerce-peripherie` | Boîte commerciale + parking | `usage=Commercial`, > 400 m², toit plat, hors centre |
| `equipement-public` | École, gymnase, administration | `usage=Public`/`Sportif`, volume composite, souvent nommé dans OSM |

### Spécial

| Clé | Nom | Traitement |
|---|---|---|
| `religieux` | Église, chapelle | `nature=Religieux` → quasi-certitude, silhouette dédiée |
| `monument` | Patrimoine remarquable | ⛔ **jamais généré** — remplacé par un asset fait main (lot 6) |
| `inconnu` | Inclassable | volume neutre sobre + entrée en file de validation |

---

## 🔎 Les signaux collectés

Le classement ne repose pas sur une source, mais sur un **faisceau**. Aujourd'hui
[`bdtopo.mjs`](../src/world/beauvais/bdtopo.mjs) ne récupère que `hauteur`, les altitudes de toit et
le matériau : **on laisse le reste sur la table.**

> ✅ **Couverture mesurée au lot 1** — voir [Résultats du lot 1](#-résultats-du-lot-1-mesuré-sur-la-zone-pilote).
> Les poids ci-dessous ont été révisés d'après ces chiffres réels : plusieurs signaux espérés se
> sont révélés vides, et un signal non prévu s'est révélé indispensable.

### BD TOPO `BDTOPO_V3:batiment`

| Champ | Ce qu'il apporte | Couverture réelle | Poids |
|---|---|---|---|
| `usage_1` | Résidentiel / Commercial / Annexe / Religieux / Industriel | 94 % *(dont 35 % « Indifférencié » → **59 % utile**)* | **3,0** |
| `nombre_d_etages` | R+1 vs R+4 | 55 % | 2,5 |
| `date_d_apparition` | **L'époque** — le plus discriminant quand il est là | **44 %** | **3,0** |
| `nombre_de_logements` | maison (1) vs collectif (24) | 55 % | 2,0 |
| `usage_2` | second usage, souvent « Annexe » ou « Commercial » | 21 % | 1,5 |
| `materiaux_des_murs` | brique / pierre / béton | 19 % | 1,0 |
| `materiaux_de_la_toiture` (`rm`) | tuile / ardoise / zinc | 30 % | 0,8 |
| `addr:housenumber` (OSM) | **repérage humain uniquement**, ne classe rien | 58 % | **0** |
| `nature` | Église, Château, Monument, Industriel | **2 %** — mais **décisif quand présent** | **3,0** *(exclusif)* |
| `construction_legere` | abri, appentis → `dependance` | 9 % | **2,0** *(exclusif)* |
| ~~`origine_du_batiment`~~ | ❌ **abandonné** : « Cadastre » sur 93 % — constante, donc sans pouvoir séparateur | 94 % | **0** |

⚠️ **Nom exact du champ : `construction_legere`**, pas `legere`.

### OpenStreetMap — les contours sont vides, les POI sont la vraie source

**Découverte du lot 1, et elle change la conception.** Les contours OSM de Beauvais sont nus :
`building=yes` sur **99 %**, `shop` et `amenity` à **0 %**, `name` à 1 %, `building:levels` à 1 %.

Ce n'est pas une lacune de la ville : c'est la convention OSM. **Le commerce est un NŒUD posé à
l'intérieur du bâtiment**, pas un attribut de son contour. Le collecteur fait donc une seconde
requête Overpass sur les nœuds `shop` / `amenity` / `craft` / `office` / `tourism` / `healthcare` /
`historic`, et les rattache par appartenance géométrique.

| | Avant | Après |
|---|---|---|
| Bâtiments avec preuve d'activité | **0 %** | **9 %** (377 POI rattachés) |

Sans cette requête, l'archétype `immeuble-centre-commerce` aurait été **indétectable**.

Poids : **2,5** pour un POI `shop`/`amenity`/`craft` contenu (preuve directe d'un RDC commercial),
**2,5** pour `historic`. Les tags de contour gardent un poids résiduel de 0,5.

### Géométrie — calculée, gratuite

Aire (1,5), hauteur `h` (1,5), allongement et compacité (0,8), nombre de sommets, orthogonalité,
rapport hauteur/largeur, pente de toit déduite de `rh` / largeur perpendiculaire au faîtage (1,0).

### Contexte — le plus négligé, et pourtant très parlant

| Signal | D'où il vient | Poids |
|---|---|---|
| **`sharedRatio`** — part du périmètre collée à un voisin | calculé (même règle qu'[`roofs.mjs`](../src/world/beauvais/roofs.mjs) : < 1 m = mitoyen) | **2,0** |
| Distance et classe de la rue la plus proche | routes IGN de [`bdtopoRoads.mjs`](../src/world/beauvais/bdtopoRoads.mjs) | 0,8 |
| Densité bâtie locale (`neighbours50`, `builtRatio50`) | calculé | 0,6 |
| Quartier | [`zones.json`](../src/data/zones.json) | 0,5 |

> 💡 On mesure la **longueur** de mur partagée, pas seulement le nombre de côtés. « 2 côtés
> mitoyens » ne dit pas si c'est 2 m ou 20 m ; la part du périmètre, si — et c'est elle qui sépare
> une maison de ville d'un pavillon qui frôle son garage. Mesuré : **88 %** de la zone pilote a un
> `sharedRatio > 0,15`, ce qui confirme un tissu dense.

---

## 📈 Résultats du lot 1 (mesuré sur la zone pilote)

Produit par `npm run chunk:collect` le 2026-08-01 sur les 1 991 bâtiments du carré ±400 m.
**Jointures : IGN 94 % · OSM 100 % · POI 9 %.**

### Ce qui a confirmé les hypothèses

- **La Reconstruction domine, et de très loin.** Sur les 830 bâtiments datés, **360 sont des
  années 1950** — 43 % à eux seuls, contre 102 pour les années 1900 et 71 pour les années 1960.
  Beauvais a brûlé en juin 1940, et la donnée le dit franchement. ➡️ `reconstruction-brique` est
  bien **l'archétype prioritaire** : le soigner, c'est rendre le centre reconnaissable.
- **La brique domine les murs** : 279 brique contre 72 pierre. Et la toiture : 424 tuile,
  151 ardoise. Le contraste tuile/ardoise du centre ancien est réel.
- **Le tissu est mitoyen** (88 %) et **dense**.
- **Les dépendances pèsent lourd** : `usage_1 = Annexe` sur 216 bâtiments, plus 197 en `usage_2`,
  et 274 (14 %) répondent au critère géométrique (< 40 m², h < 3,5 m). L'aire médiane est de
  **44 m²**, le p10 à **6 m²**. La classe `dependance` n'est pas un détail : c'est un pilier.

### Ce qui a démenti les hypothèses — à retenir

| Attendu | Constaté | Conséquence |
|---|---|---|
| Tags OSM exploitables | `building=yes` à 99 %, `shop`/`amenity` à **0 %** | ➡️ requête POI ajoutée : 0 % → 9 % |
| `date_d_apparition` pollué par la sentinelle `1800-01-01` | **1 % seulement** | ➡️ la crainte était exagérée ; le champ est propre, il est juste **absent à 56 %** |
| `nature` utile largement | **2 %** hors « Indifférenciée » | ➡️ inutile en général, mais **décisif** quand il sort (Église ×2, Château, Monument) : gardé en signal exclusif |
| `materiaux_des_murs` à ~39 % | **19 %** (le sondage initial portait sur une zone plus large) | ➡️ poids abaissé à 1,0 |
| `origine_du_batiment` prometteur | « Cadastre » sur **93 %** | ➡️ **abandonné** : une constante ne sépare rien |
| `usage_1` très fiable (94 %) | dont **35 % « Indifférencié »** | ➡️ utile sur 59 % seulement |

### Ce que la zone contient vraiment

```
usage_1   : Indifférencié 705 · Résidentiel 700 · Commercial 235 · Annexe 216 · Religieux 5
étages    : R+1 337 · R+3 301 · R+2 281 · R+4 130 · R+5 40 · R+6 8 · R+9 1
POI top   : restaurant 26 · coiffeur 15 · vêtements 15 · bar 12 · opticien 11 · fast-food 10
quartiers : centre-ville 1599 · saint-just-des-marais 282 · argentine 9
aire (m²) : p10 6 · médiane 44 · p90 191 · max 4000
```

### Conséquence directe pour le lot 2

**Aucun signal ne couvre la zone à lui seul.** Le meilleur (`usage_1`) plafonne à 59 % utile. Le
faisceau pondéré n'est donc pas un luxe : c'est la seule approche possible. Et le **plafond de
confiance à 0,70 en l'absence d'`usage_1` et de date** concernera une part importante des
bâtiments — ce qui est le comportement voulu, pas un défaut.

Les 100 % de couverture sont : la **hauteur** (mesurée IGN) et toute la **géométrie**. Le lot 2
doit donc s'appuyer plus lourdement que prévu sur la forme et le contexte, moins sur les attributs.

---

## 📊 Le moteur de prédiction et le %

**Pas de machine learning.** Un score par faisceau d'indices, transparent et réglable.

```
score(a) = Σ  poids(i) × accord(i, a)          accord ∈ [-1, +1], 0 si le signal est absent
score(a) = max(0, score(a))                    on écrête les négatifs
confiance = score_max / Σ score(a)
```

**Signaux exclusifs.** `nature=Religieux` ou `legere=true` court-circuitent le vote : ils imposent
l'archétype avec une confiance plancher de 0,95.

**Plafond pour données manquantes.** Si `usage_1` **et** `date_d_apparition` sont absents, la
confiance est plafonnée à **0,70**, quel que soit le score. Sans ça, un bâtiment classé sur la
seule géométrie afficherait fièrement 92 % — le pire des cas, parce qu'on lui ferait confiance.

**Pourquoi pas un modèle ML** : il donnerait 84 % sans jamais dire pourquoi. Ici l'éditeur affiche
les indices qui ont voté, on voit tout de suite quelle règle est mal réglée, et on la corrige. Un
score qui s'explique est un score qu'on peut améliorer.

### Seuils

| Confiance | Traitement |
|---|---|
| ≥ 0,80 | automatique, vert |
| 0,55 – 0,80 | automatique, **marqué orange** (générable, relisable plus tard) |
| < 0,55 | **file de validation** |

### La revue se trie par impact visuel, pas par confiance

C'est le point qui rend la validation supportable.

```
impact = (1 − confiance) × surface_normalisée × hauteur_normalisée × visibilité
visibilité = 1 si le bâtiment est à moins de 15 m d'une voie `drivable` ou `pedestrian`, sinon 0,3
```

**Attente réaliste** : avec `rm` à 30 % et une aire médiane de 44 m², il faut s'attendre à
**15–25 %** de la zone sous le seuil au premier passage. Ce n'est pas un problème : trié par
impact, on relit les ~150 bâtiments qui font le visage du centre-ville, pas les ~400 cabanons de
fond de cour où se tromper ne se verra jamais. Une demi-journée, pas une semaine.

### Deux garde-fous ajoutés au lot 2

**1. `requires` — pas de classement sans preuve.** Un archétype ne concourt que si au moins un de
ses signaux *définissants* est présent et en accord (≥ 0,5).

Sans ce filtre, un archétype dont les signaux définissants manquent ne vote que sur ses signaux
secondaires — et devient donc **plus facile à satisfaire** qu'un archétype bien renseigné. Mesuré :

| | Sans `requires` | Avec |
|---|---|---|
| `pan-de-bois` | **232** bâtiments (il y a ~27 datés d'avant 1800) | **0** |
| `monument` | 41 | **7** |
| `religieux` | 36 | **4** |
| File de validation | **71,2 %** de la zone | **29,6 %** |

**2. `prior` — la rareté se paie.** Chaque archétype porte une fréquence attendue relative
(1 = neutre), appliquée en logarithme au moment du passage en confiance. Un bâti rare doit apporter
plus de preuves qu'un bâti courant pour l'emporter. C'est la règle de Bayes, en pratique.

**3. Repli « suggestion sans preuve ».** Quand *aucun* archétype ne passe `requires`, on rejoue
sans le filtre et on plafonne à **0,50** — donc sous le seuil de validation. Un relecteur préfère
toujours « probablement un immeuble de la Reconstruction, mais sans preuve » à « inconnu » : il a
quelque chose à confirmer ou infirmer plutôt qu'une case vide. Mesuré : `inconnu` passe de 248 à
**99**, dont beaucoup moins de gros bâtiments visibles.

**4. Emprises aberrantes.** 223 objets de la zone sont des **éclats** de découpe OSM — jusqu'à
3,5 m² au sol annoncés à 11 m de haut avec 3 étages, parce que la jointure leur a greffé les
attributs du gros bâtiment voisin. Ils sont marqués `suspect` et **retirés de la file de
validation** : il n'y a rien à y décider tant que la géométrie n'est pas réparée. L'éditeur
(lot 3) proposera de les fusionner avec leur voisin.

### Consensus de voisinage

> *« Si les 3-4 bâtiments autour sont pareils, celui-là l'est probablement aussi. »*

Le tissu urbain est fortement corrélé dans l'espace : un îlot de la Reconstruction a été bâti d'un
coup, un lotissement aussi. Un bâtiment mal renseigné entouré de voisins unanimes hérite donc
raisonnablement de leur famille — c'est de l'information réelle, pas un raccourci.

Une passe après le classement : voisins à moins de 35 m, **de gabarit comparable**, au moins 3,
d'accord à 70 % et sûrs à 60 % en moyenne.
- Accord avec la prédiction → confiance +0,15, **plafonnée à 0,80** (un voisinage seul ne rend
  jamais « sûr »).
- Désaccord et confiance propre < 0,50 → le bâtiment suit ses voisins, confiance 0,60.

**Deux garde-fous, sans lesquels ça propagerait des erreurs en chaîne :**

1. **Gabarit comparable** (surface ×2,5 max, hauteur ±4 m). Un garage de 20 m² en fond de cour est
   entouré d'immeubles : sans ce filtre, il deviendrait un immeuble.
2. **Une seule passe, sur les prédictions d'origine.** En relisant au fur et à mesure les résultats
   déjà modifiés, une erreur unique se propagerait de proche en proche à tout un quartier.

Le résultat est toujours marqué (`consensus: 'confirme' | 'adopte'`) : on doit pouvoir distinguer
ce qui est déduit du bâtiment lui-même de ce qui vient de ses voisins.

| | Avant | Après |
|---|---|---|
| Sûrs (≥ 80 %) | 19,2 % | **34,6 %** |
| À valider (< 55 %) | 29,6 % | **25,1 %** |
| File à impact réel | 175 | **152** |

Mesuré : 401 confirmés, 55 alignés sur leurs voisins.

### Calibration — obligatoire avant de faire confiance au %

Avant que le pourcentage veuille dire quoi que ce soit, il faut **annoter 150 bâtiments à la main**,
puis mesurer la vraie précision du classifieur dessus. Sans cette étape, « 87 % » mesure la
cohérence du modèle avec lui-même, **pas sa justesse**.

L'outil est prêt :

```bash
npm run chunk:annotate
```

Il produit `public/debug/chunk-annotate.html`, une page autonome. Pour chaque bâtiment, elle montre
un **vrai plan de quartier** — parce qu'un tas de rectangles gris ne permet pas de savoir de quel
bâtiment on parle :

- les **rues à leur largeur réelle** (donnée IGN) avec leur **nom** posé le long du tracé ;
- les **numéros de rue** des voisins — on lit « 27 » sur le plan, on cherche « 27 » sur la façade ;
- l'emprise du bâtiment **et celles de ses voisins** : on reconnaît une maison de ville à sa place
  dans l'îlot, pas à ses chiffres ;
- une **échelle de 20 m** et le **nord**, à échelle fixe d'une fiche à l'autre pour garder le sens
  des distances ;
- toutes ses données, la prédiction et les indices qui ont voté ;
- un lien **Street View qui s'ouvre face au bâtiment** : la caméra est posée sur le point de voie
  le plus proche et orientée vers l'emprise, au lieu de tomber une fois sur deux sur la façade d'en
  face.

On tranche aux touches `1-9` / `A-G`, le travail est sauvegardé au fur et à mesure, puis « Exporter ».

> 📌 L'adresse vient des nœuds `addr:housenumber` d'OSM. La jointure stricte (point dans l'emprise)
> ne couvrait que **10 %** des bâtiments — beaucoup de points sont posés en limite de parcelle. Avec
> un repli sur le plus proche à 12 m, on passe à **58 %**. Une adresse approchée est préfixée `~` :
> c'est un repère pour l'œil, jamais l'adresse officielle du bâtiment.

⚠️ **L'échantillon est tiré au hasard** (150 bâtiments), pas pris en haut de la file de validation.
Mesurer la précision sur les cas les plus douteux donnerait un score faussement bas. Le tirage est
reproductible : deux personnes annotent le même échantillon. 60 bâtiments de la file s'y ajoutent,
comptés à part.

Puis :

```bash
npm run chunk:calibrate
```

Qui répond à trois questions, dans cet ordre d'importance :

1. **Précision** — quelle part est bien classée (1er candidat, et 1er-ou-2e) ;
2. **La confiance est-elle honnête ?** — le tableau le plus utile et le plus oublié : par tranche,
   on compare le pourcentage *annoncé* au taux de réussite *constaté*. Un classifieur qui annonce
   90 % et a raison 6 fois sur 10 rend tous les seuils du projet caducs ;
3. **Où sont les erreurs ?** — rappel et précision par famille, et les confusions les plus
   fréquentes, c'est-à-dire la liste des règles d'`archetypes.json` à corriger en priorité.

> 📌 **La précision mesurée sera reportée ici** — c'est le critère de fin du lot 2. Elle ne peut
> pas être produite automatiquement : elle demande un humain qui regarde les bâtiments.

#### ⚠️ Leçon de la première tentative : le vocabulaire est un piège

Une première annotation de 31 bâtiments a donné **6,5 % de précision**. Ce chiffre ne mesurait
**pas** la justesse du classifieur : il mesurait un écart de **vocabulaire**.

Exemple : 8 bâtiments avaient été étiquetés « grand-ensemble ». En regardant leurs données —
`80 m² · 4 étages · 3 logements · 1952 · mitoyen 0,78` — ce sont des immeubles de la Reconstruction.
L'étiquette technique « Barre ou tour de grand ensemble » avait été lue, très logiquement, comme
« grand bâtiment ». Même chose pour des annexes de 9 m² étiquetées « maison de ville ».

**La faute était dans l'outil, pas chez l'annotateur** : la page proposait des noms d'archétypes
sans jamais donner le critère qui les sépare.

Correctif : chaque archétype porte désormais deux champs destinés à l'humain, distincts de son nom
technique — `label` (sans ambiguïté) et `critere` (le test de décision), affichés sous chaque
bouton :

| Avant | Après |
|---|---|
| Barre ou tour de grand ensemble | **Barre ou tour HLM** — *30 logements MINIMUM, R+5 et plus, cité des années 60. Quasi absent du centre* |
| Maison de ville mitoyenne (brique/tuile) | **Maison de ville (mitoyenne)** — *1 SEUL logement, R+1/R+2, collée aux voisines, avant 1940* |
| Garage, appentis, remise de cour | **Garage / annexe / remise** — *PAS habitable : moins de ~45 m², 1 niveau, souvent en fond de cour* |

> 🧭 **Règle à retenir pour toute annotation future** : si un critère de décision ne tient pas en
> une phrase affichable à côté du choix, l'archétype est mal défini — et les annotations qu'on en
> tirera seront inexploitables.

L'annotation v1 est conservée pour mémoire dans
`data/chunks/centre-ville.truth.v1-vocabulaire-ambigu.json`. **Elle ne doit pas servir de vérité
terrain.**

#### Taille de l'échantillon

Ramené de 150 à **60** tirages aléatoires (+ 30 en tête de file, hors consensus) — soit **90 fiches
au lieu de 210**. La précision sort alors à **±12 points**, ce qui suffit à répondre à la seule
question qui compte pour l'instant : *est-ce que ça marche à peu près, ou pas du tout ?* On
remontera à 150 (±4 points) le jour où on voudra régler finement les poids.

⚠️ **L'échantillon aléatoire ne peut pas être filtré par le consensus de voisinage.** Un
échantillon dont on retire les cas faciles ne mesure plus la précision sur la ville, mais sur les
cas difficiles — donc un score faussement bas. Le consensus ne réduit que la **file de
validation**, pas la mesure.

---

## 🔮 Résultats du lot 2 (classement de la zone pilote)

`npm run chunk:classify` sur les 1 991 bâtiments, après les garde-fous décrits plus haut.

| Archétype | Bâtiments | Part | Confiance moy. |
|---|---:|---:|---:|
| Garage, appentis, remise | 790 | 39,7 % | 81 % |
| **Immeuble de la Reconstruction** | **554** | **27,8 %** | 59 % |
| Maison de ville mitoyenne | 267 | 13,4 % | 59 % |
| Immeuble avec commerce en RDC | 138 | 6,9 % | 55 % |
| *Inclassable* | 99 | 5,0 % | — |
| Petit collectif R+3/R+4 | 51 | 2,6 % | 59 % |
| Commerce de périphérie | 21 | 1,1 % | 67 % |
| Hangar | 16 | 0,8 % | 51 % |
| Pavillons (3 familles) | 34 | 1,7 % | 38 % |
| Équipement public | 7 | 0,4 % | 64 % |
| Monument | 7 | 0,4 % | 62 % |
| Église | 4 | 0,2 % | 91 % |
| Grand ensemble | 3 | 0,2 % | 66 % |

**Confiance** : 19,2 % sûrs (≥ 80 %) · 51,1 % à confirmer · **29,6 % à valider**.
Dont 441 plafonnés à 70 % (ni usage ni date), 153 tranchés par règle exclusive, 148 suggérés sans
preuve.

**File de validation réelle : 175 bâtiments** à impact visuel ≥ 0,05. C'est une demi-journée de
relecture, pas une semaine — et c'est le tri par impact qui rend ça possible.

### Vérification de bon sens

Les deux bâtiments les plus importants de la zone tombent juste, sans intervention :

- **Cathédrale Saint-Pierre** — `monument` à 98 % (3 999 m², 45 m) → ira en asset fait main au lot 6
- **Église Notre-Dame-de-la-Basse-Œuvre** — `religieux` à 96 %

Et la répartition raconte bien Beauvais : la Reconstruction est le **premier archétype habité** de
la zone, comme le laissait attendre le pic de 360 bâtiments datés des années 1950 trouvé au lot 1.

### Ce qui reste à surveiller

- **`dependance` à 39,7 %** est beaucoup, même pour un centre plein de cours et de garages.
  429 de ces 790 sont classés sur la seule géométrie (petits, sans aucun attribut) : c'est le
  choix par défaut raisonnable, mais c'est le premier chiffre que la calibration devra confirmer
  ou démentir.
- Quelques `dependance` atteignent 472 m² et 19 m de haut, parce que l'IGN les déclare « Annexe ».
  Le générateur (lot 4) ne devra **pas** leur appliquer le gabarit d'un garage.
- Les trois familles de pavillons ne totalisent que 34 bâtiments, avec une confiance faible (38 %).
  Attendu dans un centre mitoyen — à revoir quand on étendra la méthode aux quartiers extérieurs.

---

## 🛠️ L'outil ChunkForge

Un onglet **dans l'éditeur existant** ([`src/editor/`](../src/editor/), voir
[`06-EDITEUR-PLS.md`](06-EDITEUR-PLS.md)). On ne repart pas de zéro.

✅ **Implémenté au lot 3** — onglet **ChunkForge** dans `editor.html`, à côté de Carte et Intérieurs.

| # | Étape | Ce qu'on voit | État |
|---|---|---|---|
| 1 | **Sélectionner** | **Maj + glisser** délimite une zone sur le plan. Molette pour zoomer, glisser pour déplacer, clic sur un bâtiment pour l'inspecter. `Échap` revient au chunk entier | ✅ |
| 2 | **Lire** | plan coloré par famille, rues à leur vraie largeur, légende cliquable qui isole une famille, compteurs (bâtiments dans la zone, restants à trancher, corrigés) | ✅ |
| 3 | **Revoir** | l'inspecteur montre l'adresse et la rue en premier, puis la proposition, sa confiance, ses drapeaux (*plafonné*, *suggéré sans preuve*, *aligné sur N voisins*…), les indices qui ont voté, puis les mesures. Touches `1…9`/`A…G` pour trancher, `Entrée` pour confirmer la proposition. **Trié par impact visuel** | ✅ |
| 4 | **Enregistrer** | écrit `data/chunk-overrides.json` via le plugin Vite `chunkOverridesPlugin` | ✅ |
| 5 | **Générer / voir en jeu** | produit le chunk et bascule dessus dans le jeu | lot 4 |

**Le classement ne tourne pas dans l'éditeur.** Il reste hors-jeu (`npm run chunk:classify`) : le
navigateur n'a ni les accès réseau IGN/OSM ni le droit d'écrire les gros fichiers intermédiaires.
L'éditeur fait ce que seul un humain peut faire — **regarder, puis trancher**. Le module lit le
`.classified.json` produit par le lot 2 ; si le fichier manque, il affiche les commandes à lancer
plutôt qu'une page blanche.

### Fichiers du lot 3

| Fichier | Rôle |
|---|---|
| `src/editor/ChunkForge.tsx` | le module : interface, gestes, raccourcis, enregistrement |
| `src/editor/chunkForgeData.ts` | types du passeport, chargement **dynamique** du chunk, couleurs des familles |
| `src/editor/chunkForgeDraw.ts` | dessin du plan sur canvas (sans état) |
| `src/editor/ChunkForge.css` | styles propres au module, tous préfixés `cf-` |
| `vite/chunkOverridesPlugin.ts` | endpoint `/__pls/chunk-overrides` → `data/chunk-overrides.json` |

> 💡 Le chunk classé pèse plusieurs Mo : il est chargé en **import dynamique**, à la première
> ouverture de l'onglet seulement. L'éditeur démarre à la même vitesse qu'avant pour qui n'utilise
> pas ce module.

### Deux pièges React rencontrés — à ne pas réintroduire

Les deux ont la même cause : **un geste ne doit jamais dépendre du rythme de rendu de React.**

1. **Rafale de touches.** Quatre touches frappées dans la même image ne classaient qu'un seul
   bâtiment : `trancher` calculait « le suivant » à partir d'une file périmée, donc les trois
   suivantes réécrivaient le même bâtiment. Ça se déclenche dès qu'on garde une touche enfoncée.
   → file et bâtiment courant doublés par des `useRef`, plus un jeu des identifiants déjà traités
   dans la rafale.
2. **Tracé de zone.** `onPointerUp` lisait le rectangle depuis une closure figée au rendu
   précédent : si le relâchement suit le déplacement de trop près, la zone était perdue.
   → le rectangle en cours est gardé en `useRef` en plus de l'état.

---

## 🧱 Résultats du lot 4 (le centre-ville en jeu)

✅ **Le centre-ville s'affiche avec des étages, des fenêtres et des rez-de-chaussée.** Vérifié en
jeu au sol et en vue 2.5D dans l'éditeur : **60 FPS**, aucune erreur console.

Trois défauts ont été trouvés **en regardant le résultat**, pas en relisant le code — voir
[Les trois bugs du lot 4](#les-trois-bugs-du-lot-4--à-ne-pas-réintroduire). Le plus grave, les
faces retournées, ne se voyait pas comme un bug : la ville était simplement « terne », ce qu'on
aurait pu mettre sur le compte du style.

### Comment ça marche

| Fichier | Rôle |
|---|---|
| `archetypes/facadeAtlas.ts` | l'atlas de façades, **dessiné par le code** — ⚠️ débranché du jeu, garde la palette d'aplats et l'interrupteur `FACADES_TEXTUREES` |
| `archetypes/buildingGen.ts` | passeport → volume : niveaux, travées, pignons, toit |
| `chunkIndex.ts` | jointure entre les bâtiments du jeu et l'index publié |
| `data/chunks/centre-ville.json` | **l'index publié : 66 Ko** pour 1 984 bâtiments |

**L'atlas est une pile de bandes horizontales**, chacune sur toute la largeur et raccordable à
elle-même. On répète en U (`wrapS = RepeatWrapping`) autant de travées que le mur en compte,
pendant que V reste bloqué dans sa bande (`wrapT = ClampToEdgeWrapping`). L'enroulement étant
indépendant par axe, **un seul matériau suffit pour toute la ville** — murs, pignons et toits
compris, ces derniers pointant sur une case d'aplat de la palette.

**Dessiné par le code plutôt qu'en PNG** : des PNG seraient des binaires dans Git, illisibles en
diff et impossibles à fusionner à deux. Ici, changer la couleur d'une brique est une ligne qu'on
relit en revue — et c'est déterministe.

**66 Ko et pas 2 Mo** : le jeu n'embarque pas le fichier de travail du lot 2. Il a déjà les
emprises dans `beauvais-buildings.json` ; l'index ne lui dit que « famille, nombre d'étages », par
clé positionnelle. Un bâtiment absent de l'index retombe sur l'ancien rendu — **une donnée
manquante dégrade, elle ne casse pas**.

### Les trois bugs du lot 4 — à ne pas réintroduire

#### 1. Faces retournées : la ville plate et terne

Toutes les façades avaient leurs **normales tournées vers l'intérieur**. Le culling supprimait donc
la face visible, on voyait l'intérieur du bâtiment, et l'éclairage arrivait par-derrière : la ville
était uniformément plate, sans aucune différence entre une façade au soleil et une à l'ombre.

Cause : un ordre de sommets qui paraît tout aussi naturel à écrire, mais qui tourne à l'envers.

| | Ordre des sommets |
|---|---|
| ✅ `buildingMesh.ts` (correct) | `bas-gauche → haut-gauche → haut-droit` |
| ❌ premier jet de `buildingGen.ts` | `bas-gauche → bas-droit → haut-droit` |

Le contour sort d'`orientRing()` dans un sens connu ; **seul le premier ordre tourne les normales
vers l'extérieur**. Murs, pignons ET jupes étaient touchés.

> 🧪 **Comment le vérifier sans se fier à l'œil** : construire un bâtiment test, avancer de 0,3 m
> le long de la normale depuis le centre de chaque triangle, et vérifier que le point sort de
> l'emprise. Mesuré après correction : **24 faces correctes, 0 inversée** sur une emprise en L
> avec toit à deux pans.
>
> ⚠️ Ne PAS tester avec « la normale s'éloigne-t-elle du centre du bâtiment ? » : c'est faux dès
> que l'emprise est concave (un L, un U), et ça signale des erreurs qui n'existent pas.

#### 2. Textures qui grésillent : le filtrage

Premier réglage : `NearestFilter` partout et `generateMipmaps = false`, pour « le trait net du
cel-shading ». En jeu, à dix mètres, chaque fenêtre tombait entre deux texels et les façades se
désintégraient en **tirets scintillants** — du repliement de spectre classique : sans mipmap, une
texture minifiée n'échantillonne qu'un pixel sur N au lieu d'en faire la moyenne.

Réglage retenu :

| Paramètre | Valeur | Pourquoi |
|---|---|---|
| `magFilter` | `NearestFilter` | de près, l'arête reste franche (look BD) |
| `minFilter` | `LinearMipmapLinearFilter` | de loin, les fenêtres fondent dans le mur au lieu de grésiller |
| `anisotropy` | 8 | une façade vue en biais — c'est-à-dire presque toutes, dans une rue — reste lisible |

Comme les bandes sont empilées dans un seul atlas, les mipmaps les feraient déteindre l'une sur
l'autre. D'où une **marge de 22 px de mur nu** en haut et en bas de chaque bande, qui absorbe le
mélange — et qui sert au passage d'allège et de linteau, puisqu'une fenêtre ne touche jamais le
plancher ni le plafond.

#### 3. Toits en éventail

Premier essai : les bâtiments apparaissaient comme des **plaques plates débordant sur la rue**.
Cause : j'avais trianglé les toits **en éventail** depuis le premier sommet. Un éventail n'est
valable que pour un contour **convexe** — or les emprises de centre ancien sont massivement en L
ou en U, et les triangles se posaient hors de l'emprise.

Corrigé avec `THREE.ShapeUtils.triangulateShape`, comme `buildingMesh.ts` le faisait déjà, plus le
test d'orientation des faces (sans lui, un toit sur deux est éclairé par en dessous, donc noir).

> ⚠️ **À ne pas réintroduire** : jamais de triangulation en éventail sur une emprise de bâtiment.

### Comment une façade est composée

Une façade ne se lit pas comme une grille uniforme du sol au toit. Elle a **trois registres**, et
c'est ce qui sépare un immeuble d'un mur percé de trous :

| Registre | Ce qu'il porte |
|---|---|
| **socle** | rez-de-chaussée : vitrine, porte cochère ou garage. Plus sombre, assis sur un soubassement — c'est ce contraste de valeur qui « pose » le bâtiment au sol |
| **courant** | les étages répétés |
| **attique** | dernier niveau + **corniche**. Sans elle, un immeuble s'arrête net, comme coupé au couteau |

Le couronnement n'apparaît qu'à partir de trois niveaux : sur une maison basse, une corniche
marquée écraserait la façade.

**Une baie se dessine en quatre couches**, et c'est la première qui fait tout le travail :
l'**embrasure** (une ombre portée en haut et à gauche de l'ouverture, qui donne l'épaisseur du
mur), l'encadrement clair, le verre en deux tons, et l'appui saillant. Sans embrasure, une fenêtre
reste un autocollant collé sur le mur.

Les baies sont en proportions **portrait** (hauteur ≈ 1,55 × largeur) : une fenêtre carrée donne
immédiatement un air de bureau moderne à n'importe quel bâtiment.

### Cohérence de rue

> *Une rue a été bâtie à une époque, avec les mêmes briques — et ça doit se voir.*

Le matériau combine `map` **et** `vertexColors`, qui se multiplient : l'atlas donne le dessin, la
couleur de sommet donne la teinte. *(Atlas débranché : la couleur de sommet porte aujourd'hui
l'aplat complet — la teinte de rue décrite ici la module toujours de la même façon.)* Chaque bâtiment reçoit la teinte de **sa rue** (88 rues
distinctes dans la zone pilote), plus un écart propre d'environ 5 %.

Les valeurs restent proches de 1 : on module, on ne repeint pas. Au-delà de ±12 %, la ville vire au
patchwork.

C'est ce qui fait qu'une ville paraît *construite* plutôt que semée au hasard — et les données le
permettent, parce que les rues ont un vrai caractère :

| Rue (autour de la cathédrale) | Bâtiments | Hauteur médiane | Époque |
|---|---:|---:|---:|
| Rue Nicolas Pastour | 61 | 5 m | ~1850 |
| Rue Jean Racine | 66 | 7 m | ~1900 |
| Rue Jean Vast | 32 | 10 m | ~1954 |
| Rue Chambiges | 22 | 13 m | ~1953 |

### 🖼️ Régler les façades sans lancer le jeu

```
http://localhost:5199/atlas.html
```

Page de développement (hors build, comme `editor.html` et `regie.html`) : elle monte un **immeuble
témoin par style** — socle, deux étages courants, couronnement — plus l'atlas brut.

Se promener dans le jeu pour juger une façade est très lent : il faut charger la ville, trouver la
bonne rue, le bon angle, la bonne heure pour l'éclairage. Ici, on modifie `facadeAtlas.ts`, on
recharge, on voit.

### Ce qui reste franchement perfectible

- 🚫 **Les façades sont sans ouverture, et c'est volontaire.** L'atlas est débranché (voir le
  parti pris n°4) : les volumes sortent en aplats. **C'est le chantier n°1 du lot 4.** Ce qu'une
  future méthode devra produire, et que l'atlas ne produisait pas :
  - des **travées irrégulières** — une façade beauvaisienne n'est pas une grille ;
  - un **rez-de-chaussée qui suit l'usage réel** (le commerce, la porte cochère), pas le rythme
    des étages ;
  - des **murs aveugles** : pignon mitoyen, arrière de parcelle, mur de dépendance. Aujourd'hui
    toutes les faces étaient percées de la même façon, y compris celles qu'on ne perce jamais ;
  - une **variation d'un bâtiment à l'autre** dans une même famille (la graine `seed` du
    passeport n'est toujours pas utilisée).
- **La palette penche vers le beige.** Les teintes ont été resaturées (la brique tire vraiment au
  rouge), mais le fond du problème reste : `dependance` pèse **41 %** de la zone et utilise le
  style crépi clair. Si le classement surestime les annexes, le rendu le montre immédiatement —
  c'est un symptôme du lot 2, pas du lot 4. **C'est le prochain chantier.**
- **Les rez-de-chaussée commerciaux ne sortent que sur 131 bâtiments** (`immeuble-centre-commerce`),
  alors qu'une rue piétonne de centre-ville en compte bien plus. Lié à la couverture des POI (9 %).
- Pas encore de variation d'un bâtiment à l'autre au sein d'une famille : la graine `seed` est dans
  le passeport mais le générateur ne s'en sert pas encore.

---

## 📁 Arborescence prévue

Rien de tout ça n'existe encore — c'est la cible.

```
src/world/beauvais/
  chunks/
    collect-chunk.mjs      # ✅ lot 1 — agrège toutes les sources → passeports bruts
    classify.mjs           # ✅ lot 2 — archétype + confiance + evidence + impact
    signals.mjs            # ✅ lot 2 — lecture des signaux, poids, calcul d'accord
    archetypes.json        # ✅ lot 2 — les 16 archétypes, leurs attentes, requires et priors
    annotate.mjs           # ✅ lot 2 — génère la page d'annotation (vérité terrain)
    calibrate.mjs          # ✅ lot 2 — mesure précision et honnêteté de la confiance
  archetypes/
    buildingGen.ts         # ✅ lot 4 — passeport → géométrie (dans le jeu)
    facadeAtlas.ts         # ✅ lot 4 — l'atlas, dessiné par le code
  chunkIndex.ts            # ✅ lot 4 — jointure jeu ↔ index publié
  data/
    chunks/
      centre-ville.passports.json  # ✅ sortie du lot 1 (régénérable, 1,4 Mo)
      centre-ville.classified.json # ✅ sortie du lot 2 (régénérable)
      centre-ville.truth.json      # 🟠 vérité terrain — à produire À LA MAIN, jamais régénérable
      centre-ville.json            # ✅ lot 4 — l'index publié (66 Ko), le seul qui part dans le jeu
    chunk-overrides.json   # ✅ lot 3 — corrections manuelles, JAMAIS réécrit par un script
public/textures/facades/   # lot 4 — l'atlas toon (3–4 PNG)
src/editor/
  ChunkForge.tsx           # lot 3 — l'onglet éditeur
```

Commandes disponibles :

```bash
npm run chunk:collect              # lot 1 — collecte (--fresh pour ignorer le cache)
npm run chunk:classify             # lot 2 — classement (--explain 12 pour détailler des exemples)
npm run chunk:annotate             # lot 2 — page d'annotation de la vérité terrain
npm run chunk:calibrate            # lot 2 — mesure de la précision
```

> 📄 Les téléchargements sont mis en cache dans `node_modules/.cache/pls-chunks/` — donc hors de
> Git, et relancer la collecte est instantané. La clé de cache porte un suffixe de version
> (`-v2`) : **l'incrémenter à chaque modification d'une requête réseau**, sinon on relit l'ancienne
> réponse sans s'en apercevoir.

---

## ✅ Les lots — le plan à suivre

À cocher au fur et à mesure. **Un lot n'est fini que quand sa colonne « Fini quand » est vraie.**

| Lot | Contenu | Fini quand | État |
|---|---|---|---|
| **0** | Spécification écrite, zone pilote figée | ce document existe et est validé | ☑ **fait** |
| **1** | `collect-chunk.mjs` : tous les champs BD TOPO + OSM + POI + géométrie + contexte → passeports bruts | 1 991 passeports produits, **taux de remplissage réel affiché pour chaque champ** | ☑ **fait** — voir [Résultats du lot 1](#-résultats-du-lot-1-mesuré-sur-la-zone-pilote) |
| **2** | `classify.mjs` + `signals.mjs` + `archetypes.json` + outils d'annotation et de calibration | **précision mesurée et écrite ici** ; liste des 16 archétypes ajustée aux vrais chiffres | 🟠 **code fait, calibration à faire** — voir [Résultats du lot 2](#-résultats-du-lot-2-classement-de-la-zone-pilote) |
| **3** | ChunkForge dans l'éditeur (sélection, tableau, revue par impact) | outil livré et vérifié de bout en bout ; reste à **passer la file** | 🟠 **outil fait** — voir [L'outil ChunkForge](#️-loutil-chunkforge) |
| **4** | Générateur : archétypes → volumes + atlas façades | le centre visible en jeu, **basculable** avec l'ancien pour comparer | ☑ **fait** — voir [Résultats du lot 4](#-résultats-du-lot-4-le-centre-ville-en-jeu) |
| **5** | Sol du chunk : MNT 2 m + matériaux depuis BD ORTHO | trottoirs, cours, parkings, pelouses distincts | ☐ |
| **6** | Monuments faits main | cathédrale, Saint-Étienne, mairie, halles (~10 assets) | ☐ |

**Les lots 1 → 4 sont le cœur.** Si à la fin du lot 4 le centre-ville ne convainc pas, on a perdu
quelques jours — pas le projet : l'ancien pipeline n'a pas bougé.

---

## 🚧 Garde-fous et pièges connus

1. **Ne jamais toucher à `geo.mjs`.** `ORIGIN` et `project()` sont partagés par tous les scripts
   hors-jeu. Les changer décale silencieusement toute la ville.
2. **Ne pas remplacer les emprises OSM par celles de la BD TOPO.** Routes, collisions et minimap
   sont calées dessus, et les deux jeux se recouvrent à 98,7 % — le gain ne vaut pas la casse.
3. **La donnée IGN aberrante existe.** La cathédrale est dans la BD TOPO avec 4 068 m² au sol et
   `hauteur = 0,1 m`. Les trois garde-fous décrits dans [`04-MONDE-BEAUVAIS.md`](04-MONDE-BEAUVAIS.md)
   restent en vigueur et s'appliquent aussi ici.
4. **`h` garde son sens** (haut des murs, gouttière). Le changer casserait collisions, carte et
   minimap.
5. **Pas de `DoubleSide` sur une surface de sol.** C'est ce qui avait créé le bug d'éclairage par
   en dessous sur les routes (voir 04).
6. **Budget triangles.** Les chunks se montent en tuiles de 180 m autour du joueur ; toute
   géométrie ajoutée par bâtiment est payée ~2 000 fois. En cas de doute : texture, pas géométrie.
7. **Déterminisme.** Deux builds successifs doivent produire un JSON **identique au bit près**,
   sinon chaque régénération crée un diff Git illisible. D'où `seed` dérivé de `id`.

---

## ⛔ Ce qu'on ne fait pas

Écarté après analyse — ne pas y revenir sans raison nouvelle.

- **Le nuage de points LiDAR brut.** Classifier soi-même sol/bâti/végétation pour reconstruire les
  toits, c'est des semaines pour retrouver ce que la BD TOPO donne en une requête WFS.
- **NeRF / Gaussian Splat / Image-to-3D pour les monuments.** Un splat ne se cell-shade pas et ne
  se collisionne pas. Une modélisation Blender d'une silhouette reconnaissable fait mieux, pour un
  rendu BD.
- **La photo aérienne posée telle quelle au sol.** L'ortho sert à *analyser* (lot 5), pas à
  texturer : ça tuerait le style BD.
- **Générer les monuments.** Ils sont faits main. Une extrusion automatique ne rendra jamais la
  cathédrale crédible.

---

## 🔗 Voir aussi

- [`04-MONDE-BEAUVAIS.md`](04-MONDE-BEAUVAIS.md) — la ville, le pipeline actuel, le relief, les routes
- [`06-EDITEUR-PLS.md`](06-EDITEUR-PLS.md) — l'éditeur qui accueille ChunkForge
- [`02-ARCHITECTURE.md`](02-ARCHITECTURE.md) — où ranger le code
- [`archive/07-BEAUVAIS-REPERES-IMPORTANTS.md`](archive/07-BEAUVAIS-REPERES-IMPORTANTS.md) —
  recherches sur le vrai Beauvais, à relire avant le lot 6
