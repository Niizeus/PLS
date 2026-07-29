# 06 - Editeur PLS

Ce document pose la vision de l'editeur de developpement de PLS avant de commencer
l'implementation. L'objectif est d'avoir un socle solide : savoir ce que l'outil doit
permettre aujourd'hui, ce qu'il devra permettre plus tard, et comment eviter de construire
un outil trop limite qu'il faudrait jeter dans deux semaines.

**Statut : vision + roadmap + etat implemente.** Ce document sert a guider l'editeur PLS. Il melange
volontairement la cible long terme et l'etat actuel ; si le fichier devient trop lourd, il faudra
separer une doc "vision editeur" et une doc "suivi technique".

---

## Vision generale

PLS n'est pas un jeu a quete principale lineaire. L'objectif principal ne change jamais :

> Quitter Beauvais.

Le joueur doit decouvrir par lui-meme les options disponibles : argent, train, avion,
egouts, politique, monde psychique, combines illegales, rencontres, objets, informations,
chemins absurdes ou echecs. Les quetes secondaires peuvent aider cet objectif, l'ignorer
completement, ou meme envoyer le joueur dans une mauvaise direction.

L'editeur doit donc aider a fabriquer une ville sandbox pleine d'opportunites, pas une
suite de missions en couloir.

Il doit devenir l'outil central de production du jeu :

- placer les lieux importants dans la vraie ville de Beauvais ;
- definir les entrees de batiments et leurs interieurs instancies ;
- poser les opportunites de fuite, les indices et les blocages ;
- creer les zones de travaux qui empechent la sortie directe ;
- preparer les quetes secondaires, PNJ, boutiques, objets, evenements ;
- tester rapidement en jeu ce qui vient d'etre pose ;
- centraliser progressivement les outils de production utiles au gameplay.

---

## Decisions actees

- L'editeur est un outil web de developpement uniquement. Il n'est pas un mode creation
  expose au joueur dans l'executable final.
- L'editeur est pense comme un couteau suisse : tous les outils de production doivent etre
  accessibles depuis lui a terme, y compris la Regie radio.
- Un POI signifie "Point Of Interest" : dans la doc et l'interface, on parlera surtout de
  point d'interet, lieu ou marqueur gameplay. C'est un point place sur la carte qui sert a
  representer un lieu, une entree, une sortie, un PNJ important, une boutique, une zone de
  test, une piste implicite, etc.
- Les interieurs sont stockes dans un fichier par interieur, pour garder des diffs Git
  lisibles et eviter qu'un seul gros fichier soit modifie par tout le monde.
- Les assets d'interieur sont prefabriques : murs, sols, portes, props, lumieres, objets,
  PNJ et modules seront choisis dans une banque d'assets, pas dessines librement au depart.
- Les modifications de routes sont des overrides complets : elles changent le rendu visuel
  ET les collisions / surfaces praticables.
- Les pistes de fuite ne doivent pas etre listees explicitement au joueur comme un journal
  de quete principale. Elles doivent etre deduites par l'exploration, les indices, les lieux,
  les dialogues, les objets et les consequences.
- La Regie radio existe deja, mais elle est laissee de cote pour l'instant. Elle pourra etre
  integree plus tard comme module de l'outil global, sans bloquer les priorites actuelles :
  carte, interieurs, items, PNJ, quartiers et gameplay sandbox.
- Un point d'interet peut avoir des horaires : bar, shop, mairie, travail, gare, evenement
  temporaire, PNJ ou activite peuvent etre ouverts, fermes ou disponibles selon l'heure et le jour.

---

## Principe cle : couche PLS au-dessus d'OSM

La ville de base vient d'OpenStreetMap / IGN. Cette donnee doit rester une base stable.
L'editeur ne doit pas modifier directement le gros fichier de ville genere automatiquement.

L'editeur doit plutot produire une couche de donnees PLS par-dessus la carte reelle :

- `src/data/mapMarkers.json` pour les points d'interet ;
- `src/data/interiors/<interiorId>.json` pour les niveaux interieurs, un fichier par interieur ;
- `src/data/mapOverrides.json` pour les batiments masques, modifies ou remplaces ;
- `src/data/roadEdits.json` pour les routes ajoutees, coupees ou repeintes ;
- `src/data/worldEvents.json` pour les evenements et conditions ;
- `src/data/escapeLeads.json` pour les pistes liees a l'objectif "quitter Beauvais".

Avantages :

- la vraie carte reste regenerable ;
- les edits faits main restent lisibles dans Git ;
- on peut annuler ou comparer les changements facilement ;
- les outils de dev manipulent de petits fichiers comprehensibles ;
- le jeu peut charger la base automatique + les modifications PLS.

---

## Acces a l'outil

L'editeur serait une page de developpement separee :

- jeu : `localhost:5173/`
- editeur : `localhost:5173/editor.html`

Plus tard, on peut imaginer un hub de dev :

- carte ;
- interieurs ;
- objets ;
- PNJ ;
- quartiers / factions ;
- quetes secondaires ;
- smartphone ;
- radio ;
- tests rapides ;
- validation des donnees.

L'outil doit etre absent du jeu final ou protege derriere un mode developpeur. La Regie radio,
actuellement accessible via `regie.html`, peut rester separee pendant cette phase. Son integration
dans le hub est une option de confort pour plus tard, pas une priorite de gameplay.

---

## Mode 1 - Carte exterieure de Beauvais

### Vue top-down

Base de l'outil :

