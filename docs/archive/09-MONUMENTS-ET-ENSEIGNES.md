# 🏛️ 09 — Monuments et enseignes du centre-ville : la fiche de fidélité

Ce document est la **source de vérité factuelle** pour tout ce qui touche aux grands monuments
et aux commerces du centre-ville de Beauvais. Il évite de re-chercher les mêmes informations à
chaque session, et surtout d'inventer des détails.

> 🎨 Rappel de direction artistique : on vise **cartoon / BD cell-shading**, pas le réalisme.
> Fidélité veut dire ici : **bonnes proportions, bonne silhouette, bons détails signature, bon
> emplacement**. Volumes francs, aplats de couleur, contours nets — pas de photoréalisme.

**Convention de fiabilité employée ci-dessous :** ✅ confirmé par source · ⚠️ source unique ou
divergence · ❌ non trouvé, **ne pas inventer**.

---

## 1. Cathédrale Saint-Pierre — le repère central

C'est LE monument du jeu. Implémenté dans **`src/world/beauvais/CathedralPrecinct.tsx`**.

### Chiffres réels ✅

| Élément | Valeur |
|---|---|
| Voûtes du chœur | **48,50 m** — record mondial du gothique |
| Hauteur extérieure | **~67 m** ⚠️ (67,2 / 67,8 selon les sources) |
| Longueur totale **actuelle** | **72,5 m** seulement |
| Largeur au transept | **58,6 m** |
| Rosaces nord et sud | **11 m de diamètre** chacune |
| Élévation intérieure | arcades 21,2 m + triforium 4 m + fenêtres hautes 17 m |

**Proportion à retenir : l'édifice est presque aussi haut que long, et plus large au transept
que long.** C'est un bloc quasi cubique et extrêmement vertical — rien à voir avec la silhouette
allongée d'une cathédrale ordinaire.

### Les neuf choses qui la rendent reconnaissable ✅

1. **Elle n'a pas de nef.** Le chantier s'arrête en 1604 et on ferme l'église à l'ouest par une
   **cloison recouverte d'ardoise**. Pas de façade occidentale, pas de portail ouest, pas de tour
   de façade : l'édifice est **tronqué net**.
2. **Aucune flèche, aucune tour à la croisée.** La tour-lanterne de **153 m** (plus haute
   construction humaine du monde de 1569 à 1573) s'est effondrée le **30 avril 1573**, jamais
   rebâtie. À la croisée : simple toiture. ❌ Aucune source ne mentionne de clocheton actuel
   notable — **ne pas en modéliser un**.
3. **Les deux vraies façades sont les pignons du transept**, puisqu'il n'y a pas de façade ouest :
   nord = **portail Saint-Paul**, sud = **portail Saint-Pierre**, gothique flamboyant, vantaux de
   bois sculpté de **Jean Le Pot** (classés MH), chacun surmonté d'une **rosace de 11 m**.
4. **Forêt d'arcs-boutants très rapprochés**, parce que l'édifice est fragile, **reliés par des
   tirants métalliques** sombres bien visibles.
5. **Huit contreforts** ceinturent les chapelles rayonnantes du chevet.
6. **Couverture en plomb** (120 tonnes) → **gris mat**, pas d'ardoise, sur des toitures à très
   forte pente.
7. **Craie blanche** du Crétacé (carrières de Saint-Martin-le-Nœud), **fortement encrassée** :
   coulures grises et noires sous les corniches, contraste marqué entre pierres restaurées
   (blanches) et pierres anciennes (gris sale).
8. **Échafaudages quasi permanents** depuis des décennies (chantier de restauration toujours en
   cours) + étaiement de bois à l'intérieur du transept.
9. **La Basse-Œuvre accolée à l'ouest** (voir §2).

### Deux horloges à ne pas confondre ✅
- **Horloge astronomique de Vérité** (1865-1868, installée 1876), bras **nord** du transept :
  **12 m de haut × 5,12 m de large**, ~90 000 pièces, **53 cadrans d'émail**, **63 automates**.
- **Horloge médiévale** commandée en 1302, installée **1305** : la plus ancienne horloge à
  carillon encore en fonctionnement.

### Comment c'est réparti dans le code ⚠️ à respecter

