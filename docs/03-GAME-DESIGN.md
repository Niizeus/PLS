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

**Deja en place :** un **scooter** et une **voiture prototype** conduisibles (`src/entities/vehicles/`).
On s'en approche et on monte/descend avec **E** ; conduite a ZQSD (accelere, freine/recule, braque).
Les vehicules partagent un noyau de physique commun (`vehicleDriving.ts` + `vehicleEngine.ts`) avec
des reglages propres a chaque type.

**Physique.** Le vehicule a un vrai **vecteur vitesse**, decompose a chaque image dans son repere :
la part longitudinale est celle que les roues poussent, la part laterale est la derive, que
l'adherence mange progressivement. Le braquage suit le **modele bicyclette** (vitesse de rotation
= vitesse / empattement x tan(braquage)), plafonne par une limite d'adherence laterale. Deux
consequences : **on ne tourne plus a l'arret** (fini l'effet tourelle), et le sous-virage a haute
vitesse apparait tout seul. Mesure : rayon de braquage de **5,8 m a 15 km/h** et **115 m a 120 km/h**.

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

Direction technique à garder en tête : une approche hybride est acceptable. Le moteur véhicule
maison peut rester responsable du feeling arcade précis, tandis qu'un moteur physique dédié pourra
servir aux objets dynamiques, props, ragdolls, joints et interactions plus générales.

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
| Inventaire sac à dos / items | `src/gameplay/inventory/` + `src/data/items.*` |
| Smartphone | `src/gameplay/phone/` + `src/ui/phone/` |
| Actions illégales | `src/gameplay/actions/` |
| Police / niveau de recherche | `src/gameplay/police/` |
| Quartiers, gangs et tensions | `src/data/zones.json` + `src/gameplay/factions/` |
| Drogues et monde psychique | `src/gameplay/substances/` + `src/world/psychic/` |
| Dialogues & réfs perso | `src/data/` |
| Look cell-shading | `src/shaders/` + matériaux dans `src/world/` & `src/entities/` |
| PNJ, routines et dialogues | `src/entities/` + `src/gameplay/npc/` + `src/data/npcs.*` |
| Véhicules | `src/entities/vehicles/` |
| Physique sandbox / ragdoll | `src/gameplay/physics/` + moteur physique dédié si retenu |
| Radios / audio | `src/audio/` + fichiers `.wav` dans `public/musique/radio/` |