- plan 2D technique de toute la ville, utile pour placer vite et lire les coordonnees ;
- vue IG top-down de Beauvais, rendue avec la vraie scene 3D du jeu, utile pour verifier les
  volumes, le relief et ajuster les emplacements dans le contexte reel ;
- vue IG 2.5D orthographique inclinee, utile pour lire les volumes et le relief sans passer
  en camera joueur ;
- zoom/dezoom fluide ;
- deplacement par glisser ;
- centrage sur le joueur, le spawn ou un lieu ;
- affichage des batiments, routes, eau, verdure, quartiers ;
- calques activables/desactivables ;
- grille optionnelle ;
- coordonnees monde visibles sous la souris ;
- recherche par nom de lieu ;
- edition des contours de quartier par sommets : selectionner un quartier, deplacer ses points,
  ajouter un point, supprimer un point non essentiel, puis sauvegarder `src/data/zones.json`.

La carte plein ecran actuelle (`WorldMap.tsx`) est une excellente base technique pour le plan 2D :
elle sait deja dessiner Beauvais en 2D, zoomer, se deplacer et poser des points. La vue IG top-down
doit rester separee : elle reutilise les composants 3D du monde pour montrer ce que le joueur verra.

### Calques

Calques utiles :

- batiments OSM ;
- routes OSM ;
- eau ;
- verdure ;
- quartiers ;
- POI ;
- entrees d'interieurs ;
- sorties de Beauvais ;
- zones de travaux ;
- PNJ ;
- objets/pickups ;
- vehicules ;
- quetes secondaires ;
- pistes de fuite ;
- zones de police ;
- zones de danger ;
- zones sonores ;
- zones de performance/debug ;
- points de spawn/test.

Chaque calque doit pouvoir etre masque, verrouille, filtre et colore.

### Points d'interet

Un point d'interet, souvent appele POI en anglais ("Point Of Interest"), est un marqueur place
sur la carte. Il peut representer :

- appartement de Chibrux ;
- gare SNCF ;
- gare routiere ;
- aeroport ;
- mairie ;
- commissariat ;
- lieu de travail ;
- kebab ;
- tabac ;
- market ;
- bar ;
- dealer ;
- boutique ;
- parc ;
- plan d'eau ;
- entree d'egouts ;
- zone de travaux ;
- sortie bloquee ;
- depart d'activite ;
- PNJ important ;
- point de quete secondaire ;
- point secret ;
- destination de fuite potentielle.

Champs possibles :

- identifiant stable ;
- nom affiche ;
- type ;
- icone ;
- couleur ;
- position x/z ;
- rayon d'interaction ;
- visible en jeu ou seulement en dev ;
- visible sur carte/minimap ;
- texte de prompt ;
- description de debug ;
- tags ;
- horaires d'ouverture ou de disponibilite ;
- message si ferme ;
- conditions d'apparition ;
- interaction declenchee ;
- interieur cible ;
- piste de fuite associee ;
- quete secondaire associee.

### Entrees de batiments

Les interieurs du jeu sont des niveaux instancies. Le joueur arrive devant une porte,
interagit, puis est teleporte dans un niveau interieur.

Une entree doit pouvoir definir :

- position de la porte dans Beauvais ;
- batiment associe, si possible ;
- nom du lieu ;
- type de lieu ;
- `interiorId` ;
- point de spawn dans l'interieur ;
- point de sortie retour vers Beauvais ;
- conditions d'entree ;
- horaire d'ouverture ;
- prompt affiche ;
- son ou transition ;
- etat ferme/ouvert/verrouille ;
- dialogue ou message si inaccessible.

### Sorties de Beauvais et routes bloquees

Comme l'objectif est de quitter Beauvais, l'editeur doit aider a poser les sorties et
leurs blocages.

Types de sorties :

- route principale bloquee par travaux ;
- gare ;
- aeroport ;
- egouts ;
- tunnel ;
- bus ;
- monde psychique ;
- sortie secrete ;
- sortie politique ou administrative ;
- sortie narrative speciale.

Pour une sortie bloquee :

- type de barriere ;
- longueur ;
- orientation ;
- collision active ;
- message affiche ;
- niveau de blocage ;
- condition de deblocage ;
- lien vers une piste de fuite ;
- visible sur carte ou non ;
- niveau d'absurdite visuelle.

### Edition des batiments

Actions a prevoir :

- selectionner un batiment ;
- afficher ses infos OSM/IGN ;
- le masquer ;
- le remplacer par un modele fait main ;
- changer sa couleur ou son style ;
- declarer son usage gameplay ;
- ajouter une porte ;
- ajouter des enseignes ;
- marquer un toit accessible ;
- marquer un batiment comme collision speciale ;
- creer une zone de non-collision si necessaire ;
- annoter un batiment pour plus tard.

Important : si on masque ou remplace un batiment visible, il faut garder la coherence
avec les collisions. Un mur invisible est un bug.

### Edition des routes

L'edition des routes est plus complexe et doit venir apres les POI.
Une route modifiee par l'editeur doit modifier a la fois ce que le joueur voit et ce que le
jeu considere comme praticable : rendu, collision, largeur, surface et blocages doivent rester
coherents.

Outils possibles :

- pinceau pour creer une route ;
- outil segment/polyline ;
- suppression locale ;
- largeur ;
- type de surface ;
- route pietonne / voiture / service ;
- route bloquee ;
- route temporaire de travaux ;
- sens unique ;
- pont/tunnel ;
- hauteur ou couche ;
- validation des intersections ;
- affichage debug du ruban final ;
- recalcul local des collisions.

