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

> 🧱 **Le décor est volontairement minimal et sans texture** (remise à plat de 2026-07, voir
> [« Remise à plat »](#-remise-à-plat-du-monde-2026-07) plus bas). La **carte**, elle, est la
> vraie donnée : tracé des rues, emprises des bâtiments, largeurs et plans d'eau (OSM), **et le
> vrai relief de la commune** (LiDAR HD de l'IGN — voir [« Le relief »](#️-le-relief-de-beauvais)).
> Ce sont les textures, le mobilier détaillé et les monuments faits main qui ont été retirés.

Les fichiers :

| Fichier | Rôle |
|---------|------|
| `src/world/beauvais/build-beauvais.mjs` | **Temps 1+2** : recupere OSM et exporte batiments, routes, eau, verdure, murs, arbres, lampadaires. Les routes gardent aussi `highway`, `name`, `ref`, `lanes`, `oneway`, `service`, `bridge`, `tunnel`, `layer` pour les fusions de chaussee. Tourne hors-jeu. La grille Open-Meteo produite n'est plus lue : le relief vient de l'IGN. |
| `src/world/beauvais/build-terrain-global.mjs` | Télécharge le **relief LiDAR HD de l'IGN** pour toute la commune → `public/terrain/global.png`. Tourne hors-jeu. |
| `src/world/beauvais/terrain.ts` | Charge cette carte et l'échantillonne : **source unique de la hauteur du sol**. |
| `src/world/beauvais/data/beauvais-buildings.json` | Le fichier compact charge par le jeu (batiments, routes enrichies, eau, limites). ~5,5 Mo. |
| `src/world/beauvais/cityData.ts` | Source unique lue par tout le monde : bâtiments, routes, eau, limites, point de spawn dégagé. |
| `src/world/beauvais/Beauvais.tsx` | **Temps 3** : extrude les bâtiments en **blocs d'une seule couleur**, par **TUILES** de 180 m montées/démontées autour du joueur. |
| `src/world/beauvais/Roads.tsx` | Routes : rubans en volume par tuiles depuis `roadway.ts`. Les cotes interieurs fusionnes sont rendus en bitume, et les routes ne recoivent pas les ombres dures des batiments. Surface fusionnee : `road-surface-test.json` couvre maintenant toute la ville en tuiles de 180 m. Chaque tuile est rendue autour du joueur, retessellee en petits triangles pour suivre le relief, possede un bord vertical visible, et les rubans classiques ne sont caches que sous les polygones experimentaux reels afin de garder une route visible si la surface de test rate une zone. |
| `src/world/beauvais/Water.tsx` | Plans d'eau : surfaces bleues plates (`y = 0.02`). Purement visuel (on ne nage pas). |
| `src/world/beauvais/GreenAreas.tsx` | Parcs / pelouses / bois : surfaces vertes plates (`y = 0.01`), 2 teintes. |
| `src/world/beauvais/Trees.tsx` | Arbres instanciés (OSM + semés dans les bois). |
| `src/world/beauvais/Lamps.tsx` | Lampadaires instanciés (positions OSM). |
| `src/world/beauvais/ScaleReferences.tsx` | Reperes d'echelle pres du spawn : place de stationnement, bornes et jauge a hauteur humaine. |
| `src/world/beauvais/collision.ts` | Grille spatiale + `isBlocked(x,z)` : empêche d'entrer dans les bâtiments. |
| `src/world/beauvais/debug-road-geometry.mjs` | Outil hors-jeu : genere `public/debug/road-geometry.html` et `data/road-surface-test.json`. La V2 compare les rubans actuels a une surface de chaussee fusionnee par polygones (`polygon-clipping`) et exporte les surfaces de toute la ville en tuiles streamables, avec un panneau de diagnostic prioritaire sur le centre-ville. Commande : `npm run debug:roads`. |
| `src/world/Ground.tsx` | Le **sol avec son vrai relief**, affiché en dalles de 256 m autour du joueur. |
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
- **Routes coherentes** (`roadway.ts` + `Roads.tsx`) : `roadway.ts` garde la surface physique et detecte les voies proches a fusionner. `Roads.tsx` dessine des rubans continus. Les carrefours complexes ne doivent plus etre corriges directement en 3D sans validation : `npm run debug:roads` genere d abord une vue 2D pour verifier axes, largeurs et noeuds.
- **Grande carte M** (`WorldMap.tsx`) : la ville (statique) est pré-rendue **une seule fois**
  dans un canvas hors-écran, puis recopiée chaque image → ouverture instantanée.

> ⏳ **Reste à faire** (opti secondaire) : le fichier compact ville (~5,5 Mo) et la surface de route tuilée (~6,7 Mo) sont encore **embarques
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
- [x] Routes plus propres : metadonnees OSM, fusion physique des voies proches et rendu ruban corrige. *(build-beauvais.mjs, roadway.ts, Roads.tsx)*
- [x] Outil de diagnostic 2D des carrefours avant nouvelle passe 3D, avec comparaison rubans actuels / surface fusionnee et cible centre-ville. *(debug-road-geometry.mjs, `npm run debug:roads`, `polygon-clipping`)*
- [x] Surface fusionnee et tuilée sur toute la ville, avec triangles orientes vers le haut, retessellation de hauteur, bord vertical et masque limite aux polygones reels. *(road-surface-test.json, debug-road-geometry.mjs, Roads.tsx, roadway.ts)*
- [ ] Etendre la generation de surfaces aux carrefours valides apres retour visuel en jeu.
- [x] Collision caméra (elle ne traverse plus les bâtiments). *(FollowCamera.tsx)*
- [x] Habillage : verdure/parcs, arbres, lampadaires. *(GreenAreas/Trees/Lamps)*
- [x] **Découpage en quartiers** (zones) : `zones.json` + `zoneAt()` + nom du quartier au HUD + contours sur la carte. *(zones.ts, Hud, mapDraw)*
- [x] **Remise à plat du monde** : décor réduit à des blocs sans texture. *(voir la section dédiée plus bas)*
- [x] **Relief réel de TOUTE la commune** (LiDAR HD de l'IGN) : une source, une fonction `terrainHeight()`, et un sol affiché qui décrit exactement la même surface. *(voir « Le relief de Beauvais »)*
- [ ] Repères à la main : cathédrale soignée, ancienne prison, etc. (pas dans OSM → modélisation manuelle).
- [ ] (Option) Ajouter les 9 tours / châteaux d'eau `man_made` d'OSM comme repères.
- [ ] (Gros) Contours BD (cell-shading) en post-traitement — le vrai look cartoon.
- [ ] Optimisation restante : charger le JSON en asset (fetch) au lieu de l'embarquer.
- [ ] Routes/eau sur la minimap (déjà sur la grande carte).
- [ ] Placer la cathédrale comme repère central (modèle fait main par-dessus la base auto).
- [x] Spawn dégagé DEVANT la cathédrale (point le plus ouvert). *(cityData.SPAWN)*
- [x] Reperes d'echelle pres du spawn : voiture 4 m, place de stationnement, bornes et hauteur humaine. *(ScaleReferences.tsx)*
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
1. **Deux hauteurs, deux usages.** `terrainHeight()` (`cityData.ts`) decrit le relief nu et doit
   rester coherent avec le sol affiche (`Ground.tsx`). `groundHeight()` (`roadway.ts`) decrit la
   surface praticable finale : relief ou dessus de chaussee, selon le point. Tout ce qui se deplace
   ou se pose en jeu (joueur, vehicules, pickups, reperes) doit utiliser `groundHeight()` - jamais
   de hauteur en dur. Detail, pieges et verification chiffree : voir la section Le relief de Beauvais.
   Les surfaces experimentales de route echantillonnent aussi le relief autour du point pour eviter un bitume enterre dans les bosses. Les collisions de deplacement sont testees en sous-pas et avec une empreinte au sol simplifiee,
   afin que les vehicules rapides ne traversent pas les facades entre deux frames.
2. **Ce qui bloque doit être visible.** `Beauvais.tsx` affiche *tous* les bâtiments de la donnée,
   sans exception, et `collision.ts` bloque exactement les mêmes contours. Si tu exclus un
   bâtiment de l'affichage (pour le remplacer par un modèle fait main, par exemple), **exclus-le
   aussi des collisions** — sinon tu recrées un mur invisible.
3. **Une couche de sol = une entrée dans `groundLayers.ts`.** Ce fichier est la source unique de
   l'empilement (hauteur + rang de profondeur) : herbe, bois, eau, routes. Si tu ajoutes une
   couche, donne-lui sa place **là** et nulle part ailleurs. **Deux surfaces colorées différemment
   ne doivent jamais être à la MÊME hauteur sans les départager** — voir juste en dessous.

### ⛰️ Le relief de Beauvais

Les altitudes viennent du **LiDAR HD de l'IGN** (le modèle numérique de terrain officiel
français), pré-téléchargées par `build-terrain-global.mjs` dans **`public/terrain/global.png`** :
une grille de **1751 × 1626 nœuds tous les 8 m**, soit 14 × 13 km — toute la commune et au-delà.
Le fichier fait 3,6 Mo et se charge en **186 ms**.

C'est le vrai relief : la cathédrale est à **69,9 m NGF** (réel ~67 m), la gare plus bas dans la
vallée du Thérain à **64,4 m**, et la carte va de **53 à 175 m** — 122 m de dénivelé entre le
fond de vallée et les coteaux.

**Les trois règles qui empêchent le bug de 2026-07 de revenir** (le relief chargé en deux temps
qui faisait « plonger » routes et pelouses — voir la section suivante) :

1. **UNE seule carte.** Un fichier, une résolution. Pas de second niveau de détail qui viendrait
   contredire le premier. ⚠️ Les 182 dalles 2 m de l'ancienne version n'ont **pas** été
   restaurées, et c'est délibéré.
2. **Chargée AVANT tout affichage.** `World.tsx` attend `loadTerrain()` avant de monter quoi que
   ce soit. `terrainHeight()` est donc **figée pour toute la partie** : tout le décor, qui
   construit sa géométrie une seule fois au montage, lit forcément la bonne hauteur.
3. **Une seule façon d'échantillonner.** `sampleHeight()` interpole **dans le triangle**
   (barycentrique), avec le même découpage que le maillage affiché — surtout **pas** en
   bilinéaire, qui décrit une surface courbée passant à côté des triangles.

**Vérifié, pas supposé** : on reconstruit une vraie dalle de maillage, on cherche par force brute
le triangle qui contient chacun de 20 000 points au hasard, et on compare avec `terrainHeight()`.

| | Écart maximal avec le sol affiché |
|---|---|
| `sampleHeight()` (barycentrique, retenu) | **8·10⁻¹⁴ m** ✅ |
| interpolation bilinéaire (ancienne méthode) | **0,135 m** — l'ordre de grandeur qui enfonçait les routes |

**Comment chaque couche se pose dessus :**

| Couche | Méthode | Pourquoi |
|---|---|---|
| Sol (`Ground.tsx`) | dalles de 256 m autour du joueur | 2,8 M de nœuds : impossible en un seul maillage |
| Bâtiments | altitude au centre de l'emprise + jupe enterrée de 8 m | un bâtiment a un sol horizontal ; mesuré, 99 % des emprises varient de moins de 3,2 m |
| Routes | segments densifiés à 8 m, chaque bord à sa propre altitude | une rue OSM peut être un segment droit de 200 m : sans découpe, elle ferait un pont |
| Verdure / eau | découpe **pilotée par l'erreur** (`conformToTerrain`) | découper « tous les 10 m » donnait 1,2 M de triangles ; viser 0,35 m d'erreur en donne 124 k, en mieux |

> ⚠️ **Le piège de la verdure.** Une zone verte d'OSM couvre en médiane 2,5 m de dénivelé, et
> jusqu'à **76 m** pour les grands bois de coteau : posée à plat, elle tranche la colline. D'où
> la découpe adaptative. Le réglage du garde-fou est mesuré : à 4 000 triangles par polygone,
> cinq bois plafonnaient avec 7,3 m d'écart ; à 30 000, plus aucun ne plafonne et l'écart maximal
> tombe à **0,62 m**, pour 13 % de triangles en plus.

> 📝 **Simplification assumée** : l'eau suit le relief au lieu d'être horizontale. Une vraie
> surface d'eau est plane, mais tant qu'on ne creuse pas les berges, une nappe plane flotterait
> au-dessus d'un bord et s'enfoncerait sous l'autre. Coller au sol est le moindre mal.

**Régénérer le relief** (si on agrandit la zone) : `node src/world/beauvais/build-terrain-global.mjs`
— nécessite `npm install` (le script utilise `geotiff` et `pngjs`, des dépendances de dev).

### 🔦 Pourquoi le sol ne clignote pas (et comment ne pas le recasser)

Un sol plat qui scintille quand le joueur bouge, c'est presque toujours l'une de ces deux causes.
Les deux sont corrigées ; si le scintillement revient, commence par regarder ici.

**1. La grille d'ombre qui glisse** (`src/core/Lights.tsx`). La zone d'ombre suit le joueur pour
rester petite et nette. Mais l'ombre est calculée dans une petite texture : si cette zone se
déplace en continu, sa grille de texels glisse sous le décor et les mêmes points du sol basculent
à chaque image entre « à l'ombre » et « éclairé » → la route clignote.
`snapShadowCenter()` arrondit donc le centre de la zone à un **multiple d'un texel** (3,4 cm) :
la grille reste alignée sur le monde. Vérifié : avant, un point fixe du monde se décalait de
**0,499 texel** ; après, de **0,000**. La direction du soleil, elle, ne bouge pas (dérive `1e-16`).
S'y ajoute `shadow-normalBias` : le matin et le soir le soleil est rasant, et sans cette marge une
grande surface plate se raye d'ombres parasites.

> ⚠️ `SHADOW_HALF` et `SHADOW_MAP` servent à la fois au calcul du texel **et** au JSX
> (`shadow-camera-*`, `shadow-mapSize`). Si tu changes la taille de la zone d'ombre ou la
> résolution, change la constante — ne réécris pas les nombres en dur dans le JSX, sinon le
> calage se fait sur un texel qui n'existe pas et le scintillement revient.

**2. Deux surfaces exactement à la même hauteur.** C'est la SEULE configuration qui clignote
vraiment. Mesuré en rendant deux surfaces l'une sur l'autre et en comptant les pixels volés :

| Écart entre les deux surfaces | Pixels volés | Images qui changent |
|---|---|---|
| 0 cm | 100 % | 25/39 → **ça clignote** |
| 0,5 cm | 99,9 % | 8/39 → ça clignote |
| **1 cm et plus** | **0 %** | 0/39 → stable |
| n'importe lequel + `polygonOffset` | **0 %** | 0/39 → stable |

Testé aussi jusqu'à 6 km de l'origine et avec un sol en un seul quad de 12 km : **aucun effet**.
Autrement dit, écarter les couches d'un centimètre suffit, et il est inutile de subdiviser le sol.
Les deux vrais cas de coplanarité trouvés dans la donnée :

- **26 bois tracés à l'intérieur d'une pelouse** → deux verts différents à la même altitude.
  Réglé par le classement de `groundLayers.ts` (`polygonOffset`).
- **81 rues dont le ruban se replie sur lui-même** (virages en épingle) → la route se recouvre
  elle-même. Réglé par le sens des triangles, ci-dessous.

**3. Le sens des triangles (`side`).** Une surface vue « de dos » n'est pas juste invisible : avec
`DoubleSide`, la carte graphique **retourne sa normale**, et la surface se retrouve éclairée PAR
EN DESSOUS — donc sombre. Deux surfaces coplanaires de sens opposés ont alors des couleurs
différentes, et clignotent l'une sur l'autre. C'était le cas des routes : **la totalité du réseau
était à l'envers** (59 008 triangles sur 59 118), donc éclairé par en dessous, et les 110 triangles
restants — les replis d'épingle — clignotaient par-dessus.

Désormais : routes, verdure et eau sont toutes en **face avant uniquement** (`side` par défaut),
avec un sens de triangles homogène (routes 99,83 % à l'endroit, les 0,17 % de replis étant
simplement écartés). ⚠️ Ne remets pas `DoubleSide` sur une surface de sol « pour être tranquille » :
c'est précisément ce qui a créé le bug.

### 🏢 Pourquoi les immeubles ne sont plus « posés sur les routes »

Symptôme : du bitume qui entrait sous un immeuble, et des routes qui mouraient contre un mur.

**Ce n'est PAS un décalage de données** — c'était la première hypothèse, elle est fausse.
Bâtiments et routes passent par le même `project()`, et seuls **0,40 %** des points de route
tombent dans un bâtiment. Les vraies voies de circulation (primaire, secondaire, tertiaire,
nationale, autoroute) sont à **0,0 %** : zéro chevauchement. Tout était concentré sur les chemins
piétons (5,2 % des voies concernées), les escaliers (10,8 %) et les allées de service (2,6 %).

Deux causes, deux correctifs dans `Roads.tsx` :

1. **Les chemins piétons étaient peints en bitume.** OSM cartographie 1 671 `footway` / `path` /
   `steps` / `cycleway` à Beauvais, et ils vont jusqu'aux PORTES des immeubles — d'où les
   « routes » qui s'arrêtent au pied des bâtiments. C'est une régression de la remise à plat :
   l'ancien `Roads.tsx` les filtrait déjà. Filtre rétabli (`MIN_DRIVABLE_WIDTH`). ⚠️ Les rues
   piétonnes du centre sont des `pedestrian` de 5 m : elles **restent**.
2. **Le reste traverse vraiment des bâtiments** (passages couverts, allées de cour). On ne peint
   donc plus la chaussée à l'intérieur d'un bâtiment, via `clipToOutside()` — qui s'appuie sur
   **`isBlocked()`, la même fonction qui arrête le joueur**. La chaussée est peinte exactement là
   où on peut circuler (c'est la règle n°2 appliquée dans l'autre sens).

Mesuré sur la donnée réelle :

| | Voies peintes | Surface peinte sur un bâtiment | Extrémités mourant dans un bâtiment |
|---|---|---|---|
| Avant | 7 066 | 0,273 % | 158 |
| + filtre piétons | 5 395 | 0,208 % | 83 |
| + découpe aux bâtiments | 5 400 | **0,080 %** | **0** |

Coût : ~120 ms une seule fois au montage, et +1 % de sommets (on n'affine la découpe qu'aux
segments qui touchent réellement un bâtiment). Les 0,080 % restants sont la largeur du ruban qui
déborde légèrement sous un mur quand l'axe de la rue longe la façade — invisible, puisque le
bâtiment est un bloc plein dessiné par-dessus.

> 💡 Piste si on veut aller plus loin un jour : `build-beauvais.mjs` n'exporte que la **largeur**
> de chaque voie, pas son type OSM. On déduit donc « piéton » de la largeur. Exporter `highway`
> dans le JSON rendrait ce filtre explicite — et permettrait de dessiner les trottoirs dans une
> teinte à part au lieu de les jeter.

### Ce qui a été archivé

Les recherches sur le vrai Beauvais (repères, monuments, enseignes, tracés de rues) restent
valables même sans le code qui les utilisait : elles sont dans **`docs/archive/`**. À relire
avant de refaire le centre-ville — mais ne les traite pas comme l'état actuel du code.
