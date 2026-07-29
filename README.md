# PLS — Le jeu 🎮

Un jeu vidéo **3D sandbox, style cartoon / BD cell-shading**, fun et déjanté, où l'on incarne
**Chibrux**, notre pote caricaturé à fond, coincé dans la **vraie ville de Beauvais**
(Oise, Hauts-de-France / Picardie).

Objectif principal : **quitter Beauvais coûte que coûte**. Les routes sont bloquées par des travaux,
donc il faut trouver une autre sortie : argent, train, avion, égouts, politique, monde psychique ou
dérapage total.

> On développe à **deux, à distance**, chacun avec l'aide d'une IA connectée au dossier,
> le tout synchronisé via **GitHub** (app GitHub Desktop).

> 🤖 **IA / assistants de code : lisez d'abord [AGENTS.md](AGENTS.md)** (briefing obligatoire).

---

## 🚀 Démarrage rapide

Pour retrouver vite une information, commence par l'index central :
[docs/README.md](docs/README.md).

Tu débutes sur le projet ? Lis les docs **dans l'ordre** :

1. 📦 [Installer son environnement](docs/00-SETUP.md) — Node, éditeur, GitHub Desktop
2. 🔀 [**Workflow Git — À LIRE AVANT DE CODER**](docs/01-WORKFLOW-GIT.md) — comment bosser à 2 sans se marcher dessus
3. 🧱 [Architecture du projet](docs/02-ARCHITECTURE.md) — où ranger quoi, qui bosse sur quoi
4. 🎨 [Game Design](docs/03-GAME-DESIGN.md) — le concept, le gameplay, les systèmes
5. 🗺️ [Le monde de Beauvais](docs/04-MONDE-BEAUVAIS.md) — vraie ville, quartiers, relief, routes
6. 🎒 [Objets et équipements](docs/05-OBJETS-EQUIPEMENTS.md) — items, inventaire, équipement
7. 🛠️ [Éditeur PLS](docs/06-EDITEUR-PLS.md) — outil de production carte / intérieurs / gameplay

👉 **Règle d'or n°1 : personne ne code sans avoir lu [le workflow Git](docs/01-WORKFLOW-GIT.md).**
C'est ce qui évite les conflits et les fichiers "cassés".

---

## 🛠️ La stack technique (le choix des outils)

| Étape | Outil | Pourquoi |
|-------|-------|----------|
| Base du projet | **Vite + React + TypeScript** | Rapide, moderne, l'IA le maîtrise très bien |
| 3D dans le navigateur | **Three.js** via **React Three Fiber** (`@react-three/fiber` + `@react-three/drei`) | Standard du 3D en React |
| Style cell-shading | `MeshToonMaterial` + contours (`<Outlines>` / postprocessing) | Rendu cartoon / BD |
| État du jeu | **Zustand** | Léger, simple, parfait pour un jeu |
| Carte de Beauvais | Données **OpenStreetMap** (OSM) | La vraie ville, gratuit |
| Export en `.exe` (plus tard) | **Tauri v2** (ou Electron en secours) | Fait un vrai `.exe` Windows |

> On code **d'abord** la version web (dans le navigateur, facile à tester),
> et **seulement quand ça tourne bien** on emballe le tout en `.exe` avec Tauri.

---

## 📁 Où sont les choses

```
PLS/
├── README.md          ← tu es ici
├── CONTRIBUTING.md    ← les règles de contribution (commits, branches)
├── docs/              ← toute la documentation
├── index.html         ← page hôte (Vite)
└── src/               ← le code du jeu
    ├── main.tsx / App.tsx   ← entrée + assemblage de l'écran
    ├── core/          ← Canvas 3D, lumières, caméra qui suit le joueur
    ├── entities/      ← personnages (dont le joueur Chibrux)
    ├── gameplay/      ← entrées clavier/souris, état du jeu (Zustand)
    ├── world/         ← le monde de Beauvais, son relief, ses routes et ses bâtiments
    ├── shaders/       ← cell-shading (gradient map toon)
    ├── ui/            ← interface 2D (HUD, compteur FPS, aide contrôles)
    └── lib/           ← utilitaires partagés
```

(Détail complet et conventions dans [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md).)

---

## ⚡ Lancer le jeu en local (une fois installé)

**Le plus simple (Windows)** : double-clique sur **`Lancer-PLS.bat`** à la racine du projet.
Il **vérifie et installe tout seul ce qu'il faut** : si **Node.js** manque, il propose de
l'installer automatiquement (via `winget`) ; il installe les librairies au premier
lancement ; puis il démarre le jeu et ouvre le navigateur tout seul. Pour arrêter : ferme
la fenêtre noire.
(Si `winget` n'existe pas sur le PC, il ouvre la page de téléchargement de Node.js.)

**Ou en ligne de commande :**

```bash
npm install
npm run dev
```

Puis ouvre l'adresse affichée (souvent `http://localhost:5173`) dans ton navigateur.

---

## 🕹️ Ce qui tourne déjà (prototype jouable)

Une **base jouable** existe dans la vraie ville de Beauvais : relief IGN, bâtiments et routes
issus des données de ville, **Chibrux** contrôlable, véhicules prototypes, caméra suiveuse,
HUD, inventaire, carte, points d'intérêt et radios.

**Contrôles :**

| Touche | Action |
|--------|--------|
| **ZQSD** | Se déplacer / conduire (fonctionne aussi en QWERTY : on lit la position physique des touches) |
| **Maj** | Courir |
| **Espace** / **Ctrl** | Sauter / s'accroupir |
| **E** | Action / interagir / monter dans un véhicule |
| **Clic gauche** | Attaquer |
| **Clic droit** | Défendre |
| **Tab** (ou **I**) | Inventaire |
| **1-4** | Raccourcis d'inventaire |
| **R** | Station de radio suivante (en véhicule) |
| **M** | Carte |
| **F1** | Déplier/replier le rappel des touches |
| **Échap** | Libérer la souris |

> C'est encore un prototype : Beauvais existe déjà comme base jouable, mais les lieux faits main,
> les PNJ, les boutiques, les routes de fuite et les systèmes sandbox restent à produire.
