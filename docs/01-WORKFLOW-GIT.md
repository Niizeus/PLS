# 🔀 01 — Workflow Git : bosser à 2 sans se marcher dessus

> **C'est le document le plus important du projet.** Lisez-le tous les deux **avant** de coder.
> Il répond à la question : *"si on modifie le même fichier en même temps, que se passe-t-il ?"*

---

## 🥇 Les 6 règles d'or

1. **Toujours faire `Pull` avant de commencer à coder** (récupérer le travail de l'autre).
2. **Jamais coder directement sur `main`** — on crée une **branche** par tâche.
3. **Petits commits, souvent** — plus c'est petit, plus c'est facile à fusionner.
4. **Push régulièrement** (au moins à chaque fin de session).
5. **On se répartit les fichiers** — chacun son domaine (voir [Architecture](02-ARCHITECTURE.md)).
6. **On se prévient** quand on va toucher un fichier "partagé".

Respecte ça et tu n'auras quasiment **jamais** de conflit.

> 🤖 **Rôle de l'IA vs humain :** l'IA peut écrire du code et faire des **commits en local**
> (titre + description). Mais c'est **toujours toi (l'humain) qui fais le `Pull` et le `Push`**
> via **GitHub Desktop**. L'IA ne synchronise jamais avec GitHub. Comme ça, tu gardes le
> contrôle de ce qui part sur le dépôt partagé.

---

## ❓ TA QUESTION : "et si on code le même fichier tous les deux ?"

Réponse courte : **Git s'en sort presque toujours tout seul, et rien n'est jamais "corrompu".**

Il y a 2 cas :

### Cas 1 — vous modifiez des **endroits différents** du fichier ✅
Exemple : toi tu changes la fonction du haut, ton pote change la fonction du bas.
→ Git **fusionne automatiquement** les deux. Aucun problème, tu ne remarques même rien.

### Cas 2 — vous modifiez **la même ligne** (ou juste à côté) ⚠️
→ Git ne peut pas deviner quelle version garder. Il crée un **conflit de fusion** (*merge conflict*).
Ce n'est **pas** un fichier cassé : Git garde **les deux versions** côte à côte, comme ça :

```
<<<<<<< VOTRE VERSION
const vitesse = 10;
=======
const vitesse = 15;
>>>>>>> VERSION DE TON POTE
```

Ton boulot : **choisir** la bonne version (ou combiner les deux), puis effacer les lignes
`<<<<<<<`, `=======`, `>>>>>>>`. C'est tout. Tu enregistres, tu commits, c'est réglé.

> 🛟 **Rien n'est jamais perdu.** Git garde tout l'historique. Même si tu te trompes en
> résolvant un conflit, on peut revenir en arrière. C'est fait pour être sûr.

### Comment on **évite** presque tous les conflits
- **Architecture modulaire** : beaucoup de petits fichiers plutôt qu'un gros → vous touchez rarement le même.
- **Répartition claire** : chacun son domaine (map / gameplay / UI...).
- **Pull avant de coder** + petites branches courtes.
- **Communication** : "je touche à `player.ts` cet aprem, laisse-le moi".

---

## 🔁 Le cycle de travail au quotidien (avec GitHub Desktop)

À faire **à chaque session de code** :

### 1. Avant de commencer → récupérer les nouveautés
Dans GitHub Desktop : bouton **`Fetch origin`** puis **`Pull origin`** (s'il propose).
→ Tu as maintenant le travail le plus récent de ton pote.

### 2. Créer une branche pour ta tâche
`Current branch` → `New branch`. Nomme-la clairement :

```
feature/deplacement-personnage
feature/map-cathedrale
fix/bug-collision-voiture
```

> Une **branche** = une copie de travail isolée. Tu bosses dedans sans gêner `main`
> ni ton pote. C'est l'astuce n°1 pour ne pas se marcher dessus.

### 3. Coder + commiter petit à petit
Après chaque bout de travail qui marche :
- GitHub Desktop montre tes changements à gauche
- Écris un **message de commit** clair (voir [CONTRIBUTING](../CONTRIBUTING.md))
- Clique **`Commit to feature/...`**

### 4. Publier ta branche
Clique **`Publish branch`** (la 1ʳᵉ fois) ou **`Push origin`** (les fois suivantes).
→ Ton travail est sauvegardé sur GitHub, ton pote peut le voir.

### 5. Fusionner dans `main` via une Pull Request (PR)
- GitHub Desktop propose **`Create Pull Request`** → ça ouvre GitHub dans le navigateur
- Crée la PR, décris ce que tu as fait
- **Ton pote y jette un œil** (review), puis **`Merge`**
- Une fois fusionné : supprime la branche, et **tout le monde refait un `Pull` sur `main`**

> 💡 La Pull Request, c'est le "sas" avant d'entrer dans `main`. Ça permet de relire,
> de commenter, et d'attraper les problèmes **avant** qu'ils cassent la version principale.

---

## 🧩 Résoudre un conflit (pas de panique)

Si GitHub Desktop dit *"conflicts"* au moment de fusionner :

1. Il te liste les fichiers en conflit.
2. Clique **`Open in Visual Studio Code`**.
3. VS Code surligne les zones en conflit et propose des boutons :
   **`Accept Current`** / **`Accept Incoming`** / **`Accept Both`**.
4. Choisis, vérifie que le code a du sens, enlève les marqueurs `<<<`/`===`/`>>>` s'il en reste.
5. Enregistre → reviens sur GitHub Desktop → **`Commit merge`**.

C'est fini. Si tu bloques : **ne force rien**, demande à ton IA "aide-moi à résoudre ce conflit
Git" en lui montrant le fichier.

---

## 🚫 À ne PAS faire

- ❌ Coder à deux sur le même fichier en même temps sans se prévenir.
- ❌ Rester des jours sans push (plus tu attends, plus le conflit est gros).
- ❌ Faire des commits géants ("j'ai tout changé") — impossible à relire/fusionner.
- ❌ Envoyer `node_modules/` ou des gros fichiers non prévus (voir `.gitignore`).
- ❌ Bosser sur `main` directement.

---

## 🆘 Antisèche des mots

- **main** : la branche principale, la version "officielle" du jeu.
- **branche (branch)** : une ligne de travail isolée pour une tâche.
- **commit** : une sauvegarde d'un ensemble de changements, avec un message.
- **push** : envoyer tes commits sur GitHub.
- **pull / fetch** : récupérer les commits des autres depuis GitHub.
- **Pull Request (PR)** : demande de fusionner ta branche dans `main`, avec relecture.
- **merge** : fusionner deux branches.
- **conflit (merge conflict)** : quand Git ne sait pas quelle version garder → tu choisis à la main.
