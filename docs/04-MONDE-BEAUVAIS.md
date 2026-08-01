# 🗺️ 04 — Le monde : Beauvais pour de vrai

On veut que la map soit **vraiment Beauvais**, à **échelle 1:1 complète** : on part des
**vraies données de la ville** pour placer les bâtiments, les rues, les lieux importants et
l'ambiance/le climat.

**Statut : source principale pour Beauvais.** Ce document regroupe la vision de la ville, les
quartiers, les lieux, le pipeline de carte et les garde-fous du monde. Il contient aussi des notes
techniques importantes ; si elles deviennent trop nombreuses, elles pourront être séparées dans une
doc technique du monde.

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
| Annonce du quartier à l'entrée (HUD) | `usePlayerMovement` → `playerStore.zoneName` → `ui/ZoneToast.tsx` (s'affiche ~3 s puis s'efface ; consultable à tout moment dans le téléphone) |
| Visualisation sur la grande carte (M) | `mapDraw.drawZones` |

Structure gameplay validée : **4 grands quartiers rivaux + le centre-ville**.

- **Centre-ville** : zone municipale, contrôlée par la ville, la police et les autorités ;
- **Saint-Jean** ;
- **Soie-Vauban** ;
- **Saint-Just-des-Marais** ;
- **Argentine**.

Le centre-ville n'est pas un territoire de gang. Il sert de zone plus surveillée : si des groupes
rivaux viennent y traîner, s'affronter ou provoquer le chaos, la police intervient plus vite et plus
fort. Les quatre autres quartiers peuvent porter des rivalités locales, des PNJ liés au territoire,
des ambiances propres, des points chauds et des réactions différentes aux actions de Chibrux.

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
3. **BD TOPO® de l'IGN** (données officielles françaises, gratuites) — ✅ **en place** : c'est
   elle qui fournit la **hauteur réelle des bâtiments** et de leurs toits. Voir plus bas.

**Ambiance / météo réelle :**
- **Open-Meteo** (API gratuite, sans clé) — météo réelle de Beauvais pour caler l'ambiance
  (pluie, ciel gris, saisons).

---

## 🏗️ Du monde réel au jeu 3D (le pipeline)

> 🔜 **Ce pipeline va être doublé, quartier par quartier, par ChunkForge** — un système qui déduit
> *ce qu'est* chaque bâtiment (16 archétypes beauvaisiens, avec un % de confiance) pour en générer
> un volume et des façades crédibles, au lieu d'un volume peint en aplat. La spécification complète
> est dans [`08-CHUNKFORGE.md`](08-CHUNKFORGE.md) ; zone pilote : carré de ±400 m autour de la
> cathédrale. **Rien n'est supprimé ici** : le pipeline ci-dessous reste en service partout où
> aucun chunk n'est publié.

L'idée générale, étape par étape :

1. **Récupérer Beauvais à grande échelle** depuis OpenStreetMap / Overpass, avec une priorité sur
   les quartiers et lieux utiles au gameplay.
2. **Exporter en GeoJSON** les bâtiments (`building`) et les routes (`highway`).
3. **Convertir les coordonnées GPS** (latitude/longitude) en **coordonnées de la scène 3D**
   (x, z), en prenant un point de Beauvais comme "origine" (0,0) — par ex. la cathédrale.
