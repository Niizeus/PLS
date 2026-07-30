# 🎨 03 — Game Design Document (GDD)

Le "cahier des idées" du jeu. Il évolue avec le projet — n'hésitez pas à le compléter.

**Statut : source principale des décisions gameplay.** Ce document décrit ce que le jeu doit être :
boucles, systèmes, intentions, conséquences et feeling. Les détails techniques trop précis doivent
être déplacés plus tard vers l'architecture ou une doc système dédiée si le fichier devient trop
lourd.

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
- bijoux
- buste
- bras
- jambes
- pieds

Les équipements peuvent donner des bonus de stats, des effets spéciaux ou débloquer certaines
interactions. Les armes et objets utilisables ne sont pas des emplacements d'équipement séparés :
ils passent par l'inventaire, les raccourcis rapides et l'objet actif du joueur.

---

## 🎒 Inventaire sac à dos

L'inventaire doit être repensé comme un **sac à dos physique**, avec une place limitée sur une
grille. L'objectif est d'avoir un mini puzzle lisible et amusant : le joueur ne gère pas seulement
un poids maximum, il doit aussi organiser ses objets.

Direction validée :

- inventaire principal en grille, par exemple **8 x 5** au départ, à ajuster après test en jeu ;
- chaque objet occupe une taille claire : `1x1`, `1x2`, `2x2`, `1x4`, `2x3`, etc. ;
- les formes rectangulaires suffisent pour la première version ; les formes plus complexes peuvent
  venir plus tard si elles apportent vraiment du fun ;
- les objets peuvent garder un poids, mais le poids devient secondaire par rapport à la place prise ;
- certains contenants peuvent modifier l'espace disponible : sac plastique, sac de sport, coffre de
  voiture, boîte à outils, planque dans l'appartement ;
- les objets équipés ne prennent pas forcément de place dans le sac, mais ils doivent pouvoir y
  retourner si le joueur les retire.

Chaque item doit être décrit par une structure commune, pensée comme une base de données de contenu :
nom, catégorie, rareté, prix, taille, poids, icône, modèle, effets, tags, légalité, durabilité,
stack éventuel et description. Le but est de pouvoir créer beaucoup d'objets sans recoder le
système à chaque fois.

À terme, l'éditeur PLS devra proposer un **éditeur d'items** : formulaire, aperçu d'icône, aperçu
dans la grille, validation des champs et bouton pour tester l'objet en jeu.

---

## 📱 Smartphone

Le smartphone de Chibrux doit devenir un **hub diégétique** : une interface qui existe dans le monde
du jeu, pas seulement un menu abstrait.

Applications prévues :

- **Options** : paramètres du jeu ;
- **Contacts** : appels, messages, quêtes, embrouilles, plans, réponses au téléphone ;
- **Appareil photo** : photos de preuves, indices, missions, souvenirs ou publications ;
- **Santé / Sport** : besoins, constantes, stats, fatigue, effets temporaires, substances ;
- **Boutiques** : achats en ligne, livraisons, arnaques, objets rares ;
- **Réseaux** : rumeurs, conséquences des actes, vidéos, tensions entre quartiers ;
- **Carte / GPS** : lieux connus et points d'intérêt découverts ;
- **Banque** : argent, salaire, amendes, dettes éventuelles ;
- **Notes** : indices découverts sur les pistes pour quitter Beauvais.

Le téléphone peut être cassé, sans batterie ou sans réseau dans certains cas, mais ces contraintes
doivent rester ponctuelles. Elles doivent créer des situations drôles ou tendues, pas empêcher le
joueur de jouer confortablement.

### Ce qui existe déjà en jeu

Un **premier prototype jouable** est en place. Il applique la règle « le téléphone **consulte** les
systèmes existants, il ne duplique jamais les données ».

- **Touche `P`** : sortir / ranger le téléphone. **`Échap`** : revenir à l'accueil, puis le ranger.
- **Le jeu ne se met PAS en pause** : c'est un objet du monde, pas un menu. La ville continue de
  tourner, et le téléphone reste utilisable en voiture (il se décale à gauche du tableau de bord).
- Il s'affiche **en bas à droite**, sans masquer les stats (à gauche) ni la minimap (en haut à
  droite) — contrairement à l'inventaire et à la carte, qui sont plein écran.
- **Accueil** : grille de 9 icônes, navigable à la **souris** ou aux **flèches + Entrée**. Le fond
  d'écran suit l'heure du jeu (il réutilise les couleurs du cycle jour/nuit).
- **Applications qui marchent** :
  - `Santé` — vitaux, caractéristiques, effets en cours, zone. Tout est lu dans les stores du jeu.
  - `Notes` — les pistes pour quitter Beauvais (contenu : `src/data/phoneNotes.ts`).
  - `GPS` — carte vivante centrée sur le joueur (3 crans de zoom), lieux les plus proches avec
    leur distance et leurs **horaires d'ouverture**, plus les points de passage posés sur la
    grande carte. Réutilise `ui/mapDraw.ts`, `data/mapMarkers.json` et `gameplay/map/waypoints.ts`.
  - `Photo` — prend de **vraies captures de la vue du jeu**, avec pellicule (12 photos max, en
    mémoire), agrandissement et suppression. Le HUD n'apparaît pas sur la photo.
  - `Contacts` — répertoire et conversations. Les messages sont **figés**
    (`src/data/phoneContacts.ts`) : répondre et appeler attendent les PNJ et les dialogues.
  - `Réglages` — uniquement ce qui existe vraiment : volume de la radio et filtre « vieux poste »
    (`audio/radioStore.ts`). Le reste est listé comme « pas encore branché ».
