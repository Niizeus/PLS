# 🎨 03 — Game Design Document (GDD)

Le "cahier des idées" du jeu. Il évolue avec le projet — n'hésitez pas à le compléter.

---

## 🎯 Pitch

**PLS** est un jeu vidéo **3D sandbox, cartoon / BD cell-shading**, où le joueur incarne
**Chibrux**, directement inspiré de notre pote réel mais caricaturé à fond.

Le seul grand objectif est clair :

> **Quitter Beauvais coûte que coûte.**

La ville est reproduite à partir du vrai Beauvais, mais elle est bloquée par des travaux partout :
impossible de s'échapper simplement par la route. Le joueur doit donc trouver un autre moyen de
partir, légal, absurde, criminel, politique ou psychédélique.

---

## 🧭 Structure globale

Le jeu mélange deux rythmes :

1. **La journée classique** : Chibrux se lève, gère ses besoins, peut aller travailler, mange,
   boit, fume, se lave, sort en ville puis dort.
2. **Le dérapage sandbox** : à tout moment, le joueur peut sécher le travail, voler un véhicule,
   provoquer le chaos, consommer, explorer, commettre des délits ou chercher une route de fuite.

Le jeu a une **limite de temps**. Chaque journée compte : travailler rapporte peu mais sécurise un
minimum d'argent, tandis que les plans risqués peuvent faire avancer plus vite vers une fin.

---

## 🏁 Objectif et fins

Il n'y a pas une quête principale linéaire. Le jeu suit un objectif unique, mais les fins émergent
selon les actions du joueur.

### Routes de fuite prévues

- **Fuite économique** : accumuler assez d'argent ou de patrimoine pour partir par le train,
  l'avion ou un autre moyen légal.
- **Fuite psychédélique** : consommer assez de substances pour quitter le monde physique et
  atteindre le monde psychique.
- **Fuite souterraine** : découvrir un passage par les égouts.
- **Fuite politique** : devenir maire de Beauvais et faire lever les travaux qui bloquent la ville.
- **Routine / échec** : suivre sa vie sans réussir à partir, jusqu'à une fin absurde ou amère.

Les fins peuvent être heureuses, ridicules, sombres mais comiques, humiliantes ou secrètes. Elles
dépendent du temps restant, de l'argent, des stats, des drogues, des crimes, des objets, des
rencontres et des chemins explorés.

---

## ⏰ Boucle quotidienne

### Matin

Chibrux se réveille vers **8h00** dans son appartement au quartier Saint-Lucien.

Il doit gérer ses besoins :

- manger
- boire / prendre un café
- aller aux toilettes
- fumer
- se laver
- préserver son mental

### Travail du matin

Chibrux travaille comme éducateur. Le travail prend la forme de mini-jeux chaotiques, stressants
et absurdes.

Exemple de mini-jeu : courir après des jeunes qui partent dans tous les sens et les ramener dans
une zone précise avant la fin du temps imparti.

> Intention importante : le mini-jeu doit être drôle par son chaos et par la galère de Chibrux,
> sans stigmatiser les personnes handicapées.

### Pause midi

Moment libre en ville :

- manger au snack, au kebab ou au market
- faire des achats
- croiser des PNJ
- déclencher des quêtes annexes
- provoquer le chaos
- jouer à des mini-jeux

### Travail de l'après-midi

Deuxième séquence de travail, avec un autre mini-jeu ou une variante du mini-jeu du matin.

### Soirée libre

De **17h00 à minuit**, Chibrux est libre :

- explorer Beauvais
- sortir dans les bars
- améliorer ses stats
- acheter ou revendre des objets
- chercher des pistes de fuite
- voler, taguer, se battre ou fuir la police
- consommer pour accéder à des effets ou événements spéciaux

Il doit dormir avant de tomber d'épuisement.

### Travail et salaire

Aller au travail n'est **pas obligatoire**. Si Chibrux sèche, il ne touche pas son salaire.

Le salaire est **faible** et versé **chaque mardi**. Il permet surtout de survivre, pas de devenir
riche rapidement.

---

