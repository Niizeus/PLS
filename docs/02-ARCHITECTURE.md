# 🧱 02 — Architecture du projet (modulaire = pas de conflits)

L'idée centrale : **beaucoup de petits fichiers bien rangés**, chacun avec **un seul rôle**.
Plus le code est découpé en modules, moins vous touchez les mêmes fichiers → **moins de conflits**.

---

## 📁 Structure des dossiers

```
PLS/
├── docs/                  ← la documentation
├── public/                ← fichiers servis tels quels (icônes, textures brutes...)
└── src/
    ├── main.tsx           ← point d'entrée (on n'y touche presque jamais)
    ├── App.tsx            ← assemble l'écran de jeu
    │
    ├── core/              ← le "moteur" : boucle de jeu, systèmes partagés
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

L'ordre est maintenant explicite, via les constantes de `FRAME` :

| Priorité | Qui | Quoi |
|---|---|---|
| `INPUT` (0) | `useMouse` | applique la souris accumulée depuis l'image précédente |
| `LOGIC` (1) | `usePlayerMovement` | déplace le joueur / conduit le véhicule |
| `ATTACHED` (2) | `Car`, `Scooter` | place ce qui est accroché au joueur |
| `CAMERA` (3) | `FollowCamera` | vise une position déjà à jour |
| `RENDER` (10) | `SceneRenderer` | dessine l'image |

> ⚠️ **Piège à connaître.** Dès qu'un `useFrame` a une priorité > 0, React Three Fiber **arrête
> de rendre tout seul** (il considère qu'on prend la main sur la boucle). C'est pour ça que
> `core/SceneRenderer.tsx` existe et appelle `gl.render()` en dernier. Si un jour on enlève
> toutes les priorités, il faut enlever `SceneRenderer` en même temps — sinon plus rien
> ne s'affiche, ou la scène est rendue deux fois.

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

## 🗂️ Où je mets... ?

| Je veux ajouter... | Je vais dans... |
|--------------------|-----------------|
| Un nouveau bâtiment de Beauvais | `world/beauvais/`, puis je le monte dans `world/World.tsx` |
| Une nouvelle quête / mission | `data/quests.json` (+ logique dans `gameplay/`) |
| Une "action mauvaise" jouable | `gameplay/actions/` |
| Un menu ou un écran | `ui/` |
| Un bloc du HUD | `ui/`, puis je le monte dans une **colonne** de `ui/Hud.tsx`. ⚠️ Le composant ne fixe **jamais** sa propre position : il décrit son contenu, `Hud.tsx` décide où il va. Et il part de `panel` (`ui/hudStyle.ts`) au lieu de réinventer un fond. |
| Un paramètre de gameplay à régler en live | `src/devtools/devTuningSchema.ts`, puis lire la valeur via `getPlayerTuning()` ou `getVehicleTuning(...)`. Le panneau s'ouvre avec `F2` en DEV et exporte/import un JSON d'overrides. |
| Une touche du clavier | `gameplay/input/keyMap.ts` (toujours via `event.code`, jamais `event.key`), puis je l'ajoute au rappel des touches dans `ui/ControlsHint.tsx` |
| Un personnage (le pote, un PNJ) | `entities/`, puis je le monte dans `entities/Characters.tsx` |
| Un modèle 3D / des animations | fichiers dans `public/models/…` (servis tels quels) ; chargés via drei (`useFBX`/`useGLTF`). Ex : le joueur = `entities/player/PlayerModel.tsx` (personnage Mixamo + clips FBX, animé selon l'`action` du store). Les anims **jouées une seule fois** (coups, dégâts) sont calées sur les durées de `entities/player/playerConfig.ts` |
| Une radio jouable | depose le fichier audio dans `public/musique/radio/RXX_Nom/Musiques/` (ou `Jingles/`, `Publicites/`, `Emissions/<Emission>/`). **Aucun code a ecrire, le nom du fichier est libre** : `vite/radioManifestPlugin.ts` scanne le dossier et fournit le catalogue au jeu via le module virtuel `virtual:pls-radio-manifest`. La logique radio vit dans `src/audio/`. |
| Un module de l'editeur PLS | `src/editor/` avec `editor.html` comme entree du hub actuel. L'editeur est dev-only et ne doit pas modifier le jeu principal sans necessite. |
| Un interieur de batiment | `src/data/interiors/<interiorId>.json` (un fichier par interieur), avec les types/validateurs dans `src/data/interiors.ts` et l'edition dans le module Interieurs de `src/editor/`. |
| Un effet visuel cartoon | `shaders/` |
| Une référence à la vie du pote | `data/` (texte/JSON) |

Note editeur : `world/World.tsx` peut etre monte avec `mode="editor"` par `src/editor/` pour elargir
le streaming visuel local de Beauvais. Le mode par defaut reste `game`, utilise par le jeu principal.

---

## Outil dev in-game (`F2`)

Le jeu principal monte un panneau de reglages dev-only dans `src/devtools/`. Il n'existe qu'en mode
Vite DEV (`import.meta.env.DEV`) et sert a tester vite les valeurs de feeling sans recompiler :

- `DevToolsControls.tsx` ecoute `F2` pour ouvrir/fermer le panneau, et `Escape` pour fermer.
- `DevToolsPanel.tsx` affiche les onglets Joueur, Voiture, Scooter, Camera, Inventaire, Stats,
  Temps et JSON.
- `devTuningSchema.ts` est le registre des reglages exposes : label, chemin JSON, bornes, pas.
- `devTuningStore.ts` charge d'abord `public/dev/dev-tuning.json`, ajoute les overrides locaux
  sauvegardes en `localStorage`, puis expose les fonctions de lecture (`getPlayerTuning()`,
  `getVehicleTuning(...)`, `getCameraTuning()`, etc.) pour les boucles de jeu.
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
un parametre deja lu par le gameplay, ajoute une entree dans `DEV_TUNING_FIELDS`. Pour un nouveau
systeme, cree d'abord son type/default clair, puis ajoute une fonction de lecture equivalent a
`getPlayerTuning()`.

`F2` est reserve a cet outil. Les raccourcis temps restent dans `TimeDevControls.tsx` : `F6` cycle la
vitesse, `F7` met midi, `F8` met nuit, `F9` pause/play, `F10` met l'aube, `F11` saute a la prochaine
nuit.

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

**3. Historique annuler/retablir.** `src/editor/editorHistory.ts` fournit `useEditorHistory<T>()`,
un historique par **photos de l'etat** (et non par actions inversibles : impossible de desynchroniser
l'historique du contenu reel). Deux regles a respecter en l'utilisant :

- deposer la photo de l'etat **d'avant** la modification, avec `push()` ;
- pendant un glisser a la souris, ne prendre qu'**une** photo, au premier deplacement reel — sinon
  chaque pixel parcouru devient une annulation. C'est le role du parametre `recordHistory` de
  `moveMarker` / `moveZonePoint` dans `EditorApp.tsx`.

Le `coalesceKey` regroupe les modifications rapprochees de meme nature : taper un nom dans
l'inspecteur ne compte que pour une annulation, pas une par lettre.

⚠️ `InteriorEditor.tsx` a encore son propre historique fait main, anterieur a ce module. Les deux
font la meme chose : a unifier quand on retouchera ce fichier.

**4. Plafond de streaming 3D.** Les vues IG de l'editeur montent le monde avec `mode="editor"`, qui
elargit le streaming de Beauvais. `src/world/editorStreaming.ts` plafonne ce rayon a 15 x 15 tuiles :
sans ca, un dezoom complet demandait ~20 000 tuiles et la geometrie des 34 000 batiments d'un coup,
ce qui figeait l'onglet. Pour voir la ville entiere, c'est le **plan 2D** qui sert, pas la vue 3D.