- **Applications prévues mais pas encore développées** (Banque, Boutiques, Réseaux) : icônes
  grisées qui ouvrent un écran **« pas encore branché »** expliquant ce qui manque. Le téléphone ne
  fait jamais semblant et n'invente aucun chiffre.
- **Ajouter une application** = créer un fichier dans `src/ui/phone/apps/` + une entrée dans
  `src/ui/phone/apps.tsx`. Rien d'autre à toucher.

Restent à faire (voir [07 - Backlog d'idées § Prototype du téléphone](07-BACKLOG-IDEES.md#-2-prototype-du-téléphone)) :
un vrai **système de paramètres joueur** (le panneau `F2` est dev-only et doit le rester), la
**manette** (aucune couche d'entrées manette n'existe), l'**argent / la réputation / les missions**
(les apps Banque, Boutiques et Réseaux les attendent), la **sauvegarde des photos** (elles vivent
en mémoire) et une **batterie** (l'icône est décorative).

> 🔍 Détail technique à connaître pour l'app Photo : on ne peut lire le canvas WebGL que **juste
> après le rendu de l'image**, sinon le navigateur a déjà effacé le tampon. C'est le rôle de
> `gameplay/phone/PhoneCameraCapture.tsx`, monté dans la scène avec la priorité `FRAME.CAPTURE`
> (voir `core/framePriority.ts`). L'alternative (`preserveDrawingBuffer`) coûterait des perfs à
> **chaque** image pour un usage ponctuel.

---

## 🥊 Combat au corps à corps

### Attaquer (clic gauche)

**À mains nues** (rien d'équipé, ou juste le « Poing basique ») : un **enchaînement de 3 coups**.
Chaque clic joue le coup suivant — poing 1, poing 2, poing 3 — à condition de recliquer assez
vite. Si on attend trop, l'enchaînement retombe et le clic suivant repart au coup n°1. Après le
3e coup, on repart aussi au coup n°1.

**Avec une arme active** (catégorie `arme`/`arme_lancer` — ex : la pelle) : une **animation
d'attaque différente**, sans enchaînement pour l'instant.

> ⏳ L'animation d'arme n'existe pas encore : en attendant, l'attaque à l'arme rejoue le 1er coup
> de poing. Le mode d'emploi pour brancher le futur FBX est écrit en commentaire dans
> `src/entities/player/PlayerModel.tsx` (constante `ATTACK_TO_ANIM`).

### Se défendre (clic droit maintenu)

Chibrux lève sa **garde** (animation dédiée, jouée en boucle) et reste planté : en défense on ne
se déplace pas et on ne saute pas. Plus lisible, plus tactique.

### Encaisser (animation « Hurt »)

Dès que la **santé baisse** (coup reçu, faim/soif à zéro, etc.), Chibrux joue l'animation de
douleur. Pendant ce court instant il est **sonné** : il ne bouge plus, ne frappe plus, ne saute
plus, et l'enchaînement en cours est cassé. N'importe quel système peut déclencher ça avec
`usePlayerStore.getState().takeHit()`.

### Réglages

Toutes les durées (les 3 coups, la fenêtre d'enchaînement, l'attaque à l'arme, la durée du
« sonné ») se règlent au même endroit : `src/entities/player/playerConfig.ts`. Les animations
sont **calées sur ces durées**, donc changer une valeur change vraiment la vitesse du geste.

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

## 🧱 Quartiers, gangs et tensions locales

Beauvais est découpée en **4 grands quartiers rivaux**, plus le **centre-ville**. Le centre-ville
n'est pas un territoire de gang : il est contrôlé par la ville, donc par la police et les autorités.

Intention :

- chaque quartier peut avoir ses groupes, ses habitudes, ses lieux, ses PNJ et son ambiance ;
- les groupes rivaux peuvent s'intimider, se battre ou se tirer dessus s'ils se croisent ;
- le centre-ville agit comme une zone plus surveillée : si des groupes rivaux y traînent ou y
  provoquent le chaos, la police intervient plus vite ;
- Chibrux peut déclencher, aggraver ou calmer certaines tensions par ses actions ;
- les rivalités doivent faire vivre Beauvais même quand le joueur ne fait rien.

Le système doit rester sandbox et lisible. Le joueur ne doit pas avoir l'impression d'une guerre
permanente qui bloque toute la ville : les affrontements doivent être localisés, déclenchés par des
conditions claires, et servir à créer des opportunités, du danger ou des scènes absurdes.

Exemples de facteurs de tension :

- heure de la journée ou de la nuit ;
- quartier traversé ;
- présence policière ;
- PNJ important blessé ou tué ;
- tag, vol, agression ou humiliation publique ;
- mission terminée pour un groupe ;
- rumeur diffusée par le smartphone ou la radio.

---

## 👥 PNJ et vie du monde

Les PNJ doivent être pensés comme des entités data-driven, proches des items dans leur logique de
création : une structure commune, puis beaucoup de fiches différentes.

Types de PNJ :

- **PNJ nommés** : personnages uniques, liés à des quêtes, boutiques, dialogues ou conséquences ;
- **PNJ fonctionnels** : vendeurs, policiers, collègues, dealers, agents municipaux, etc. ;
- **foule ambiante** : passants et présences de fond, utiles pour donner vie aux rues.

Les PNJ importants doivent avoir une routine : horaires, lieux, déplacements, réactions, dialogues,
relations et comportement en cas de chaos. Si le joueur tue un PNJ important, il ne doit pas
réapparaître comme si rien ne s'était passé. Sa disparition peut fermer une opportunité, changer une
boutique, modifier une tension de quartier, provoquer une rumeur, attirer la police ou créer une
nouvelle situation.

La foule ambiante peut rester plus souple et respawner pour garder Beauvais vivante, mais les PNJ
nommés et fonctionnels doivent porter les vraies conséquences.

À terme, l'éditeur PLS devra proposer un **éditeur de PNJ** : fiche d'identité, modèle, quartier,
routine, dialogues, faction, rôle, réactions, état persistant et liens avec quêtes, boutiques ou
pistes de fuite.

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

### Commandes de conduite

⚠️ `src/gameplay/input/keyMap.ts` travaille en **`event.code`** (position physique de la touche),
pas en lettre imprimée. Sur AZERTY, le **A** est `KeyQ` — `KeyA` étant déjà le « Q » du ZQSD. Toute
nouvelle touche se déclare dans `keyMap.ts` **et** dans le rappel `src/ui/ControlsHint.tsx`.

| Touche | `event.code` | Effet |
|--------|--------------|-------|
| ZQSD | `KeyW/A/S/D` | Conduire ; **en l'air** : Z pique du nez, S cabre, Q/D font tourner la caisse |
| Espace | `Space` | Frein à main ; **maintenu sur le toit** : remet la voiture sur ses roues |
| A | `KeyQ` | Limiteur de vitesse (bascule) |
| F | `KeyF` | Klaxon (maintien) |
| L | `KeyL` | Phares (bascule) |
| R | `KeyR` | Station de radio suivante — le dernier cran est **poste éteint** |

**Limiteur de vitesse (A).** Premier appui : la vitesse **actuelle** devient le plafond. Deuxième
appui : coupé. En dessous de `LIMITER_MIN_SPEED` (25 km/h) l'enclenchement est refusé. Le limiteur
ne coupe pas les gaz d'un coup : la poussée moteur se referme progressivement sur la bande
`LIMITER_FADE_SPEED` (~11 km/h) qui précède le plafond, ce qui donne une arrivée sans à-coup.
⚠️ Il n'agit **que sur la poussée moteur** : freins, marche arrière et frein moteur restent entiers,
sinon on ne pourrait plus ralentir. Témoin discret « LIM xxx » sous le compteur.

**Frein à main et drift (Espace).** Le frein à main freine l'essieu **arrière uniquement**
(`HANDBRAKE_FORCE`) et lui retire l'essentiel de son adhérence latérale (`HANDBRAKE_REAR_GRIP`).
Le survirage n'est pas scripté : il **émerge** du déséquilibre avant/arrière (voir « Adhérence par
essieu » ci-dessous). Pendant la glisse, l'asservissement de trajectoire ne garde que
`DRIFT_STEER_AUTHORITY` de son autorité — sans ça il remettrait la voiture droite instantanément et
le frein à main ne serait qu'un frein. Le résultat dépend donc bien de la vitesse, de l'angle de
braquage **et** du sol (`SURFACE_GRIP_ROAD` / `SURFACE_GRIP_OFFROAD`).

**Adhérence par essieu.** L'adhérence latérale n'est plus une force unique au centre de gravité :
elle est répartie **moitié avant / moitié arrière** et appliquée aux essieux. Hors frein à main les
deux moitiés sont égales, leurs couples s'annulent et le comportement est identique à avant. Dès que
l'arrière décroche, le déséquilibre crée un couple de lacet — c'est tout le mécanisme du drift.
⚠️ Ne pas revenir à une force unique au centre : une force au centre de gravité ne fait jamais
tourner un corps, donc le drift deviendrait impossible.

**Effets de pneus.** Fumée grise sur bitume, poussière beige hors bitume, traces de gomme au sol.
Tout est piloté par les **vraies informations de contact** des suspensions Rapier — point de
contact, normale, glissement latéral mesuré sur le corps, nature du sol — publiées dans
`tireContactStore.ts`. Rien n'est deviné depuis la vitesse ou l'angle du volant.

**Contrôle en l'air.** Roues décollées, ZQSD pilote l'assiette en **vitesse de rotation cible**
(plafonnée par `AIR_MAX_RATE`) : réactif, mais pas de vrille instantanée ni de rotation absurde.
Sans consigne, `AIR_LEVEL_ASSIST` ramène doucement la caisse à plat pour rattraper un saut mal
négocié. Le pilotage aérien est volontairement **doux** : une voiture n'est pas un avion, on corrige
son assiette avant de se poser, on n'enchaîne pas les saltos. Sens des commandes (une seule
convention, en vol comme sur le toit) : **avant pique du nez, arrière cabre** — comme un manche à
balai qu'on pousse — et **la touche gauche/droite fait basculer la caisse de ce côté-là**.

**Sur le toit.** ⚠️ **Aucun rayon de suspension ne touche** (ils partent vers le ciel) : la voiture
est « en l'air » au sens du code alors qu'elle est posée. Le rétablissement est donc testé **avant**
le contrôle aérien, sinon on resterait bloqué à l'envers. Deux façons de s'en sortir, qui
cohabitent :
- **les flèches** appliquent un couple (`FLIP_TORQUE`) directement sur la caisse et la font
  **rouler** — on se débat, c'est plus vivant. Le réglage doit dépasser le couple de rappel de la
  gravité (≈ poids × demi-largeur, ~11 000 N·m pour la voiture), sinon la caisse frémit sans jamais
  basculer ;
- **le frein à main maintenu** `FLIP_RECOVERY_HOLD` secondes la repose d'aplomb : dépannage garanti
  quand on est coincé contre un mur.

**Klaxon (F).** Synthétisé en WebAudio (deux oscillateurs à la tierce), donc aucun fichier à charger
et un timbre différent par véhicule. Source positionnelle (`PannerNode`) suivant le véhicule,
oreille calée sur la caméra. Maintenir la touche **prolonge** le son au lieu d'en empiler un
nouveau, avec un plafond de 4 s.

**Phares (L).** Deux optiques `MeshBasicMaterial` (lumineuses par nature, coût nul) + deux
`SpotLight` en `castShadow={false}`. ⚠️ Éteints, les `SpotLight` sont **démontées**, pas mises à
`intensity={0}` : une lumière présente compte dans les uniformes de chaque matériau et force des
recompilations de shaders. C'est le point à ne pas « simplifier ».

**Radio éteinte.** Le poste coupé est un **cran du bouton R**, après la dernière station :
R01 → … → R05 → éteinte → R01. Ce n'est pas une sixième station muette — une station a un programme,
des jingles, une grille. Éteint, il n'y a rien à diffuser : ni musique, ni jingle, ni souffle. En
interne c'est `currentStationId === null` **avec** une `activeSource` toujours présente (à ne pas
confondre avec `activeSource === null`, qui veut dire « pas de poste ici », donc à pied). Le choix
est mémorisé par véhicule : une caisse laissée éteinte le reste.

**Deja en place :** un **scooter** et une **voiture Chevrolet FBX** conduisibles
(`src/entities/vehicles/`). On s'en approche et on monte/descend avec **E** ; conduite a ZQSD
(accelere, freine/recule, braque). Les vehicules partagent un noyau de physique commun
(`vehicleDriving.ts` + `vehicleEngine.ts`) avec des reglages propres a chaque type. La voiture
utilise `public/models/Vehicule/Voiture/Chevrolet.fbx` : le mesh de caisse et les meshes d'essieux
avant/arriere sont separes pour animer braquage, rotation de roues et suspension visuelle. La voiture
est portée par un chassis Rapier `dynamic` invisible : moteur, frein, grip, direction et suspension
sont appliqués comme des forces sur le rigidbody, puis le FBX suit la pose physique.

**Physique.** Le vehicule a un vrai **vecteur vitesse**, decompose a chaque image dans son repere :
la part longitudinale est celle que les roues poussent, la part laterale est la derive, que
l'adherence mange progressivement. Le braquage suit le **modele bicyclette** (vitesse de rotation
= vitesse / empattement x tan(braquage)), plafonne par une limite d'adherence laterale. Deux
consequences : **on ne tourne plus a l'arret** (fini l'effet tourelle), et le sous-virage a haute
vitesse apparait tout seul. Pour rester jouable, une **aide arcade de direction** ajoute du grip
progressivement au-dessus d'environ 45 km/h et une assistance basse vitesse renforce le yaw des que
la voiture roule un minimum : elle reste credible, mais n'impose plus un rayon de simulateur pur dans
les manoeuvres lentes. Mesure cible : rayon de braquage de **5,8 m a 15 km/h** et autour de **75 m a
120 km/h**.