Cas d'usage :

- rendre une zone plus jouable ;
- bloquer une sortie ;
- dessiner une route de chantier ;
- corriger un endroit mal rendu ;
- creer une allee menant a un lieu important ;
- ajouter un chemin secret.

---

## Mode 2 - Editeur d'interieurs

Les interieurs sont des niveaux instancies. Ils ne sont pas modelises dans la vraie ville
1:1 : ce sont des scenes separees, chargees quand le joueur entre dans un lieu.

### Creation d'un niveau interieur

Depuis une entree de batiment :

1. cliquer sur "Creer interieur" ;
2. choisir un type de lieu ;
3. donner un nom ;
4. creer un `interiorId` ;
5. ouvrir l'editeur d'interieur ;
6. placer murs, sols, portes, props ;
7. generer/visiter ;
8. revenir editer ;
9. sauvegarder/exporter.

Types d'interieurs :

- appartement ;
- kebab ;
- tabac ;
- market ;
- bar ;
- mairie ;
- commissariat ;
- gare ;
- aeroport ;
- lieu de travail ;
- boutique ;
- cave ;
- egouts ;
- squat ;
- salle secrete ;
- monde psychique.

### Vue plan 2D

L'interieur se construit d'abord comme un plan :

- grille ;
- murs ;
- sols ;
- portes ;
- fenetres ;
- escaliers ;
- zones de collision ;
- zones d'interaction ;
- props ;
- lights ;
- spawn joueur ;
- sorties ;
- PNJ ;
- objets ;
- cameras de debug ;
- zones sonores.

### Banque d'assets

En bas de la fenetre :

- murs ;
- sols ;
- portes ;
- fenetres ;
- meubles ;
- comptoirs ;
- props ;
- objets ramassables ;
- lumieres ;
- decals ;
- panneaux ;
- enseignes ;
- sons ;
- PNJ ;
- vehicules interieurs si besoin ;
- elements absurdes propres au jeu.

La banque d'assets doit avoir :

- recherche ;
- categories ;
- favoris ;
- assets recents ;
- miniatures ;
- taille/rotation ;
- variantes de couleurs ;
- tag "prototype" ou "final" ;
- indicateur de performance.

### Generation 3D

Le plan 2D genere un niveau 3D :

- murs extrudes ;
- sols ;
- plafonds optionnels ;
- collisions ;
- props places ;
- lumieres ;
- spawn ;
- triggers ;
- portes ;
- sorties.

Le createur doit pouvoir cliquer sur "Visiter" pour lancer le niveau en mode test, puis
revenir dans l'editeur sans perdre le contexte.

### Outils de confort

- undo/redo ;
- copier/coller ;
- rotation ;
- alignement ;
- duplication ;
- snap a la grille ;
- snap au mur ;
- selection multiple ;
- groupes ;
- calques ;
- verrouillage ;
- miroir ;
- prefabs ;
- mesure de distance ;
- test de collision ;
- warning si une porte ne mene nulle part ;
- warning si le spawn est bloque ;
- warning si un objet flotte.

---

## Mode 3 - Gameplay sandbox et pistes de fuite

L'editeur doit aider a poser les opportunites liees a "quitter Beauvais", sans transformer
ca en quete principale lineaire.

### Pistes de fuite

Une piste est une information ou une possibilite que le joueur peut decouvrir.

Exemples :

- "La gare pourrait etre une sortie, mais il faut de l'argent."
- "Les egouts ont une entree cachee."
- "La mairie peut lever les travaux."
- "L'aeroport est accessible mais demande un plan."
- "Le monde psychique pourrait etre une vraie sortie."
- "Un PNJ connait un passage."

Une piste peut avoir :

- id ;
- nom interne ;
- texte court ;
- categorie ;
- statut : inconnue, apercue, confirmee, bloquee, resolue ;
- lieux qui la revelent ;
- objets requis ;
- conditions ;
- consequence possible ;
- fin associee ou non.

### Quetes secondaires

Les quetes secondaires sont separees de l'objectif principal. Certaines aident, d'autres
non.

L'editeur pourrait permettre :

- poser un donneur de quete ;
- definir un lieu de depart ;
- definir des etapes optionnelles ;
- definir recompenses ;
- lier ou non a une piste de fuite ;
- ecrire les textes/dialogues ;
- placer les objets necessaires ;
- tester la quete depuis l'etape voulue.

### Evenements

Evenements possibles :

- evenement horaire ;
- evenement selon jour ;
- evenement selon stat ;
- evenement selon inventaire ;
- evenement selon niveau de recherche ;
- evenement selon zone ;
- evenement aleatoire ;
- evenement declenche par radio ;
- evenement declenche par consommation ;
- evenement lie au monde psychique.

---

## Mode 4 - PNJ, dialogues et factions

Outils possibles :

- placer un PNJ ;
- choisir son modele ;
- choisir son type : nomme, fonctionnel, foule ambiante ;
- definir son quartier ou sa faction ;
- definir son planning ;
- definir sa zone de deplacement ;
- definir ses dialogues ;
- definir ses reactions ;
- lier a une quete secondaire ;
- lier a une boutique ;
- lier a une piste de fuite ;
- definir relation avec police ou groupes ;
- definir comportement en cas de chaos.
- definir son etat persistant : vivant, mort, disparu, arrete, indisponible.