L'emprise OSM de la cathédrale est un **gros polygone unique** qui englobe chapelles, bas-côtés
et déambulatoire. L'extruder d'un bloc donnait une **brique plate** sans aucune silhouette.
Elle n'est donc **plus extrudée du tout** : la cathédrale est **entièrement bâtie à la main**
d'après son plan réel.

- **`Beauvais.tsx`** l'exclut via `isHandBuiltMonument(b)` — volume, détails de façade et lignes
  de toit compris. La même exclusion couvre la **Basse-Œuvre** (la chapelle à moins de 60 m de
  l'origine). L'emprise OSM reste utilisée par `collision.ts` (on ne traverse pas la cathédrale)
  et par la carte.
- **`MonumentAccents.tsx`** saute lui aussi la cathédrale.
- **`CathedralPrecinct.tsx`** contient tout : le plan est décrit par des constantes en tête de
  fichier (`AXIS_Z`, `CLOSURE_X`, `TRANSEPT_*`, `VESSEL_HALF`, `AISLE_HALF`, `CHAPEL_HALF`,
  `VESSEL_TOP`, `RIDGE`…). **Pour retoucher les proportions, on touche ces constantes, pas la
  géométrie.**

**Le plan est un T** : la barre du T est le transept (à l'ouest, faute de nef), le pied du T est
le chœur qui part vers l'est et se termine par l'hémicycle du chevet, son déambulatoire et ses
**7 chapelles rayonnantes**.

Cotes obtenues par le modèle, comparées au réel :

| | Modèle | Réel |
|---|---|---|
| Longueur totale | 73 m | 72,5 m |
| Largeur au transept | 58,6 m | 58,6 m |
| Faîtage | 67 m | ~67 m |
| Gouttereau du vaisseau | 50 m | voûtes à 48,50 m |
| Rapport hauteur / longueur | 0,92 | 0,92 |
| Rosaces | 11 m | 11 m |

Les **contours BD** ne sont pas dessinés arête par arête : ils sont générés automatiquement sur
le volume final par une `THREE.EdgesGeometry` (seuil 32°). Seul le remplage des rosaces est
tracé à la main.

---

## 2. Notre-Dame-de-la-Basse-Œuvre ✅

Église **carolingienne** (Xe-XIe s.) qui occupe **exactement l'emplacement où la nef gothique
aurait dû être**. C'est le détail le plus distinctif de la composition d'ensemble.

- **Dimensions actuelles** : 3 travées subsistantes · nef **9,30 m de large**, **15,00 m** sous
  plafond (plafond **plat en bois**) · bas-côtés **4,65 m** de large, **6,55 m** de haut.
- **Appareil — l'élément visuel clé** : *petit appareil cubique* (blocs de ~10 cm dits
  « pastoureaux ») en **opus mixtum**, mêlant pierre claire et **briques rouges** formant des
  **cordons horizontaux**. → aspect **beige clair rayé de bandes rouge-orangé**, à l'opposé de la
  craie lisse de la cathédrale.
- **Toit** à deux rampants avec pignons est et ouest ; bas-côtés en **appentis**.
- **Façade ouest** : **portail en plein cintre simple, sans ornement**, contreforts plats à
  glacis ; pignon percé de **deux petits oculi** et orné d'une **croix en relief**.

Implémenté dans `CathedralPrecinct.tsx` (`addBasseOeuvre`), ancré sur le bâtiment OSM
`kind === 'chapel'` le plus proche de l'origine.

---

## 3. Les enseignes réelles du centre-ville

Implémenté dans **`src/world/beauvais/CentreVilleEnseignes.tsx`**.

### Méthode de placement (à comprendre avant de déplacer quoi que ce soit)

1. Chaque rue a une **ancre (x, z)** dans le repère du jeu, **cohérente avec les repères déjà
   utilisés** ailleurs dans le centre-ville (`World.tsx`, `cityData.ts`) — délibérément pas un
   géocodage isolé, pour rester d'accord avec la ville déjà bâtie.
2. À la construction, on cherche la **polyligne de rue OSM la plus proche**, puis on la
   **prolonge de proche en proche** (`chainAxis`) en suivant à chaque nœud le segment qui repart
   le plus droit → on obtient un vrai axe de rue continu, pas un bout de 40 m.
3. Chaque rue **réserve** les segments qu'elle consomme (`claimed`) : deux rues voisines ne
   peuvent donc pas empiler leurs boutiques sur la même voie.
4. Si l'axe est plus court que nécessaire, **l'espacement se resserre** au lieu de déborder en
   ligne droite hors de la rue, et la largeur des devantures se réduit d'autant.
5. Les **numéros pairs et impairs** se répartissent de part et d'autre de la voie, comme dans la
   vraie numérotation française.

> ⚠️ Honnêteté sur la précision : l'**ordre** des commerces le long de chaque rue est fidèle, la
> position **au numéro près** est une approximation assumée. Le géocodage adresse par adresse
> n'a pas pu être refait (l'API Adresse est inaccessible depuis l'environnement de dev).

### Enseignes en place

| Rue | Enseignes |
|---|---|
| **Place Jeanne Hachette** | Pharmacie de l'Hôtel de Ville (2), Devred 1902 (4), Pharmacie Jeanne Hachette (9), Free (10), Jules (14), Tamaris (22), Promod (28), Leonidas (34), **Galeries Lafayette (36)**, O'Tacos, Antonelle (45), Saint James (47) |
| **Rue Carnot** | Save (1), Marionnaud (3), SFR (9), Grand Optical (12), Yves Rocher (13), Joël Junior (14), Point Cadres (16), **Frimat** (22 bis, bijoutier beauvaisien historique), **Rituals** (ouverture 25/07/2026, 1re boutique de la marque dans l'Oise), Armand Thiery (39), Phildar (45) |
| **Rue Gambetta** | 1.2.3 (6), Shampoo (16), Top Cosmétiques (17), Chauss Expo (20), Pharmacie Gambetta (36), **L'inventorium** (41, librairie indépendante), Maurice Cash (57), O'65 (65), Petit Bateau (68), Jean-Louis David (85) |
| **Rue des Jacobins** | Les Pieds Sur Terre (1), Dim (2), Nocibé (6), Au Bureau (8), Pharmacie Chorein (30), L'Onglerie (45) |
| **Rue Saint-Pierre** | Gold Union (5), Bouygues Telecom (10), Coriolis (12), Pharmacie Saint-Pierre (16), **Funbike** (47) |
| **Rue Pierre Jacoby** | Carrefour City (4), Franck Provost (5), Optic 2000 (20), Esthetic Center (42) |

### ⛔ Enseignes FERMÉES — ne pas les remettre

| Enseigne | Adresse | Fermeture |
|---|---|---|
| **McDonald's** | 26 rue Carnot | **13/12/2013** ✅ — le McDo du centre est aujourd'hui **dans le Jeu de Paume**. *(Retiré de `BeauvaisImportantPlaces.tsx`.)* |
| **Gibert Joseph** | 30 place Jeanne Hachette | liquidation, **10/11/2015** ✅ |
| **Fnac** | 16 rue Pierre Jacoby | liquidation du stock **mars 2025** ✅ |
| **Jennyfer** | 24 rue Carnot | liquidation judiciaire nationale, **mai 2025** ✅ |
| Tati, La Halle, M&S Mode | divers | enseignes disparues de France |

**Galeries Lafayette (2 rue des Jacobins / 36 place Jeanne Hachette)** : ✅ **toujours ouvert**.
Magasin affilié exploité par Hermione Retail (groupe Ohayon), menacé de fermeture en février 2024
puis **préservé** par le plan de sauvegarde de mars 2024 ; absent de la liste des magasins menacés
de juin 2026. Statut « ouvert mais fragile ».

---

## 4. Centre commercial du Jeu de Paume ✅

**4 boulevard Saint-André**, ouvert le **25 novembre 2015**.

| Donnée | Valeur |
|---|---|
| Surface commerciale (GLA) | **24 000 m²** |
| Niveaux commerciaux | **2** |
| Boutiques | **84 à 86** |
| Hauteur | **~12 m** ⚠️ |
| Parking souterrain | **750 places** ⚠️ (830 / ~900 selon les sources) |

⚠️ **Point important pour le rendu : ce n'est PAS une boîte de verre.** L'intégration urbaine est
délibérément discrète — « la hauteur de façade ne dépasse pas celle des bâtiments existants », et
les matériaux reprennent le caractère local : **murs en brique et toitures en pente**. Deux
entrées ouvrent directement sur les rues du centre.

**Locomotives** : E.Leclerc, H&M, Sephora, Foot Locker, Action, Vendome, McDonald's, Kiko Milano,
Histoire d'Or, Cleor, Claire's. Fermé le dimanche.

---

## 5. Les autres grands monuments — fiche de référence

*(Faits vérifiés et prêts à l'emploi ; l'implémentation 3D fidèle reste à faire, voir §6.)*

### Église Saint-Étienne ✅
Orientation **irrégulière nord-ouest / sud-est** — ce n'est pas orienté classiquement.

| | Nef **romane** (XIIe) | Chœur **gothique flamboyant** (XVIe) |
|---|---|---|
| Longueur | 38,00 m | 39,4 m |
| Largeur | 18,00 m | 32 m (avec chapelles) |
| **Hauteur sous voûtes** | **17,40 m** | **29,50 m** |

**Longueur totale 86 m.** **Le contraste est l'élément-signature** : vu de l'extérieur l'église
est en « marche d'escalier » — nef basse et trapue à l'ouest, chœur énorme à l'est, presque
**deux fois plus haut et deux fois plus large**. Chevet plat percé de **8 baies de plus de 40 m²**.
**La tour n'est PAS à la croisée** : elle occupe les deux premières travées du **bas-côté nord**,
donc au **nord-ouest**, contre la façade occidentale. Détails : **roue de la Fortune** sculptée sur
le bras nord, vitraux Renaissance dont l'**Arbre de Jessé** d'Engrand Le Prince.
❌ Couleur exacte de la pierre non documentée.

### MUDO – Musée de l'Oise ✅
**1 rue du Musée**, ancien palais épiscopal bâti **sur les remparts gallo-romains**.
- **Châtelet du XIVe s.** : porte d'entrée fortifiée **flanquée de deux tours jumelles massives**,
  érigée après la révolte de 1305. Le passage entre les deux tours est l'entrée du musée.
- **Corps de logis du XVIe s.** : Renaissance avec ornements gothiques conservés, **tourelle
  d'escalier à vis** dite « tour de l'horloge », coiffée d'une **poivrière** et d'un **campanile
  à trois cloches** (dont une de 1506).
- Rouvert **fin mars 2025** après 2,5 ans de travaux.
- ⚠️ Matériaux et couleur des toitures du châtelet **non confirmés** — à caler sur photo.

### Hôtel de Ville ✅
**1 rue Desgroux**, façade sur la place Jeanne-Hachette. **Façade de 1753**, style **classique
Louis XV**, pierre de taille claire, **deux niveaux strictement symétriques** :
porte encadrée de **deux colonnes engagées à chapiteaux ioniques** → au-dessus une **fenêtre
cintrée surmontée d'une horloge** → **armoiries et devise** → **fronton triangulaire** ; de chaque
côté **4 fenêtres par niveau** séparées par des **pilastres ioniques** ; **balustrade** en
couronnement.
⚠️ **Détruit en juin 1940 — seule la façade a survécu** ; reconstruction inaugurée en **1957** avec
deux ailes modernes à bas-reliefs. C'est donc une façade XVIIIe + un arrière des années 50.

### Le Quadrilatère ✅
Contre la cathédrale, **adossé au rempart gallo-romain**. Architecte **André Hermant**
(élève de Perret), **1972-1976**, projet lancé par Malraux.
**Béton armé brut apparent**, béton émaillé + verre, **toiture en cuivre**, façades horizontales.
Volume **bas et horizontal**, conçu pour **faire ressortir par contraste la verticalité de la
cathédrale**. ❌ Dimensions précises non trouvées.

### Théâtre du Beauvaisis — ⚠️ IL A DÉMÉNAGÉ
**3 place Georges Brassens**, bâtiment **neuf ouvert le 11 janvier 2025** — à modéliser en
contemporain, il n'y a pas d'ancien théâtre à cet endroit.
Façades en **béton blanc matricé** (ciment blanc + agrégats sableux) alternant béton lisse et
**béton en relief évoquant l'artisanat tapissier beauvaisien**, motifs s'amincissant vers le haut.
**Cage de scène cylindrique dominante de 27 m** (dôme à 26,86 m), hall entièrement vitré, toiture
végétalisée. Grande salle **673 places**, petite salle 180-184 places.

### Remparts gallo-romains et Tour Boileau ✅
**Rempart antique** (fin IIIe – début IVe s., ville antique *Caesaromagus*) : **1 370 m** de long,
**plus de 14 m** conservés par endroits, **2,50 m** d'épaisseur, **18 tours** à l'origine.
Vestiges visibles : **tour de l'Aurore** et **tour Leuillier**, rue Philippe-de-Dreux.
**Tour Boileau** — attention, elle est **médiévale, pas gallo-romaine** : construite en **1489**
par le maire Boileau, au confluent du Thérain et de l'Avelon. **Ce n'est pas une tour classique :
c'est un bâtiment-pont qui enjambe le Thérain**, régulant l'eau vers les fossés et les moulins.
Subsistent la tour d'escalier et une galerie couverte. ❌ Hauteur, diamètre et matériaux non
documentés.

### Statue de Jeanne Hachette ✅
Sculpteur **Vital Gabriel Dubray**, **inaugurée en 1851**, place Jeanne-Hachette. **Bronze** →
patine vert-de-gris. Pose : **armée d'une francisque, en position combattante**, hache levée.
Piédestal remplacé en 2003. ❌ **Hauteur non trouvée — ne pas inventer.**
⚠️ Place réaménagée vers 2015-2017 avec un **miroir d'eau** (dimensions non confirmées).

### Collégiale Saint-Barthélemy — vestiges ✅
Fondée en 1037. Subsistent le **chœur gothique** (seul élément debout), la **crypte romane
voûtée en berceau**, et surtout un **muret de pierre posé au sol au début des années 2000 traçant
le plan d'origine en croix grecque** — élément au sol très exploitable en jeu.

### Manufacture nationale de la tapisserie ✅
**24 rue Henri Brispot — hors hypercentre.** Installée dans les **anciens abattoirs de 1851**.
⚠️ **Ne pas confondre** : la *Galerie nationale de la tapisserie* (l'espace d'exposition près de la
cathédrale) est **devenue Le Quadrilatère** ; la *Manufacture* (l'atelier) est ailleurs.

---

## 6. Reste à faire

- [ ] **Église Saint-Étienne** : la silhouette « en marche d'escalier » (nef basse 17,4 m / chœur
      haut 29,5 m) et la tour au **nord-ouest**, pas à la croisée.
- [ ] **MUDO** : le châtelet à **deux tours jumelles** et la tourelle d'escalier à poivrière.
- [ ] **Hôtel de Ville** : la façade classique de 1753 (colonnes ioniques, horloge, fronton,
      balustrade, 4 fenêtres de chaque côté).
- [ ] **Le Quadrilatère** : volume bas et horizontal en **béton brut** à toiture **cuivre**.
- [ ] **Théâtre du Beauvaisis** : bâtiment neuf place Georges Brassens, cage de scène cylindrique
      de 27 m en béton blanc matricé.
- [ ] **Jeu de Paume** : le repasser en **brique + toitures en pente** (aujourd'hui traité en
      volume commercial générique dans `CentreVilleMicroPlaces.tsx`).
- [ ] **Statue de Jeanne Hachette** : pose combattante, hache levée, bronze patiné.
- [ ] Vérifier sur photo les lacunes marquées ❌ / ⚠️ ci-dessus **plutôt que de supposer**.

---

## 7. Sources principales

Wikipédia FR (cathédrale Saint-Pierre, Basse-Œuvre, Saint-Étienne, MUDO, hôtel de ville, tour
Boileau, statue de Jeanne Hachette, horloge astronomique) · Villes et Pays d'art et d'histoire
Hauts-de-France (rempart antique, Saint-Étienne, Saint-Barthélemy, Manufacture) ·
`mudo.oise.fr` · `culture.beauvais.fr` · `beauvaisis.fr` · Chroniques d'architecture (théâtre) ·
ACPresse (Quadrilatère) · site officiel et LSA (Jeu de Paume) · Livres Hebdo (Gibert Joseph) ·
La Gazette France (Rituals) · France 3 Hauts-de-France et CNews (Galeries Lafayette) ·
McDonald's France (fermeture rue Carnot).
