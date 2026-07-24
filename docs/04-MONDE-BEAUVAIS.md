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

### 📂 État actuel du pipeline (quartier cathédrale)

Le pipeline est en place et fonctionne sur un premier quartier (~650 m autour de la
cathédrale, **1388 bâtiments réels**). Les fichiers :

| Fichier | Rôle |
|---------|------|
| `src/world/beauvais/build-beauvais.mjs` | **Temps 1+2** : récupère OSM (Overpass) + convertit en fichier compact. Tourne hors-jeu. |
| `src/world/beauvais/data/beauvais-buildings.json` | Le fichier compact chargé par le jeu (contours en mètres + hauteurs + limites). |
| `src/world/beauvais/cityData.ts` | Source unique lue par tout le monde : bâtiments, limites, centroïdes, point de spawn dégagé. |
| `src/world/beauvais/Beauvais.tsx` | **Temps 3** : extrude les bâtiments et **fusionne** tout en 1 seul draw call. |
| `src/world/CityGround.tsx` | Le sol, dimensionné automatiquement sur les limites de la ville. |
| `src/ui/Minimap.tsx` + `src/ui/WorldMap.tsx` | Minimap ronde (suivi joueur) et carte plein écran (touche M), via `src/ui/mapDraw.ts`. |

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

> ⚠️ Le fichier compact est aujourd'hui **importé** (embarqué dans le bundle). Quand on
> passera à toute la ville, il faudra le charger en **asset** (fetch) + découper en
> **tuiles** avec gestion de distance (LOD). Le code de génération, lui, ne changera pas.

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
- [x] Prototype : afficher les bâtiments extrudés d'un quartier. *(Beauvais.tsx, 1388 bâtiments)*
- [ ] Placer la cathédrale comme repère central (modèle fait main par-dessus la base auto).
- [x] Déplacer le spawn du joueur hors des bâtiments (place dégagée). *(cityData.SPAWN)*
- [x] Hauteurs réalistes (type + surface + variation). *(build-beauvais.mjs)*
- [x] Sol couvrant toute la zone générée. *(CityGround)*
- [x] Minimap ronde + carte (M). *(ui/Minimap, ui/WorldMap)*
- [ ] Ajouter les routes (`highway`) au générateur.
- [ ] Collisions (empêcher de traverser les bâtiments).
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
