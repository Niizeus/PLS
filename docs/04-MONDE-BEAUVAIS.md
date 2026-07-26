# 🗺️ 04 — Le monde : Beauvais pour de vrai

On veut que la map soit **vraiment Beauvais**, à **échelle 1:1 complète** : on part des
**vraies données de la ville** pour placer les bâtiments, les rues, les lieux importants et
l'ambiance/le climat.

Le but gameplay de la carte est simple : Beauvais est le piège dont Chibrux doit sortir.
Les sorties routières sont bloquées par des travaux partout, donc la ville doit être à la fois
reconnaissable, explorable et frustrante à quitter.

---

## 📍 Repères réels

- **Ville** : Beauvais, préfecture de l'**Oise (60)**, région **Hauts-de-France** (ancienne **Picardie**).
- **Coordonnées (centre)** : environ **49.4295° N, 2.0808° E**.
- **Population** : ~57 000 habitants.
- **Climat** : **océanique** (doux, humide, ciel souvent gris) → parfait pour une **ambiance
  automnale/pluvieuse** caractéristique.

### Lieux emblématiques à mettre dans le jeu
- ⛪ **Cathédrale Saint-Pierre de Beauvais** — le **chœur gothique le plus haut du monde**,
  monument inratable, jamais totalement achevée : un super repère central.
- ✈️ **Aéroport de Beauvais-Tillé (BVA)** — hub low-cost, potentiel comique.
- 🏛️ Centre-ville, halles, rues piétonnes, l'Église Saint-Étienne, les bords du Thérain.
- 🚉 **Gare SNCF** et **gare routière** — lieux importants pour les routes de fuite, les dealers,
  les PNJ et les galères de transport.
- 🚓 **Commissariat** — point central du système de police / niveau de recherche.
- *(à compléter avec les lieux liés à la vie de Chibrux)*

### Lieux de gameplay déjà prévus

- Appartement de Chibrux au quartier Saint-Lucien
- Tabac
- Market de proximité
- Grand magasin
- Mairie
- 2-3 bars
- Kébabs
- Coiffeurs / barbiers
- Magasins de vêtements
- Armurier
- Rachat d'or
- Parc
- Lieu de travail
- Plan d'eau
- CBD shop
- Repaire des SDF sous le pont de Paris de Beauvais
- Dealers de la gare routière
- Aéroport
- Gare SNCF
- Commissariat

> ⚠️ Vérifiez toujours les détails sur la vraie carte (voir sources ci-dessous) plutôt que de
> se fier à la mémoire.

---

## 🧩 Quartiers (zones de la ville)

Pour travailler la ville **zone par zone** (densité de décor, palette, ambiance, gameplay), la
ville est découpée en **quartiers**. Chaque quartier est un **polygone** (contour `[x, z]` en
mètres monde) défini dans **`src/data/zones.json`** :

| Quartier | Fichier / usage |
|----------|-----------------|
| Données (contours, couleur, nom) | `src/data/zones.json` |
| Chargement + « dans quel quartier ce point ? » | `src/world/beauvais/zones.ts` (`ZONES`, `zoneAt(x, z)`) |
| Affichage du quartier courant (HUD) | `usePlayerMovement` → `playerStore.zoneName` → `Hud.tsx` |
| Visualisation sur la grande carte (M) | `mapDraw.drawZones` |

Quartiers actuels : **Centre-ville, Saint-Jean, Soie-Vauban, Saint-Just-des-Marais, Argentine**.

> ⚠️ Les contours de `zones.json` sont une **première ébauche grossière** (rectangles autour de
> la cathédrale, orientés selon la vraie géographie). Ils seront **redessinés précisément dans
> l'éditeur de carte** (prochaine étape de l'outil touche **M**). `zoneAt()` renvoie la
> **première** zone qui contient le point → le centre-ville, plus petit, est prioritaire.

---

## 🧭 D'où viennent les données de la vraie ville

### Source principale : OpenStreetMap (OSM) — gratuit et libre
OSM contient les **contours des bâtiments**, les **rues**, les **points d'intérêt** de Beauvais.

**Manières de récupérer les données :**
1. **overpass-turbo.eu** — un site où on écrit une petite requête et on **exporte en GeoJSON**
   la zone de Beauvais (bâtiments, routes...). Le plus simple pour commencer.
2. **API Overpass** — pour automatiser la récupération depuis le code.
3. **BD TOPO® de l'IGN** (données officielles françaises, gratuites) — plus précis, notamment
   pour la **hauteur des bâtiments**, si on veut aller loin.

**Ambiance / météo réelle :**
- **Open-Meteo** (API gratuite, sans clé) — météo réelle de Beauvais pour caler l'ambiance
  (pluie, ciel gris, saisons).

---