Principe important : les PNJ nommes et fonctionnels peuvent porter des consequences durables. Si le
joueur tue un PNJ important, il ne doit pas reapparaitre comme un passant generique. Sa disparition
peut fermer un dialogue, changer une boutique, modifier une tension de quartier, declencher une
rumeur ou attirer la police. La foule ambiante peut rester plus souple et respawner pour garder la
ville vivante.

Quartiers et factions :

- 4 grands quartiers rivaux + centre-ville municipal ;
- centre-ville controle par la police et les autorites ;
- tensions entre quartiers reglables ;
- points chauds ou zones de rencontre ;
- reaction policiere plus rapide en centre-ville ;
- evenements de rue possibles : intimidation, bagarre, fuite, tirs, intervention police.

Plus tard :

- editeur de dialogue visuel ;
- branches ;
- conditions ;
- choix ;
- consequences ;
- preview in-game ;
- detection des dialogues jamais atteignables.

---

## Mode 5 - Objets, pickups, boutiques et economie

L'editeur peut servir a placer :

- objets ramassables ;
- armes ;
- consommables ;
- argent ;
- loot cache ;
- conteneurs ;
- stocks de boutique ;
- prix ;
- horaires ;
- restrictions ;
- objets illegaux ;
- objets utiles pour quitter Beauvais.

Editeur d'items :

- creer une fiche item depuis une structure commune ;
- definir nom, categorie, rarete, prix, description ;
- definir taille dans la grille d'inventaire, rotation autorisee, poids et stack ;
- choisir icone, modele ou prefab visuel ;
- definir emplacement d'equipement si applicable : tete, bijoux, buste, bras, jambes, pieds ;
- definir effets, degats, defense, soin, duree, contrecoup et durabilite ;
- definir legalite : legal, suspect, illegal, vole ;
- ajouter tags gameplay : nourriture, arme, drogue, mission, quartier, fuite, etc. ;
- afficher un apercu de l'objet dans une grille de sac ;
- valider les champs manquants, ids dupliques, icones absentes et tailles impossibles.

Boutiques :

- nom ;
- type ;
- stock ;
- marge de prix ;
- vendeur ;
- interieur associe ;
- conditions d'ouverture ;
- reactions au vol ;
- lien avec police.

---

## Mode 6 - Police, chaos et zones de risque

Le projet vise un cote GTA-like cartoon. L'editeur pourra poser :

- commissariat ;
- zones surveillees ;
- cameras ;
- patrouilles ;
- zones interdites ;
- zones de fuite ;
- spawn police ;
- routes de patrouille ;
- points de respawn apres arrestation ;
- niveau de recherche initial selon zone ;
- reactions aux actions illegales.

Outils debug :

- afficher les zones de detection ;
- simuler un delit ;
- tester une poursuite ;
- reset le niveau de recherche ;
- teleporter au commissariat.

---

## Mode 7 - Audio, radio et ambiance

La Regie radio existe deja et peut rester separee pour l'instant. L'audio spatial et les ambiances
de lieux peuvent avancer sans attendre son integration dans le hub. Quand le reste de l'editeur sera
plus stable, la Regie pourra etre reintegree comme module de confort.

Idees :

- onglet Regie radio plus tard, quand ce sera utile ;
- calendrier par station ;
- preecoute ;
- detection des fichiers manquants ;
- validation de la grille ;
- jingles ;
- pubs ;
- emissions ;
- evenements radio lies au monde ;
- annonces qui revelent des pistes ;
- zones d'ambiance sonore dans la ville ;
- sons interieurs ;
- reverberation par type de lieu ;
- volume radio selon vehicule/interieur.

---

## Mode 8 - Temps, routine et vie quotidienne

L'editeur pourrait visualiser :

- heures d'ouverture ;
- horaires de travail ;
- routines PNJ ;
- evenements par jour ;
- salaire ;
- rendez-vous ;
- couvre-feu eventuel ;
- disponibilite des boutiques ;
- programmation radio ;
- meteo/ambiance ;
- consequences d'une journee ratee.

Vue utile :

- timeline de journee ;
- calendrier de semaine ;
- calques par heure ;
- simulation "voir la ville a 8h / 12h / 18h / minuit".

---

## Mode 9 - Monde psychique

Le monde psychique peut devenir une route complete pour quitter Beauvais.

L'editeur pourrait permettre :

- creer des zones psychiques ;
- lier une entree psychique a une consommation, un lieu ou un evenement ;
- placer des portails ;
- definir des transformations visuelles ;
- poser des regles speciales ;
- connecter des fragments de monde ;
- definir des sorties ;
- previsualiser l'effet sur Beauvais.

---

## Mode 10 - Tests et debug

Un bon editeur doit accelerer les tests.

Fonctions utiles :

- teleporter le joueur a un point ;
- lancer le jeu depuis un POI ;
- lancer un interieur directement ;
- simuler une heure/jour ;
- donner un objet ;
- vider l'inventaire ;
- changer stats ;
- changer argent ;
- changer niveau de recherche ;
- activer/desactiver une piste ;
- afficher collisions ;
- afficher triggers ;
- afficher zones ;
- verifier les donnees ;
- exporter un rapport d'erreurs.

Validations automatiques :

- POI sans nom ;
- entree sans interieur ;
- interieur sans sortie ;
- spawn bloque ;
- objet place dans un mur ;
- route bloquee sans collision ;
- sortie de Beauvais non bloquee ;
- quete secondaire sans recompense ;
- piste de fuite impossible ;
- asset manquant ;
- id duplique ;
- donnees non sauvegardees.

---

## Mode 11 - Production, Git et collaboration

