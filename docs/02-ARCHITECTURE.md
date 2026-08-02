# 🧱 02 — Architecture du projet (modulaire = pas de conflits)

L'idée centrale : **beaucoup de petits fichiers bien rangés**, chacun avec **un seul rôle**.
Plus le code est découpé en modules, moins vous touchez les mêmes fichiers → **moins de conflits**.

---

## 📁 Structure des dossiers

```
PLS/
├── docs/                  ← la documentation
├── public/                ← fichiers servis tels quels (icônes, textures brutes...)
├── tools/                 ← petits outils locaux de production hors jeu
└── src/
    ├── main.tsx           ← point d'entrée (on n'y touche presque jamais)
    ├── App.tsx            ← assemble l'écran de jeu
    │
    ├── core/              ← le "moteur" : boucle de jeu, systèmes partagés
    │   └── postfx/         ← effets appliqués à l'image finie (contours cell-shading...)
    ├── world/             ← LE MONDE (map de Beauvais, décor, bâtiments)
    │   └── beauvais/       ← données OSM + IGN, génération de la ville
    ├── entities/          ← personnages & objets (1 fichier par entité)
    ├── gameplay/          ← règles du jeu : actions, quêtes, score, "actions mauvaises"
    ├── ui/                ← interface 2D : menus, HUD, dialogues (composants React)
    ├── devtools/          ← outils de debug in-game actifs seulement en DEV
    ├── editor/            ← outil web dev-only (`editor.html`) : carte, futurs outils de production
    ├── shaders/           ← cell-shading / effets visuels (GLSL)
    ├── assets/            ← modèles 3D, sons, images du jeu
    ├── data/              ← contenu en JSON : quêtes, dialogues, références à la vie du pote
    └── lib/               ← utilitaires partagés (maths, helpers)
```

> Chaque dossier peut avoir son petit `README.md` qui dit "ce dossier sert à X".

`src/gameplay/physics/` porte la couche physique globale PLS : constantes monde
(gravité, pas fixe, groupes de collision), enveloppe Rapier, props dynamiques,
surface physique de Beauvais et helpers d'appuis véhicule. `<WorldPhysicsColliders>`
stream des tuiles `TrimeshCollider` fixes autour du joueur à partir de la surface
finale praticable (`driveSurfaceHeightAt`, basee sur `groundHeight()`) : Rapier devient l'autorité locale du
sol proche, pas seulement un outil de test. `<WorldBuildingColliders>` stream aussi
les façades proches sous forme de murs `CuboidCollider` fixes, pour que la voiture
collide avec les bâtiments dans Rapier et plus avec une caisse 2D séparée. ⚠️ Ces murs
sont montés **par lots de 48, un lot par image maximum** : une tuile du centre-ville en
compte jusqu'à 770, et les créer d'un coup coûtait 40 à 80 ms de commit React/Rapier
(la source des drops FPS en voiture rapide — voir `docs/04-MONDE-BEAUVAIS.md`). Les
props/colliders de test attendent le chargement du relief avant de se créer, sinon
Rapier les figerait à une hauteur provisoire avant que le sol visible existe.