## 🏗️ Du monde réel au jeu 3D (le pipeline)

L'idée générale, étape par étape :

1. **Récupérer Beauvais à grande échelle** depuis OpenStreetMap / Overpass, avec une priorité sur
   les quartiers et lieux utiles au gameplay.
2. **Exporter en GeoJSON** les bâtiments (`building`) et les routes (`highway`).
3. **Convertir les coordonnées GPS** (latitude/longitude) en **coordonnées de la scène 3D**
   (x, z), en prenant un point de Beauvais comme "origine" (0,0) — par ex. la cathédrale.
4. **Générer les bâtiments** : chaque contour de bâtiment est un polygone → on l'**extrude**
   en hauteur (hauteur réelle si dispo dans OSM via `height` / `building:levels`, sinon estimée)
   pour créer un volume 3D.
5. **Styliser** en cell-shading (voir [Game Design](03-GAME-DESIGN.md)) : on ne cherche pas le
   réalisme, mais une **version cartoon fidèle** de la ville.
6. **Placer les lieux clés** (cathédrale, etc.) en modèles soignés faits main par-dessus la base.

> On garde ces données dans `src/world/beauvais/` (le GeoJSON + le code qui le transforme).

### 📂 État actuel du pipeline (TOUTE la commune de Beauvais)

Le pipeline couvre **toute la ville** (bbox ~7,5 km) :
**~34 000 bâtiments + ~7 000 routes + les plans d'eau** (dont le plan d'eau du Canada).