## 👤 Personnage : Chibrux

Le joueur incarne Chibrux. Ce n'est pas un personnage fictif détaché : c'est bien le pote, mais
dans une version exagérée, cartoon et absurde.

### Besoins dynamiques

Ces jauges évoluent pendant la journée :

- santé
- faim
- soif
- mental
- hygiène

Si elles descendent trop bas, elles peuvent provoquer des malus : fatigue, perte de contrôle,
mauvaise performance, hallucinations, évanouissement ou journée gâchée.

### Statistiques visibles

Chibrux possède des statistiques façon RPG, visibles dans l'interface :

- attaque
- défense
- agilité
- intelligence
- chance

Elles peuvent être augmentées ou modifiées par :

- quêtes annexes
- équipements
- aliments
- objets
- drogues
- événements spéciaux
- activités secondaires

---

## 🎒 Équipement

Chibrux possède plusieurs emplacements d'équipement :

- tête
- collier
- bijoux
- buste
- bras
- jambes
- pieds
- accessoire
- main droite
- main gauche

Les mains servent aux armes, outils ou objets utilisables. Les équipements peuvent donner des
bonus de stats, des effets spéciaux ou débloquer certaines interactions.

---

## 🚓 Police, délits et respawn

Le jeu assume une dimension **GTA-like cartoon**.

Le joueur peut notamment :

- voler des véhicules
- frapper des passants
- utiliser des armes débiles ou classiques
- taguer
- tirer avec un sniper à billes depuis l'appartement
- tirer au ballon sur des cibles
- provoquer des dégâts
- fuir la police

La police fonctionne avec un **niveau de recherche**. Plus Chibrux commet d'actions illégales,
plus la réponse policière devient agressive.

Chibrux peut se faire neutraliser ou tirer dessus facilement si la situation dégénère.

En cas de mort ou d'arrestation :

- il respawn dans son appartement
- il perd de l'argent à cause des amendes
- il perd sa drogue
- il garde le reste de son inventaire

Il n'y a pas de système de réputation global. Les conséquences passent par le niveau de recherche,
les amendes, les pertes, le temps perdu et les opportunités ratées.

---

## 🌈 Drogues et monde psychique

Les drogues sont une vraie mécanique de gameplay, pas seulement une blague de décor.

Elles peuvent :

- modifier temporairement les stats
- altérer la perception de Beauvais
- provoquer des hallucinations
- ouvrir des événements spéciaux
- faire baisser le mental
- débloquer l'accès au monde psychique

Il n'y a pas de besoin obligatoire lié à l'addiction : le joueur ne doit pas forcément reconsommer
pour survivre. Les substances servent surtout de leviers de gameplay, de transformation et de
progression.

Le **monde psychique** est une vraie zone jouable. Il peut devenir une route complète pour quitter
Beauvais autrement, en abandonnant le monde physique.

---

## 🚗 Véhicules

Les véhicules sont centraux pour traverser Beauvais à échelle 1:1.

Le joueur peut utiliser ou voler :

- voitures
- scooters
- vélos
- véhicules spéciaux selon les lieux
- karts dans une activité dédiée

Même si les sorties routières sont bloquées par les travaux, les véhicules restent essentiels pour
circuler, fuir la police, faire des missions ou provoquer le chaos.