**Assiette, terrain et vol.** Rapier devient l'autorite du sol proche : `WorldPhysicsColliders`
stream des tuiles `TrimeshCollider` autour du joueur depuis la surface roulable officielle
(`driveSurfaceHeightAt`, qui reprend la surface finale `groundHeight()` et pas seulement le bitume
central). Le maillage physique proche est echantillonne a 1 m pour limiter les secousses de
suspension sur les routes et les raccords. La voiture ne colle plus sa hauteur depuis une fonction maison : ses quatre
roues raycastent vers le bas depuis le chassis dynamique, compriment des ressorts, amortissent la
vitesse verticale au point de contact et appliquent la force sur chaque coin de caisse. Si les roues
perdent le sol sur un tremplin, Rapier laisse le chassis voler, prendre du pitch/roll et retomber via
les contacts physiques. Le rendu des roues ne reprend pas la compression brute : il soustrait la
compression statique de repos, limite le debattement visuel et garde donc les roues lisibles dans les
arches sans cacher le travail physique de la suspension.

**Collisions physiques vehicule.** La caisse de la voiture est un `RigidBody dynamic` avec collider
Rapier, CCD et solveur renforcé. Les routes/terrains proches sont des `TrimeshCollider` et les
façades/bâtiments proches sont streamés en murs `CuboidCollider` fixes par `WorldBuildingColliders`.
Les collisions latérales de la voiture doivent donc passer par Rapier ; l'ancien sweep/caisse 2D ne
doit plus être utilisé pour la voiture. Le collider du chassis est légèrement rehaussé par rapport au
visuel pour éviter les raclages invisibles sur les coutures de route ; la suspension garde le contact
au sol, tandis que la force moteur conserve une traction minimale dès qu'au moins une roue touche.
Le braquage physique peut rester généreux pour le gameplay, mais le braquage visuel des roues est
clampé séparément pour éviter une lecture caricaturale du mesh. Ce clamp est exposé dans le panneau
F2 avec `vehicles.car.VISUAL_STEER_MAX`, afin de regler la lecture des roues sans changer la tenue de
route. En conduite, le `linearDamping` Rapier du chassis reste quasi neutre : la trainee d'air, le
roulement et la transmission sont deja modelises a la main, donc ajouter un gros damping physique
briderait artificiellement la voiture autour de 80-90 km/h.

