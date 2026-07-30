# 💡 07 — Backlog d'idées et vision produit

**Statut : recueil d'idées. Ce document n'est PAS une liste de tâches.**

Ce fichier garde les directions de conception, les envies et les pistes d'exploration du projet
**avant** qu'elles deviennent des specs. Rien ici ne doit être codé du simple fait d'être écrit ici.

> ⛔ **Règle pour les IA comme pour les humains : ne pas implémenter une idée de ce document sans
> demande explicite.** Une idée devient un chantier seulement quand on l'a analysée, confrontée à ce
> qui existe déjà, et transformée en spécification dans le document du système concerné
> ([03 Game Design](03-GAME-DESIGN.md), [06 Éditeur](06-EDITEUR-PLS.md), [02 Architecture](02-ARCHITECTURE.md)…).

Cycle de vie d'une idée :

```
idée brute (ici)  →  à étudier  →  prototype si besoin  →  spec écrite dans la doc du système  →  code
```

Quand une idée est spécifiée et implémentée, sa description **part** dans la doc du système et on ne
garde ici qu'une ligne barrée ou on supprime l'entrée. Ce fichier ne doit pas devenir un doublon des
autres docs.

---

## 🏷️ Comment lire les étiquettes

Chaque idée porte une ligne d'étiquettes. Les valeurs possibles :

| Étiquette | Valeurs |
|---|---|
| **Priorité** | critique · importante · souhaitable · expérimentale |
| **Horizon** | court terme · moyen terme · long terme · après stabilisation des outils |
| **Nature** | gameplay · interface · outil de dev · visuel · audio · confort · architecture · documentation |
| **État** | idée brute · à étudier · spec à rédiger · prototype nécessaire · validée · reportée · abandonnée |

Et quand c'est utile : **Dépend de**, **Risques**, **Questions ouvertes**.

Les détails de chaque idée **pourront évoluer après prototypage** : ce qui est écrit ici décrit une
intention et une expérience visée, pas un contrat technique.

---

## 🚗 1. Véhicules et qualité de conduite

