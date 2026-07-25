# 🏔️ 06 — Cap graphique : terrain LiDAR HD + bâtiments BD TOPO (IGN)

> **Statut : Phase 1 (terrain) EN COURS — pipeline en place et validé en jeu.** Ce document décrit
> la cible technique pour passer un vrai cap de réalisme sur le monde de Beauvais. Il complète
> [`04-MONDE-BEAUVAIS.md`](04-MONDE-BEAUVAIS.md) (qui décrit le pipeline *actuel*).
>
> **Fait :**
> - `build-terrain-ign.mjs` → 182 dalles 2 m (public/terrain/*.png) pour le DÉTAIL (phase 2, pas encore utilisées en jeu).
> - `build-terrain-global.mjs` → **carte de relief GLOBALE** de la commune (`global.png`, 8 m, un seul fichier ~4 Mo). C'est ce que le jeu charge : léger, robuste, couvre TOUTE la ville.
> - `lidarTerrain.ts` : charge la carte globale + `lidarHeight(x,z)` (partout dans la commune, repli ancienne grille au-delà).
> - `TerrainLidar.tsx` : maillage cell-shading (décimé 16 m, découpé en chunks pour le culling).
> - `terrainHeight()` branché dessus ; **World attend le sol chargé** avant d'afficher le décor (sinon routes/bâtiments se caleraient sur l'ancien relief) ; repli sur l'ancien `Terrain` si le LiDAR échoue.
> - `geotiff`/`pngjs` en devDeps (build uniquement).
> **Vérifié en jeu** : `terrainHeight(0,0) ≈ −2 m` (LiDAR), relief sur toute la commune, aucune erreur console.
> **Choix clé** : une carte globale 8 m plutôt que 182 dalles chargées d'un coup (un décodage raté supprimait tout le sol). Reste : streaming des dalles 2 m pour le détail près du joueur (phase 2), puis bâtiments BD TOPO.

---

## 1. Pourquoi (le constat)

Le pipeline actuel plafonne :
- **Relief** : Open-Meteo = modèle ~90 m **lissé**, échantillonné à 268 m → une bouillie sans rues,
  berges ni talus. Raffiner la source ne crée aucun détail (test fait, échec).
- **Bâtiments** : hauteurs **estimées** depuis OSM (pas les vraies), placement OSM correct mais
  sans altimétrie propre.

**Preuve faite (2026-07-25)** : la dalle LiDAR HD du centre-ville (1 km²) donne un relief **0,5 m**,
net (rues, parcelles, tranchée ferroviaire, berges du Thérain), **0 nodata**. → c'est la bonne voie.

---

## 2. Sources de données (IGN, gratuit, licence Etalab 2.0)

| Donnée | Rôle | Résolution | Accès |
|--------|------|-----------|-------|
| **LiDAR HD — MNT** (sol nu) | Le relief du terrain | dalles 1×1 km, **0,5 m**, GeoTIFF, Lambert-93 (EPSG:2154) | WFS `data.geopf.fr/wfs/ows`, couche `IGNF_MNT-LIDAR-HD:dalle` → champ `url` (WMS GetMap qui renvoie le GeoTIFF) |
| **RGE ALTI 1 m** | **Filet de sécurité** si LiDAR HD pas encore sur une zone | 1 m, national | `geoservices.ign.fr` |
| **BD TOPO — bâtiments** | Emprises + **hauteur réelle** | métrique, 3D | WFS, `BDTOPO_V3:batiment` (attrs `hauteur`, `z_min_sol`, `z_max_toit`) |
| **BD TOPO — routes/eau/ponts** | Axes+largeur, surfaces hydro, ponts | métrique | `troncon_de_route` (`largeur_de_chaussee`), `surface_hydrographique`, `pont` |
| LiDAR HD — nuage classé | (option) toits, **tablier de pont**, eau | 10 pts/m² | couche `IGNF_NUAGES-DE-POINTS-LIDAR-HD:dalle` |
| BD ORTHO 20 cm | (option) calage/texture | 20 cm | WMTS/WFS |

**Repères de projection déjà calculés :**
- Cathédrale (origine locale 0,0) = Lambert-93 **E 633 317 / N 6 926 294**.
- Dalle centre-ville = **`LHD_FXX_0633_6927_MNT_O_0M50_LAMB93_IGN69`** (BBOX E 632999.75–633999.75, N 6926000.25–6927000.25).
- Beauvais commune ≈ E 627 000–639 000, N 6 921 000–6 933 000 → **~12×12 = 144 dalles** (cœur jouable : moins).

---

## 3. Décision de projection (IMPORTANT)

Le jeu actuel est en **local équirectangulaire** autour de la cathédrale (`build-beauvais.mjs`
`project()`). Le LiDAR et la BD TOPO sont en **Lambert-93**. Sur 12 km, la convergence des
méridiens (~0,7° à Beauvais) crée un décalage/rotation non négligeable → il faut **un seul repère**.

- **Cible retenue : migrer tout le monde en « Lambert-93 local »** : `x = E − E0`, `z = −(N − N0)`
  avec `E0,N0` = cathédrale. Comme on passe *aussi* les bâtiments en BD TOPO (Lambert-93), autant
  unifier là-dessus. On documente la conversion et on garde la cathédrale comme (0,0).
- Repli court terme (si on garde les bâtiments OSM un temps) : reprojeter le LiDAR
  Lambert-93 → lat/lon → équirectangulaire local (même `project()`) pour aligner sur l'existant.

---

## 4. Architecture cible du terrain (tuilé + streamé)

On **ne peut pas** embarquer les GeoTIFF bruts (16 Mo/dalle × 144 ≈ 2,3 Go). Le terrain devient un
système **par tuiles**, comme le streaming des bâtiments ([`Beauvais.tsx`](../src/world/beauvais/Beauvais.tsx)) :

- **Tuile de jeu** : 250 m de côté (indépendante de la dalle IGN de 1 km).
- **Stockage** : une **heightmap par tuile** (PNG 16-bit niveaux de gris, `h` encodée
  `(h−hmin)/scale`), ~100–200 Ko/tuile. Décodée à la volée par le navigateur.
- **Résolution d'échantillonnage** : **2 m** (détail large suffisant ; le 0,5 m natif reste
  disponible ponctuellement). → 125×125 valeurs par tuile.
- **Maillage 3D** : ~4 m près du joueur (LOD proche), plus grossier au loin (LOD lointain) pour
  tenir le budget de sommets. `terrainHeight()` échantillonne la heightmap de la tuile active
  (interpolation par **triangle**, comme le fix déjà en place, pour rester cohérent avec le rendu).
- **Streaming** : charger/décharger les tuiles autour du joueur (rayon paramétrable), fond lointain
  en une tuile très basse résolution.

---

## 5. Pipeline de build (scripts hors-jeu)

Même philosophie qu'aujourd'hui : des scripts tournent **une fois**, produisent du **JSON/PNG
compact** que le jeu lit. Aucun téléchargement lourd côté joueur.

1. **`build-terrain-ign.mjs`**
   - Liste les dalles couvrant l'emprise jouable (WFS `IGNF_MNT-LIDAR-HD:dalle`).
   - Télécharge chaque dalle (champ `url`), lit le GeoTIFF (`geotiff.js` — pas de GDAL requis).
   - Downsample 0,5 m → 2 m, découpe en tuiles de 250 m, écrit `data/terrain/<tx>_<tz>.png` + un
     `data/terrain/index.json` (bornes, échelle, hmin par tuile).
   - Repli automatique RGE ALTI 1 m si une dalle LiDAR manque.
2. **`build-buildings-ign.mjs`**
   - WFS `BDTOPO_V3:batiment` sur la commune (INSEE Beauvais = **60057**, à confirmer).
   - Emprises + `hauteur` réelle ; base posée sur l'altitude MNT sous l'emprise.
   - Remplace l'extrusion estimée OSM.
3. **Routes / eau / ponts** : BD TOPO (`troncon_de_route`+largeur → surfaces ; `surface_hydrographique` ;
   `pont`). Le **pont de Paris** devient un vrai tablier.

> Les scripts restent **hors du jeu** et **hors CI** ; leurs sorties compactes sont commitées.
> Attention à la **taille Git** : ne commiter que les tuiles du cœur jouable au début.

---

## 6. Cap graphique (rendu, on GARDE la DA toon)

- **Contours BD** (postprocessing outline) — le vrai look cartoon.
- **AO** (occlusion ambiante, SSAO ou bakée) + ombres de contact → volumes lisibles.
- **Instanciation** des props (arbres, lampadaires, mobilier) par zone/quartier.
- Palette de sol dérivée de l'altitude + type d'occupation (BD TOPO `zone_de_vegetation`).

---

## 7. Feuille de route (phases)

1. **Tranche verticale (1 tuile)** — brancher la dalle centre-ville dans le jeu : chargeur de
   tuile-terrain + relief LiDAR en cell-shading, joueur qui marche dessus. Valide toute la chaîne
   de rendu avant d'industrialiser.
2. **Pipeline terrain complet** — `build-terrain-ign.mjs` + streaming de tuiles sur le cœur jouable.
3. **Bâtiments BD TOPO** — hauteurs + emprises réelles.
4. **Routes / eau / ponts BD TOPO** — surfaces précises, pont de Paris.
5. **Polish** — contours, AO, instanciation, quartiers (voir carte officielle : 8 quartiers).

---

## 8. Décisions ouvertes (à trancher avec l'équipe)

- **Emprise jouable** exacte (cœur 8×8 dalles ? toute la commune 12×12 ?) → pilote le volume Git.
- **Résolution** terrain (2 m proposé) et taille de tuile (250 m proposé).
- **Bascule complète en Lambert-93 local** (recommandé) vs garder l'équirectangulaire un temps.
- **Format de stockage** heightmap : PNG 16-bit (proposé) vs binaire `.bin`.
- Remplacer complètement les bâtiments OSM par BD TOPO **d'un coup** ou par quartier.

---

## 9. Risques & mitigations

| Risque | Mitigation |
|--------|-----------|
| Volume de téléchargement (jusqu'à ~2,3 Go bruts) | Ne traiter que le cœur jouable ; scripts hors-jeu ; sorties compactes |
| Taille des fichiers dans Git (conflits, poids) | Tuiles PNG légères ; ne commiter que le cœur ; `.gitignore` des bruts |
| Perf (beaucoup de sommets terrain) | Tuilage + LOD + streaming (déjà éprouvé sur les bâtiments) |
| Alignement LiDAR ↔ bâtiments | Repère **unique** Lambert-93 local (§3) |
| Coexistence avec le binôme (règle Git) | Travailler par petits commits ; prévenir sur les fichiers `core/` partagés |