Comme le projet est fait a deux, avec des IA, l'editeur doit produire des donnees propres.

Regles importantes :

- JSON lisible ;
- ids stables ;
- tri stable des donnees ;
- petits fichiers par domaine ;
- pas de gros blob illisible ;
- sauvegarde explicite ;
- message clair apres sauvegarde ;
- historique local ;
- export/import ;
- validation avant commit ;
- eviter que deux personnes modifient le meme gros fichier tout le temps.

Possibilite future :

- decouper les donnees par quartier ;
- decouper les interieurs par fichier ;
- afficher "fichier modifie par cet outil" ;
- mode lecture seule ;
- bouton "copier resume pour commit".

---

## Interface ideale

Disposition possible :

- centre : carte ou plan interieur ;
- gauche : liste des calques/outils ;
- droite : inspecteur de l'objet selectionne ;
- bas : banque d'assets ou timeline ;
- haut : barre d'actions, sauvegarde, validation, mode test.

Outils permanents :

- selection ;
- pan ;
- zoom ;
- placer ;
- deplacer ;
- peindre ;
- supprimer ;
- mesurer ;
- tester ;
- sauvegarder ;
- valider.

L'outil doit rester agreable :

- raccourcis clavier ;
- undo/redo ;
- autosave local de secours ;
- sauvegarde fichier explicite ;
- preview rapide ;
- messages simples ;
- pas de texte inutile en plein milieu ;
- l'info importante dans l'inspecteur ;
- erreurs visibles mais non bloquantes tant qu'on explore.

---

## Plan de developpement

Ce plan sert de feuille de route pour les prochaines sessions. Chaque etape doit produire
quelque chose d'utilisable, meme si tout n'est pas encore complet.

### Session 1 - Socle de l'editeur

Objectif : ouvrir un vrai outil dev-only sans toucher au jeu principal.

Etat actuel : `editor.html` charge une entree React dediee dans `src/editor/`. La page affiche
trois vues navigables de Beauvais : un plan 2D technique pour placer vite, une vue IG top-down
qui reutilise la vraie scene 3D du jeu, et une vue IG 2.5D orthographique inclinee pour mieux lire
les volumes et le relief. Les vues IG utilisent un eclairage editeur homogene sans ombres locales
de gameplay, et chargent dynamiquement les vraies tuiles 3D visibles selon le zoom et le cadre
camera : zoom proche = zone locale, grand dezoom = plus de ville generee en 3D. Le bouton "Ville"
calcule un zoom de vue d'ensemble a partir de l'emprise reelle de Beauvais. La mise en page contient barre haute,
panneau de calques a gauche, vue centrale et inspecteur a droite. Les calques batiments, routes,
eau et quartiers sont visibles et activables/desactivables dans le plan 2D ; les vues supportent
molette, pan, zoom par boutons, centrage spawn et vue ville entiere. Aucun outil d'edition
destructeur n'est expose.

Livrables :

- ajouter `editor.html` ;
- ajouter une entree Vite/React dediee a l'editeur ;
- creer `src/editor/EditorApp.tsx` ;
- creer une mise en page simple : barre haute, panneau gauche, vue centrale, inspecteur droit ;
- reutiliser le rendu top-down de Beauvais deja disponible via `mapDraw.ts` ;
- afficher les calques de base : batiments, routes, eau, quartiers ;
- zoom/dezoom, pan, centrage sur spawn ;
- aucun outil destructeur a ce stade.

Critere de fin :

- `localhost:5173/editor.html` ouvre une carte de Beauvais fluide et navigable.

### Session 2 - Donnees de points d'interet

Objectif : definir le format de donnees des lieux et marqueurs gameplay.

Etat actuel : `src/data/mapMarkers.json` contient une premiere liste de points d'interet de test,
avec id stable, type, position x/z, couleur, icone, rayon d'interaction, prompt, visibilite carte/jeu,
tags et horaires optionnels. Les types et le validateur vivent dans `src/data/mapMarkers.ts`.
L'editeur charge ces donnees, affiche le nombre de POI et l'etat de validation dans l'inspecteur,
liste les points dans le panneau gauche, les dessine sur le plan 2D et affiche des pins simples
dans la vue IG top-down quand le calque "Points d'interet" est actif. Aucune creation, suppression
ou sauvegarde n'est encore exposee.

Livrables :

- creer `src/data/mapMarkers.json` ;
- creer les types TypeScript associes ;
- definir les types de point d'interet : appart, shop, bar, travail, gare, mairie,
  commissariat, entree, sortie, travaux, PNJ, test, secret ;
- ajouter les champs horaires : jours, heure d'ouverture, heure de fermeture, message si ferme ;
- ajouter les champs interaction : rayon, prompt, visible carte, visible jeu, tags ;
- ajouter un validateur simple des donnees ;
- charger les points dans l'editeur.

Critere de fin :

- l'editeur lit un fichier JSON stable et affiche quelques points d'interet de test.

### Session 3 - Creation et edition de points d'interet

Objectif : placer les premiers vrais lieux utiles dans Beauvais.