**Deja en place :** un **scooter** et une **voiture prototype** conduisibles (`src/entities/vehicles/`).
On s'en approche et on monte/descend avec **E** ; conduite a ZQSD (accelere, freine/recule, braque).
La voiture sert de premier test d'echelle et de feeling : conduite arcade plus lourde, direction lissee,
freinage plus progressif et rebond amorti contre les obstacles. Les vehicules partagent un noyau de
conduite commun (`vehicleDriving.ts`) avec des reglages propres a chaque type.
Les deplacements utilisent maintenant une collision a sous-pas avec empreinte simplifiee,
pour limiter les traversees de batiments a vitesse voiture. La camera est reglee plus proche,
avec un suivi plus nerveux en vehicule et une collision mur plus dense.
Quand le joueur conduit, un tableau de bord affiche la vitesse reelle en km/h avec aiguille et
compteur numerique, ainsi qu'une jauge d'essence prevue pour la future boucle de ravitaillement.
Chaque vehicule garde sa station radio attribuee : au premier demarrage, une des cinq radios est choisie aleatoirement, puis elle reste la meme quand on descend et qu'on remonte. **La touche R change de station** (elle tourne en boucle sur les cinq) ; le choix est memorise sur le vehicule, donc chaque caisse garde SA station. La touche est rappelee sur le tableau de bord, a cote du nom de la station. Les stations utilisent une timeline mondiale commune : si deux sources diffusent R01, elles doivent pointer vers le meme morceau et le meme moment de diffusion.
Le contenu des stations est **detecte sur disque**, pas ecrit en dur : chaque fichier audio depose dans `public/musique/radio/RXX_Nom/` entre dans la programmation, quel que soit son nom. Le titre affiche sur le tableau de bord est deduit du nom du fichier. Voir `public/musique/radio/README.md`.

Les emissions programmees ont des horaires fixes dans le temps du jeu : chaque sous-dossier de `Emissions/` occupe une tranche d'une heure a partir de 18h00, dans l'ordre alphabetique. Un episode est choisi par jour de jeu, dans l'ordre, puis la liste boucle. Premiere grille en place : `La_Zone_Libre` (TekRadz), `Derriere_La_Chanson` (Franchon), `Zone_De_Clash` (NRV), `La_France_En_Danger` (Lys France), `Starzone` (Alterz), de 18h00 a 19h00.

---

## 🧩 Activités et mini-jeux

Idées de contenus secondaires :

- karting
- casino / jeux d'argent
- tickets à gratter
- mini-jeu "pisse ta bière" : reproduire une forme dans un temps limité, sinon Chibrux se rate
- sniper à billes depuis la fenêtre de l'appartement
- tirs au ballon sur des cibles : fenêtres, poubelles, commissariat, voitures
- tags
- quêtes annexes absurdes données par des PNJ inutiles
- vol de voitures
- poursuites
- bagarres
- revente d'objets ou d'or

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

### Style à viser

- [ ] Ajouter des références visuelles : Borderlands, jeux toon, BD franco-belge, cartoon adulte.

---

## 🔊 Ambiance sonore

- Musique légère, drôle ou nerveuse selon les moments.
- Les cinq radios de depart sont des flux coherents du monde, pas des pistes relancees a zero par objet.
  **TekRadz** (R01, tekno underground militante), **Franchon** (R02, musique francaise),
  **NRV** (R03, rap et clashs), **Lys France** (R04, info reactionnaire satirique) et
  **Alterz** (R05, pop commerciale internationale). Identites completes dans
  `docs/Documentations RADIO/Identite des radios du jeu.pdf`.
- Les radios sont structurees en musiques, jingles, pubs et emissions programmees.
- Bruitages exagérés façon cartoon.
- Ambiance sonore de ville : circulation, pluie, bars, gare, parc, commissariat.
- Ambiance psychédélique distincte dans le monde psychique.

---

## 🧱 Comment ça se traduit dans le code

| Élément de design | Où ça vit dans le code |
|-------------------|------------------------|
| Missions / fins / routes de fuite | `src/data/quests.json` + `src/gameplay/` |
| Routine quotidienne | `src/gameplay/time/` + `src/gameplay/needs/` |
| Travail et salaire | `src/gameplay/work/` |
| Besoins du joueur | `src/gameplay/needs/` |
| Stats RPG | `src/gameplay/stats/` |
| Actions illégales | `src/gameplay/actions/` |
| Police / niveau de recherche | `src/gameplay/police/` |
| Drogues et monde psychique | `src/gameplay/substances/` + `src/world/psychic/` |
| Dialogues & réfs perso | `src/data/` |
| Look cell-shading | `src/shaders/` + matériaux dans `src/world/` & `src/entities/` |
| Personnages | `src/entities/` |
| Véhicules | `src/entities/vehicles/` |
| Radios / audio | `src/audio/` + fichiers `.wav` dans `public/musique/radio/` |
