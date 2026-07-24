# 📦 00 — Installer son environnement

Ce guide part de zéro. Suis-le **dans l'ordre**, une seule fois, sur ta machine.
Si un mot te bloque, il est expliqué à la fin ([Glossaire](#-glossaire)).

---

## 1. Installer les 3 outils de base

| Outil | À quoi ça sert | Lien |
|-------|----------------|------|
| **Node.js** (version LTS) | Fait tourner le projet et installe les librairies | https://nodejs.org |
| **Visual Studio Code** | L'éditeur de code | https://code.visualstudio.com |
| **GitHub Desktop** | Synchronise le dossier avec GitHub (sans ligne de commande) | https://desktop.github.com |

> Prends toujours la version **LTS** de Node (la plus stable), pas la "Current".

**Vérifier que Node est bien installé** — ouvre un terminal et tape :

```bash
node --version
```

Tu dois voir un numéro (ex : `v20.x.x`). Si oui, c'est bon.

---

## 2. Récupérer le projet (le "cloner")

1. Ouvre **GitHub Desktop**
2. Connecte-toi avec ton compte GitHub (celui qui a accès au dépôt `Niizeus/PLS`)
3. `File` → `Clone repository` → onglet **GitHub.com** → choisis **PLS**
4. Choisis un dossier sur ton PC où le mettre → **Clone**

Tu as maintenant une copie du projet sur ta machine. 🎉

> ⚠️ Un seul dossier `PLS` synchronisé suffit. Ne le copie-colle pas ailleurs à la main,
> sinon tu auras deux versions qui divergent.

---

## 3. Installer les librairies du jeu

Dans GitHub Desktop : `Repository` → `Open in ...` → ouvre un terminal dans le dossier,
**ou** ouvre le dossier dans VS Code puis `Terminal` → `New Terminal`. Puis :

```bash
npm install
```

Ça télécharge tout ce dont le jeu a besoin (ça peut prendre 1-2 minutes).
Ça crée un dossier `node_modules/` — **c'est normal, on ne l'envoie jamais sur GitHub** (voir `.gitignore`).

---

## 4. Lancer le jeu

```bash
npm run dev
```

Ouvre l'adresse affichée (souvent `http://localhost:5173`) dans ton navigateur.
Pour arrêter : reviens dans le terminal et fais `Ctrl + C`.

> ✅ La base du jeu existe : tu dois voir un **terrain de test cartoon** avec **Chibrux**
> déplaçable (ZQSD), une caméra qui le suit et un compteur FPS. La liste des contrôles est
> dans le [README](../README.md#-ce-qui-tourne-déjà-prototype-jouable).

---

## 5. (Plus tard) Outils pour l'export en `.exe`

Tant qu'on développe dans le navigateur, **pas besoin**. Le jour où on veut un vrai `.exe` :
- Installer **Rust** (https://rustup.rs) — nécessaire pour **Tauri**
- Suivre la doc Tauri v2 : https://v2.tauri.app

On s'en occupera dans une phase dédiée, pas maintenant.

---

## 🧾 Glossaire

- **Cloner** : télécharger une copie du projet depuis GitHub sur ton PC, reliée au dépôt.
- **Dépôt (repository / repo)** : le projet versionné, hébergé sur GitHub.
- **npm** : l'outil (fourni avec Node) qui installe les librairies.
- **Librairie / package** : du code déjà écrit par d'autres qu'on réutilise.
- **Terminal** : la fenêtre où on tape des commandes.
- **Serveur de dev (`npm run dev`)** : lance le jeu en local pour le tester pendant qu'on code.