Etat actuel : l'editeur expose Selection, Placer et Quartier. Un clic sur le plan 2D ou la
vue IG top-down selectionne un point proche, ou cree un nouveau point quand l'outil Placer est
actif. Les points peuvent etre modifies dans l'inspecteur : nom, type, icone, couleur, position,
rayon d'interaction, prompt, tags, horaires, message si ferme et visibilites carte/jeu/dev-only.
Les points de test initiaux ont ete retires : `src/data/mapMarkers.json` demarre vide pour que les
vrais lieux soient poses manuellement. L'edition ne trie plus les points a chaque frappe, afin de
garder l'inspecteur stable ; le tri/formatage est fait a la sauvegarde. La suppression reste locale
tant que l'utilisateur ne sauvegarde pas explicitement. Le bouton Sauver POI envoie les donnees a
une route Vite de developpement `POST /__pls/map-markers`, qui reecrit `src/data/mapMarkers.json`
avec un tri stable par id pour garder des diffs lisibles.

Livrables :

- outil selection ;
- outil placement ;
- inspecteur de point d'interet ;
- creation/modification/suppression ;
- choix du type, nom, icone, couleur, tags ;
- edition des horaires ;
- sauvegarde explicite dans `mapMarkers.json` via une route dev Vite ;
- tri stable du JSON pour eviter les diffs inutiles ;
- message clair apres sauvegarde.

Critere de fin :

- on peut placer l'appart, la gare, la mairie, le commissariat, un bar, un shop et une sortie
  bloquee, puis sauvegarder dans le repo.

### Session 4 - Affichage et interaction en jeu

Objectif : faire exister les points d'interet dans le jeu, sans encore creer les interieurs.

Etat actuel : les points d'interet de `src/data/mapMarkers.json` existent maintenant aussi dans
le jeu. Les points `visibleOnMap` apparaissent sur la grande carte et la minimap, les points
`visibleInGame` ont un marqueur 3D simple pose au sol via `groundHeight()`, et le joueur detecte
le lieu le plus proche dans son rayon d'interaction. Le HUD affiche un prompt avec la touche `E`,
le nom du lieu et son etat horaire. Les horaires optionnels sont compares au jour/heure du jeu :
si le lieu est ferme, le message de fermeture est affiche ; sinon `E` declenche une interaction
placeholder basee sur le prompt du marqueur. Les points `devOnly` restent visibles en developpement
mais sont caches du runtime de production.

Livrables :

- afficher les points importants sur la grande carte du jeu ;
- afficher optionnellement certains points sur la minimap ;
- afficher un marqueur 3D simple pour les points visibles en jeu ;
- detecter la proximite du joueur ;
- afficher un prompt d'interaction ;
- prendre en compte les horaires : ouvert, ferme, indisponible ;
- declencher une interaction placeholder ;
- documenter le comportement.

Critere de fin :

- le joueur peut aller devant un lieu, voir s'il est ouvert ou ferme, et interagir avec un
  message de test.

### Session 5 - Hub d'editeur

Objectif : commencer le cote couteau suisse.

Livrables :

- ajouter une navigation interne a l'editeur ;
- onglet Carte ;
- onglet Interieurs ;
- preparer une structure commune : layout, sauvegarde, messages, validation ;
- centraliser les futurs outils dans `src/editor/`.

Critere de fin :

- depuis `editor.html`, on peut passer entre les modules principaux sans perdre le travail non
  sauvegarde.

### Session 6 - Entrees de batiments et liens vers interieurs

Objectif : preparer le passage exterieur -> interieur.

Etat actuel : le dossier `src/data/interiors/` existe et contient un premier fichier test
`appart_chibrux.json`. Les types, la validation et la serialization vivent dans
`src/data/interiors.ts`. Chaque interieur contient ses etages, pieces, portes, fenetres, props,
spawns, sorties et futurs escaliers. La route Vite dev-only `POST /__pls/interiors` reecrit un
fichier `src/data/interiors/<interiorId>.json` avec un JSON stable. Le lien direct depuis un POI
exterieur et le bouton "Creer interieur" depuis la carte restent a faire.

Livrables :

- ajouter aux points d'interet le type `entrance` ;
- ajouter `interiorId`, spawn interieur, sortie retour ;
- creer le dossier `src/data/interiors/` ;
- creer un fichier par interieur ;
- bouton "Creer interieur" depuis un point d'entree ;
- creer un interieur vide avec metadonnees ;
- validation : entree sans interieur, interieur sans sortie, id duplique.

Critere de fin :

- depuis une porte placee sur Beauvais, l'editeur peut creer le fichier d'un nouvel interieur.

### Session 7 - Editeur d'interieur 2D minimal

Objectif : construire un interieur simple avec des assets prefabriques.

Etat actuel : `editor.html` est devenu un petit hub avec deux modules, Carte et Interieurs. Le
module Interieurs affiche la liste des interieurs, les etages, une grille 2D zoomable/deplacable,
un outil Piece par cliquer-glisser, et des outils de placement simples pour porte, fenetre, spawn,
sortie et prop prototype. Les pieces peuvent etre selectionnees et modifiees dans l'inspecteur
nom/x/z/largeur/profondeur. Le plan de base est vide : aucun point, aucune piece, aucun prop n'est
pre-place. Les elements se deplacent par clic-glisser, `Suppr` efface, `Ctrl+D` duplique, `Escape`
annule la selection, `Ctrl+Z` annule, `Ctrl+Y` retablit, et des boutons de pieces rapides posent une
piece 3x3, une piece 4x5 ou un couloir au centre de la vue. L'outil Piece reste actif apres creation
pour permettre de dessiner plusieurs salles a la suite. Coller deux pieces ne supprime pas
automatiquement le mur entre elles : l'outil Mur permet de cliquer un mur pour l'ouvrir ou le
refermer. Les murs ouverts sont stockes explicitement dans `removedWalls`, restent visibles en
pointille dans le plan, disparaissent du rendu 3D, et la collision de test laisse passer le joueur a
cet endroit. Les portes et fenetres s'aimantent au mur le plus proche dans un rayon court, prennent
automatiquement l'orientation du mur et peuvent etre recalees depuis l'inspecteur. Les fenetres ont
un cadre visible en test 3D. Une bibliotheque de placeholders en bas de l'ecran propose deja cube,
table, chaise, comptoir et lumiere : on peut choisir un prop ou le glisser-deposer directement sur
le plan. Le bouton Sauver enregistre l'interieur actif via Vite. Le bouton Tester ouvre le prototype
3D decrit en Session 8.