> ✅ **SECTION LIVRÉE — ne plus spécifier ici.** Les sept points 1.1 à 1.7 (limiteur, frein à main
> et drift, effets de pneus, contrôle en l'air, klaxon, phares, radio éteinte) ont été tranchés et
> codés. La spécification qui fait foi est désormais
> [03 Game Design § Commandes de conduite](03-GAME-DESIGN.md#commandes-de-conduite).
> Ce qui suit n'est conservé que comme **trace de l'intention d'origine** : en cas de désaccord avec
> le GDD, c'est le GDD qui gagne. Toute évolution de ces systèmes se documente là-bas, pas ici.

**Contexte existant** — à lire avant de spécifier quoi que ce soit dans cette section :
[03 Game Design § Véhicules](03-GAME-DESIGN.md#-véhicules). Ce qui est déjà en place :

- noyau commun `src/entities/vehicles/vehicleDriving.ts` + `vehicleEngine.ts` (courbe de couple,
  rapports, traînée) ;
- voiture portée par un chassis Rapier `dynamic` piloté par forces (`carRapierController.ts`), avec
  **suspension par raycast roue par roue** — donc les informations de contact et de compression par
  roue existent déjà ;
- part longitudinale / part latérale de la vitesse déjà séparées (la dérive est une donnée du
  modèle, pas un effet cosmétique) ;
- panneau DEV `F2` avec onglets Voiture et Scooter ;
- radio par véhicule, `R` change de station (`src/audio/`).

⚠️ **Point commun à toutes les touches de cette section : `src/gameplay/input/keyMap.ts` travaille
en `event.code` (position physique), pas en lettre imprimée.** Sur AZERTY, la touche marquée **A**
est `KeyQ` — et `KeyA` est déjà pris par `KEY.LEFT` (le « Q » du ZQSD). Toute nouvelle touche doit
donc être vérifiée dans `keyMap.ts` **et** ajoutée au rappel des touches `src/ui/ControlsHint.tsx`.

### 1.1 Limitateur de vitesse

**Intention** — donner au joueur un moyen de tenir une vitesse choisie sans garder le pied au
plancher : conduite tranquille en ville, respect d'une limitation, trajets longs plus confortables.

Comportement visé :

1. le joueur atteint la vitesse qu'il veut garder ;
2. un premier appui **enregistre cette vitesse comme limite** ;
3. le véhicule ne dépasse plus cette valeur en accélération normale ;
4. un second appui désactive le limitateur ;
5. un retour visuel **discret** indique l'état et la vitesse mémorisée.

Exigence de feeling : **aucune coupure brutale**. On approche la limite en douceur, on ne tape pas
dedans.

- **Touche envisagée** : la touche marquée **A** → à mapper sur `KeyQ` (AZERTY), pas `KeyA`.
- **Dépend de** : `vehicleEngine.ts` (c'est la poussée moteur qu'on plafonne, pas la vitesse
  directement — sinon on écrase le vecteur vitesse et on casse la physique), `ui/VehicleDashboard.tsx`
  pour le retour visuel.
- **À étudier** : plafonner le couple demandé plutôt que la vitesse finale ; que fait le limitateur
  en descente (le véhicule dépasse la limite par gravité — on freine ou on laisse filer ?) ; est-il
  désactivé par un freinage ou par une pédale à fond (« kickdown ») ?
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature gameplay + confort · État idée brute

### 1.2 Frein à main et drift

**Intention** — améliorer les **sensations** de conduite. Le but n'est pas de bloquer la voiture,
c'est d'ouvrir un vocabulaire de pilotage : amorcer, glisser, contrôler, rattraper.

Comportement visé : perte temporaire d'adhérence à l'arrière, amorce de drift, glisse
**contrôlable**, résultat dépendant de la vitesse, de l'angle de braquage et du type de sol.
Registre légèrement arcade, mais cohérent.

- **Touche envisagée** : `Espace` — déjà `KEY.JUMP`. Le partage est jouable (on ne saute pas en
  voiture) mais doit être **contextuel et explicite**, pas implicite.
- **Dépend de** : la séparation longitudinal/latéral déjà présente dans `vehicleDriving.ts` et le
  grip latéral appliqué par `carRapierController.ts`. C'est là que le frein à main doit vivre —
  en réduisant temporairement l'adhérence arrière, pas en ajoutant un mode « drift » à part.
- **Risques** : interaction avec l'**aide arcade de direction** (elle ajoute du grip au-dessus de
  ~45 km/h) et avec l'assistance basse vitesse — un frein à main naïf sera mangé par ces aides.
  Elles devront probablement être suspendues pendant la glisse.
- **Questions ouvertes** : le « type de sol » existe-t-il déjà comme donnée exploitable côté
  matériaux physiques (`src/gameplay/physics/`) ? Sinon il faut d'abord une notion de matériau de
  surface — c'est un préalable partagé avec 1.3.
- **Étiquettes** : Priorité importante · Horizon moyen terme · Nature gameplay · État à étudier

### 1.3 Effets liés aux pneus

**Intention** — rendre la glisse **visible**. Fumée sur l'asphalte, poussière sur les sols secs,
traces de pneus, intensité proportionnelle au niveau de glissement, effets adaptés au matériau.

Exigence : utiliser les **vraies** informations de contact et de friction des roues, pas un
déclencheur cosmétique branché sur la vitesse.

- **Dépend de** : 1.2 (le drift donne les occasions), les raycasts de suspension par roue de
  `carRapierController.ts` (point de contact, compression, glissement déjà calculables), et une
  notion de **matériau de sol** (voir la question ouverte de 1.2).
- **Risques** : **performance**. Des particules par roue, en streaming autour du joueur, sur une
  ville 1:1 — à profiler avec `F9` avant/après. Les traces au sol posent en plus une question de
  durée de vie et de nombre maximum.
- **Prototype nécessaire** : oui, sur un seul effet (fumée sur asphalte) avant de généraliser.
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature visuel · État prototype nécessaire

### 1.4 Contrôle du véhicule dans les airs

**Intention** — **considérée comme très importante pour la qualité générale de la conduite.**
Le joueur doit pouvoir influencer légèrement le poids et la rotation du véhicule quand il saute,
tombe, se retourne, ou se retrouve sur le côté ou sur le toit.

Leviers visés : tangage avant/arrière, rotation latérale, rétablissement avant l'atterrissage,
remise du véhicule sur ses roues.

Curseur de conception : le contrôle doit être **utile et réactif**, sans autoriser des rotations
irréalistes ou instantanées.

- **Dépend de** : le chassis Rapier vole déjà librement quand les roues perdent le sol (déjà décrit
  dans 03) — la brique physique est donc là. Il s'agit d'appliquer des **couples** au rigidbody
  quand aucune roue ne touche.
- **À étudier** : détection fiable de « en vol » (zéro roue au contact) sans faux positifs sur les
  bosses ; est-ce que la remise sur les roues est le **même** système ou un geste séparé (un
  « reset » assisté quand le véhicule est immobile sur le toit) ? Les deux besoins sont proches mais
  pas identiques.
- **Étiquettes** : Priorité importante · Horizon court/moyen terme · Nature gameplay · État à étudier

### 1.5 Klaxon

**Intention** — un klaxon, avec un son **positionnel**, éventuellement différent selon les
véhicules, et une protection contre les superpositions excessives.

- **Touche envisagée** : `F` → `KeyF`, libre aujourd'hui (attention : `F1` est déjà le rappel des
  touches, ce n'est pas la même chose).
- **Dépend de** : `src/audio/` ; aucun système d'audio positionnel généraliste n'existe encore (le
  dossier `audio/` est aujourd'hui dédié à la radio). Cette idée est donc aussi une occasion de
  poser la brique « SFX positionnels » du projet.
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature audio · État idée brute

### 1.6 Phares

**Intention** — allumer et éteindre les phares, et rendre la nuit conduisible.

Le système devra gérer : lumières projetées, matériaux lumineux des optiques, état allumé/éteint,
visibilité nocturne, coût en performances, et l'absence de conflit avec les autres raccourcis.

- **Touche envisagée** : `L` → `KeyL`, libre aujourd'hui.
- **Dépend de** : le cycle jour/nuit (§3) et `src/core/Lights.tsx`.
- **Risques** : **performance et ombres**. Des spots dynamiques par véhicule sur une ville streamée
  coûtent cher ; il faudra probablement des projecteurs sans ombres, ou une solution stylisée
  cohérente avec le rendu cell-shading (§ Direction artistique de [03](03-GAME-DESIGN.md)).
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature visuel + gameplay · État à étudier

### 1.7 Radio éteinte

**Intention** — pouvoir rouler **en silence**. Une station ou une option « radio éteinte » qui ne
produit aucune musique, aucun jingle, aucun bruit de fond, aucune transition sonore inutile — et
sélectionnable aussi simplement qu'une station classique.

- **Dépend de** : `src/audio/radioStore.ts`. ⚠️ Attention au piège : `currentStationId: null` sert
  déjà à dire « aucune source active » (pas de véhicule allumé), pas « le poste est éteint ». Il faut
  donc un **état distinct**, entrant dans le cycle de la touche `R`, et qui coupe aussi le **souffle
  de fond** de `radioNoise.ts` (`HISS_LEVEL`) — sinon « éteint » resterait bruyant.
- **Note** : l'état radio est mémorisé **par véhicule** (`vehicleStations`) ; « éteint » doit se
  mémoriser de la même façon.
- **Étiquettes** : Priorité souhaitable · Horizon court terme · Nature audio + confort · État spec à rédiger

---

## 📱 2. Prototype du téléphone

> ✅ **Le prototype est FAIT** (touche `P`, accueil, catalogue extensible, et six applications :
> `Santé`, `Notes`, `GPS`, `Photo`, `Contacts`, `Réglages`).
> Ce qui est en place est décrit dans [03 Game Design § Smartphone](03-GAME-DESIGN.md#-smartphone).
> Cette entrée ne garde que **ce qui reste à faire** : le système de paramètres (§ 2.2) et les
> données de jeu qui n'existent pas encore (§ 2.1).

**Intention** — démarrer un prototype **basique** du téléphone du joueur, dont la vraie valeur est
de **valider la structure** et la connexion aux données du jeu, pas d'être joli.

La vision complète du smartphone (hub diégétique, liste des applications visées) vit dans
[03 Game Design § Smartphone](03-GAME-DESIGN.md#-smartphone). Cette entrée-là ne traite que du
**prototype**.

> ⚠️ **Avant toute implémentation : faire une analyse du projet et de sa documentation** pour
> identifier ce qui existe déjà — informations affichées dans le HUD, statistiques disponibles,
> données du joueur, systèmes de paramètres, contrôles, systèmes réutilisables, interfaces en place.

**Ce qui existe aujourd'hui** (résultat d'une première passe, à re-vérifier avant de coder) :

- HUD monté en colonnes par `src/ui/Hud.tsx`, avec un style de fond partagé `ui/hudStyle.ts` ;
- blocs existants : `StatsPanel`, `InventoryPanel`, `QuickBar`, `GameClock`, `Minimap`, `WorldMap`,
  `VehicleDashboard`, `ControlsHint` ;
- stores lisibles : joueur, inventaire (`gameplay/inventory/`), stats (`gameplay/stats/`), temps
  (`gameplay/time/gameTimeStore.ts`), radio (`audio/radioStore.ts`), télémétrie véhicule ;
- ❗ **il n'existe aucun système de paramètres joueur** (ni volumes, ni luminosité, ni remap de
  touches). Le seul panneau de réglages est l'outil **DEV `F2`** (`src/devtools/`), qui est
  volontairement dev-only et ne doit pas devenir le menu options du jeu.

### 2.1 Informations accessibles depuis le téléphone

Le téléphone pourrait progressivement récupérer des informations du HUD principal : vie, argent,
statistiques, besoins, réputation, progression, missions, inventaire résumé, autres données
existantes.

> **Règle de conception** : ne **jamais dupliquer** la donnée. Le téléphone **consulte** les
> systèmes déjà présents (les stores), il n'en tient pas une deuxième copie.

- **Note** : certaines de ces données n'existent pas encore comme systèmes (besoins, réputation,
  missions, argent). Le prototype doit pouvoir afficher « pas encore branché » proprement plutôt que
  d'inventer des valeurs.
- **✅ Fait** : l'app `Santé` lit déjà vitaux, caractéristiques, effets en cours et zone dans les
  stores existants ; l'app `GPS` lit la position du joueur, les points d'intérêt et leurs horaires ;
  l'argent, la réputation et les missions sont affichés comme « pas encore branché ». Il reste à
  brancher ces systèmes le jour où ils existeront.
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature interface · État à étudier

### 2.2 Paramètres accessibles depuis le téléphone

Pistes : luminosité, volume général, volume musique, effets, voix, radios, configuration des
touches, sensibilité, options d'affichage.

- **Dépend de** : un **vrai système de paramètres joueur**, qui n'existe pas. C'est le préalable
  réel de cette idée, et il concerne aussi le menu options du jeu en général. La configuration des
  touches dépend en plus de `keyMap.ts`, aujourd'hui une constante figée : le rendre remappable est
  un chantier à part entière (voir aussi le rappel des touches `ControlsHint.tsx`).
- **⚠️ Partiellement fait** : l'app `Réglages` existe mais n'expose QUE les réglages réels
  d'aujourd'hui (volume radio + filtre « vieux poste », dans `audio/radioStore.ts`). Les autres y
  sont listés en « pas encore branché ». **Ne pas** y bricoler des réglages au cas par cas : c'est
  le système de paramètres qu'il faut construire, l'app n'en sera que la façade.
- **Étiquettes** : Priorité importante (comme préalable) · Horizon moyen terme · Nature architecture + interface · État spec à rédiger

### 2.3 Structure du prototype — ✅ fait

Livré : ouverture/fermeture (`P`), écran d'accueil, navigation clavier et souris, icônes
temporaires (emojis), application de statistiques, catalogue d'applications extensible.
Code : `src/gameplay/phone/phoneStore.ts` (état) + `src/ui/phone/` (coque, accueil, apps).

- **Questions tranchées** : le téléphone s'ouvre avec **`P`** ; le jeu **ne se met pas en pause**
  (c'est un objet du monde, pas un menu) ; en voiture il reste utilisable et se décale à gauche du
  tableau de bord.
- **Reste à faire** : la **manette**. Elle n'est gérée nulle part (`gameplay/input/` ne connaît que
  clavier et souris) : « compatible manette » implique une couche d'entrées abstraite, c'est un
  chantier à part entière et il n'a pas été entamé.
- **Reste à faire** : l'**app Réglages**, bloquée par § 2.2 (pas de système de paramètres joueur).
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature interface · État prototype livré

---

## 🌅 3. Ciel et cycle jour/nuit

**Intention** — ce n'est pas un chantier de réalisme, c'est un chantier d'**ambiance**. L'objectif
est de créer plusieurs atmosphères fortes, chaleureuses et agréables, qui donnent envie de rouler et
d'explorer.

**Ce qui existe déjà** (le système est en place mais n'était documenté nulle part — à ne pas
redécouvrir de zéro) :

| Fichier | Rôle |
|---|---|
| `src/gameplay/time/gameTimeStore.ts` | horloge du jeu (1 jour = 1 h réelle), phases de journée, `getDaylightFactor()`, `getSolarElevationFactor()`, et **`getSkyColors()`** : 4 palettes `DAY / DAWN / EVENING / NIGHT` (haut, horizon, brouillard) interpolées par `smoothstep` sur des plages horaires |
| `src/gameplay/time/celestialCycle.ts` | positions et visibilités du soleil, de la lune (avec phases), des étoiles et des nuages |
| `src/core/DynamicSky.tsx` | dégradé de ciel généré en canvas, étoiles, champ de nuages en sprites (atlas 14×10, `cloudSpriteManifest.ts`) |
| `src/core/GradientSky.tsx`, `TimeFog.tsx`, `Lights.tsx` | ciel de secours, brouillard lié à l'heure, lumières directionnelle/ambiante |
| `src/gameplay/time/TimeDevControls.tsx` | raccourcis DEV : `F6` vitesse, `F7` midi, `F8` nuit, `F10` aube, `F11` nuit suivante — **c'est l'outil de travail pour juger les ambiances** |

Autrement dit : la **mécanique** de transition existe. Le travail à faire est un travail de
**direction artistique** (palettes, intensités, cohérence), plus l'ajout de ce qui manque (§3.7).

### 3.1 Transitions progressives

Les transitions doivent faire varier progressivement : couleur du ciel, lumière directionnelle,
lumière ambiante, exposition, brouillard, réflexions, couleurs des nuages, intensité des astres.

À éviter : les changements soudains, et surtout la **simple baisse globale de luminosité** qui tient
lieu de nuit.

- **Note** : ciel, horizon, brouillard, teinte globale des lumières et teinte des nuages sont
  désormais synchronisés via `getSkyAtmosphere(totalMinutes)`. Ce qui n'est pas encore piloté par
  l'heure de la même manière : exposition, réflexions et lumières artificielles.
- **Étiquettes** : Priorité importante · Horizon moyen terme · Nature visuel · État à étudier

### 3.2 Aurore chaude californienne

Ambiance visée : chaude, douce, accueillante — « californienne ».
Palette possible : orange doux, rose chaud, violet léger, jaune doré à l'horizon, bleu plus froid en
haut du ciel.

Point de départ concret : `DAWN_SKY` vaut aujourd'hui `top #536f9c` / `horizon #ffc38a` — l'horizon
est déjà dans le bon esprit, le haut du ciel est encore neutre.

- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature visuel · État idée brute

### 3.3 Journée

La journée doit garder une identité et **éviter le bleu générique** : plusieurs nuances de bleu, une
lumière légèrement chaude, un horizon subtilement coloré, des variations selon l'heure, une bonne
lisibilité générale.

- **Note** : `DAY_SKY` est aujourd'hui une palette **constante** entre 7 h 36 et 17 h 12 — « varier
  selon l'heure » demande donc d'ajouter des étapes intermédiaires (milieu de matinée, zénith,
  après-midi), pas seulement de changer des couleurs.
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature visuel · État idée brute

### 3.4 Coucher de soleil

Peut être plus **intense et dramatique** que l'aurore : orange profond, rouge, rose saturé, violet,
bleu sombre. Ces couleurs doivent influencer le ciel, **les nuages, le décor, le brouillard et les
réflexions** — pas seulement le dôme.

- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature visuel · État idée brute

### 3.5 Nuit cosy et lo-fi

La nuit doit être **réellement sombre**, mais jamais vide ni simplement noire.

Ambiance : lo-fi, cosy, urbaine, rétro, légèrement synthwave, mood proche de Kavinsky.
Palette possible : bleu nuit, violet sombre, magenta discret, rouge-orangé dans les éclairages,
contrastes doux entre ombres et lumières artificielles.

La nuit doit donner envie de conduire et d'explorer, tout en gardant une lisibilité correcte.

- **Dépend de** : les **éclairages artificiels** (lampadaires, vitrines, enseignes) portent une
  grande partie de cette ambiance — les lampadaires sont déjà extraits d'OSM
  (voir [04](04-MONDE-BEAUVAIS.md)) mais ne sont pas des sources lumineuses. Lié aussi aux phares (§1.6).
- **Risques** : performance des lumières nocturnes en ville 1:1 ; à traiter probablement en
  **matériaux émissifs** plutôt qu'en vraies lumières.
- **Étiquettes** : Priorité importante · Horizon moyen terme · Nature visuel · État à étudier

### 3.6 Nuages influencés par l'heure

Les nuages devraient évoluer selon l'heure, la direction du soleil, la direction de la lune, la
couleur ambiante, l'intensité lumineuse, leur épaisseur et leur orientation.

Exemples : contours dorés à l'aurore, blanc chaud en journée, orange/rose/violet au coucher,
bleu et violet la nuit.

- **À étudier** : le système actuel (sprites d'un atlas, teinte et visibilité pilotées par
  `cloudVisibility`) doit être **examiné avant de décider s'il est adapté ou remplacé**. Une teinte
  par sprite est probablement peu coûteuse ; un éclairage directionnel des nuages l'est beaucoup plus.
- **Étiquettes** : Priorité souhaitable · Horizon long terme · Nature visuel · État à étudier

### 3.7 Halos et effets autour des astres

Pistes : halo atmosphérique, bloom, glare, lens flare, diffusion lumineuse, rayons lumineux (light
shafts), adaptation légère de l'exposition.

Contrainte : ces effets doivent rester **contrôlés** et ne pas gêner constamment la visibilité.

- **Dépend de** : une chaîne de **post-traitement** (`@react-three/postprocessing`), qui est déjà
  envisagée pour les contours cell-shading. Décision à prendre **une seule fois** pour les deux
  usages, pas deux fois séparément.
- **Risques** : coût GPU ; et le bloom se marie mal avec un rendu à aplats s'il n'est pas dosé.
- **Étiquettes** : Priorité souhaitable · Horizon long terme · Nature visuel · État à étudier

### 3.8 Cohérence globale

Doivent finir **synchronisés** : ciel, soleil, lune, étoiles, nuages, éclairage directionnel,
éclairage ambiant, brouillard, exposition, réflexions, éclairages artificiels.

- **Note d'architecture** : la bonne forme est probablement **une seule source de vérité** qui
  renvoie, pour une heure donnée, l'ensemble des paramètres d'ambiance — et que tout le monde lit
  (comme `getSkyColors()` / `getCelestialCycle()` le font déjà pour une partie). Plusieurs fichiers
  qui décident chacun de leur propre courbe = incohérences garanties.
- **Étiquettes** : Priorité importante · Horizon moyen terme · Nature architecture + visuel · État à étudier

### 3.9 Prototype : ciel procédural stylisé en masses de peinture

**Intention** — créer un ciel signature, non réaliste, qui donne l'impression de grandes masses de
peinture douce déposées dans le ciel : formes rondes et organiques, contours flous, dégradés
progressifs, mouvement très lent, légère évolution de forme, sans effet bulle de savon, sans
irisation arc-en-ciel, et avec des couleurs qui suivent naturellement l'aurore, la journée, le
coucher de soleil et la nuit.

**Prototype en place** — la solution recommandée ci-dessous a été implémentée dans
`src/core/sky/PaintSkyDome.tsx` et `src/core/sky/skyAtmosphere.ts`, puis montée depuis
`src/core/DynamicSky.tsx`. Elle reste désactivable via `F2` > Ciel > `Ciel peinture actif`.

#### Résumé du rendu actuel

- Le projet utilise **Vite + React + TypeScript** pour l'application, mais le rendu 3D réel est
  **Three.js via React Three Fiber** (`@react-three/fiber`, `@react-three/drei`). Vite n'est donc que
  le build/dev server.
- Le renderer est le **WebGLRenderer de Three.js**, créé par `<Canvas>` dans
  `src/core/GameCanvas.tsx`. Aucun WebGPU, Babylon.js ou moteur maison n'a été trouvé.
- `SceneRenderer.tsx` appelle `gl.render(scene, camera)` en dernier, parce que l'ordre des
  `useFrame` est fixé dans `framePriority.ts`.
- Le ciel actuel est `DynamicSky.tsx` : fond de scène en `CanvasTexture`, soleil/lune en sprites,
  étoiles en `Points`, nuages en sprites camera-centered avec atlas (`cloudSpriteManifest.ts`).
- Le cycle temps vient de `src/gameplay/time/` : `gameTimeStore.ts` avance un jour en 1 h réelle,
  `getSkyColors()` interpole 4 palettes, `celestialCycle.ts` calcule soleil, lune, étoiles et
  visibilité des nuages.
- Le brouillard (`TimeFog.tsx`) reprend maintenant la couleur/distance de fog issue de
  `getSkyAtmosphere(totalMinutes)`, avec dosage `F2`.
- La lumière (`Lights.tsx`) et les nuages (`DynamicSky.tsx`) lisent aussi `getSkyAtmosphere(...)` :
  la source unique d'ambiance pilote skydome, fog, lumières globales, nuages et particules rares.
- Les shaders personnalisés sont très limités aujourd'hui : principalement `toonGradient.ts` pour
  `MeshToonMaterial`. Il n'y a pas de `ShaderMaterial` de ciel ni de chaîne de post-traitement active.

#### Fichiers concernés

| Besoin | Fichiers actuels |
|---|---|
| Assemblage scène | `src/core/GameCanvas.tsx`, `SceneRenderer.tsx`, `framePriority.ts` |
| Ciel actuel | `src/core/DynamicSky.tsx`, `GradientSky.tsx`, `cloudSpriteManifest.ts` |
| Temps et palettes | `src/gameplay/time/gameTimeStore.ts`, `celestialCycle.ts`, `TimeDevControls.tsx` |
| Brouillard et lumières | `src/core/TimeFog.tsx`, `Lights.tsx` |
| Réglages DEV | `src/devtools/devTuningSchema.ts`, `devTuningStore.ts`, `public/dev/dev-tuning.json` |
| Style shader existant | `src/shaders/toonGradient.ts` |

#### Architecture proposée

La solution doit rester modulaire et désactivable. Forme recommandée :

1. garder `DynamicSky` comme système stable et fallback ;
2. ajouter plus tard un composant optionnel `ProceduralPaintSky` ou `PaintSkyDome`, monté derrière
   les astres et compatible avec les nuages actuels ;
3. déplacer les données artistiques vers un module dédié, par exemple `src/core/sky/skyPalettes.ts`
   ou `src/gameplay/time/skyAtmosphere.ts`, pour séparer palettes, paramètres horaires et rendu ;
4. exposer une fonction pure du type `getSkyAtmosphere(totalMinutes)` qui renvoie palette, opacité,
   échelle de formes, douceur, vitesse, intensité horizon/zenith, halos, fog, lumières globales,
   teinte des nuages et particules rares ;
5. laisser le shader ou le générateur visuel consommer uniquement ces paramètres et le temps ;
6. prévoir un flag DEV/prototype `enabled` pour revenir instantanément au ciel actuel.

La logique mathématique cible peut rester :

```text
SkyColor = F(ViewDirection, DayProgress, PaintLayerParams)
```

avec un fond vertical/sphérique, 4 palettes principales, interpolation continue, 1 ou 2 masques de
formes, FBM/value noise/simplex, domain warping léger, et éventuellement des metaballs stylisées si
les formes ne sont pas assez rondes.

#### Approches possibles

| Approche | Avantages | Inconvénients |
|---|---|---|
| Améliorer le `CanvasTexture` actuel en générant une texture procédurale 2D | Très compatible, coût GPU quasi nul après génération, fallback simple | Animation fluide plus difficile, coût CPU si régénéré souvent, moins naturel avec la direction de vue |
| Ajouter un skydome `ShaderMaterial` WebGL | Une seule géométrie, animation fluide par uniforms, idéal pour `SkyColor = F(ViewDirection, DayProgress)` | Coût fragment plein écran, demande un shader propre, nouvelle brique technique dans un projet peu shaderisé |
| Ajouter des couches de sprites/metaballs sur le ciel actuel | Très contrôlable artistiquement, proche du système de nuages existant | Plus de draw calls/transparence, risque d'effet collage, transitions de forme moins élégantes |
| Ajouter un post-process ou fullscreen pass | Puissant pour halos/exposition/bloom plus tard | Pas de chaîne postprocess aujourd'hui, risque de chantier trop large, peut contrarier le rendu cell-shading |

#### Solution retenue

Le prototype utilise un **skydome WebGL optionnel avec ShaderMaterial**, alimenté par
`getSkyAtmosphere(totalMinutes)` et monté sans supprimer `DynamicSky`.

Pourquoi : c'est l'approche la plus proche de l'intention `SkyColor = F(ViewDirection, DayProgress)`,
elle permet des formes fluides et continues, elle évite de multiplier les sprites transparents, et
elle reste un prototype isolé si le composant peut être désactivé.

À ne pas faire au premier prototype :

- ne pas remplacer directement `DynamicSky` ;
- ne pas ajouter une météo complète ;
- ne pas ajouter de post-traitement juste pour ce ciel ;
- ne pas exposer des dizaines de paramètres avant d'avoir validé la base visuelle ;
- ne pas coder les palettes en dur dans le shader final.

#### Risques techniques

- **Fill-rate GPU** : un skydome shader est peu coûteux en draw calls, mais son fragment shader couvre
  beaucoup de pixels. Limiter les octaves, éviter les boucles coûteuses et profiler avec `F9`.
- **Transparence et ordre de rendu** : le ciel doit rester derrière soleil, lune, étoiles et nuages.
  Il faudra définir `renderOrder`, `depthWrite={false}`, `fog={false}` et un placement camera-centered
  cohérent avec `DynamicSky`.
- **Incohérence des ambiances** : si palettes de ciel, fog, lumières et nuages restent séparés, les
  transitions risquent de se contredire. Le prototype doit déjà préparer une source `skyAtmosphere`.
- **Compatibilité WebGL** : rester sur GLSL compatible Three.js/WebGL, pas WebGPU.
- **Lisibilité nuit** : une nuit plus stylisée peut devenir trop sombre sans lampadaires/phares.
- **Dette artistique** : trop de bruit ou de couleurs donnera vite un effet savon/arc-en-ciel, à
  éviter par palettes limitées, opacité contrôlée et contours très doux.

#### Impact performance attendu

- Prototype skydome : 1 mesh + 1 matériau + quelques uniforms par frame.
- Coût principal : fragment shader plein écran. Cible prudente : 1 à 2 couches procédurales, 3 à 5
  octaves maximum au total, domain warping léger, pas de texture 3D, pas de volumétrique.
- Les sprites de nuages actuels coûtent déjà de la transparence ; le prototype doit pouvoir masquer
  ou réduire son opacité pour comparer.
- Toute validation doit passer par le profiler `F9` avant/après, avec stats `calls`, triangles,
  textures et temps frame.

#### Plan de prototype minimal

1. Créer une branche/prototype isolée et garder un flag `paintSky.enabled`.
2. Ajouter une fonction pure `getSkyAtmosphere(totalMinutes)` avec 4 palettes : aurore, jour,
   coucher, nuit.
3. Ajouter un `PaintSkyDome` camera-centered, `BackSide`, `depthWrite=false`, `fog=false`.
4. Dans le shader : gradient horizon/zenith, une couche principale de formes douces, une couche
   secondaire plus légère, animation lente, interpolation continue des palettes et paramètres.
5. Monter le composant sans retirer `DynamicSky`; prévoir un retour immédiat au ciel actuel.
6. Ajouter des contrôles temporaires DEV : heure, opacité, échelle, warp, douceur, vitesse.
7. Tester visuellement avec `F7`, `F8`, `F10`, `F11`, puis mesurer avec `F9`.

#### Paramètres artistiques exposables dans `F2`

Noms proposés pour le menu DEV, avec descriptions à écrire dans le schéma :

| Paramètre interne possible | Nom F2 proposé | Usage |
|---|---|---|
| `sky.paint.enabled` | Ciel peinture actif | Active/désactive le prototype. |
| `sky.paint.opacity` | Opacité des masses | Intensité globale des formes peintes. |
| `sky.paint.primaryShapeScale` | Taille formes principales | Taille des grandes masses organiques. |
| `sky.paint.secondaryShapeScale` | Taille détails doux | Taille de la couche secondaire. |
| `sky.paint.warpStrength` | Fluidité des formes | Force de déformation/domain warping. |
| `sky.paint.shapeSoftness` | Douceur des contours | Transition entre ciel et masses colorées. |
| `sky.paint.horizontalStretch` | Étirement horizontal | Allonge les formes vers l'horizon. |
| `sky.paint.animationSpeed` | Vitesse du ciel | Vitesse d'évolution lente. |
| `sky.paint.horizonIntensity` | Intensité horizon | Force des couleurs proches de l'horizon. |
| `sky.paint.zenithIntensity` | Intensité zénith | Force des couleurs en haut du ciel. |
| `sky.paint.sunHaloIntensity` | Halo soleil | Intensité du halo solaire stylisé. |
| `sky.paint.moonHaloIntensity` | Halo lune | Intensité du halo lunaire stylisé. |
| `sky.paint.materialTint` | Teinte ambiance | Force de la teinte horaire sur les lumières globales. |
| `sky.paint.fogIntensity` | Densité fog | Densité du fog coloré selon l'heure. |
| `sky.paint.cloudTint` | Teinte nuages | Intégration colorimétrique des sprites de nuages. |
| `sky.paint.particleIntensity` | Poussières air | Intensité des particules atmosphériques rares. |
| `sky.paint.horizonGlowIntensity` | Halo horizon | Force du halo horizontal quand le soleil est bas. |

Les palettes `DawnPalette`, `DayPalette`, `SunsetPalette`, `NightPalette` doivent rester dans une
structure artistique dédiée plutôt que comme simples nombres dans `F2`, sauf si le panneau évolue
plus tard pour éditer proprement des couleurs.

- **Dépend de** : `DynamicSky.tsx`, `gameTimeStore.ts`, `celestialCycle.ts`, `TimeFog.tsx`,
  `Lights.tsx`, `devTuningSchema.ts`.
- **Risques** : coût shader plein écran, incohérence avec les sprites de nuages existants, besoin de
  QA visuelle en jeu par l'humain, et tentation de transformer le prototype en refonte complète.
- **Étiquettes** : Priorité importante · Horizon moyen terme · Nature visuel + architecture +
  outil de dev · État prototype en place

---

## ✅ 4. Refonte ergonomique du menu `F2` — **réalisée**

**Intention (rappel)** — transformer un menu **technique** en outil compréhensible, visuel et
agréable, pour régler le feeling du jeu sans lire le code.

**C'est fait.** Le détail vit maintenant dans
[02 Architecture § Outil dev in-game (`F2`)](02-ARCHITECTURE.md#outil-dev-in-game-f2) :

| Point de la spec | Ce qui a été livré |
|---|---|
| 4.1 Principes généraux | Chaque réglage porte un nom clair en français, une description, l'effet d'une valeur plus basse / plus haute, un cas d'usage, une unité, sa valeur d'origine affichée et un bouton `↺` de retour. Le nom interne n'apparaît que dans le panneau d'aide, en bas. |
| 4.2 Onglet véhicule visuel | Schéma de véhicule vu de dessus (`panel/VehicleSchematic.tsx`) : moteur à l'avant, pneus, freins, essieux, poids au centre, aéro sur les flancs, drift à l'arrière, vol au-dessus. Cliquer une zone ouvre et fait défiler jusqu'à la catégorie. |
| 4.3 Regroupement | 10 catégories par véhicule (comportement général, moteur, vitesse max, freinage, direction, adhérence, drift, suspension, contrôle aérien, chocs), 4 pour le joueur, 2 pour le ciel. |
| 4.4 Préréglages | Menus déroulants : style de conduite, adhérence, suspension, drift, contrôle aérien. Ils sont calculés à partir des valeurs d'origine du véhicule. Dès qu'une valeur est retouchée à la main, le menu affiche « Personnalisé » — l'interface ne ment pas. |
| 4.5 Simple / avancé | Sélecteur en haut à droite, **mode simple par défaut**. Chaque réglage porte un niveau dans `schema/`. |
| 4.6 Aide contextuelle | Panneau d'aide à droite, mis à jour au survol : ce que ça change, valeur plus basse, valeur plus haute, quand s'en servir, avertissement quand plusieurs réglages sont liés (`⚠`). |
| 4.7 Prévisualisation et comparaison | Tout s'applique en direct. Bouton **« Comparer avant / après »** (rejoue les valeurs d'avant l'ouverture, réglages bloqués le temps de comparer), **« Annuler mes changements »**, `↺` par réglage et par catégorie, **« Tout remettre par défaut »**, et onglet **⭐ Mes réglages** pour enregistrer des configurations nommées. |

### Ce qui reste ouvert

- **Éclairage et audio des véhicules** : aucun réglage n'existe encore côté gameplay (phares, klaxon,
  son moteur). Les deux zones du schéma sont dessinées mais inactives, et le disent au survol. À
  brancher le jour où ces systèmes existent.
- **Partage des préréglages nommés** : ils vivent dans le `localStorage` du navigateur. Pour passer
  un réglage à l'autre dev, il faut toujours l'onglet JSON puis `public/dev/dev-tuning.json`.
- **Prévisualisation « avant / après » côte à côte** (deux valeurs affichées en même temps) : non
  faite, on bascule de l'une à l'autre.
- **Étiquettes** : Priorité importante · État livré · Reste : éclairage/audio véhicule, partage des
  préréglages

---

## 🧰 5. Passe ergonomique globale des outils

> 🚩 **Chantier futur important, noté dès maintenant volontairement.** À lancer quand les outils du
> projet seront suffisamment avancés — pas avant, sinon on documente et on polit une interface qui
> bouge encore.

**Objectif** — qu'un outil puisse être compris et utilisé **sans lire son code** ni connaître son
architecture interne.

Concerne : l'[éditeur PLS](06-EDITEUR-PLS.md) (carte, intérieurs, modules à venir), le panneau
`F2`, la **Régie** radio (`regie.html`), le profiler `F9`.

### 5.1 Périmètre de la passe

Noms des outils, noms des options, descriptions, navigation, disposition des éléments, cohérence
visuelle, retours utilisateur, messages d'erreur, aide contextuelle, documentation externe.

- **Étiquettes** : Priorité importante · Horizon après stabilisation des outils · Nature confort + documentation · État idée brute

### 5.2 Ne pas surcharger les écrans

Plus d'explications ne veut **pas** dire tout afficher en permanence. À utiliser intelligemment :
infobulles au survol, panneaux latéraux, sections repliables, onglets, catégories, icônes d'aide,
descriptions contextuelles, modes simple et avancé, recherche de paramètres, raccourcis affichés
seulement quand ils sont pertinents.

L'espace devra parfois être **complètement réorganisé** plutôt qu'enrichi d'un texte sous chaque
élément.

- **Étiquettes** : Priorité importante · Horizon après stabilisation des outils · Nature interface · État idée brute

### 5.3 Guides futurs

À créer **après stabilisation** des outils, avec un format adapté à leur complexité : guide rapide
intégré, première ouverture accompagnée, tutoriel interactif, documentation détaillée, exemples de
configurations, captures annotées, courtes vidéos, page récapitulative des raccourcis.

- **Note** : les raccourcis sont aujourd'hui décrits dans plusieurs docs à la fois — une page
  récapitulative unique est probablement le premier guide à écrire.
- **Étiquettes** : Priorité souhaitable · Horizon après stabilisation des outils · Nature documentation · État idée brute

### 5.4 Cohérence entre les outils

Conventions à partager progressivement : emplacement des boutons confirmer/annuler, style des menus
déroulants, présentation des nombres, comportement des infobulles, couleurs d'avertissement, système
de recherche, boutons de réinitialisation, raccourcis, structure des catégories.

Bénéfice visé : comprendre plus vite **chaque nouvel outil**.

- **Étiquettes** : Priorité importante · Horizon après stabilisation des outils · Nature interface + architecture · État idée brute

---

## 🎨 6. Outil de création d'intérieur : matériaux des murs et des sols

**Intention** — pouvoir changer facilement les matériaux des murs et des sols, avec une interaction
proche d'un **outil de peinture**.

**Ce qui existe déjà** — voir [06 Éditeur § Modèle des intérieurs](06-EDITEUR-PLS.md#modele-des-interieurs--murs-et-sols-refonte) :
un mur est un segment A→B avec épaisseur, hauteur et ouvertures ; un sol est un polygone quelconque ;
et **chaque mur et chaque sol porte déjà un champ `material: string`** (`'proto_wall'`,
`'proto_floor'`) dans `src/data/interiors.ts`. Le crochet de données est donc là ; ce qui manque est
une **bibliothèque de matériaux** et l'outil pour les appliquer.

### 6.1 Bibliothèque de textures

Textures adaptées aux intérieurs, rangées par catégorie.

- **Murs** : peinture, papier peint, brique, béton, pierre, bois, carrelage, plâtre, métal,
  matériaux stylisés.
- **Sols** : parquet, planches, carrelage, béton, moquette, pierre, vinyle, métal, matériaux
  stylisés.

Chaque texture devrait avoir : une miniature lisible, un nom clair, une catégorie, éventuellement
des variantes, une indication d'échelle, et les paramètres de matériau pertinents.

- **Risques** : **nécessite du contenu graphique** ; et les textures doivent rester compatibles avec
  le rendu **cell-shading** (aplats, `MeshToonMaterial`) — une photo réaliste jurera.
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature outil de dev + visuel · État à étudier

### 6.2 Application directe sur les surfaces

Fonctionnement visé, volontairement simple :

1. le joueur sélectionne une texture ;
2. il survole un mur ou un sol ;
3. la surface ciblée est **mise en évidence** ;
4. un clic applique directement la texture ;
5. un aperçu permet éventuellement de voir le résultat avant validation.

L'outil doit reconnaître automatiquement s'il vise un **mur**, un **sol**, ou éventuellement un
**plafond**.

- **Note** : les plafonds n'existent pas dans le modèle actuel (murs + sols seulement).
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature outil de dev · État spec à rédiger

### 6.3 Sélection directe d'un mur

Avec une texture déjà sélectionnée, cliquer sur un mur suffit. Il ne doit **pas** falloir
sélectionner l'objet dans une hiérarchie, chercher un identifiant, ouvrir plusieurs sous-menus, ni
confirmer chaque petite action.

- **Note** : l'outil `V` (Sélection) sait déjà désigner un mur ou un sol précis — la brique de
  ciblage existe. ⚠️ Mais une séparation entre deux pièces est faite de **deux murs superposés** :
  peindre « le mur » devra décider si on peint une face, les deux, ou le mur visé uniquement. C'est
  exactement le genre de détail qui rend l'outil bon ou frustrant.
- **Étiquettes** : Priorité importante · Horizon moyen terme · Nature confort · État à étudier

### 6.4 Sélection et modification d'une surface existante

Pouvoir sélectionner une surface déjà texturée pour : voir la texture actuelle, la remplacer,
modifier son orientation, ajuster son échelle, ajuster son décalage, éventuellement modifier sa
teinte, copier ses réglages, appliquer les mêmes réglages ailleurs.

- **Dépend de** : `material` est aujourd'hui une **simple chaîne**. Orientation, échelle, décalage et
  teinte impliquent de passer à un **objet de matériau** (avec migration au chargement, comme
  `migrateFloor` l'a déjà fait une fois).
- **Étiquettes** : Priorité souhaitable · Horizon moyen terme · Nature architecture + outil de dev · État spec à rédiger

### 6.5 Outils pratiques futurs

Pistes à conserver : pipette (récupérer le matériau d'une surface), pot de peinture (remplir
plusieurs murs liés), application sur toute une pièce, application sur tous les murs similaires,
rotation de la texture, réglage de l'échelle, répétition automatique correcte, historique
annuler/rétablir, favoris, textures récemment utilisées, recherche, aperçu avant application.

- **Note** : l'historique `Ctrl+Z` / `Ctrl+Y` existe déjà (`editorHistory.ts`) — les actions de
  peinture devront s'y brancher, y compris un remplissage multi-surfaces compté comme **une seule**
  annulation. ⚠️ « Pot de peinture » suppose une notion de **pièce**, qui n'est plus une donnée
  depuis la refonte (juste un raccourci d'outil) : il faudra la redéduire de la géométrie.
- **Étiquettes** : Priorité souhaitable · Horizon long terme · Nature confort · État à étudier

### 6.6 Gestion technique des surfaces (étude préalable)

À vérifier lors d'une future étude technique, **avant** de choisir une architecture :

- comment les murs et les sols sont représentés ;
- comment les surfaces peuvent être identifiées ;
- si chaque face peut recevoir un matériau indépendant ;
- comment sont gérées les coordonnées UV ;
- si les textures doivent être instanciées ;
- comment éviter la création excessive de matériaux ;
- comment sauvegarder les choix du joueur ;
- comment restaurer correctement les textures au chargement.

- **Point d'entrée** : `getWallChunks` (un mur est construit en morceaux : tronçons, linteau, allège
  — chaque morceau devra recevoir des UV cohérents, sinon la texture sautera autour des ouvertures).
- **Risques** : explosion du nombre de matériaux Three.js → à mutualiser par matériau, pas par
  surface. À vérifier avec `F9`.
- **Étiquettes** : Priorité importante (préalable) · Horizon moyen terme · Nature architecture · État à étudier

---

## ❓ 7. Questions ouvertes transverses

Ces questions reviennent dans plusieurs idées. Y répondre une fois débloquerait plusieurs chantiers.

| Question | Idées concernées |
|---|---|
| Existe-t-il une notion de **matériau de surface** exploitable en jeu (asphalte, terre, herbe) ? | 1.2, 1.3 |
| Quelle est la **couche d'entrées** cible (clavier, souris, **manette**), et les touches deviennent-elles remappables ? | 1.1, 1.5, 1.6, 2.2, 2.3 |
| Y a-t-il un **post-traitement** dans le projet, et lequel (contours cell-shading + effets de ciel) ? | 3.7, direction artistique |
| Comment gère-t-on les **lumières nocturnes** en ville 1:1 sans effondrer les performances ? | 1.6, 3.5 |
| À quoi ressemble un **vrai système de paramètres joueur** (distinct du DEV `F2`) ? | 2.2, 2.3, 4.x |
| Un préréglage doit-il rester affiché comme tel après une modification manuelle ? | 4.4, 4.7 |

---

## ➕ 8. Ajouter une idée dans ce document

1. La ranger dans la **section du système concerné** (en créer une seulement si aucune ne colle).
2. Écrire l'**intention** et l'**expérience visée**, pas une solution technique.
3. Noter ce qui **existe déjà** dans le projet et qui la concerne (au moins les fichiers).
4. Noter les **dépendances**, les **risques** et les **questions ouvertes**.
5. Mettre les **étiquettes** (priorité, horizon, nature, état).
6. Ne pas créer de nouveau fichier de doc pour une idée : ça vit ici jusqu'à la spec.
7. Quand l'idée devient une spec, la **déplacer** dans la doc du système et la retirer d'ici.