> 🧱 **Le monde est volontairement PLAT et sans texture** (remise à plat de 2026-07, voir
> [« Remise à plat »](#-remise-à-plat-du-monde-2026-07) plus bas). La **carte** reste la vraie
> donnée OSM — tracé des rues, emprises des bâtiments, largeurs, plans d'eau. C'est seulement le
> **décor** (relief, textures, mobilier détaillé, monuments faits main) qui a été retiré.

Les fichiers :

| Fichier | Rôle |
|---------|------|
| `src/world/beauvais/build-beauvais.mjs` | **Temps 1+2** : récupère OSM (bâtiments `way`+`relation`, routes, eau, verdure, murs, arbres, lampadaires) **et le relief** (altitudes via Open-Meteo). Tourne hors-jeu. ⚠️ Le relief et les murs qu'il produit ne sont **plus lus** par le jeu depuis la remise à plat. |
| `src/world/beauvais/data/beauvais-buildings.json` | Le fichier compact chargé par le jeu (bâtiments, routes, eau, limites). ~4,8 Mo. |
| `src/world/beauvais/cityData.ts` | Source unique lue par tout le monde : bâtiments, routes, eau, limites, point de spawn dégagé. |
| `src/world/beauvais/Beauvais.tsx` | **Temps 3** : extrude les bâtiments en **blocs d'une seule couleur**, par **TUILES** de 180 m montées/démontées autour du joueur. |
| `src/world/beauvais/Roads.tsx` | Routes : rubans plats d'une seule couleur, à la vraie largeur OSM, posés à `y = 0.03`. |
| `src/world/beauvais/Water.tsx` | Plans d'eau : surfaces bleues plates (`y = 0.02`). Purement visuel (on ne nage pas). |
| `src/world/beauvais/GreenAreas.tsx` | Parcs / pelouses / bois : surfaces vertes plates (`y = 0.01`), 2 teintes. |
| `src/world/beauvais/Trees.tsx` | Arbres instanciés (OSM + semés dans les bois). |
| `src/world/beauvais/Lamps.tsx` | Lampadaires instanciés (positions OSM). |
| `src/world/beauvais/collision.ts` | Grille spatiale + `isBlocked(x,z)` : empêche d'entrer dans les bâtiments. |
| `src/world/Ground.tsx` | Le **sol : un plan PLAT à l'altitude 0** couvrant toute la ville. |
| `src/ui/Minimap.tsx` + `src/ui/WorldMap.tsx` | Minimap ronde (suivi joueur) et **carte plein écran** (M) avec **zoom molette**, **déplacement** et **points de passage** (texte + icône, sauvegardés en local), via `src/ui/mapDraw.ts`. |

### 🏢 Comment on estime les hauteurs (réalisme)

À Beauvais, ~99 % des bâtiments OSM n'ont **aucune** hauteur renseignée. On estime
donc dans `build-beauvais.mjs`, par ordre de fiabilité :
1. **vraie donnée OSM** si présente (`height`, `building:levels`) ;
2. **type de bâtiment** (`cathedral` → 45 m, `church` → 22 m, `garage` → 3 m, `apartments` plus haut...) ;
3. sinon, **surface au sol** (une grande emprise = souvent plus haut : de ~3 m pour une
   annexe à ~15 m pour un gros immeuble), **+ une variation déterministe** (±2 m) pour
   éviter que tous les toits soient à la même hauteur.

> Le résultat vise une silhouette crédible (médiane ~6 m, cathédrale dominante), pas une
> hauteur exacte au mètre près. Pour plus de précision un jour : **BD TOPO® de l'IGN**.

**Régénérer / agrandir la zone :**
1. Ouvre `build-beauvais.mjs`, change `BBOX` (et au besoin `ORIGIN`).
2. Lance : `node src/world/beauvais/build-beauvais.mjs` (retélécharge depuis OSM).
3. Le fichier compact est réécrit ; le jeu le prend au prochain lancement.

### ⚡ Optimisations en place

À l'échelle de toute la ville (~34 000 bâtiments), plusieurs optimisations rendent le
jeu fluide :

- **Streaming des tuiles** (`Beauvais.tsx`) : on ne construit et n'affiche QUE les tuiles
  autour du joueur (le brouillard masque déjà au-delà de ~110 m). Elles se montent/démontent
  quand le joueur se déplace → chargement quasi instantané, peu de géométrie à l'écran.
- **Ombres qui suivent le joueur** (`Lights.tsx`) : la zone d'ombre reste petite (~70 m
  autour du perso) au lieu de couvrir toute la ville.
- **Minimap** (`Minimap.tsx`) : ne dessine que les bâtiments proches, récupérés via la grille
  spatiale (`collision.buildingsNear`), au lieu de parcourir les 34 000.
- **Grande carte M** (`WorldMap.tsx`) : la ville (statique) est pré-rendue **une seule fois**
  dans un canvas hors-écran, puis recopiée chaque image → ouverture instantanée.

> ⏳ **Reste à faire** (opti secondaire) : le fichier compact (~4,8 Mo) est encore **embarqué
> dans le bundle**. Le charger en **asset** (fetch au démarrage) allègerait le JS. Un vrai
> **LOD** (silhouettes simplifiées au loin) serait le prochain gain si on agrandit encore.

### Stratégie retenue

- **Base fidèle et automatique** : générer la ville depuis OSM pour garder la vraie topologie,
  les routes, les bâtiments et l'échelle 1:1.
- **Lieux importants faits main** : retravailler à la main les endroits utiles au gameplay
  (appartement, mairie, commissariat, gare, aéroport, travail, bars, pont de Paris, etc.).
- **Travaux comme barrière de jeu** : les sorties routières doivent être bloquées par des travaux,
  ce qui justifie que le joueur ne puisse pas quitter Beauvais en voiture malgré la carte ouverte.

---

## ✅ Prochaines actions concrètes (map)
- [ ] Définir le périmètre exact de Beauvais jouable à échelle 1:1.
- [x] Faire un premier export de test depuis Overpass. *(fait : quartier cathédrale)*
- [x] Écrire le convertisseur GPS → scène 3D dans `src/world/beauvais/`. *(build-beauvais.mjs)*
- [x] Prototype : afficher les bâtiments extrudés d'un quartier. *(Beauvais.tsx)*
- [x] Étendre à TOUTE la commune (~7,5 km, ~34 000 bâtiments). *(BBOX dans build-beauvais.mjs)*
- [x] Plans d'eau (dont le plan d'eau du Canada). *(Water.tsx)*
- [x] Optimisation : streaming des tuiles autour du joueur. *(Beauvais.tsx)*
- [x] Optimisation : ombres qui suivent le joueur. *(Lights.tsx)*
- [x] Optimisation : minimap + carte allégées. *(Minimap/WorldMap/mapDraw)*
- [x] Inclure les bâtiments en relation (multipolygones) + cours intérieures. *(build-beauvais.mjs)*
- [x] Routes plus propres (rubans continus). *(Roads.tsx)*
- [x] Collision caméra (elle ne traverse plus les bâtiments). *(FollowCamera.tsx)*
- [x] Habillage : verdure/parcs, arbres, lampadaires. *(GreenAreas/Trees/Lamps)*
- [x] **Découpage en quartiers** (zones) : `zones.json` + `zoneAt()` + nom du quartier au HUD + contours sur la carte. *(zones.ts, Hud, mapDraw)*
- [x] **Remise à plat du monde** : relief supprimé, décor réduit à des blocs sans texture. *(voir la section dédiée plus bas)*
- [ ] **Relief** : à refaire un jour, mais **une seule fois et proprement** — une source, une fonction `terrainHeight()`, et le sol affiché qui renvoie exactement la même surface.
- [ ] Repères à la main : cathédrale soignée, ancienne prison, etc. (pas dans OSM → modélisation manuelle).
- [ ] (Option) Ajouter les 9 tours / châteaux d'eau `man_made` d'OSM comme repères.
- [ ] (Gros) Contours BD (cell-shading) en post-traitement — le vrai look cartoon.
- [ ] Optimisation restante : charger le JSON en asset (fetch) au lieu de l'embarquer.
- [ ] Routes/eau sur la minimap (déjà sur la grande carte).
- [ ] Placer la cathédrale comme repère central (modèle fait main par-dessus la base auto).
- [x] Spawn dégagé DEVANT la cathédrale (point le plus ouvert). *(cityData.SPAWN)*
- [x] Hauteurs réalistes (type + surface + variation). *(build-beauvais.mjs)*
- [x] Façades + toits colorés de façon variée. *(Beauvais.tsx)*
- [x] Sol couvrant toute la zone générée. *(CityGround)*
- [x] Minimap ronde + carte (M). *(ui/Minimap, ui/WorldMap)*
- [x] Ajouter les routes (`highway`) au générateur. *(Roads.tsx)*
- [x] Collisions (empêcher de traverser les bâtiments). *(collision.ts)*
- [ ] Routes sur la minimap / la carte.
- [ ] Toits en pente + cours intérieures (relations OSM) pour plus de précision.
- [ ] Optimisation : découpage en tuiles + LOD (quand on agrandira la ville).
- [ ] Placer les premières zones utiles : appartement Saint-Lucien, gare, mairie, commissariat,
  lieu de travail.