Livrables :

- vue plan 2D ;
- grille ;
- banque d'assets prefabriques minimale : sol, mur, porte, comptoir, table, chaise, lumiere ;
- placement, selection, deplacement, rotation ;
- sauvegarde dans `src/data/interiors/<interiorId>.json` ;
- inspecteur d'asset ;
- spawn joueur et sortie ;
- validation spawn/sortie.

Critere de fin :

- on peut creer un petit bar ou shop en plan 2D et sauvegarder son fichier.

### Session 8 - Generation 3D et visite d'interieur

Objectif : passer du plan 2D a une scene visitable.

Etat actuel : le module Interieurs possede un bouton Tester actif. Il bascule la zone centrale
vers une scene Three.js generee depuis le plan 2D : sols, murs simples, portes/fenetres en
marqueurs transparents, props prototype et anneaux de sortie. Le personnage Pierrot est reutilise
avec une logique de deplacement dediee aux interieurs : ZQSD pour bouger, Maj pour courir, camera
de test suiveuse, collision simple qui garde le joueur dans l'union des pieces. La camera de test
se controle avec clic droit ou molette : clic droit-glisser tourne autour du personnage et ajuste
la hauteur, la molette rapproche/eloigne. Le deplacement suit l'orientation de la camera. Le bouton Plan 2D
revient immediatement a l'edition. Ce test reste un prototype : les portes ne decoupent pas encore
les murs, les escaliers/ascenseurs ne changent pas encore d'etage, et l'interieur n'est pas encore
charge depuis une interaction en ville.

Livrables :

- generateur 3D depuis les assets prefabriques ;
- collisions simples ;
- chargement d'un interieur par `interiorId` ;
- transition depuis Beauvais vers interieur ;
- sortie retour vers Beauvais ;
- bouton "Visiter" depuis l'editeur ;
- retour editeur apres test.

Critere de fin :

- le joueur peut entrer dans un interieur simple, le visiter, ressortir, puis on peut le modifier.

### Session 9 - Zones de travaux et sorties bloquees

Objectif : rendre concret l'objectif "quitter Beauvais".

Livrables :

- outil zone/segment de travaux ;
- barrieres visibles ;
- collisions associees ;
- messages quand le joueur tente de sortir ;
- categorisation des sorties : route, gare, aeroport, egouts, psychique, politique ;
- marqueurs visibles ou caches selon besoin ;
- validation : sortie routiere non bloquee.

Critere de fin :

- les premieres sorties de Beauvais sont identifiees et bloquees de maniere visible et jouable.

### Session 10 - Routes overrides visuel + collisions

Objectif : modifier la carte jouable sans toucher a la donnee OSM brute.

Livrables :

- format `roadEdits.json` ;
- outil de creation de segment ;
- largeur/type/surface ;
- suppression ou masquage local ;
- recalcul de collision/surface praticable ;
- rendu top-down et rendu 3D coherent ;
- validation des routes coupees ou invalides.

Critere de fin :

- une route ajoutee ou modifiee dans l'editeur existe visuellement et physiquement en jeu.

### Session 11 - Batiments overrides

Objectif : transformer les lieux importants sans casser les collisions.

Livrables :

- selection de batiment OSM ;
- masquer/remplacer/annoter ;
- declarer usage gameplay ;
- poser une porte sur un batiment ;
- validation visible/collision ;
- support futur de modeles faits main.

Critere de fin :

- on peut transformer un batiment OSM en lieu gameplay fiable.

### Session 12 - Outils de confort et validation globale

Objectif : rendre l'editeur agreable pour de longues sessions de production.

Livrables :

- undo/redo ;
- autosave de secours ;
- recherche globale ;
- filtres ;
- raccourcis clavier ;
- teleportation test ;
- rapport d'erreurs ;
- warnings non bloquants ;
- export/resume pour commit.

Critere de fin :

- l'editeur devient utilisable longtemps sans friction majeure.

### Sessions suivantes - Modules systemiques

Modules a brancher ensuite dans le meme hub :

- PNJ et dialogues ;
- quartiers, factions et tensions ;
- quetes secondaires ;
- boutiques et economie ;
- objets et loot ;
- smartphone ;
- police, patrouilles, zones de risque ;
- routines horaires ;
- evenements ;
- audio spatial ;
- Regie radio, quand on voudra la reintegrer au hub ;
- monde psychique ;
- outils de debug avance ;
- validation globale des routes de fuite possibles, sans les exposer au joueur comme une
  quete principale.

---

## Interieurs rattaches aux points d'interet

Le circuit "je pose un lieu sur la carte, je fabrique son interieur" est en place.

Depuis le module **Carte**, avec un point selectionne, le bloc *Interieur* de l'inspecteur permet de :

- **creer l'interieur** du point : un niveau est fabrique et ouvert immediatement dans le module
  Interieurs. Il n'est pas vide — une piece de 6x5 m, un point d'arrivee du joueur et une sortie
  qui ramene au point de la carte. Un interieur sans piece ni sortie ne serait pas testable ;
