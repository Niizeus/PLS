# PLS — Le jeu 🎮

Un jeu vidéo **3D, style cartoon / BD cell-shading**, fun et déjanté, basé sur la vie de notre pote,
dans un monde inspiré de la **vraie ville de Beauvais** (Oise, Hauts-de-France / Picardie).

> On développe à **deux, à distance**, chacun avec l'aide d'une IA connectée au dossier,
> le tout synchronisé via **GitHub** (app GitHub Desktop).

> 🤖 **IA / assistants de code : lisez d'abord [AGENTS.md](AGENTS.md)** (briefing obligatoire).

---

## 🚀 Démarrage rapide

Tu débutes sur le projet ? Lis les docs **dans l'ordre** :

1. 📦 [Installer son environnement](docs/00-SETUP.md) — Node, éditeur, GitHub Desktop
2. 🔀 [**Workflow Git — À LIRE AVANT DE CODER**](docs/01-WORKFLOW-GIT.md) — comment bosser à 2 sans se marcher dessus
3. 🧱 [Architecture du projet](docs/02-ARCHITECTURE.md) — où ranger quoi, qui bosse sur quoi
4. 🎨 [Game Design](docs/03-GAME-DESIGN.md) — le concept, le gameplay, le style visuel
5. 🗺️ [Le monde de Beauvais](docs/04-MONDE-BEAUVAIS.md) — comment on reconstruit la vraie ville

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
└── src/               ← le code du jeu (créé à l'étape SETUP)
```

---

## ⚡ Lancer le jeu en local (une fois installé)

```bash
npm install
npm run dev
```

Puis ouvre l'adresse affichée (souvent `http://localhost:5173`) dans ton navigateur.