4. **Générer les bâtiments** : chaque contour de bâtiment est un polygone → on monte ses **murs**
   jusqu'à la hauteur réelle mesurée par l'**IGN**, puis on pose un **toit en pente** par-dessus.
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
| `src/world/beauvais/build-beauvais.mjs` | **Temps 1+2** : recupere OSM et exporte batiments, eau, verdure, murs, arbres, lampadaires — puis **remplace les routes OSM par celles de l'IGN** (voir `bdtopoRoads.mjs`). Tourne hors-jeu. La grille Open-Meteo produite n'est plus lue : le relief vient de l'IGN. |
| `src/world/beauvais/bdtopoRoads.mjs` | Télécharge les **routes mesurées de la BD TOPO IGN** (`troncon_de_route`) et les traduit en `Road`. Donne la **largeur réelle** de chaque chaussée, la **classe d'usage** (`drivable` / `pedestrian` / `service` / `track`) et les noms de rues. Tourne hors-jeu. Voir [« Les routes »](#-les-routes-viennent-de-lign-pas-dosm). |
| `src/world/beauvais/data/road-overrides.json` | **Retouches manuelles** des routes, indexées par `cleabs` IGN. Jamais réécrit par le build : les corrections survivent à une régénération complète. |
| `src/world/beauvais/geo.mjs` | L'**origine du monde** (la cathédrale), l'emprise `BBOX` et la projection GPS → mètres. Partagé par tous les scripts hors-jeu : une seule définition, sinon tout se décale. |
| `src/world/beauvais/bdtopo.mjs` | Télécharge les **hauteurs réelles de la BD TOPO IGN** et les greffe sur les contours OSM. Contient les garde-fous anti-donnée-aberrante. Tourne hors-jeu. |
| `src/world/beauvais/roofs.mjs` | Calcule l'**orientation du faîtage** de chaque toit (détection des murs mitoyens) et plafonne les pentes. Tourne hors-jeu. |
| `src/world/beauvais/update-heights-ign.mjs` | Met à jour **uniquement** les hauteurs et les toits du fichier déjà généré, sans retélécharger OSM. Diff Git minuscule. Tourne hors-jeu. |
| `src/world/beauvais/buildingMesh.ts` | Fabrique le volume d'**un** bâtiment : murs jusqu'à la gouttière + toit en pente + pignons. Couleur de toit selon le matériau réel. |
| `src/world/beauvais/build-terrain-global.mjs` | Télécharge le **relief LiDAR HD de l'IGN** pour toute la commune → `public/terrain/global.png`. Tourne hors-jeu. |
| `src/world/beauvais/terrain.ts` | Charge cette carte et l'échantillonne : **source unique de la hauteur du sol**. |
| `src/world/beauvais/data/beauvais-buildings.json` | Le fichier compact charge par le jeu (batiments avec hauteurs et toits IGN, routes enrichies, eau, limites). ~6,4 Mo. |
| `src/world/beauvais/cityData.ts` | Source unique lue par tout le monde : bâtiments, routes, eau, limites, point de spawn dégagé. |
| `src/world/beauvais/tileResourceCache.ts` | Petit cache LRU partage par les tuiles de rendu et de physique : il garde les geometries/colliders recents pour eviter les hitches quand le joueur revient sur ses pas, puis libere les ressources inactives au-dela d'un plafond. |
| `src/world/beauvais/Beauvais.tsx` | **Temps 3** : monte/démonte les bâtiments par **TUILES** de 180 m autour du joueur (la forme d'un bâtiment, elle, est faite par `buildingMesh.ts`). Saute la cathédrale, qui a son propre modèle. |
| `src/world/beauvais/Cathedral.tsx` | La **cathédrale Saint-Pierre**, affichée en permanence (repère central, visible de loin). Voir « La cathédrale » plus bas. |
| `src/world/beauvais/cathedralMesh.ts` | Construit son maillage : masses étagées, toit, contreforts, arcs-boutants, verrières, rosaces. |
| `src/world/beauvais/footprintField.ts` | Outil de géométrie : champ de distance d'une emprise + extraction de contours (« marching squares »). Sert à rétrécir une emprise pour en tirer les masses hautes. Fournit aussi `orientRing()`, partagé avec `buildingMesh.ts`. |
| `src/world/beauvais/meshBuilder.ts` | Petite boîte à outils pour bâtir un décor à la main (murs, surfaces, prismes, pinacles, plaques murales, poutres courbes) en couleur par sommet, sans se tromper de sens de face. |
| `src/world/beauvais/Roads.tsx` | Routes : rubans en volume par tuiles depuis `roadway.ts`. Les cotes interieurs fusionnes sont rendus en bitume, et les routes ne recoivent pas les ombres dures des batiments. Surface fusionnee : `road-surface-test.json` couvre maintenant toute la ville en tuiles de 180 m. Chaque tuile est rendue autour du joueur, retessellee en petits triangles pour suivre le relief, possede un bord vertical visible, et les rubans classiques ne sont caches que sous les polygones experimentaux reels afin de garder une route visible si la surface de test rate une zone. |
| `src/world/beauvais/Water.tsx` | Plans d'eau : surfaces bleues plates (`y = 0.02`). Purement visuel (on ne nage pas). |
| `src/world/beauvais/GreenAreas.tsx` | Parcs / pelouses / bois : surfaces vertes plates (`y = 0.01`), 2 teintes. |
| `src/world/beauvais/Trees.tsx` | Arbres instanciés (OSM + semés dans les bois). |
| `src/world/beauvais/Lamps.tsx` | Lampadaires instanciés (positions OSM). |
| `src/world/beauvais/ScaleReferences.tsx` | Reperes d'echelle pres du spawn : place de stationnement, bornes et jauge a hauteur humaine. |
| `src/world/beauvais/collision.ts` | Grille spatiale + `isBlocked(x,z)` : empêche d'entrer dans les bâtiments. |
| `src/world/beauvais/debug-road-geometry.mjs` | Outil hors-jeu : genere `public/debug/road-geometry.html` et `data/road-surface-test.json`. La V2 compare les rubans actuels a une surface de chaussee fusionnee par polygones (`polygon-clipping`) et exporte les surfaces de toute la ville en tuiles streamables, avec un panneau de diagnostic prioritaire sur le centre-ville. Commande : `npm run debug:roads`. |
| `src/world/Ground.tsx` | Le **sol avec son vrai relief**, affiché en dalles de 256 m autour du joueur. |
| `src/ui/Minimap.tsx` + `src/ui/WorldMap.tsx` | Minimap ronde (suivi joueur) et **carte plein écran** (M) avec **zoom molette**, **déplacement**, POI de `mapMarkers.json` et **points de passage** locaux (texte + icône), via `src/ui/mapDraw.ts`. Le type et la sauvegarde des points de passage vivent dans `gameplay/map/waypoints.ts` (partagés avec l'app GPS du téléphone). |
| `src/gameplay/map/destinationStore.ts` | La **destination** choisie depuis le GPS du téléphone. La minimap l'affiche : un losange doré si elle est dans le champ, une **flèche sur le bord** sinon, avec la distance restante. Le téléphone pose, la minimap montre — les deux ne se connaissent pas. |
| `src/entities/map/MapMarkerEntities.tsx` | Marqueurs 3D des points d'interet visibles en jeu, detection de proximite, prompt `E` et interaction placeholder avec prise en compte des horaires. |
| `src/gameplay/map/` | Runtime des points d'interet : filtrage dev/prod, calcul ouvert/ferme selon l'heure du jeu, store du POI proche et message d'interaction. |

### 🏢 Les hauteurs et les toits : la BD TOPO de l'IGN

**Les hauteurs ne sont plus devinées, elles sont mesurées.** Elles viennent de la
**BD TOPO® de l'IGN** (gratuite, Licence Ouverte, même serveur `data.geopf.fr` que le
relief LiDAR), obtenues par photogrammétrie et LiDAR.

Pourquoi on a changé — mesuré sur le centre-ville, l'ancienne estimation par la
surface au sol se trompait de :

| Mesure | Ancienne estimation |
|--------|---------------------|
| Erreur moyenne | **2,9 m** |
| Bâtiments faux de ≥ 3 m | **39 %** |
| Pire cas | **42 m** |

Ce qu'on récupère par bâtiment (couverture réelle sur la commune) :

| Champ | Sens | Couverture |
|-------|------|-----------|
| `h` | hauteur des **murs**, sol → gouttière | 97,5 % |
| `rh` | hauteur du **toit**, gouttière → faîtage | 74,9 % |
| `ra` | **orientation du faîtage** (radians), calculée par `roofs.mjs` | idem |
| `rm` | matériau de toiture : tuile / ardoise / zinc / béton | ~51 % |

⚠️ **`h` garde exactement le même sens qu'avant** (haut des murs) : les collisions,
la minimap et la carte ne sont donc pas affectées. On n'a pas non plus remplacé les
**contours**, qui restent ceux d'OSM — et les deux jeux de données se recouvrent à 98,7 %.
(Les **routes**, elles, ne viennent plus d'OSM du tout : voir la section suivante.)

**Les trois garde-fous** (sans eux, ça casse) :
1. **~2,5 % des bâtiments** n'ont aucune correspondance IGN → ils gardent l'ancienne
   estimation. `estimateHeight()` reste donc dans `build-beauvais.mjs` : c'est le filet.
2. **La donnée IGN aberrante est refusée.** La cathédrale Saint-Pierre est dans la
   BD TOPO avec ses 4 068 m² au sol... et `hauteur = 0,1 m`. Règle : au-delà de 150 m²
   au sol, une hauteur sous 2 m est fausse → on garde l'estimation.
3. **La pente est plafonnée à 55°.** L'IGN mesure le point le *plus haut* du toit :
   une cheminée suffit à faire croire à un toit démesuré (11 % dépassaient 60°, jusqu'à
   79°). Les monuments, eux, gardent droit à leurs flèches (80°).

#### Comment le toit est construit

On ne stocke **aucun triangle** dans le JSON — seulement `rh` et `ra`. La géométrie est
fabriquée dans le jeu par `buildingMesh.ts`, en s'appuyant sur une propriété simple :

> la hauteur d'un toit en un point ne dépend que de sa **distance au faîtage**.

Chaque point est donc mesuré le long de l'axe perpendiculaire au faîtage : la crête est
au milieu à la hauteur `rh`, les deux bords retombent à zéro, et c'est linéaire entre les
deux. Chaque versant est ainsi un plan parfait, **quelle que soit la forme du bâtiment**
(même en L). Effet de bord agréable : les murs d'extrémité montent en biais et forment
tout seuls les **pignons**.

⚠️ **À condition de couper les murs sur le faîtage.** Le profil du toit est un chapeau :
il monte jusqu'à la crête puis redescend. Un mur de pignon va d'un bord à l'autre, donc ses
deux coins sont en bas et son milieu doit culminer à `rh`. Tant qu'on reliait les deux coins
en ligne droite, **tout le triangle du pignon manquait** et on voyait l'intérieur du bâtiment
sous chaque toit. `buildingMesh.ts` insère donc un sommet là où le mur croise le faîtage
(fonction `ridgeCrossing`) — exactement comme les triangles de toit sont déjà coupés par
`splitAtRidge`. Vérification : hors du fond volontairement ouvert (la jupe enterrée), plus
aucune arête libre sur les 200 premiers bâtiments en pente.

**Nuances de toiture.** Le matériau réel (`rm`) donne la couleur de base, puis chaque toit
reçoit une variation déterministe de luminosité (± `ROOF_SHADE`) et un soupçon de température,
tirées de la position du bâtiment. Sans ça un quartier entier devient un seul aplat orange où
l'on ne distingue plus les maisons. La variation se fait **en sRGB** : en espace linéaire, ±20 %
de luminosité ne se voit quasiment pas. Les monuments (`kind`) gardent leur teinte exacte —
ce sont des repères, pas du tissu urbain.

L'orientation du faîtage suit la vraie règle d'architecture : **il est parallèle aux
façades libres, jamais aux murs mitoyens** (`roofs.mjs` détecte les murs mitoyens).
Une maison de ville est étroite sur rue et profonde : prendre bêtement son plus long
côté mettrait le faîtage en travers de la rue, l'inverse de la réalité.

**Régénérer :**
- Hauteurs et toits seulement (rapide, petit diff Git) :
  `node src/world/beauvais/update-heights-ign.mjs`
- Tout le monde (change `BBOX` / `ORIGIN` dans `geo.mjs` d'abord) :
  `node src/world/beauvais/build-beauvais.mjs` — retélécharge OSM **et** l'IGN.

### 🛣️ Les routes viennent de l'IGN, pas d'OSM

**Le problème.** Les routes venaient d'OSM et leur largeur était **devinée** par une table
`highway → mètres` (« une résidentielle, ça fait 5 m en général »). Deux défauts, et le
second est le pire :

1. La largeur était un stéréotype. Une venelle du centre et une rue de lotissement
   sortaient toutes les deux à 5 m.
2. **Routes et bâtiments ne venaient pas du même référentiel.** Les bâtiments sont levés
   par l'IGN, les routes étaient tracées à la main sur fond d'ortho par les contributeurs
   OSM → un décalage courant de 1 à 5 m. Une rue de 8 m dont l'axe est décalé de 3 m
   devient 1 m d'un côté et 7 de l'autre. C'est ça qui donnait la sensation de rues
   étranglées, bien plus que la largeur du bitume elle-même.

**La correction.** Les routes viennent maintenant de la couche `troncon_de_route` de la
BD TOPO — **même serveur WFS et même référentiel que les bâtiments**. Sur les 7 892
tronçons de la commune, 7 091 sont retenus :

| Ce que l'IGN donne | Ce que ça règle |
|---|---|
| `largeur_de_chaussee` | La largeur **mesurée** du bitume (88,1 % des tronçons retenus ; le reste, surtout des chemins, retombe sur une largeur type). |
| `nature` | Écarte franchement **776 sentiers, 353 chemins et 11 escaliers** au lieu de deviner « trop étroit, donc pas une route ». |
| `acces_vehicule_leger` | Sépare les dessertes privées des vraies rues — et voir ci-dessous. |
| `nom_collaboratif_gauche` | **923 noms de rues réels**, remis en forme lisible (`R D'ALSACE` → `Rue d'Alsace`). |

**La trouvaille.** 174 tronçons sont de *nature* « Route » (donc une vraie chaussée) mais
avec `acces_vehicule_leger = Physiquement impossible` : ce sont exactement les **rues
piétonnisées** (bornes, potelets, plots). Les zones piétonnes du centre sortent donc de la
donnée elle-même — aucune n'a été dessinée à la main.

**La classe d'usage** (`road.cls`) est la nouveauté qui compte : `drivable` (5 329),
`service` (901), `track` (687), `pedestrian` (174). Une rue piétonne et une rue de quartier
ont souvent la **même largeur** — ce qui les distingue est l'accès, pas les mètres. Le
revêtement est choisi là-dessus dans `Roads.tsx` (pavé clair, terre, bitume).

⚠️ **Ce que ça ne règle PAS.** `largeur_de_chaussee` est quantifiée au demi-mètre et vaut
5 m dans 48 % des cas : **l'IGN confirme que les rues de Beauvais font réellement ~5 m de
bitume**. Ce changement rend les largeurs *justes*, il ne les rend pas plus *grandes*.
L'impression d'étroitesse restante se joue dans l'espace **entre le bitume et la façade**
(le trottoir), qui est encore une constante `SHOULDER_W` dans `roadway.ts`.

**Corrections manuelles.** `data/road-overrides.json` permet de retoucher un tronçon
(`w`, `cls`, `name`, `skip`) par son `cleabs` IGN. Ce fichier n'est **jamais réécrit** par
le build : sans lui, chaque régénération effacerait le travail fait à la main et le
chantier tournerait en rond.

#### 🚶 Le trottoir est le COMPLÉMENT de la chaussée, pas un ruban par rue

**Le problème d'origine.** La seule partie PLATE au bord de la chaussée était le dessus de la
bordure : **35 cm**. Les 80 cm de `SHOULDER_W` sont une pente en terre qui rattrape le terrain,
pas un trottoir. Beauvais n'avait donc pratiquement pas de trottoir — et comme la sensation
d'une ville tient au rapport largeur de rue / hauteur de façade, les rues paraissaient
étranglées même avec un bitume à la bonne largeur.

**La première tentative, et pourquoi elle a été abandonnée.** Le trottoir était une bande du
ruban extrudé de chaque voie, large de ce que mesurait une perpendiculaire jusqu'à la première
façade. Trois défauts, tous structurels — aucun réglage ne les corrigeait :

- **un trou à chaque intersection.** Deux rubans qui se croisent se chevauchent ; le seul moyen
  de s'en sortir était de supprimer le trottoir dans les carrefours ;
- **des planches grises qui s'arrêtent en l'air** là où deux voies se rejoignent en biais ;
- **deux voies voisines ne tombaient pas d'accord sur le bord**, parce que chacune mesurait son
  propre couloir et le lissait de son côté.

> ⚠️ **Un trottoir est une propriété du RÉSEAU, pas d'une rue prise isolément.** C'est l'espace
> entre la chaussée et les bâtiments. Tant qu'on le construit rue par rue, il ne peut pas être
> propre.

**La méthode retenue.** On ne dessine plus le trottoir, on le **déduit** — hors-jeu, dans
`debug-road-geometry.mjs` (`npm run debug:roads`), par une soustraction de polygones :

```
trottoir = (réseau élargi de la largeur du trottoir) − (la chaussée) − (les emprises des bâtiments)
```

Les trois termes sont des polygones fusionnés avec `polygon-clipping`, exactement comme la dalle
de bitume qui existait déjà. Conséquences :

- **les carrefours sont justes par construction.** L'union de deux rues élargies couvre le coin,
  la soustraction de la chaussée ouvre le passage. Il n'y a plus de cas particulier « carrefour »
  à écrire — donc plus de trou ;
- **il n'y a qu'un seul bord**, partagé par toutes les voies qui le touchent ;
- **le trottoir s'arrête net au pied des murs** au lieu d'y rentrer.

Sortie : **1 953 tuiles de trottoir**, dans le champ `walkTiles` de `road-surface-test.json`, au
même découpage que le bitume. Un fichier produit avant ce lot n'a pas ce champ ; `Roads.tsx` le
traite alors comme « pas de trottoir » plutôt que de planter.

**La largeur reste un choix de projet.** `WALK_TARGET_RATIO` × la demi-chaussée, borné par
`WALK_TARGET_MIN` 1,2 m et `WALK_TARGET_MAX` 3 m : une avenue a de vrais trottoirs, une ruelle
non. Le rabotage par les bâtiments n'a pas disparu, il a changé de nature — c'est la
soustraction qui s'en charge, ce qui donne un bord **net** au pied du mur au lieu d'une largeur
moyennée. Le sondage de façade (`facadeDistances`) et le lissage ont donc été supprimés.

#### 🚫 Deux vetos : un trottoir possible n'est pas un trottoir réel

La soustraction seule produisait deux absurdités. Toutes deux se règlent en **interdisant un
côté**, pas en rabotant une largeur — c'est le rôle de `walkSidesAllowed()`.

**Veto n°1 — entre deux voies parallèles proches, jamais de trottoir.** Le terre-plein qui sépare
les deux chaussées d'un boulevard n'est pas du bitume : il devenait donc du trottoir, et on
avait **une bande grise en plein milieu de la route**. 20 % des segments de Beauvais ont une voie
parallèle à moins de 8 m, écart médian 3 m. Le veto s'applique tant que l'écart entre les deux
bitumes est plus petit que ce que les deux trottoirs occuperaient : en dessous, ce n'est pas un
trottoir, c'est un terre-plein.

> ⚠️ **Écarter les tronçons colinéaires.** L'IGN découpe une rue en tronçons successifs, chacun
> avec son propre index. Deux tronçons qui se suivent sont donc « une autre route », colinéaire
> et à écart négatif : le veto les prenait pour un boulevard à deux chaussées et supprimait le
> trottoir **des deux côtés de la rue**. Mesuré avant correction : **54,5 %** des déclenchements
> du veto au centre-ville étaient ce faux positif. Un vrai couple de chaussées parallèles est
> décalé latéralement ; une continuation ne l'est pas.

**Veto n°2 — pas de bâti, pas de trottoir.** Une route de campagne, une bretelle, un chemin
d'exploitation n'en ont pas. La géométrie seule ne peut pas le savoir : pour elle, une
départementale au milieu des champs ressemble à une rue. Le signal qui fait la différence est le
**bâti** — un trottoir dessert des portes. Critère retenu : 4 bâtiments distincts dans 25 m.

> ⚠️ **Le critère porte sur la RUE, pas sur le côté.** Compter les bâtiments côté par côté
> paraissait plus fin, mais c'est faux dans la ville réelle : une rue bâtie qui longe un parc,
> une place, une rivière ou un parking a bien un trottoir du côté dégagé. Mesuré au centre-ville,
> le critère par côté supprimait le trottoir de **40 %** des côtés de rue.

Les chemins de terre (`cls: track`) sont écartés d'office.

**Résultat mesuré** : **73,6 %** des côtés de voie du centre-ville (600 m) portent un trottoir,
contre **28,8 %** sur la commune entière — qui est pleine de routes rurales, de chemins et de
zones d'activité. C'est le meilleur contraste obtenu sur les réglages testés (18 à 30 m de
portée, 1 à 6 bâtiments).

**Le sol dit exactement la même chose.** On ne peut pas rejouer une soustraction de polygones à
chaque image, mais on n'en a pas besoin : la même règle s'écrit en distances dans
`roadwayHeightAt()`. Dans la dalle de bitume → chaussée (c'est le terme « − chaussée ») ; sinon,
en deçà de `walkOuterReach(half)` d'un axe → trottoir (c'est le « réseau élargi »). Le terme
« − bâtiments » n'a **volontairement** pas d'équivalent : un bâtiment est déjà un volume plein,
on ne peut pas marcher dedans.

> ⚠️ `walkOuterReach()` dans `roadway.ts` et `walkTarget()` dans `debug-road-geometry.mjs` sont
> le **même calcul écrit deux fois**, l'un pour la physique, l'autre pour le découpage. Ils
> doivent donner le même nombre pour la même voie, sinon on marche à côté du trottoir qu'on
> voit. Toute modification se fait des deux côtés, **dans le même commit**.

**⚠️ La boîte englobante n'est pas une optimisation, c'est ce qui rend la lecture possible.**
`roadwayHeightAt()` interroge maintenant deux couches de polygones. Un point HORS trottoir doit
balayer les 9 tuiles voisines en entier avant de pouvoir répondre non — le cas le plus fréquent
est donc le plus cher. Mesuré sur 106 666 points : **67 µs par appel** sans boîte englobante,
**3,4 µs avec**. `buildPolygonIndex()` précalcule donc la boîte de chaque polygone (77 ms, une
fois). Quatre comparaisons éliminent la quasi-totalité des candidats avant le lancer de rayon.
Le marquage `segPaved` coûte 850 ms de plus à la construction des routes, une seule fois.

**Ce qui a été vérifié.** Sur 6 000 points tirés à l'intérieur des polygones de trottoir :
**0,00 %** tombent dans un bâtiment, **0,20 %** sur le bitume (échardes résiduelles de
simplification, absorbées par le `polygonOffset` du matériau). Le fichier de données passe de
**6,7 à 5,6 Mo** malgré l'ajout des trottoirs, grâce à une sérialisation compacte.

> ⚠️ **Le bord intérieur du trottoir EST le bord du bitume.** Les deux dalles sont découpées sur
> le même contour, et le trottoir n'est presque pas re-simplifié (5 cm, contre 55 cm pour le
> bitume). Simplifier les deux indépendamment déplaçait le bord de part et d'autre : mesuré à
> 2,3 % de recouvrement, soit une bordure qui débordait jusqu'à un demi-mètre dans la rue.

**Ce que les rubans dessinent encore.** Le profil complet là où aucune dalle n'existe — chemins,
sentiers et voies écartées de la fusion. **Sous les dalles, ils ne dessinent plus rien du tout.**

> ⚠️ Garder l'accotement du ruban sous les dalles a été essayé, et c'est faux : il part du bord
> du TROTTOIR, alors que les vetos en suppriment un sur 71 % des côtés de voie de la commune.
> L'accotement partait donc dans le vide. **Une seule autorité par surface** — sinon les deux
> divergent, ce qui est exactement le défaut que ce lot corrige. La tranche verticale est
> fournie par les jupes des dalles.

**Coût.** La construction des routes en jeu est **plus rapide qu'avant** : le sondage de
façade, qui balayait les murs voisins de chaque point, a disparu. Le calcul est passé
hors-jeu, dans `npm run debug:roads` (~4 min pour toute la commune, à relancer uniquement
quand les routes ou les bâtiments changent).

**⚠️ Le masque de la dalle, et la règle symétrique côté physique.** `Roads.tsx` teste
`inExperimentalSurfaceZone()` sur l'**axe** de la voie ; `roadway.ts` fait le même test au
milieu de chaque segment et le retient dans `segPaved`. Là où il est vrai, **le ruban ne
dessine rien et le calcul analytique se tait** : les deux dalles font seules autorité, sur
99,3 % des segments.

> ⚠️ Piège historique, à connaître avant de retoucher cette condition : à une époque le
> masque sautait la coupe entière alors que la dalle ne dessinait que le bitume. La ville se
> retrouvait en plaques de goudron nues, sans le moindre bord. Le symptôme était trompeur,
> parce que `groundHeight()` ignorait ce masque : **la voiture sentait des trottoirs
> invisibles**. C'est pour ça que `roadwayHeightAt()` lit désormais les polygones de trottoir
> eux-mêmes plutôt qu'une règle de distance — une règle ne peut pas rejouer les vetos, et la
> moindre divergence redonne ce bug. Si tu
> vois réapparaître des bords que la physique a mais pas l'écran, c'est ici qu'il faut
> regarder — en vérifiant d'abord que `walkTiles` existe bien dans
> `road-surface-test.json`.

⚙️ Réglages dans `ROADWAY` : `WALK_TARGET_RATIO`, `WALK_TARGET_MIN`, `WALK_TARGET_MAX`.
Trottoirs trop larges ou trop étroits à ton goût ? Ce sont ces trois-là qu'il faut bouger —
**et il faut relancer `npm run debug:roads`**, sinon la physique change sans la géométrie et
tu marches à côté du trottoir. Les constantes miroir sont en tête de `buildWalkTiles`.

#### ⚠️ Le piège : `road-surface-test.json` est DÉRIVÉ des routes

La grande dalle de bitume fusionnée (`road-surface-test.json`) est fabriquée **à partir
de** `beauvais-buildings.json`. Les rubans de `Roads.tsx` ne sont masqués que **sous** cette
dalle, pour garder une route visible là où la fusion rate.

> **Régénérer la ville sans relancer `npm run debug:roads` casse tout visuellement.**

La dalle reste sur les anciennes routes pendant que les rubans suivent les nouvelles :
chaque ruban dépasse de son côté et la ville se couvre de bouts de bitume en travers.
C'est arrivé au passage d'OSM à l'IGN — les deux jeux sont décalés de 1 à 5 m, et il ne
restait que **84,5 % des axes sur la dalle** (99,5 % après régénération).

**La règle : toute modification des routes = deux commandes, dans cet ordre.**

```bash
node src/world/beauvais/build-beauvais.mjs && npm run debug:roads
```

Un garde-fou est en place : la dalle stocke l'empreinte de la ville qui l'a produite
(`sourceCity`), et `roadway.ts` gueule en `console.error` au démarrage si elle ne
correspond plus. Le symptôme est spectaculaire mais la cause était invisible dans le code.

### ⛪ La cathédrale Saint-Pierre (le seul bâtiment fait main)

Les 34 000 bâtiments de la ville passent par le même gabarit « murs + toit ». Appliqué au
**plus haut chœur gothique du monde**, ça donnait un bloc de 45 m de haut, plat sur le
dessus, au milieu de Beauvais. La cathédrale a donc son propre modèle
(`Cathedral.tsx` + `cathedralMesh.ts`), et c'est le **seul** bâtiment dans ce cas.

**Rien n'est dessiné à la main pour autant.** Le principe : on part de l'emprise réelle
d'OpenStreetMap et on la **rétrécit** pour obtenir les masses intérieures.

```
emprise réelle  →  contour à 7 m du bord  →  plan en croix ∩ emprise
chapelles 12 m     bas-côtés 25 m            vaisseau 43 m + toit à 58 m
```

- Le rétrécissement passe par un **champ de distance** (`footprintField.ts`) : pour chaque
  point, « à quelle profondeur suis-je dans le bâtiment ? ». Les contours intérieurs en
  sont extraits par *marching squares*. Conséquence : le **chevet reste arrondi** et les
  chapelles rayonnantes restent là où elles sont, sans qu'on ait à les redessiner.
- Le champ est **lissé** avant usage. Une emprise OSM est hérissée de décrochements d'un
  mètre ; en la rétrécissant telle quelle, le contour intérieur devient une dentelle en
  zigzag qui fait rater la triangulation des toits (trous). Et architecturalement, un
  vaisseau central ne reproduit pas les hoquets des chapelles.
- Le **vaisseau haut** est l'emprise croisée avec un plan en **croix** (chœur + transept)
  tracé dans le repère du monument (axe obtenu par analyse de l'emprise, ≈ 10° au sud de
  l'est). D'où les deux **pignons de transept**, chacun avec sa **rosace** de 12 m.
- Le toit, ce sont **deux toits à deux pentes qui se croisent** : on garde le plus haut des
  deux en chaque point, et ce simple `max` dessine tout seul les noues de la croisée, les
  pignons au bout des bras et la croupe du chevet.
- **Contreforts et arcs-boutants** : on avance le long du mur extérieur tous les 10,5 m ;
  à chaque station on plante un contrefort à pinacle, puis on cherche le vaisseau
  **droit derrière** pour y lancer deux volées d'arcs. Là où il n'y a pas de vaisseau
  derrière (à l'ouest), le contrefort reste bas et il n'y a pas d'arc.

Ce qui reste fidèle au vrai monument : **pas de flèche** (celle de 153 m s'est effondrée en
1573), **pas de nef** (jamais bâtie — la masse s'arrête net sur un mur droit à l'ouest),
chœur très haut, arcs-boutants rapprochés, deux rosaces de 11 m.

**Cohérence avec le reste du jeu :**
- l'emprise du niveau bas est **exactement** celle qui bloque le joueur (`collision.ts`) :
  pas de mur invisible. Seuls les contreforts débordent de ~2,6 m sans bloquer ;
- le modèle n'est **pas découpé en tuiles** : il est affiché en permanence, c'est le repère
  central de la carte. Ça ne coûte qu'un objet (~10 500 triangles) ;
- il se construit en ~30 ms, une seule fois, au chargement du monde.

### ⚡ Optimisations en place

À l'échelle de toute la ville (~34 000 bâtiments), plusieurs optimisations rendent le
jeu fluide :

- **Streaming des tuiles** (`Beauvais.tsx`) : on ne construit et n'affiche QUE les tuiles
  autour du joueur (le brouillard masque déjà au-delà de ~110 m). Elles se montent/démontent
  quand le joueur se déplace → chargement quasi instantané, peu de géométrie à l'écran.
- **Cache LRU de tuiles** (`tileResourceCache.ts`) : les dalles de sol, bâtiments, routes,
  surfaces de route et colliders proches sont gardés brièvement en mémoire. Revenir sur ses pas ne
  reconstruit donc pas les mêmes ressources, et les anciennes tuiles sont libérées quand le cache
  dépasse son plafond. Le cache expose aussi `maxBuildMs` / `lastBuildMs` au rapport `F9`.
- **Streaming progressif des colliders physiques** (`WorldPhysicsColliders.tsx`,
  `WorldBuildingColliders.tsx`) : les tuiles Rapier sont préparées du centre vers les anneaux
  extérieurs et montées seulement quand leurs données sont prêtes. Un changement de zone ne doit pas
  reconstruire toute une couronne de colliders dans la même frame. Le sol physique utilise des
  `HeightfieldCollider` de 128 m échantillonnés tous les 8 m, préparés en worker puis montés une
  tuile à la fois avec une cadence volontairement ralentie pour éviter les longs commits React/Rapier. Les anciennes tuiles restent montées
  jusqu'à ce que la nouvelle couronne active soit prête, afin d'éviter les trous de collision.
- **Budget de colliders par image** (`WorldBuildingColliders.tsx`) : une tuile de façades de 96 m
  du centre-ville contient de **150 à 770 murs**. Les monter d'un coup crée autant de
  `CuboidCollider` Rapier + `Object3D` dans un seul commit React → une « long task » de 40 à 80 ms,
  soit la grosse saccade qu'on ressentait toutes les ~3 s en voiture rapide. Les murs sont donc
  pré-découpés en **lots de 48** au moment du build, et le planificateur n'autorise **qu'un seul
  lot par image**, à l'apparition comme à la disparition. Chaque lot est un composant `memo` :
  ajouter un lot ne re-réconcilie pas les précédents. ⚠️ Ne jamais revenir à un montage
  « toute la tuile d'un coup » — c'est exactement ce qui provoquait les drops FPS.
- **Ressources statiques partagées** (`Ground.tsx`, `Beauvais.tsx`, `Roads.tsx`) : les matériaux
  identiques sont réutilisés entre tuiles et les meshes immobiles désactivent `matrixAutoUpdate`.
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
- [x] **Cathédrale Saint-Pierre soignée** : modèle dédié bâti sur l'emprise réelle (masses étagées, arcs-boutants, rosaces). *(voir « La cathédrale Saint-Pierre »)*
- [ ] Autres repères à la main : ancienne prison, etc. (pas dans OSM → modélisation manuelle).
- [ ] (Option) Ajouter les 9 tours / châteaux d'eau `man_made` d'OSM comme repères.
- [ ] (Gros) Contours BD (cell-shading) en post-traitement — le vrai look cartoon.
- [ ] Optimisation restante : charger le JSON en asset (fetch) au lieu de l'embarquer.
- [ ] Routes/eau sur la minimap (déjà sur la grande carte).
- [x] Placer la cathédrale comme repère central (modèle fait main par-dessus la base auto). *(Cathedral.tsx, affichée en permanence)*
- [x] Spawn dégagé DEVANT la cathédrale (point le plus ouvert). *(cityData.SPAWN)*
- [x] Reperes d'echelle pres du spawn : voiture 4 m, place de stationnement, bornes et hauteur humaine. *(ScaleReferences.tsx)*
- [x] **Hauteurs réelles mesurées** (IGN BD TOPO) sur 97,5 % des bâtiments, l'estimation ne servant plus que de filet. *(bdtopo.mjs, update-heights-ign.mjs)*
- [x] Façades + toits colorés de façon variée. *(Beauvais.tsx)*
- [x] Sol couvrant toute la zone générée. *(CityGround)*
- [x] Minimap ronde + carte (M). *(ui/Minimap, ui/WorldMap)*
- [x] Points d'interet issus de l'editeur visibles sur carte/minimap, en 3D et interactifs avec horaires. *(mapMarkers.json, MapMarkerEntities, MapMarkerPrompt)*
- [x] Ajouter les routes (`highway`) au générateur. *(Roads.tsx)*
- [x] Collisions (empêcher de traverser les bâtiments). *(collision.ts)*
- [ ] Routes sur la minimap / la carte.
- [x] **Toits en pente** avec pignons, orientés sur les façades libres et colorés au matériau réel. *(roofs.mjs, buildingMesh.ts)*
- [ ] Cours intérieures (les `holes` des relations OSM sont dans la donnée mais pas encore percés dans le maillage).
- [ ] Faîtage **partagé** entre maisons mitoyennes : aujourd'hui chaque maison d'une rangée a son propre toit, alors qu'en vrai la rangée n'en fait souvent qu'un seul.
- [ ] **Façades : tout est à refaire.** L'atlas de fenêtres dessinées est **débranché**
  (`FACADES_TEXTUREES = false` dans `archetypes/facadeAtlas.ts`) : il produisait des damiers de
  rectangles sombres qui n'évoquaient pas Beauvais. Les bâtiments sortent en aplats cel-shading
  en attendant. La méthode de remplacement doit donner des travées irrégulières, un
  rez-de-chaussée lié à l'usage réel et des murs aveugles — voir
  [`08-CHUNKFORGE.md`](08-CHUNKFORGE.md#4-les-façades-sont-en-texture-pas-en-géométrie-modulaire).
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

> 📝 Note licence : les deux sources sont libres mais demandent d'**attribuer** :
> « © OpenStreetMap contributors » (ODbL) et « © IGN — BD TOPO® / LiDAR HD » (Licence Ouverte).
> On mettra ces mentions dans le jeu (écran crédits).

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
   Le collider Rapier du sol proche passe par `driveSurfaceHeightAt()`, qui relaie cette surface
   finale ; il ne doit pas revenir a un bitume central uniquement, sinon les bordures/raccords de
   route redeviennent des coutures physiques invisibles.
   Les surfaces experimentales de route echantillonnent aussi le relief autour du point pour eviter un bitume enterre dans les bosses. Les collisions de deplacement sont testees en sous-pas et avec une empreinte au sol simplifiee,
   afin que les vehicules rapides ne traversent pas les facades entre deux frames.
2. **Ce qui bloque doit être visible.** `Beauvais.tsx` affiche *tous* les bâtiments de la donnée,
   sans exception, et `collision.ts` bloque exactement les mêmes contours. Si tu exclus un
   bâtiment de l'affichage (pour le remplacer par un modèle fait main, par exemple), **exclus-le
   aussi des collisions** — sinon tu recrées un mur invisible.
   Les colliders Rapier des facades sont streamés par tuiles stables : chaque tuile garde un seul
   `RigidBody fixed` qui regroupe plusieurs murs `CuboidCollider`. Ne reviens pas a un recentrage
   global qui remonte des centaines de rigidbodies a la fois : ca provoque des drops FPS et des
   corrections physiques visibles en voiture.
   Diagnostic gameplay actuel : si une voiture rollback au même instant qu'un drop FPS, chercher
   d'abord un hitch de streaming/colliders ou un step Rapier trop cher. Le bug n'est pas a traiter
   comme une simple erreur de hauteur de route tant que cette correlation FPS/rollback existe.
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