**Monter / sortir.** Avant la première utilisation, la voiture peut être maintenue à sa pose de spawn
pour éviter qu'elle tombe avant que les colliders streamés soient prêts. Dès qu'elle a été utilisée,
elle reste un corps Rapier libre même sans conducteur. Sortir en plein saut ne remet donc ni le joueur
ni la voiture au sol : le joueur hérite de la hauteur/vitesse verticale de la voiture et retombe avec
sa propre gravité, pendant que le chassis continue sa trajectoire physique. Quand le joueur est dans la
voiture, son modèle 3D est masqué : le groupe joueur reste l'ancre logique suivie par la camera, mais
Pierrot ne doit pas depasser du toit.

**Chocs.** Ils utilisent la normale du mur rendue par la collision : la part de vitesse qui rentre
dans le mur est renvoyee avec un petit rebond, celle qui longe le mur est presque entierement
gardee. Autrement dit **froler ne coute presque rien, percuter coute tout**, sans aucun cas
particulier. Un choc pris sur une aile fait en plus pivoter la caisse (bras de levier), alors qu'un
choc a plat de face ne la fait pas tourner. Mesure a 100 km/h : on garde **96 %** de la vitesse a 3°,
**91 %** a 10° (avec le nez devie de 9° pour s'aligner sur la facade), **58 %** a 30°, **22 %** de plein
fouet. Le frottement est compte **par seconde**, donc identique a 30, 60 ou 144 images/s.

**Moteur et boite (`vehicleEngine.ts`).** L'acceleration n'est pas une rampe : il y a une **courbe de
couple** (creux en bas, pic au milieu, chute a la zone rouge), des **rapports** qui multiplient ce
couple, et un **trou de 0,22 s a chaque passage** — c'est lui qu'on sent. La resistance de l'air
croit avec le carre de la vitesse.

> 👉 **La vitesse maxi n'est pas un reglage : elle sort du calcul**, a l'equilibre entre la poussee
> du dernier rapport et la trainee. On calibre donc la trainee, et la progressivite vient toute seule.

| | Vitesse maxi | Transmission | 0-100 | Passages de rapport |
|---|---|---|---|---|
| **Voiture** | **210 km/h** | boite 6 rapports | ~6,0 s | 46 / 74 / 108 / 143 / 179 km/h |
| **Scooter** | **75 km/h** | variateur (CVT) | — | aucun (regime tenu a ~7 200 tr/min) |

La voiture met **22 s pour atteindre 180 km/h** et **33 s pour 200** : la fin de la plage est longue,
comme dans la vraie vie. Pour la rendre plus rapide, baisse `DRAG` dans `carConfig.ts` ; pour qu'elle
reprenne mieux, monte `PEAK_TORQUE` ou raccourcis les rapports.
**Collisions.** Le joueur est un **cercle**, chaque vehicule une **caisse orientee**, et les deux sont
testes contre les **aretes de mur** des batiments (`movementCollision.ts` + `forEachWallNear()`).
On connait donc la distance exacte au mur ET sa normale, ce qui donne trois choses :
on **glisse** le long d'une facade en biais au lieu d'avancer en escalier (l'ancienne methode testait
X puis Z separement, d'ou des micro-saccades) ; on **ressort** automatiquement si on se retrouve
coince dans un batiment ; et un choc **frontal** coute beaucoup de vitesse la ou un **frolement**
n'en coute presque pas. Le deplacement est decoupe en sous-pas plus courts que le corps :
aucune traversee de facade, meme a pleine vitesse.
Quand le joueur conduit, un tableau de bord affiche la vitesse reelle en km/h avec aiguille et
compteur numerique, le **rapport engage** (« CVT » pour le scooter), un **compte-tours** qui vire au
rouge en zone rouge, ainsi qu'une jauge d'essence prevue pour la future boucle de ravitaillement.
Le cadran se gradue **selon le vehicule** (~80 km/h pour le scooter, ~220 pour la voiture).
Chaque vehicule garde sa station radio attribuee : au premier demarrage, une radio est choisie aleatoirement **parmi celles qui ont de la musique**, puis elle reste la meme quand on descend et qu'on remonte. (Le tirage evite les stations sans fichier dans `Musiques/` : elles sont muettes hors de leurs emissions, et comme le choix est memorise, une caisse sur cinq restait sinon definitivement silencieuse.) **La touche R change de station** (elle tourne en boucle sur les cinq) ; le choix est memorise sur le vehicule, donc chaque caisse garde SA station. La touche est rappelee sur le tableau de bord, a cote du nom de la station. Les stations utilisent une timeline mondiale commune : si deux sources diffusent R01, elles doivent pointer vers le meme morceau et le meme moment de diffusion.
Le contenu des stations est **detecte sur disque**, pas ecrit en dur : chaque fichier audio depose dans `public/musique/radio/RXX_Nom/` entre dans la programmation, quel que soit son nom. Le titre affiche sur le tableau de bord est deduit du nom du fichier. Voir `public/musique/radio/README.md`.

Les emissions sont structurees en **emission → episode → parties**. Un episode est une diffusion, et
ses parties **s'enchainent sans interruption**. La regle de rangement est deduite du disque : des
fichiers poses dans le dossier de l'emission forment un seul episode en plusieurs parties, tandis
que des sous-dossiers donnent un episode chacun (voir `public/musique/radio/README.md`).

**La grille de programmation.** Les horaires ne sont plus deduits des noms de dossiers : ils vivent
dans `src/data/radioSchedule.json`, une grille **7 jours x 24 heures** par station, remplie depuis
la page **Regie** (`npm run dev`, puis `localhost:5173/regie.html` — outil de developpement, absent
du jeu compile). Une case porte une **emission**, de la **musique**, de la **pub** ou une **coupure
d'antenne** ; une case vide vaut musique.

Une emission demarre a l'heure de sa case et dure **ce que dure vraiment l'episode du jour** : elle
deborde sur les cases suivantes jusqu'a sa fin. Seules une autre emission, une pub, une coupure
d'antenne ou minuit l'interrompent. La Regie affiche ce debordement, sinon on programmerait a
l'aveugle. Un episode est choisi par jour de jeu, dans l'ordre, puis la liste boucle.

**La playlist ne se repete pas.** Elle est **melangee differemment chaque jour** et pour chaque
station, avec un tirage reproductible dont la graine est (jour, station). C'est plus fort qu'un
historique des derniers titres — aucun morceau ne repasse tant qu'on n'a pas fait le tour — et
surtout ca preserve la propriete la plus precieuse du systeme : la station **tourne toute seule
sans auditeur**, parce que sa position se CALCULE au lieu d'etre memorisee.

⏱️ Un jour de jeu dure une heure reelle : **une heure de jeu ne vaut que 2 min 30 d'audio**. Une
emission de 14 minutes occupe donc pres de 6 heures de jeu.

**La regie (`radioPlayout.ts`).** Deux lecteurs alternent : pendant que l'un finit en fondu sortant,
l'autre demarre en fondu entrant — comme dans une vraie regie. Avec un seul lecteur, changer de
morceau voulait dire ecraser sa source, donc une coupure nette. Le morceau suivant est en plus
**annonce a l'avance** : la timeline etant une fonction du temps, on lui demande ce qui passera dans
une seconde, et on lance le fondu pendant que le morceau courant joue encore. Fini le silence entre
deux titres. Zapper de station utilise un fondu plus court et plus franc, pour que ca s'entende.

> ⚠️ **La regie ne court PAS apres l'horloge du jeu.** La timeline choisit quoi jouer et ou
> demarrer ; ensuite le morceau se deroule tout seul. C'est indispensable : `GameTimeTicker` avance
> avec `requestAnimationFrame` en plafonnant son pas a 0,25 s, donc l'heure du jeu prend du retard a
> chaque a-coup et gele carrement quand la fenetre passe en arriere-plan — un retard qui ne se
> rattrape jamais. Avec un recalage serre, la regie repositionnait le lecteur toutes les 250 ms, ce
> qui annulait le chargement du fichier a chaque fois : sur des `.wav` de 30 Mo, plus aucune musique
> ne demarrait, alors que le zapping (synthetise) continuait de fonctionner. Le recalage n'est donc
> plus qu'un filet de securite, tres large et espace.

**Le bruit du poste (`radioNoise.ts`).** Un **souffle** de fond permanent, dont l'intensite respire
lentement et au hasard, et une **bouffee de zapping** au changement de station : du bruit dont la
bande passante balaie le spectre, double d'un sifflement qui glisse — une molette qu'on tourne.
Tout est synthetise, **aucun fichier audio a fournir**, ce qui fait aussi que deux zappings ne
sonnent jamais pareil. Niveaux mesures contre une vraie musique de la station : le zap sort a
**+2 dB** (200 ms), le souffle nominal reste **43 dB en dessous**, avec des creux vers -55 dB et des
bouffees occasionnelles vers -40 dB. Le filtre « poste pourri » (deja en place) pousse le souffle
avec lui.

> ⚠️ **Un souffle se regle beaucoup plus bas que l'intuition ne le suggere.** Un premier reglage a
> -22 dB mangeait litteralement les musiques. Le bruit large bande masque infiniment plus qu'un son
> musical a niveau egal, parce qu'il occupe TOUTES les frequences a la fois. Sa bande a aussi ete
> remontee (3,8-9,5 kHz au lieu de 1,2-6,5 kHz) : en dessous, elle se posait pile sur le corps du
> morceau — voix, caisse claire, synthes. Le reglage a toucher s'il gene est `HISS_LEVEL`, en tete
> de `src/audio/radioNoise.ts` ; `0` le supprime.

---

## ⚙️ Physique sandbox et ragdoll

La physique doit viser un ressenti **semi-réaliste mais fun**. Le but n'est pas de simuler la vraie
vie au millimètre : le joueur doit sentir du poids, de l'inertie, des chocs et des réactions
crédibles, tout en gardant un jeu agréable, lisible et drôle.

Priorités de feeling :

- collisions propres, sans murs invisibles ni objets qui accrochent partout ;
- véhicules qui suivent le terrain et prennent une vraie assiette : hauteur, inclinaison, roulis,
  tangage et suspension visuelle crédible ;
- objets physiques manipulables ou projetables : poubelles, caisses, bouteilles, chaises, petits
  props de chaos ;
- impacts lisibles entre véhicules, joueur, PNJ et décor ;
- interactions sandbox qui donnent envie d'expérimenter.

Direction technique retenue : **Rapier devient l'autorité physique**. `src/gameplay/physics/`
centralise les constantes du monde (gravité, pas fixe, groupes de collision, matériaux physiques),
l'enveloppe `<PhysicsRoot>`, les props dynamiques et la surface physique streamée autour du joueur.
Les systèmes maison joueur/véhicule peuvent cohabiter avec Rapier pendant la migration uniquement
comme contrôleurs ou fallbacks, mais les nouveaux sols, props dynamiques, joints, ragdolls et
interactions sandbox doivent passer par cette couche.

**Prototype en place :** le banc d'essai (`SandboxPhysicsProps`) attend le chargement du relief avant
de creer ses corps Rapier, pour eviter des colliders figes a une hauteur provisoire. Les caisses et
poubelles sont posees sur une petite dalle visible a cote de la zone de test. Le tremplin de reglage
vehicule est deplace au bout de la Rue Saint-Pierre, avec une longue approche pour prendre de la
vitesse ; il a un collider fixe incline Rapier et une plaque d'approche physique, afin que les
raycasts de roues testent un vrai volume physique et pas seulement une courbe maison. La voiture est
maintenant l'essai principal du chassis dynamique Rapier : `Car.tsx` monte le FBX Chevrolet,
`carRapierController.ts` applique suspension/moteur/grip/direction, et le store voiture publie la
pose physique pour le joueur et la camera. Les façades proches sont aussi migrées en colliders
Rapier streamés par tuiles stables : un `RigidBody fixed` par tuile regroupe plusieurs murs
`CuboidCollider`, afin d'eviter les remounts massifs et les drops FPS quand la voiture roule vite.
**Cause des drops FPS en voiture rapide (identifiée au profileur, corrigée)** : ce regroupement par
tuile ne suffisait pas. Une tuile de 96 m du centre-ville pèse 150 à 770 murs, montés dans un seul
commit React → une long task de 40 à 80 ms à chaque franchissement de tuile, soit toutes les ~3 s à
110 km/h. Sur six captures `F9` d'affilée, `cache.build:physics-building-walls` est 20 à 220 fois
plus fréquent au voisinage d'une frame lente que d'une frame rapide, et le coût est *hors* boucle de
jeu (cpu mesuré ~14 ms pour une frame de ~56 ms) — donc dans le commit React/Rapier, pas dans le
rendu ni dans le step physique. `WorldBuildingColliders` étale désormais la création et la
destruction des colliders sur plusieurs images (lots de 48 murs, un lot par image maximum).
Le span `react.mount:physics-building-walls-batch` du rapport `F9` mesure ce coût : il doit rester
très en dessous de 16 ms.
Ces briques servent à régler la gravite globale, les materiaux, le sommeil des
objets, les groupes de collision, le decollage, les tonneaux et les atterrissages.

### Ragdoll

Le ragdoll est une feature de fun prioritaire dès que la physique le permet.

Déclencheurs possibles :

- mort du joueur ou d'un PNJ ;
- collision violente avec un véhicule ;
- chute de trop haut ;
- explosion ou choc important ;
- trébuchement ou perte de contrôle spéciale.

Le ragdoll doit être court, drôle et lisible. On ne cherche pas une anatomie parfaite : on veut une
transition convaincante entre animation et corps physique, une impulsion adaptée à la cause, puis un
retour à un état stable pour éviter de coûter trop cher en performance.

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

⚠️ **Les modèles importés doivent repasser au toon.** Les FBX du projet arrivent en
`MeshPhongMaterial` (spéculaire `#333`, brillance 25, carte de normales issue d'un scan) : des
objets luisants, à la rugosité aléatoire, au milieu d'une ville entièrement en aplats. Tout passe
donc par `src/shaders/toonMaterial.ts` → `MeshToonMaterial` + la **gradient map partagée** : on garde
la texture de couleur quand elle existe, on **jette la brillance** (le toon n'a pas de spéculaire, sa
lumière est un simple escalier) et on **calme le relief** (`IMPORTED_NORMAL_STRENGTH`, un tiers de la
carte de normales — assez pour lire les plis du tissu, pas assez pour salir la couleur).
👉 Tout nouveau modèle FBX/GLB suit cette règle : **aucun matériau d'import ne reste tel quel.**

### ⚠️ Une texture référencée mais absente peint le modèle en NOIR

Le FBX de Chibrux référence ses textures par un chemin de la machine d'export —
`.../skins_xxx.fbm/Color_xxx.png` — un dossier qui n'a jamais été joint. Le chargeur crée quand même
un objet `Texture`, mais avec `image === null`.

Et une texture sans image **n'est pas ignorée** : le shader y échantillonne du noir opaque, donc le
modèle s'affiche **entièrement noir**. Mesuré au `readPixels` sur un rendu hors écran :
`{ color: #cccccc, map: textureVide }` → `rgb(0,0,0)`, le même matériau sans `map` → `rgb(200,200,200)`.
D'où la règle de `usableTexture` : **une texture ne sert que si elle a réellement une image.**

👉 **Pour retrouver les vraies textures** d'un modèle, déposer les PNG d'origine à côté du `.fbx` (le
dossier `.fbm` de l'export) suffit : rien à coder, elles sont reprises automatiquement.

### Les matériaux de la voiture

Le FBX de la voiture porte de **vrais matériaux nommés**, un par zone, et un maillage de vitrage
séparé. On garde donc le découpage de l'artiste — chaque maillage conserve ses `groups` et son
**tableau** de matériaux — et on se contente de les repasser au toon en imposant la palette du jeu
(`CAR_COLORS` dans `carConfig.ts`, seul endroit où se règle l'allure de la voiture) :

| Matériau FBX | Couleur du jeu | Ce que c'est |
|---|---|---|
| `Carroserie01` | `body` | la tôle |
| `Carosserie02` | `bumper` | chromes, pare-chocs, entourages |
| `Glass` | `glass` | le vitrage |
| `Roue` | `wheel` | la gomme |
| `Jante` | `tireHub` | les jantes |

Un matériau absent de la table garde la couleur du FBX. (L'orthographe est celle du fichier, coquille
comprise — ce sont des clés, pas du texte.)

⚠️ **Ne jamais aplatir le tableau de matériaux en un seul.** Les `groups` de la géométrie pointent
dedans par indice : n'en garder qu'un repeindrait toute la voiture d'une seule couleur et ferait
disparaître vitres, chromes et jantes.

⚠️ **Remplacer le FBX par un autre export casse le démarrage** si les noms de maillages changent
(`Mesh FBX voiture introuvable`). `Car.tsx` attend `Carcasse`, `Glass001` et les maillages préfixés
`Roue`. Les deux trains de roues, eux, sont triés par **position** (l'avant est vers +Z) et pas par
nom : un ré-export peut renommer `Roue` en `Roue002` sans rien casser.

### Style à viser

- [ ] Ajouter des références visuelles : Borderlands, jeux toon, BD franco-belge, cartoon adulte.

### Ciel et ambiances de la journée

Le ciel et le cycle jour/nuit sont **déjà en place** (`src/gameplay/time/` + `src/core/DynamicSky.tsx`,
`GradientSky.tsx`, `TimeFog.tsx`, `Lights.tsx`) : horloge, palettes aube/jour/soir/nuit interpolées,
soleil, lune avec phases, étoiles et nuages en sprites. Les raccourcis DEV `F7` (midi), `F8` (nuit),
`F10` (aube) et `F11` (nuit suivante) servent à juger les ambiances.

Un prototype de **skydome procédural stylisé** est maintenant monté dans `DynamicSky.tsx` via
`src/core/sky/PaintSkyDome.tsx`. Il rend de grandes masses de peinture douce en `ShaderMaterial`
WebGL, pilotées par `getSkyAtmosphere(totalMinutes)` (`src/core/sky/skyAtmosphere.ts`) : palettes
aurore/jour/coucher/nuit, formes organiques lentes, halo d'horizon stylisé, teinte horaire globale
des lumières, fog coloré plus expressif, nuages mieux intégrés et petites particules atmosphériques
rares. Les paramètres F2 `sky.paint.*` permettent de doser ces effets sans toucher aux palettes.
Le ciel historique reste le fallback : régler `Ciel peinture actif` à `0` dans `F2` désactive le
skydome et les particules rares sans retirer soleil, lune, étoiles, nuages ou brouillard.

> 💡 **Une grosse passe visuelle est souhaitée** — pas pour du réalisme, mais pour créer plusieurs
> ambiances fortes : aurore chaude californienne, journée non générique, coucher de soleil dramatique,
> **nuit cosy / lo-fi / synthwave** (mood Kavinsky), nuages teintés par l'heure, halos autour des
> astres. Direction détaillée et dépendances :
> [07 - Backlog d'idées § Ciel et cycle jour/nuit](07-BACKLOG-IDEES.md#-3-ciel-et-cycle-journuit).

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
| Inventaire sac à dos / items | `src/gameplay/inventory/` + `src/data/items.*` |
| Smartphone | `src/gameplay/phone/` + `src/ui/phone/` |
| Actions illégales | `src/gameplay/actions/` |
| Police / niveau de recherche | `src/gameplay/police/` |
| Quartiers, gangs et tensions | `src/data/zones.json` + `src/gameplay/factions/` |
| Drogues et monde psychique | `src/gameplay/substances/` + `src/world/psychic/` |
| Dialogues & réfs perso | `src/data/` |
| Look cell-shading | `src/shaders/` + matériaux dans `src/world/` & `src/entities/` |
| Ciel, cycle jour/nuit, astres, nuages | `src/gameplay/time/` (horloge, `celestialCycle.ts`) + `src/core/DynamicSky.tsx`, `TimeFog.tsx`, `Lights.tsx` |
| PNJ, routines et dialogues | `src/entities/` + `src/gameplay/npc/` + `src/data/npcs.*` |
| Véhicules | `src/entities/vehicles/` |
| Physique sandbox / ragdoll | `src/gameplay/physics/` + Rapier (`@react-three/rapier`) |
| Radios / audio | `src/audio/` + fichiers `.wav` dans `public/musique/radio/` |
