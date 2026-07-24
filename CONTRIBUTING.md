# 🤝 Contribuer au projet PLS

Petites règles communes pour bosser proprement à deux. Rien de rigide, juste de quoi éviter
le bazar. (Le "comment" détaillé de Git est dans [docs/01-WORKFLOW-GIT.md](docs/01-WORKFLOW-GIT.md).)

---

## 🌿 Nommer ses branches

```
feature/<ce-que-je-fais>     ← nouvelle fonctionnalité   → feature/deplacement-joueur
fix/<le-bug>                 ← correction de bug          → fix/collision-mur
docs/<le-sujet>              ← documentation              → docs/maj-game-design
```

Une branche = une tâche. On la fusionne, puis on la supprime.

---

## 💬 Messages de commit

Format simple et lisible :

```
<type>: <ce que fait le commit, à l'impératif>
```

**Types** : `feat` (nouveauté), `fix` (bug), `docs`, `style`, `refactor`, `assets`, `chore`.

Exemples :
```
feat: ajoute le déplacement du personnage
fix: corrige la caméra qui traverse les murs
docs: complète le game design
assets: ajoute le modèle 3D de la cathédrale
```

> Un commit = **une** idée. Évite le "j'ai tout changé" fourre-tout.

---

## 🧑‍🤝‍🧑 Se répartir le travail

- On suit la répartition par domaines de [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md).
- Avant de toucher un fichier "du domaine de l'autre" : **on se prévient**.
- On **pull avant** de commencer, on **push après** avoir bossé.

---

## ✅ Avant de fusionner dans `main`
- [ ] Le jeu se lance (`npm run dev`) sans erreur.
- [ ] Mes commits ont des messages clairs.
- [ ] J'ai ouvert une **Pull Request** et l'autre y a jeté un œil.

---

## 📦 Gros fichiers (modèles 3D, sons, textures)

Git n'aime pas trop les gros fichiers binaires. Si on commence à ajouter de **gros assets**
(> ~10 Mo), on mettra en place **Git LFS** (Large File Storage). En attendant, on garde les
assets raisonnables et bien rangés dans `src/assets/`.