- [ ] Bloquer les sorties routières avec des zones de travaux.

---

## 🔗 Sources
- OpenStreetMap : https://www.openstreetmap.org
- Overpass Turbo (export GeoJSON) : https://overpass-turbo.eu
- IGN / Géoportail (BD TOPO) : https://geoservices.ign.fr
- Open-Meteo (météo réelle) : https://open-meteo.com

> 📝 Note licence : OSM est libre mais demande d'**attribuer** ("© OpenStreetMap contributors").
> On mettra cette mention dans le jeu (écran crédits).

---

## 🧱 Remise à plat du monde (2026-07)

### Pourquoi

Le monde avait accumulé une cinquantaine de composants de décor (précincts faits main, pavages
texturés, enseignes, mobilier de rue…) empilés sur un relief LiDAR chargé en plusieurs temps. Le
résultat était cassé et impossible à déboguer :

- **routes cassées** — chaque couche (bas-côté, bitume, trottoir, bordure, fissures) avait ses
  propres marges verticales, calées sur un relief qui pouvait changer en cours de partie ;
- **murs invisibles** — `collision.ts` bloque les emprises OSM de **tous** les bâtiments, mais
  l'affichage en excluait certains (monuments faits main, `CATHEDRAL_ONLY`…). Un bâtiment exclu
  de l'affichage mais pas des collisions = un mur qu'on ne voit pas ;
- **objets qui flottent ou s'enfoncent** — `terrainHeight()` empilait relief LiDAR, ponts,
  passages souterrains, rampes, places « aplanies »… chacun corrigeant le précédent.

### Ce qui a été fait

**Supprimé** : les ~48 composants de décor de `src/world/beauvais/`, le terrain LiDAR
(`lidarTerrain.ts`, `TerrainLidar.tsx`, les scripts `build-terrain-*.mjs` / `refine-terrain.mjs`,
les dalles `public/terrain/`), les murs, et toutes les corrections d'altitude de `cityData.ts`.

**Gardé, intact** : l'inventaire, le personnage et ses animations, le scooter, la minimap, la
grande carte (M), le HUD, le temps de jeu et les besoins — **et toute la donnée OSM**.

**Reconstruit en simple** : voir le tableau des fichiers plus haut.

### Les 3 règles à ne pas casser

1. **Le monde est plat.** `terrainHeight()` (`cityData.ts`) renvoie `0`, et `Ground.tsx` affiche
   un plan à `y = 0`. Ces deux-là doivent **toujours** être d'accord. Si tu remets du relief,
   change les deux ensemble — et **une seule fois**, pas couche par couche.
2. **Ce qui bloque doit être visible.** `Beauvais.tsx` affiche *tous* les bâtiments de la donnée,
   sans exception, et `collision.ts` bloque exactement les mêmes contours. Si tu exclus un
   bâtiment de l'affichage (pour le remplacer par un modèle fait main, par exemple), **exclus-le
   aussi des collisions** — sinon tu recrées un mur invisible.
3. **Une couche de sol = une hauteur.** Herbe `0.01`, eau `0.02`, routes `0.03`. Si tu ajoutes une
   couche, donne-lui sa place dans cet ordre au lieu de bricoler des marges.

### Ce qui a été archivé

Les recherches sur le vrai Beauvais (repères, monuments, enseignes, tracés de rues) restent
valables même sans le code qui les utilisait : elles sont dans **`docs/archive/`**. À relire
avant de refaire le centre-ville — mais ne les traite pas comme l'état actuel du code.
