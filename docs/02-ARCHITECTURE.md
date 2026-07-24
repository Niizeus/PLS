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
    │   └── beauvais/       ← données OSM, génération de la ville
    ├── entities/          ← personnages & objets (1 fichier par entité)
    ├── gameplay/          ← règles du jeu : actions, quêtes, score, "actions mauvaises"
    ├── ui/                ← interface 2D : menus, HUD, dialogues (composants React)
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
communiquent via le **store Zustand** (`gameplay/stats/playerStore.ts`). Exemple :
`Player` publie son objet 3D dans le store, et `FollowCamera` le lit pour suivre le
perso. Ni l'un ni l'autre ne connaît GameCanvas → aucun branchement à modifier là-bas.

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
| Un personnage (le pote, un PNJ) | `entities/`, puis je le monte dans `entities/Characters.tsx` |
| Un effet visuel cartoon | `shaders/` |
| Une référence à la vie du pote | `data/` (texte/JSON) |
