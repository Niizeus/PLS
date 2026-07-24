# 🎨 03 — Game Design Document (GDD)

Le "cahier des idées" du jeu. Il évolue avec le projet — n'hésitez pas à le compléter.

---

## 🎯 Le pitch (en une phrase)

Un jeu **3D fun et déjanté** où l'on incarne (ou côtoie) **notre pote**, à travers des missions
qui font **référence à sa vraie vie**, dans une version cartoon de **Beauvais**, avec la liberté de
faire des **actions parfois... discutables** 😈.

---

## 🕹️ Le gameplay

### Boucle de jeu (le cœur du fun)
> À définir ensemble. Piste de départ :

1. Le joueur se balade **librement** dans Beauvais (monde ouvert light).
2. Il rencontre des **PNJ** et déclenche des **missions** liées à la vie du pote.
3. Chaque mission propose des choix : la faire "bien"... ou faire une **action mauvaise/absurde**
   (plus fun, mais avec des **conséquences** : réputation, réactions des PNJ, mini-chaos).
4. Réussir/rater rapporte un **score** ou débloque du contenu.

### Ton du jeu
- **Humour** avant tout, second degré, private jokes entre potes.
- Les "actions mauvaises" restent **cartoon et bon enfant** (pas glauque) : semer la pagaille,
  faire des bêtises, troller les PNJ. On veut faire **rire**, pas mettre mal à l'aise.

### Idées de mécaniques (à trier)
- [ ] Déplacement du personnage en 3D (marche / course / véhicule ?)
- [ ] Système de missions/quêtes piloté par des fichiers `data/quests.json`
- [ ] Jauge de "réputation" ou de "chaos"
- [ ] Interactions avec des PNJ (dialogues)
- [ ] Objets à ramasser / utiliser
- [ ] Mini-jeux ponctuels

---

## 👤 Le pote & les références (à remplir ensemble)

> Section à compléter avec les vraies infos (on peut mettre ça dans `src/data/` en JSON ensuite).

- **Le perso principal** : ...
- **Traits / manies à caricaturer** : ...
- **Lieux de sa vie à mettre dans le jeu** : ...
- **Private jokes / phrases cultes** : ...
- **PNJ inspirés de son entourage** : ...

---

## 🎨 Direction artistique : cartoon / BD cell-shading

Objectif : un rendu **BD animée**, aplats de couleur, contours nets.

### Comment on le fait techniquement (React Three Fiber / Three.js)
- **Matériau toon** : `MeshToonMaterial` + une **gradient map** (dégradé à 2-3 paliers) →
  l'éclairage devient "par tranches" au lieu d'être lisse = look cartoon.
- **Contours (outline)** : le composant `<Outlines>` de `@react-three/drei`, ou un effet de
  post-traitement (`@react-three/postprocessing`) pour cerner les objets d'un trait noir.
- **Palette** : couleurs vives et franches, peu de nuances.
- **Ombres** : douces et stylisées, pas réalistes.

### Style à viser (références visuelles à collecter)
- [ ] Coller ici des liens/images d'inspi (style Borderlands, jeux "toon", BD franco-belge...).

---

## 🔊 Ambiance sonore
- Musique légère/humoristique.
- Bruitages exagérés (cartoon).
- Ambiance sonore de ville (voir [monde de Beauvais](04-MONDE-BEAUVAIS.md)).

---

## 🧱 Comment ça se traduit dans le code
| Élément de design | Où ça vit dans le code |
|-------------------|------------------------|
| Missions / quêtes | `src/data/quests.json` + `src/gameplay/` |
| Actions "mauvaises" | `src/gameplay/actions/` |
| Dialogues & réfs perso | `src/data/` |
| Look cell-shading | `src/shaders/` + matériaux dans `src/world/` & `src/entities/` |
| Personnages | `src/entities/` |
