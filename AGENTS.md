# 🤖 AGENTS.md — À lire par TOUTE IA avant de coder sur ce projet

> Ce fichier est le **briefing obligatoire** pour n'importe quelle IA (Claude, Cursor, Copilot,
> ou autre) qui va écrire du code dans ce dépôt. Lis-le **en entier** avant toute modification.
> Les développeurs humains, eux, commencent par le [README](README.md).

---

## 0. Règle numéro 1 : garder la documentation à jour

**À CHAQUE changement, tu mets à jour la doc concernée DANS LE MÊME COMMIT que ton code.**

- Tu ajoutes/changes une mécanique de jeu → mets à jour [`docs/03-GAME-DESIGN.md`](docs/03-GAME-DESIGN.md).
- Tu changes la structure des dossiers ou les conventions → [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md).
- Tu changes la stack, une commande, l'installation → [`README.md`](README.md) et/ou [`docs/00-SETUP.md`](docs/00-SETUP.md).
- Tu changes le fonctionnement de la carte/Beauvais → [`docs/04-MONDE-BEAUVAIS.md`](docs/04-MONDE-BEAUVAIS.md).
- Tu changes le workflow Git → [`docs/01-WORKFLOW-GIT.md`](docs/01-WORKFLOW-GIT.md).

**La documentation est la source de vérité.** Si le code et la doc se contredisent, c'est un bug :
corrige-le. **Mais ne modifie que le(s) document(s) réellement concerné(s)** — ne réécris pas
toute la doc à chaque fois (ça crée du bruit et des conflits Git inutiles).

Avant de terminer une tâche, pose-toi la question : *« un fichier de doc est-il devenu faux à
cause de mon changement ? »* Si oui → mets-le à jour.

---

## 1. Le projet en bref

- **Nom** : PLS — un jeu vidéo **3D, cartoon / BD, cell-shading**, fun et déjanté.
- **Sujet** : la vie d'un pote (missions qui font référence à sa vraie vie, humour, private jokes).
- **Ton** : humour, second degré ; des « actions parfois mauvaises » mais **cartoon et bon enfant**,
  jamais glauque ni offensant. Le but est de faire **rire**.
- **Monde** : la **vraie ville de Beauvais** (Oise, Hauts-de-France / Picardie), reconstruite à
  partir de vraies données (OpenStreetMap). Voir [`docs/04-MONDE-BEAUVAIS.md`](docs/04-MONDE-BEAUVAIS.md).

Détails complets : [`docs/03-GAME-DESIGN.md`](docs/03-GAME-DESIGN.md).

---

## 2. Contexte de développement (important)

- Projet développé **à 2 personnes, à distance**, chacune assistée par une IA.
- Synchro via **GitHub** (app **GitHub Desktop**), dépôt `github.com/Niizeus/PLS`.
- ⚠️ **Le dépôt Git est le dossier courant** (celui qui contient ce fichier). C'est ici qu'on code.
- Les deux devs ont des **niveaux de prog différents** → écris du code **clair, commenté quand
  c'est utile**, et des messages/explications **accessibles**.
- **Priorité absolue du projet : éviter les conflits Git et les fichiers cassés.** Ça guide
  toutes les décisions (voir §4).

---

## 3. Stack technique & conventions de code

Respecte la stack existante, n'introduis pas d'outil concurrent sans qu'on te le demande.

| Domaine | Choix imposé |
|---------|--------------|
| Base | **Vite + React + TypeScript** |
| 3D | **Three.js** via **React Three Fiber** (`@react-three/fiber`, `@react-three/drei`) |
| Style visuel | Cell-shading : `MeshToonMaterial` + gradient map + contours (`<Outlines>` / postprocessing) |
| État du jeu | **Zustand** |
| Données ville | **OpenStreetMap** (GeoJSON) |
| Export `.exe` (phase 2) | **Tauri v2** (Electron seulement en secours) |

