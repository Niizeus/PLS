# Run Bible

## Role du document

Ce document fixe le cadre de conception des runs. Il ne contient pas le lore detaille, les solutions exactes, ni les idees creatives finales. Ces elements doivent etre poses dans l'outil interactif, puis consolides quand ils sont suffisamment stables.

## Principe de run

- Une run dure 90 minutes en temps reel.
- Une run represente 3 jours en temps de jeu.
- Le monde avance meme si le joueur ne participe pas aux evenements.
- Le joueur doit sortir de Beauvais avant la fin du temps.
- Si le temps expire, la run se termine par une mort.
- Il existe plusieurs facons de sortir de la ville.
- Chaque sortie doit pouvoir etre atteinte par plusieurs cheminements.
- Chaque cheminement peut avoir plusieurs methodes.

## Ratio temps

| Temps reel | Temps de jeu |
|---|---|
| 90 min | 3 jours |
| 30 min | 1 jour |
| 1 min 15 s | 1 heure |
| 1,25 s | 1 minute |

## Socle runtime

Le temps de run doit rester separe de l'heure systeme reelle. Le runtime utilise une horloge de
run qui avance a partir du temps ecoule depuis le debut de run, puis expose un temps de jeu derive.

Conversions officielles :

- `90 min IRL = 5 400 s IRL`.
- `3 jours IG = 4 320 min IG`.
- `1 s IRL = 0,8 min IG`.
- `1 min IG = 1,25 s IRL`.
- `1 h IG = 75 s IRL`.
- `1 jour IG = 1 800 s IRL`.

Le store de run expose :

- le temps reel ecoule depuis le debut de run ;
- le temps reel restant ;
- le jour de run courant ;
- l'heure de jeu courante ;
- la progression globale de `0` a `1` ;
- l'etat de run : `active`, `escaped`, `dead`, `failed`, `ended`.

Le cycle jour/nuit, le HUD, le telephone, les marqueurs horaires et les radios peuvent continuer
a lire le temps de jeu courant. Les sorties, elles, ne doivent pas etre codees dans l'horloge :
elles appellent simplement l'API de reussite de run. A expiration, si la run est encore `active`,
l'horloge declare une mort avec une raison technique extensible.

## Structure cible

### Fins

Une fin represente une issue de run. Elle peut etre une sortie de ville, une mort, ou une issue speciale.

Une fin doit pouvoir indiquer :

- son type ;
- ses conditions ;
- les chemins qui peuvent y mener ;
- les consequences principales ;
- son etat de conception.

### Chemins

Un chemin est une facon d'atteindre une fin. Il est compose d'etapes.

Une etape peut indiquer :

- les conditions requises ;
- les methodes alternatives ;
- les lieux concernes ;
- les personnages concernes ;
- les objets ou informations utiles ;
- les evenements temporels qui peuvent l'ouvrir ou la fermer.

### Timeline

La timeline de run couvre 90 minutes reelles. Elle doit aussi afficher le jour et l'heure en jeu.

Un evenement peut :

- exister sans le joueur ;
- ouvrir une opportunite ;
- fermer une opportunite ;
- deplacer un personnage ;
- changer l'etat d'un lieu ;
- declencher une information radio ;
- modifier une condition de fin.

### Entites

Les entites servent a relier les idees entre elles sans rigidifier l'ecriture.

Types attendus :

- personnage ;
- lieu ;
- objet ;
- faction ;
- information ;
- radio ;
- systeme.

## Regles de conception

- L'objectif principal reste lisible : sortir de Beauvais avant la fin du temps.
- Une route ne doit pas dependre d'une seule action invisible.
- Une fin importante doit avoir au moins deux chemins.
- Un chemin important doit avoir au moins deux methodes ou variantes.
- Les evenements temporels doivent creer des opportunites autant que des blocages.
- La mort de fin de temps doit rester comprehensible comme une consequence du chrono.
- L'outil de conception aide a detecter les trous, mais ne bloque jamais la creation.

## Outil interactif

L'outil local se trouve dans `run-bible.html` pendant le developpement.

Il sert a poser :

- les fins ;
- les chemins ;
- les etapes ;
- les evenements temporels ;
- les personnages, lieux, objets et autres entites ;
- les notes libres.

Le fichier source des donnees est `src/data/runBible.json`.