- **rattacher un interieur existant** a ce point, via la liste deroulante ;
- **editer** l'interieur deja rattache, ou **detacher** le point (le fichier reste sur le disque).

L'identifiant de l'interieur est derive du nom du point (`Kebab du General` -> `kebab_du_general`)
et devient le nom du fichier dans `src/data/interiors/`. Il est **fige a la creation** : renommer
l'interieur ensuite ne renomme pas le fichier, pour ne pas casser le lien `interiorId` du point.

Cote donnees :

- `MapMarker.interiorId` (optionnel) porte le lien, dans `src/data/mapMarkers.json` ;
- la sortie de l'interieur pointe vers le POI via `target.markerId`, pour savoir ou reposer le
  joueur quand il ressort ;
- `src/data/interiors.ts` ramasse desormais **tous** les fichiers de `src/data/interiors/` via
  `import.meta.glob`. Ajouter un interieur ne demande plus de toucher au code.

Le module **Interieurs** permet aussi de creer un interieur autonome (bouton `+ Interieur`), de le
renommer et d'en changer le type. L'inspecteur rappelle quel point de la carte l'ouvre, ou signale
qu'aucun ne le fait — un interieur inaccessible est un interieur mort.

⚠️ Rien n'est ecrit sur le disque tant qu'on ne sauvegarde pas, et les deux sauvegardes sont
separees : le fichier de l'interieur (bouton Sauver du module Interieurs) et le lien `interiorId`
du point (bouton Sauver POI du module Carte).

## Ergonomie des volets

- Les volets gauche et droite se **redimensionnent** en tirant leur bord, entre 180 et 560 px.
- Ils se **replient** avec la fleche posee sur le bord de la carte, ou par un double-clic sur la
  poignee. Largeurs et etat replie sont gardes d'une session a l'autre (`localStorage`).
- Les deux modules partagent la meme disposition de volets.

⚠️ Les deux modules restent **montes en permanence**, celui du fond etant masque. Avant, changer
d'onglet demontait le module quitte et jetait tout son travail non sauvegarde en silence — ce qui
devenait franchement dangereux maintenant que "Creer l'interieur" change d'onglet tout seul. Le
module masque met en pause sa boucle de dessin, sa scene 3D et son ecoute du clavier.

## Confort d'edition disponible (module Carte)

- **Outils** : Selection (`V`), Placer (`P`), Quartier (`Q`).
- **Glisser-deposer** : avec l'outil Selection, attraper un point d'interet le deplace
  directement sur la carte. Avec l'outil Quartier, on attrape un sommet du contour.
- **Annuler / retablir** : `Ctrl+Z` / `Ctrl+Y`, ou les fleches de la barre du haut. Un
  glisser complet compte pour une seule annulation, et une frappe au clavier dans
  l'inspecteur est regroupee en un seul point d'annulation (voir `editorHistory.ts`).
- **Autres raccourcis** : `F` centre sur la selection, `Suppr` supprime, `Ctrl+D` duplique
  le point, `Ctrl+S` sauvegarde ce qui a change, `Echap` deselectionne. Aucun raccourci
  n'est intercepte quand le curseur est dans un champ de saisie.
- **Recherche** : le volet gauche filtre les points par nom, type, tag ou identifiant. Un
  double-clic sur une ligne de liste recentre la vue sur l'element.
- **Quartiers** : creation d'un quartier (carre de 200 m au centre de la vue) et
  suppression, avec confirmation. Un nouveau sommet est **insere** dans le contour au plus
  pres du bord clique, au lieu d'etre ajoute en fin de liste — sinon le polygone se repliait
  sur lui-meme des qu'on ne cliquait pas dans l'ordre du contour.

Reste a faire cote confort (voir plus haut) : selection multiple, groupes, verrouillage de
calque, mesure de distance, copier/coller entre quartiers.

## Garde-fous en place (mis a jour au fil des sessions)

Cette section liste ce qui est **deja implemente** pour proteger le travail, par opposition au
reste du document qui decrit la cible. Detail technique dans
[`02-ARCHITECTURE.md`](02-ARCHITECTURE.md#editeur-pls-editorhtml--garde-fous).

- **Copies de secours automatiques** : chaque sauvegarde copie l'ancien fichier dans
  `src/data/.backups/` (20 versions gardees par fichier, ignore par Git). Si une sauvegarde ecrase
  quelque chose par erreur, la version d'avant est recuperable a la main.
- **Refus des sauvegardes qui vident un fichier** : sauver alors que l'editeur est vide et que le
  disque ne l'est pas declenche une confirmation explicite. C'est exactement le scenario qui avait
  remis `mapMarkers.json` a `[]`.
- **Avertissement avant fermeture** : fermer ou recharger l'onglet avec des modifications non
  sauvegardees demande confirmation. Les boutons de sauvegarde passent en orange avec un point
  quand du travail attend d'etre ecrit, et l'inspecteur affiche une ligne "A sauver".
- **Ecran d'erreur au lieu d'une page blanche** : si un composant de l'editeur plante, le message
  et la pile s'affichent avec un bouton pour recharger.
- **Vue 3D bridee au dezoom** : les vues IG ne montent qu'une zone de 15 x 15 tuiles autour du
  centre. Au-dela, c'est le plan 2D qui sert a voir la ville entiere — la vue 3D ne peut pas
  afficher les 34 000 batiments d'un coup sans figer le navigateur.