**Conventions** (détail dans [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md)) :
- **TypeScript** partout, typé (évite `any` autant que possible — ça attrape des bugs).
- Composants React : `PascalCase` (`PlayerHUD.tsx`) ; logique/utils : `camelCase` (`buildCity.ts`).
- **Un fichier = une responsabilité.** Beaucoup de petits fichiers > un gros fichier fourre-tout.
- Le **contenu** (quêtes, dialogues, références au pote) va dans des **JSON** (`src/data/`), pas
  en dur dans le code → plus facile à éditer, moins de conflits.
- Commente ce qui n'est pas évident ; garde un style cohérent avec le code voisin.

---

## 4. Règles Git à respecter (pour ne pas casser le travail de l'autre)

Résumé — détail complet dans [`docs/01-WORKFLOW-GIT.md`](docs/01-WORKFLOW-GIT.md) :

1. **Ne travaille jamais directement sur `main`.** Propose/utilise une branche `feature/...` ou `fix/...`.
2. **Commits petits et fréquents**, avec des messages clairs (`feat:`, `fix:`, `docs:`...).
3. **Ne modifie pas des dizaines de fichiers d'un coup** sans raison — plus le diff est petit,
   moins il y a de conflits.
4. **Reste dans ton domaine** (voir la répartition dans [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md)).
   Si tu dois toucher un fichier « partagé » (`core/`, `lib/`), signale-le clairement dans ta réponse.
5. **Ne commite jamais** `node_modules/`, `dist/`, `.env`, ni de gros binaires non prévus
   (voir [`.gitignore`](.gitignore)).
6. **⛔ RÈGLE STRICTE — l'IA ne synchronise JAMAIS avec GitHub.** Les humains font **toujours**
   le `pull` et le `push` eux-mêmes via **GitHub Desktop**.
   - ✅ **Autorisé pour l'IA** : faire un **`commit` en local**, avec un **titre** et une
     **description** clairs (voir [`CONTRIBUTING.md`](CONTRIBUTING.md) pour le format).
   - ❌ **Interdit pour l'IA** : `push`, `pull`, `fetch`, `merge`, créer/fusionner une Pull
     Request, changer de branche distante, ou toute action qui touche le dépôt distant GitHub.
   - Même si l'humain semble le demander, rappelle-lui que la synchro GitHub se fait à la main
     via GitHub Desktop. L'IA s'arrête au commit local.

---

## 5. Avant de considérer une tâche « terminée »

- [ ] Le code se lance sans erreur (`npm run dev`) — ou j'explique pourquoi ce n'est pas testable.
- [ ] J'ai mis à jour **la doc concernée** par mon changement (§0).
- [ ] Mes changements tiennent dans un **périmètre clair** (une tâche = une idée).
- [ ] Je résume à l'humain **ce que j'ai changé et quels fichiers**, en français, clairement.
- [ ] Je n'ai pas fait d'action Git risquée sans autorisation (§4.6).

---

## 6. Où trouver quoi

| Besoin | Fichier |
|--------|---------|
| Vue d'ensemble + démarrage | [`README.md`](README.md) |
| Installer l'environnement | [`docs/00-SETUP.md`](docs/00-SETUP.md) |
| Workflow Git / conflits | [`docs/01-WORKFLOW-GIT.md`](docs/01-WORKFLOW-GIT.md) |
| Structure & conventions | [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) |
| Concept & game design | [`docs/03-GAME-DESIGN.md`](docs/03-GAME-DESIGN.md) |
| Le monde de Beauvais | [`docs/04-MONDE-BEAUVAIS.md`](docs/04-MONDE-BEAUVAIS.md) |
| Règles de contribution | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

> 📝 **Ce fichier `AGENTS.md` doit lui aussi rester à jour.** Si la stack, les conventions ou les
> règles changent, mets-le à jour ici en priorité — c'est le premier fichier que lisent les IA.