Autour de la voiture gravitent quatre fichiers dédiés aux sensations de conduite :
`tireContactStore.ts` (état de contact des 4 roues, **objet mutable partagé et non un store
Zustand** : il change 60 fois par seconde et déclencherait autant de rendus React),
`TireEffects.tsx` (fumée, poussière et traces, en tampons circulaires à taille fixe pour ne rien
allouer par image), `CarHeadlights.tsx` (optiques + faisceaux, démontés quand ils sont éteints) et
`vehicleHorn.ts` (klaxon synthétisé en WebAudio, positionnel). Le détail des comportements et les
pièges à ne pas « simplifier » sont dans
[03 Game Design § Commandes de conduite](03-GAME-DESIGN.md#commandes-de-conduite).

La voiture principale charge le FBX `public/models/Vehicule/Voiture/Chevrolet.fbx`
dans `entities/vehicles/Car.tsx`. Le modèle est préparé en trois parties (caisse,
essieu avant, essieu arrière) pour exposer les pivots nécessaires au braquage, à la
rotation des roues et à la suspension visuelle (plus le vitrage, maillage séparé
dans le FBX). Les matériaux du modèle sont conservés — groupes compris — et
repassés au toon par `shaders/toonMaterial.ts` : voir
[03 Game Design § Les matériaux de la voiture](03-GAME-DESIGN.md#les-matériaux-de-la-voiture). Elle possède un chassis Rapier
`dynamic` invisible : `carRapierController.ts` applique les forces moteur, frein,
grip latéral, couple de direction et suspensions par raycasts sur ce rigidbody. Le
store voiture publie ensuite la pose Rapier pour que le joueur/caméra suivent le
chassis au lieu de tirer la voiture avec l'ancien contrôleur. Les futurs véhicules
FBX doivent suivre la même règle : séparer au minimum caisse et roues pilotables,
puis fournir un chassis Rapier dynamique piloté par forces. Attention : quand un
`RigidBody` est en `colliders={false}` avec des colliders enfants manuels, la masse
doit être posée sur le collider enfant (`CuboidCollider mass={...}`), sinon le
rigidbody garde une masse calculée depuis la densité par défaut et les suspensions
appliquent des forces totalement disproportionnées.

---

## 👥 Qui bosse sur quoi (répartition = clé anti-conflit)

Pour ne pas se marcher dessus, on se répartit les **domaines**. Proposition de départ
(à adapter entre vous) :

| Domaine | Dossiers principaux | Perso |
|---------|--------------------|-------|
| **Monde & rendu** (la map de Beauvais, décor, style visuel) | `world/`, `shaders/`, `assets/` | Personne A |
| **Gameplay & interface** (actions, quêtes, score, menus) | `gameplay/`, `ui/`, `entities/`, `data/` | Personne B |
| **Cœur partagé** (moteur, utilitaires) | `core/`, `lib/` | À deux, avec com' |

> Règle : si tu dois toucher un dossier "de l'autre", **préviens-le** et fais-le sur ta branche.

---

## 🎬 Le point d'assemblage (pour ne pas se marcher dessus)

`core/GameCanvas.tsx` est le fichier qui monte la scène 3D. **On veut qu'il reste
stable** : s'il fallait l'éditer à chaque nouveau bâtiment ou chaque nouveau PNJ,
les deux devs se marcheraient dessus en permanence dans ce fichier.

Du coup, chaque domaine a **son propre fichier de composition** que `GameCanvas`
se contente d'appeler :

| Tu ajoutes... | Tu édites... | Sans toucher à... |
|---------------|--------------|-------------------|
| un élément du monde (décor, bâtiment, Beauvais) | `world/World.tsx` | `GameCanvas`, `entities/` |
| un personnage (PNJ, ennemi) | `entities/Characters.tsx` | `GameCanvas`, `world/` |

Les blocs ne se branchent **pas** entre eux à la main dans `GameCanvas` : ils
communiquent via des **stores Zustand**. Exemples :
- `playerStore` : `Player` y publie son objet 3D, `FollowCamera` le lit pour suivre le perso.
- `cameraStore` (`core/`) : la souris y écrit l'orientation de la caméra (yaw/pitch),
  lue à la fois par `FollowCamera` (où se place la caméra) et par le déplacement du
  joueur (qui doit être relatif à la caméra).

Ni ces composants ni ces modules ne se connaissent directement → aucun branchement à
modifier dans GameCanvas.

> ⚡ Les valeurs lues chaque frame (position joueur, yaw/pitch caméra) le sont via
> `useXxxStore.getState()` **dans `useFrame`**, pas via le hook réactif : on évite ainsi
> tout re-render React à chaque image / mouvement de souris.

### ⏱️ L'ordre des `useFrame` est FIXÉ — `core/framePriority.ts`

Par défaut tous les `useFrame` ont la priorité 0 : leur ordre est celui du **montage** des
composants. Déplacer une ligne dans `GameCanvas.tsx` suffisait donc à faire calculer la caméra
AVANT le joueur — elle visait alors la position de l'image précédente, ce qui produit une saccade
proportionnelle à la vitesse (invisible à pied, très visible en voiture).
En voiture, `FollowCamera` lit directement la pose conducteur publiée par Rapier dans `carStore` et
lisse une cible legerement predite par la velocite du chassis : cela evite d'amplifier les pas fixes
de la physique quand le rendu tourne entre deux steps.

L'ordre est maintenant explicite, via les constantes de `FRAME` :

| Priorité | Qui | Quoi |
|---|---|---|
| `INPUT` (0) | `useMouse` | applique la souris accumulée depuis l'image précédente |
| `LOGIC` (1) | `usePlayerMovement` | déplace le joueur / conduit le véhicule |
| `ATTACHED` (2) | `Car`, `Scooter` | place ce qui est accroché au joueur |
| `CAMERA` (3) | `FollowCamera` | vise une position déjà à jour |
| `RENDER` (10) | `SceneRenderer` | dessine l'image (via la chaîne d'effets, voir plus bas) |

> ⚠️ **Piège à connaître.** Dès qu'un `useFrame` a une priorité > 0, React Three Fiber **arrête
> de rendre tout seul** (il considère qu'on prend la main sur la boucle). C'est pour ça que
> `core/SceneRenderer.tsx` existe et rend l'image en dernier. Si un jour on enlève
> toutes les priorités, il faut enlever `SceneRenderer` en même temps — sinon plus rien
> ne s'affiche, ou la scène est rendue deux fois.

### 🎞️ La chaîne d'effets d'image — `core/postfx/`

La scène n'est plus dessinée directement à l'écran : elle passe par un `EffectComposer`
(bibliothèque `postprocessing`) monté par `core/postfx/usePostProcessing.ts`. On rend la scène
dans une image en mémoire, on la retouche, on affiche le résultat. C'est ce qui permet les effets
qui ont besoin de voir l'image **entière**.

| Fichier | Rôle |
|---|---|
| `core/postfx/usePostProcessing.ts` | fabrique le composer et la liste des passes. **Le seul endroit à toucher pour ajouter un effet.** |
| `core/postfx/ToonOutlineEffect.ts` | le trait noir du cell-shading, appliqué à toute l'image |
| `core/SceneRenderer.tsx` | le seul à appeler `composer.render()` |

**Le contour** ne duplique aucune géométrie : il relit le tampon de profondeur et noircit les
pixels où il « casse » (silhouette d'un bâtiment, arête entre un mur et un toit). Il compare
chaque pixel à la **moyenne de ses deux voisins opposés**, ce qui donne zéro sur toute surface
plane même très inclinée — sans ça, une route vue de biais se remplirait de traits parasites.
Les réglages (épaisseur en pixels, sensibilité, opacité, effacement au loin) sont regroupés dans
la constante `TOON_OUTLINE` en haut du fichier.

> 🔭 **Deux règles.** (1) Une seule chose appelle `render()` — deux appels et la scène est
> dessinée deux fois par image, sans erreur visible, juste des FPS divisés par deux.
> (2) Empile les nouveaux effets dans le **même** `EffectPass` : il les fusionne en un seul
> shader, c'est bien moins cher que trois passes séparées.

> ⚠️ **Reste des contours par objet.** Plusieurs entités portent encore un `<Outlines>` de drei
> (voiture, scooter, objets ramassables, props, marqueurs). Ils font double emploi avec la passe
> d'image et devront être retirés une fois le rendu validé — voir
> [07 Backlog](07-BACKLOG-IDEES.md).

En voiture, le joueur/caméra suit une pose publiée par le chassis Rapier. `FollowCamera`
lisse donc uniquement son point cible voiture (X/Z plus vite que Y) pour absorber les
micro-oscillations de suspension/route sans changer la pose physique réelle de la voiture.

Constat de test à conserver : les "mini rollbacks" ressentis en voiture apparaissent en même temps
que des drops FPS. Ils doivent donc être traités comme un problème de hitch/performance du monde
physique et du streaming, pas seulement comme un réglage de caméra ou de suspension. Avant de
changer le feeling véhicule, profiler en priorité le nombre de colliders actifs, les remounts de
`WorldBuildingColliders` / `WorldPhysicsColliders`, et le coût du step Rapier.

> 🖱️ La souris est **mise en file** (`queueRotation`) et appliquée **une seule fois par image**
> (`flushRotation`). Les événements souris n'arrivent pas au rythme des images : une souris
> 125 Hz sur un jeu à 60 im/s livre 2 événements sur une image et 1 sur la suivante, ce qui
> faisait vibrer la rotation en permanence.

> Règle : si tu te retrouves à devoir éditer `GameCanvas.tsx`, demande-toi d'abord
> si ça n'irait pas plutôt dans `World.tsx`, `Characters.tsx` ou le store.

---

## 🧩 Les principes qui évitent les conflits

1. **Un fichier = une responsabilité.** Un fichier qui fait 1 chose est court → rarement modifié à deux.
2. **Pas de fichier "fourre-tout".** Évitez un énorme `game.ts` que tout le monde édite.
3. **Séparer données et code.** Les quêtes, dialogues, réfs perso → dans `data/*.json`.
   Ajouter du contenu = éditer un JSON, pas le code → beaucoup moins risqué.
4. **Interfaces claires entre modules.** Un module expose quelques fonctions ; les autres
   l'appellent sans connaître son intérieur.
5. **Composants React petits et indépendants.** Chaque élément d'UI dans son fichier.

---

## 🧭 Conventions de nommage

- **Fichiers de composants React** : `PascalCase` → `PlayerHUD.tsx`, `QuestPanel.tsx`
- **Fichiers utilitaires / logique** : `camelCase` → `mathUtils.ts`, `buildCity.ts`
- **Dossiers** : `kebab-case` ou simple minuscule → `world/`, `beauvais/`
- **Une "chose" par fichier**, et le nom du fichier = le nom de la chose.

---

## 🖍️ La règle du HUD

**Le style.** Le HUD parle la même langue que la 3D : **papier crème, contour d'encre épais
(3 px), ombre portée DURE (sans flou), aplats de couleur francs**. Tout part de
[`src/ui/hudStyle.ts`](../src/ui/hudStyle.ts) — `panel`, `outline`, `hardShadow`, `kbd`,
`HUD.vitals`. On ne réinvente jamais un fond ni une bordure dans un composant : si un besoin
manque, on l'ajoute **dans `hudStyle.ts`**, pour tout le monde.

Ça vaut pour **toutes** les interfaces du jeu : HUD, inventaire, grande carte, tableau de bord,
invites, écran de chargement. Deux exceptions, toutes deux volontaires :
- le **téléphone** (`ui/phone/phoneStyle.ts`) garde son propre style et une police neutre —
  c'est un smartphone dans le monde du jeu, pas un élément dessiné ;
- le **panneau dev `F2`** (`devtools/panel/devPanelStyles.ts`) reste un outil : il n'a pas à
  être joli, et le confondre avec le jeu serait une mauvaise idée.

Deux codes couleur sont fixés pour toute l'interface : **jaune = « c'est celui-là »** (objet
équipé, objet sélectionné, action principale) et **rouge = « impossible / danger »**.

> Une ombre floue n'existe pas dans une case de BD. C'est le détail qui fait basculer
> l'ensemble du côté « dessiné » — ne pas le « corriger ».

La police du jeu est `PLS Comic` (voir [`public/fonts/README.md`](../public/fonts/README.md)).
Elle est déclarée à un seul endroit (`HUD.font`) et retombe proprement sur une police système
tant que le fichier n'est pas installé.

**Ce qu'on affiche.** Règle simple :

> **Si une information ne change pas, elle n'a rien à faire à l'écran en permanence.**

- Ce qui sert **à jouer dans l'instant** (raccourcis, minimap, heure, tableau de bord) reste
  affiché.
  > Le **rappel des touches** (`F1`) ne laisse plus AUCUNE trace à l'écran quand il est replié :
  > la pastille « F1 Touches » a été supprimée, et le coin **bas gauche** revient au tableau de
  > bord du véhicule. La touche est rappelée dans l'app **Réglages** du téléphone.
- **L'état du personnage** (vie, faim, soif, mental, caractéristiques, argent, réputation) est
  **dans le téléphone** (touche `P`), pas à l'écran. Le téléphone est le tableau de bord de
  Chibrux ; l'écran, lui, montre le monde.
  > ⚠️ Conséquence assumée : plus rien ne prévient quand un vital devient critique. Si ça
  > manque en jouant, la réponse n'est **pas** de remettre un panneau permanent, mais une
  > alerte **passagère** au moment où ça devient grave.
- Ce qui **n'a d'intérêt qu'au moment où ça arrive** (entrer dans un quartier, ramasser un
  objet) est un **passager** : ça s'affiche quelques secondes, puis ça s'efface (`ZoneToast`).
- Ce qui ne concerne **que les développeurs** (FPS, action en cours, réglages) est
  **`import.meta.env.DEV`** ou dans le panneau `F2`. Jamais dans le jeu du joueur.

Avant d'ajouter un bloc permanent, se demander où il va **plutôt** aller : téléphone, passager,
ou `F2`. Un HUD, ça ne fait que grossir si personne ne défend cette règle.

---

## 🗂️ Où je mets... ?

| Je veux ajouter... | Je vais dans... |
|--------------------|-----------------|
| Un nouveau bâtiment de Beauvais | `world/beauvais/`, puis je le monte dans `world/World.tsx` |
| Une nouvelle quête / mission | `data/quests.json` (+ logique dans `gameplay/`) |
| Une "action mauvaise" jouable | `gameplay/actions/` |
| Un menu ou un écran | `ui/` |
| Un bloc du HUD | `ui/`, puis je le monte dans une **colonne** de `ui/Hud.tsx`. ⚠️ Le composant ne fixe **jamais** sa propre position : il décrit son contenu, `Hud.tsx` décide où il va. Et il part de `panel` (`ui/hudStyle.ts`) au lieu de réinventer un fond. **Avant d'ajouter quoi que ce soit à l'écran, lire la règle du HUD ci-dessous.** |
| Un **objet** ramassable | `src/data/items.ts` : une entrée avec sa `size` (place dans la grille du sac), sa catégorie et ses effets. Rien d'autre à coder — l'inventaire, le ramassage et l'équipement le prennent en charge tout seuls. |
| Un **réglage joueur** (son, image, souris) | `src/gameplay/settings/settingsStore.ts` (sauvegardé), puis un curseur dans l'app **Réglages** du téléphone. ⚠️ **Un réglage n'existe que s'il agit vraiment** : pas de curseur décoratif. Et rien d'équilibrage ici — ça, c'est `devtools/`. |
| Un paramètre de gameplay à régler en live | `src/devtools/schema/` (le fichier de la famille concernée : `vehicleFields.ts`, `playerFields.ts`, `worldFields.ts`), puis lire la valeur via `getPlayerTuning()` ou `getVehicleTuning(...)`. Le panneau s'ouvre avec `F2` en DEV et exporte/importe un JSON d'overrides. ⚠️ Chaque entrée doit porter un **nom clair en français**, une description, l'effet d'une valeur plus basse/plus haute, et son niveau (`simple` / `advanced`). |
| Un probleme de performance a diagnostiquer | `F9` en DEV lance/arrete une capture perf. Le rapport JSON est ecrit dans `public/dev/perf-reports/` via `vite/perfReportPlugin.ts`. |
| Une interface **cliquable** (qui s'ouvre par-dessus le jeu) | Déclare-la avec `setCursorUiOpen('<id>', ouvert)` dans un `useEffect` (`gameplay/input/pointerLock.ts`). Sans ça, la souris reste capturée par le canvas : on voit des boutons **sans pouvoir les viser**, et un clic à côté ferait disparaître le curseur. |
| Une touche du clavier | `gameplay/input/keyMap.ts` (toujours via `event.code`, jamais `event.key`), puis je l'ajoute au rappel des touches dans `ui/ControlsHint.tsx` |
| Un personnage (le pote, un PNJ) | `entities/`, puis je le monte dans `entities/Characters.tsx` |
| Un modèle 3D / des animations | fichiers dans `public/models/…` (servis tels quels) ; chargés via drei (`useFBX`/`useGLTF`). Ex : le joueur = `entities/player/PlayerModel.tsx` (personnage Mixamo + clips FBX, animé selon l'`action` du store). Les anims **jouées une seule fois** (coups, dégâts) sont calées sur les durées de `entities/player/playerConfig.ts` |
| Une radio jouable | depose le fichier audio dans `public/musique/radio/RXX_Nom/Musiques/` (ou `Jingles/`, `Publicites/`, `Emissions/<Emission>/`). **Aucun code a ecrire, le nom du fichier est libre** : `vite/radioManifestPlugin.ts` scanne le dossier et fournit le catalogue au jeu via le module virtuel `virtual:pls-radio-manifest`. La logique radio vit dans `src/audio/`. |
| Un petit outil local de production | `tools/<nom-outil>/`, avec un `README.md` court. Exemple : `tools/wav-to-ogg/` convertit plusieurs `.wav` en `.ogg` dans `Downloads` pour preparer les musiques radio. |
| Un module de l'editeur PLS | `src/editor/` avec `editor.html` comme entree du hub actuel. L'editeur est dev-only et ne doit pas modifier le jeu principal sans necessite. |
| Un interieur de batiment | `src/data/interiors/<interiorId>.json` (un fichier par interieur), avec les types/validateurs dans `src/data/interiors.ts` et l'edition dans le module Interieurs de `src/editor/`. |
| Un **plan type** d'interieur (maison, appartement, boutique, egouts...) | `src/data/interiorTemplates.ts` : un template decrit des **pieces rectangulaires**, le module en deduit murs, portes, fenetres, sols et meubles. Le bouton « Generer ce plan » du module Interieurs l'appelle. |
| Un effet visuel cartoon | `shaders/` |
| Une référence à la vie du pote | `data/` (texte/JSON) |

Note editeur : `world/World.tsx` peut etre monte avec `mode="editor"` par `src/editor/` pour elargir
le streaming visuel local de Beauvais. Le mode par defaut reste `game`, utilise par le jeu principal.

---

## Outil dev in-game (`F2`)

Le jeu principal monte un panneau de reglages dev-only dans `src/devtools/`. Il n'existe qu'en mode
Vite DEV (`import.meta.env.DEV`) et sert a tester vite les valeurs de feeling sans recompiler :

- `DevToolsControls.tsx` ecoute `F2` pour ouvrir/fermer le panneau, et `Escape` pour fermer.
- `DevToolsPanel.tsx` est la coquille : onglets Voiture, Scooter, Joueur, Camera, Inventaire, Ciel,
  Stats, Temps, Mes reglages et JSON, plus le selecteur **Simple / Avance**, la recherche, l'aide
  contextuelle et les boutons avant/apres.
- `panel/` contient les briques d'interface : `TuningSection.tsx` (un onglet de reglages),
  `TuningGroupSection.tsx` (une categorie pliable), `TuningFieldRow.tsx` (un reglage),
  `VehicleSchematic.tsx` (le plan de vehicule cliquable), `PresetSelect.tsx`, `HelpPanel.tsx`,
  `SavedPresetsTools.tsx`, `StatsTools.tsx`, `TimeTools.tsx`, `JsonTools.tsx` et
  `devPanelStyles.ts`.
- `devTuningSchema.ts` agrege le registre des reglages ; le contenu vit dans `schema/`
  (`vehicleFields.ts`, `playerFields.ts`, `worldFields.ts`). Chaque entree porte : nom clair,
  description, effet d'une valeur plus basse / plus haute, cas d'usage, avertissement eventuel,
  unite, lecture secondaire (m/s -> km/h, rad -> deg), bornes, pas, categorie et niveau
  (`simple` / `advanced`).
- `devTuningGroups.ts` definit les categories (comportement general, moteur, vitesse maximale,
  freinage, direction, adherence, drift, suspension, controle aerien, chocs...) et la **zone du
  schema de vehicule** qui les ouvre.
- `devTuningPresets.ts` definit les prereglages (style de conduite, adherence, suspension, drift,
  controle aerien). Ils sont **calcules a partir des valeurs d'origine du vehicule**, donc « arcade »
  veut dire la meme chose pour la voiture et pour le scooter. Des qu'une valeur est retouchee a la
  main, le menu deroulant repasse sur « Personnalise ».
- `devTuningStore.ts` charge d'abord `public/dev/dev-tuning.json`, ajoute les overrides locaux
  sauvegardes en `localStorage`, puis expose les fonctions de lecture (`getPlayerTuning()`,
  `getVehicleTuning(...)`, `getCameraTuning()`, `getSkyTuning()`, etc.) pour les boucles de jeu.
  Il gere aussi le retour a la valeur d'origine (`resetPath` / `resetPaths`, la reference etant la
  valeur ecrite dans le code), l'annulation des changements de la session (`revertSession`), le mode
  avant / apres (`toggleCompare`) et les prereglages nommes de l'utilisateur (`savedPresets`,
  stockes dans le navigateur uniquement).
- `public/dev/dev-tuning.json` est le fichier officiel de reglages DEV du projet. Il peut rester
  vide (`{}`) tant qu'aucun reglage n'est valide.
- `public/dev/dev-tuning.example.json` donne un exemple de fichier d'overrides partageable.

Flux prevu : regler en jeu avec `F2`, aller dans l'onglet JSON, copier l'export, puis remplacer le
contenu de `public/dev/dev-tuning.json` quand le reglage est valide pour tout le projet. Le bouton
`Ecrire dev-tuning.json` fait cette ecriture directement via Vite, apres une confirmation explicite,
et uniquement pendant `npm run dev`. La route serveur associee (`/__pls/dev-tuning`) n'ecrit que ce
fichier-la. `Reset local` efface seulement les essais du navigateur ; il ne touche pas au fichier
projet. `Recharger projet` relit `public/dev/dev-tuning.json` sans relancer Vite.

Regle d'ajout : on expose seulement un parametre utile a regler pendant le dev. Si une valeur est
juste interne, derivee, ou dangereuse sans contexte, elle reste dans son module d'origine. Pour ajouter
un parametre deja lu par le gameplay, ajoute une entree dans le fichier `schema/` correspondant, avec
**un nom en francais comprehensible sans lire le code** (jamais le nom de la variable), une
description, l'effet d'une valeur plus basse et plus haute, sa categorie et son niveau. Si la valeur
est un nouveau champ de vehicule, ajoute aussi sa cle dans `VEHICLE_NUMBER_KEYS` (`devTuningStore.ts`),
sinon le sanitizer la jettera. Pour un nouveau systeme, cree d'abord son type/default clair, puis
ajoute une fonction de lecture equivalent a `getPlayerTuning()`.

Le ciel procedural peint expose ses reglages DEV sous `sky.paint.*` : activation, opacite, echelles
de formes, deformation, douceur, etirement, vitesse, intensites horizon/zenith, halos, teinte globale
des lumieres, densite de fog, teinte des nuages et particules atmospheriques rares. Les palettes et
profils d'ambiance restent dans `src/core/sky/skyAtmosphere.ts` pour garder une direction artistique
coherente plutot que des couleurs isolees dans le JSON. `Lights.tsx`, `TimeFog.tsx`, `DynamicSky.tsx`
et `PaintSkyDome.tsx` lisent cette meme source afin que ciel, brouillard, lumiere et nuages changent
ensemble selon l'heure.

> ✅ **La refonte ergonomique du panneau est faite** (noms clairs, descriptions, categories,
> prereglages, mode simple / avance, schema de vehicule cliquable, avant/apres, prereglages
> enregistrables). Ce qui reste ouvert : aucun reglage d'**eclairage** ni d'**audio** de vehicule
> n'existe encore, donc les deux zones correspondantes du schema sont affichees mais inactives.
> La passe ergonomique globale des autres outils reste au
> [07 - Backlog d'idees § 5](07-BACKLOG-IDEES.md#-5-passe-ergonomique-globale-des-outils).

`F2` est reserve a cet outil. Les raccourcis temps restent dans `TimeDevControls.tsx` : `F6` cycle la
vitesse, `F7` met midi, `F8` met nuit, `Shift+F9` pause/play, `F10` met l'aube, `F11` saute a la prochaine
nuit. `F9` seul est reserve au profiler de performance.

## Profiler de performance in-game (`F9`)

Le profiler dev-only sert a generer un rapport exploitable avant d'optimiser :

- `PerfProfilerControls.tsx` ecoute `F9` : premier appui = demarre, deuxieme appui = arrete et sauvegarde.
- `PerfProfilerRecorder.tsx` vit dans le canvas R3F et mesure les frames apres le rendu.
- `perfProfiler.ts` garde les donnees hors React pour ne pas provoquer de re-render a chaque frame.
- `vite/perfReportPlugin.ts` ecrit le JSON dans `public/dev/perf-reports/` pendant `npm run dev`.

Le rapport contient les temps frame par frame, les frames lentes, des mesures approximatives par
phase `useFrame`, les stats renderer Three (`calls`, triangles, geometries, textures), une photo de
la scene, la position joueur/voiture, le temps de jeu, la memoire navigateur quand elle existe, et
les stats des caches de tuiles, dont `builds`, `evictions`, `maxBuildMs`, `lastBuildMs` et
`lastBuiltKey`. Il ne pretend pas profiler chaque composant React individuellement :
il sert surtout a distinguer hitch de streaming/physique, cout de rendu stable, explosion de scene,
ou allocation memoire.

---

## Editeur PLS (`editor.html`) — garde-fous

L'editeur est dev-only et ecrit directement dans `src/data/`. Trois protections encadrent ca,
a ne pas retirer sans les remplacer.

**1. Ecriture protegee des donnees.** Les plugins Vite d'ecriture (`vite/mapMarkersPlugin.ts`,
`vite/zonesPlugin.ts`, `vite/interiorsPlugin.ts`) passent tous par `vite/plsDataFile.ts`, qui :

- copie l'ancien contenu dans `src/data/.backups/` avant chaque ecrasement (20 versions gardees
  par fichier, dossier ignore par Git — c'est un filet local, l'historique partage reste les commits) ;
- repond **409** au lieu d'ecrire quand la sauvegarde viderait un fichier qui contenait encore des
  donnees. Cote editeur, `src/editor/editorSave.ts` transforme ce 409 en question a l'humain et ne
  rejoue la requete (en-tete `x-pls-force`) que s'il confirme.

Un nouveau plugin d'ecriture de l'editeur doit passer par `writeDataFile()`, pas par `fs.writeFileSync`.

**2. Filet anti-page-blanche.** `src/editor/EditorErrorBoundary.tsx` entoure le hub dans
`src/editor/main.tsx` : une erreur de rendu affiche le message et la pile au lieu d'un ecran vide.

⚠️ Piege React a connaitre : `event.currentTarget` vaut `null` des que le handler rend la main. Il
faut **toujours** lire la valeur d'un champ dans le corps du handler, jamais dans le callback passe a
`setState` (React ne l'execute qu'au rendu suivant → TypeError en plein rendu → tout se demonte).
C'est pour ca que `updateSelectedMarker`, `updateSelectedZone` et `updateActiveInterior` appliquent
leur recette immediatement. Voir aussi `src/editor/editorInputs.ts` (`Number('')` vaut `0`, pas NaN).

**3. Les deux modules restent montes.** `EditorHub.tsx` affiche Carte ET Interieurs en meme temps,
et masque celui qui n'est pas a l'ecran (`.editor-hidden`). Demonter le module quitte jetait tout
son travail non sauvegarde, ce qui est devenu inacceptable depuis que « Creer l'interieur » change
d'onglet automatiquement. Consequence a respecter : **tout ce qui est global doit etre conditionne
a la prop `active`** — ecoute du clavier, boucle `requestAnimationFrame`, scene 3D. Sinon les deux
modules repondent en meme temps aux memes touches.

L'etat partage entre modules vit dans `src/editor/editorWorkspace.ts` (store Zustand) : la liste des
interieurs, l'interieur ouvert, le module affiche, et une copie en lecture des points d'interet. La
source de verite des POI reste l'etat de `EditorApp` — le store n'en recoit qu'un reflet.

**4. Geometrie des interieurs : une seule source.** `src/data/interiorGeometry.ts` ne connait ni React
ni Three.js : il ne fait que du calcul sur des murs (segments) et des sols (polygones). L'editeur 2D
**et** la vue 3D partent tous les deux de la, et c'est obligatoire : si l'affichage et les collisions
calculaient chacun leur geometrie, on obtiendrait des murs qu'on voit mais qu'on traverse — le bug
classique que `docs/03-GAME-DESIGN.md` interdit deja pour la ville.

Un mur est un segment A -> B avec ses ouvertures ; `getWallChunks()` le decoupe en morceaux pleins
(troncons, linteau, allege) et sert aussi bien a construire les boites 3D qu'a savoir ou le joueur
passe. Un sol est un polygone : `pointInPolygon()` dit si on est dessus. Ajouter une forme (arc,
biseau...) se fait ICI, jamais dans un composant.

**5. Historique annuler/retablir.** `src/editor/editorHistory.ts` fournit `useEditorHistory<T>()`,
un historique par **photos de l'etat** (et non par actions inversibles : impossible de desynchroniser
l'historique du contenu reel). Deux regles a respecter en l'utilisant :

- deposer la photo de l'etat **d'avant** la modification, avec `push()` ;
- pendant un glisser a la souris, ne prendre qu'**une** photo, au premier deplacement reel — sinon
  chaque pixel parcouru devient une annulation. C'est le role du parametre `recordHistory` de
  `moveMarker` / `moveZonePoint` dans `EditorApp.tsx`.

Le `coalesceKey` regroupe les modifications rapprochees de meme nature : taper un nom dans
l'inspecteur ne compte que pour une annulation, pas une par lettre.

Les deux modules de l'editeur utilisent ce meme module — pas de second historique fait main.

**6. Plafond de streaming 3D.** Les vues IG de l'editeur montent le monde avec `mode="editor"`, qui
elargit le streaming de Beauvais. `src/world/editorStreaming.ts` plafonne ce rayon a 15 x 15 tuiles :
sans ca, un dezoom complet demandait ~20 000 tuiles et la geometrie des 34 000 batiments d'un coup,
ce qui figeait l'onglet. Pour voir la ville entiere, c'est le **plan 2D** qui sert, pas la vue 3D.
