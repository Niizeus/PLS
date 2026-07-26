# Bible musicale des radios du jeu

## Document de travail — structure, méthode et workflow

Ce document sert de base centrale pour concevoir, organiser et produire toutes les stations de radio du jeu.

L’objectif est de construire progressivement un catalogue cohérent comprenant :

- les identités des stations ;
- les artistes fictifs ;
- les titres des morceaux ;
- les prompts musicaux pour SUNO ;
- les paroles des morceaux chantés ;
- les jingles, publicités et interventions des animateurs ;
- les différentes versions générées ;
- le statut de validation de chaque élément.

Le projet doit rester lisible même lorsqu’il contiendra plusieurs dizaines de morceaux.

---

# 1. Objectif général

Le système de radio doit donner au jeu une véritable identité sonore.

Chaque station doit avoir :

- une personnalité immédiatement reconnaissable ;
- une programmation musicale cohérente ;
- ses propres artistes fictifs ;
- son ton, son humour et son public ;
- des jingles et des interventions adaptés ;
- suffisamment de variété pour éviter une impression de répétition.

Les radios ne doivent pas seulement diffuser de la musique. Elles peuvent aussi servir à enrichir l’univers du jeu, raconter des événements, faire de la satire, présenter des personnages ou créer une ambiance particulière selon les lieux et les moments.

---

# 2. Les cinq stations de départ

## R01 — Radio électro, techno et rave

### Positionnement

Une station énergique centrée sur les musiques électroniques, les scènes rave, les free parties et les sons nocturnes.

### Sous-genres possibles

- Techno industrielle
- Acid techno
- Hardtek
- Tribe
- Rave old school
- Psytrance
- Dark trance
- Breakbeat
- Jungle électronique
- Electro expérimentale
- Techno minimale
- Trance mélodique

### Types de morceaux

- Morceaux instrumentaux
- Titres avec samples vocaux courts
- Morceaux avec slogans répétés
- Tracks progressives
- Morceaux très directs sans longue introduction
- Titres de fin de nuit plus atmosphériques

---

## R02 — Chanson française old school

### Positionnement

Une station consacrée à la chanson française populaire, aux voix expressives, aux histoires simples et aux morceaux qui semblent appartenir à une autre époque.

### Sous-genres possibles

- Chanson réaliste
- Variété française des années 1960 à 1980
- Chanson de bistrot
- Ballade populaire
- Rock français ancien
- Chanson humoristique
- Chanson romantique
- Musette revisitée
- Folk français
- Chanson de route

### Types de morceaux

- Histoires de personnages
- Chansons d’amour
- Morceaux mélancoliques
- Chansons humoristiques
- Titres de comptoir
- Chansons sociales
- Ballades simples et mémorables

---

## R03 — Radio rap

### Positionnement

Une station couvrant plusieurs époques et plusieurs styles de rap, avec des artistes fictifs possédant chacun une identité claire.

### Sous-genres possibles

- Boom bap
- Rap français années 1990 ou 2000
- Trap
- Rap mélancolique
- Rap de rue
- Rap alternatif
- Rap expérimental
- Rap festif
- Rap absurde
- Cloud rap
- Rap conscient
- Rap électronique

### Types de morceaux

- Morceaux narratifs
- Freestyles
- Titres à refrain chanté
- Morceaux très techniques
- Rap humoristique
- Titres sombres
- Morceaux plus commerciaux

---

## R04 — Radio beauf, réactionnaire et satirique

### Positionnement

Une station volontairement gênante, excessive et caricaturale. Elle représente une radio de comptoir remplie d’animateurs bornés, de chansons ringardes, de nostalgie absurde et de personnages persuadés d’avoir toujours raison.

Cette station doit fonctionner comme une satire. Elle peut montrer des personnages racistes, ignorants ou réactionnaires, mais elle ne doit pas devenir une véritable plateforme de propagande contre des groupes réels.

### Règle éditoriale importante

Pour conserver l’humour sans transformer la station en contenu haineux réel :

- les personnages peuvent être présentés comme ridicules, contradictoires ou méprisables ;
- les chansons peuvent viser des factions, espèces, régions ou groupes fictifs appartenant à l’univers du jeu ;
- les paroles peuvent utiliser des préjugés absurdes ou des rivalités inventées ;
- les groupes réels protégés ne doivent pas être présentés comme inférieurs, dangereux ou indésirables ;
- la mise en scène doit clairement montrer la bêtise de la station plutôt que valider son discours.

### Sous-genres possibles

- Rock de routier
- Country française de parking
- Chanson de chasse
- Punk de comptoir
- Variété patriotique ringarde
- Hymne de supporters
- Chanson paillarde fictive
- Parodie identitaire
- Rock régional caricatural
- Chanson anti-modernité

### Types de morceaux

- Hymnes ridicules
- Chansons contre une invention moderne
- Morceaux sur la chasse, le barbecue ou le diesel
- Titres visant une faction fictive du jeu
- Chansons d’animateurs persuadés d’être censurés
- Publicités douteuses
- Faux débats radiophoniques

---

## R05 — Radio alternative commerciale mondiale

### Positionnement

Une station plus accessible, capable de diffuser de faux tubes internationaux. Les morceaux doivent être immédiatement agréables et mémorables, mais conserver suffisamment de personnalité pour éviter une impression de musique générique.

### Sous-genres possibles

- Indie pop
- Alternative rock
- Electro-pop
- Pop-rock de festival
- Synth-pop
- Folk-pop
- Hyperpop accessible
- Dream pop
- Dance alternative
- Pop électronique
- Rock radiophonique
- Soul alternative

### Types de morceaux

- Faux tubes internationaux
- Chansons à gros refrain
- Morceaux de festival
- Titres mélancoliques mais accessibles
- Morceaux dansants
- Ballades modernes
- Duos fictifs

---

# 3. Convention de nommage

Chaque station et chaque morceau doit posséder un identifiant unique.

## Identifiants des stations

- `R01` : Électro / Techno / Rave
- `R02` : Chanson française old school
- `R03` : Rap
- `R04` : Radio beauf et satirique
- `R05` : Alternative commerciale mondiale

## Identifiants des morceaux

Format :

```text
RXX-TXX
```

Exemples :

- `R01-T01` : premier morceau de la radio électro
- `R03-T07` : septième morceau de la radio rap
- `R05-T12` : douzième morceau de la radio alternative

## Identifiants des autres contenus

- `R01-J01` : premier jingle de la radio 1
- `R02-P01` : première publicité fictive de la radio 2
- `R04-A01` : première intervention d’animateur de la radio 4
- `R05-B01` : premier bulletin ou segment parlé de la radio 5

Cette convention permet de retrouver rapidement chaque élément dans les dossiers, les exports et le document final.

---

# 4. Workflow général

Chaque morceau passe par plusieurs étapes.

## Étape 1 — Idée brute

L’idée peut être très simple.

Exemples :

- une techno industrielle qui ressemble à une machine en train de perdre le contrôle ;
- une chanson française sur un homme qui attend tous les soirs dans le même café ;
- un morceau de rap raconté par un petit escroc trop ambitieux ;
- un rock de routier sur un homme persuadé que son vieux diesel lui parle ;
- un tube indie pop sur une rupture racontée comme une panne de satellite.

À ce stade, aucune structure complète n’est nécessaire.

---

## Étape 2 — Définition du concept

L’idée est transformée en concept précis.

Il faut définir :

- la station concernée ;
- le sous-genre ;
- l’époque ou les influences générales ;
- l’émotion dominante ;
- le rôle du morceau dans la programmation ;
- le type de voix ;
- la langue ;
- le sujet des paroles ;
- le niveau d’accessibilité ou d’expérimentation.

---

## Étape 3 — Création de l’artiste fictif

Chaque morceau peut appartenir à un artiste déjà existant dans l’univers ou introduire un nouvel artiste.

Pour éviter un catalogue sans personnalité, chaque artiste doit avoir quelques caractéristiques simples :

- nom ;
- pays ou région fictive ;
- style principal ;
- type de voix ;
- image publique ;
- thèmes récurrents ;
- niveau de popularité ;
- station principale de diffusion.

Un artiste peut avoir plusieurs morceaux, ce qui permet de construire progressivement une fausse scène musicale cohérente.

---

## Étape 4 — Direction musicale

Avant d’écrire le prompt SUNO, il faut préciser le morceau musicalement.

Éléments à définir :

- tempo ou plage de BPM ;
- rythme ;
- instrumentation ;
- texture sonore ;
- type de production ;
- intensité ;
- structure ;
- durée visée ;
- évolution du morceau ;
- place de la voix ;
- éléments originaux ;
- clichés à éviter.

Cette étape empêche les prompts de devenir trop vagues ou trop génériques.

---

## Étape 5 — Écriture du prompt SUNO

Le prompt doit être directement copiable.

Il doit décrire :

- le genre exact ;
- le tempo ;
- la voix ;
- les instruments ;
- l’ambiance ;
- la structure ;
- les variations ;
- la qualité de production recherchée ;
- ce qui rend le morceau particulier.

Il faut éviter les références inutiles au projet ou au nom du jeu. SUNO ne connaît pas l’univers du jeu. Le prompt doit décrire concrètement le résultat sonore attendu.

### Bon principe

Ne pas écrire :

```text
Une musique pour la radio de mon jeu.
```

Préférer :

```text
Fast French acid techno at 145 BPM, distorted 303 bassline, dry punchy kick, metallic percussion, short shouted vocal samples, immediate start with no ambient intro, escalating tension and a raw underground warehouse mix.
```

---

## Étape 6 — Écriture des paroles

Les paroles ne sont écrites que lorsque le morceau en a besoin.

Elles doivent respecter :

- le personnage de l’artiste ;
- la station ;
- le genre musical ;
- la durée visée ;
- la structure du morceau ;
- la manière dont SUNO interprète les indications de section ;
- le niveau de répétition nécessaire pour obtenir un refrain mémorable.

Les paroles doivent être pensées pour être chantées ou rappées, pas seulement lues.

---

## Étape 7 — Génération

Le prompt et les paroles sont envoyés dans SUNO.

Il est conseillé de générer plusieurs versions avant validation.

Pour chaque génération, noter :

- ce qui fonctionne ;
- ce qui ne fonctionne pas ;
- la qualité de la voix ;
- la qualité du refrain ;
- la longueur de l’introduction ;
- le respect du genre ;
- les instruments intéressants ;
- les erreurs de prononciation ;
- les passages à conserver ;
- les modifications à effectuer.

---

## Étape 8 — Révision

Le prompt ou les paroles sont modifiés en fonction des résultats.

Exemples :

- réduire l’introduction ;
- rendre la batterie plus sèche ;
- enlever un instrument ;
- rendre la voix moins commerciale ;
- renforcer le refrain ;
- simplifier un couplet ;
- augmenter l’énergie ;
- diminuer la quantité de paroles ;
- supprimer les clichés du genre.

Chaque version importante doit être conservée.

---

## Étape 9 — Validation

Un morceau est validé lorsqu’il remplit les critères suivants :

- il correspond clairement à sa station ;
- il possède une identité propre ;
- il ne ressemble pas trop aux autres morceaux déjà validés ;
- la voix est crédible ;
- le refrain ou le thème principal est mémorable ;
- la durée est adaptée ;
- le morceau peut fonctionner pendant le gameplay ;
- le mix ne devient pas fatigant trop rapidement ;
- les paroles sont compréhensibles ;
- le morceau enrichit l’univers du jeu.

---

## Étape 10 — Intégration au catalogue

Une fois validé, le morceau reçoit :

- son identifiant définitif ;
- son titre définitif ;
- son artiste définitif ;
- son genre ;
- ses tags ;
- son fichier audio final ;
- sa pochette éventuelle ;
- ses métadonnées ;
- son statut `VALIDÉ`.

---

# 5. Statuts de production

Chaque fiche doit afficher un statut.

Valeurs recommandées :

- `IDÉE`
- `CONCEPT EN COURS`
- `PROMPT EN COURS`
- `PROMPT PRÊT`
- `PAROLES EN COURS`
- `PRÊT À GÉNÉRER`
- `GÉNÉRÉ`
- `À CORRIGER`
- `VERSION INTÉRESSANTE`
- `VALIDÉ`
- `ABANDONNÉ`

---

# 6. Modèle de fiche pour une station

```markdown
# R01 — Nom de la station

## Identité

**Nom complet :**  
**Slogan :**  
**Style principal :**  
**Public visé :**  
**Ton général :**  
**Époque dominante :**  
**Langues diffusées :**  

## Identité sonore

Décrire ici les sons, instruments, types de voix et ambiances récurrentes.

## Animateurs

### Nom de l’animateur

**Personnalité :**  
**Type de voix :**  
**Humour :**  
**Rôle dans l’univers :**  

## Programmation

- Genre 1
- Genre 2
- Genre 3

## Règles de la station

- Ce que la station diffuse souvent
- Ce qu’elle diffuse rarement
- Ce qu’elle ne diffuse jamais

## Morceaux

- R01-T01 — Titre — Artiste — Statut
- R01-T02 — Titre — Artiste — Statut

## Jingles

- R01-J01 — Description — Statut

## Publicités

- R01-P01 — Description — Statut

## Interventions parlées

- R01-A01 — Description — Statut
```

---

# 7. Modèle complet de fiche pour un morceau

```markdown
# R01-T01 — Titre du morceau

**Statut :** IDÉE  
**Station :** R01  
**Artiste fictif :**  
**Album ou single :**  
**Genre principal :**  
**Sous-genre :**  
**Langue :**  
**Durée visée :**  
**BPM :**  
**Tonalité ou mode :**  

## Fonction dans la radio

Expliquer à quel moment ce morceau doit être diffusé et ce qu’il apporte à la programmation.

## Concept

Résumé clair du morceau en quelques phrases.

## Ambiance

- Émotion principale :
- Niveau d’énergie :
- Atmosphère :
- Images mentales :

## Direction musicale

### Rythme

Décrire la batterie, le groove, les changements et l’intensité.

### Instruments

- Instrument 1
- Instrument 2
- Instrument 3

### Production

Décrire le type de mix, la texture, les effets et le niveau de propreté ou de brutalité recherché.

### Voix

**Type de voix :**  
**Interprétation :**  
**Placement dans le mix :**  
**Accent ou prononciation :**  

## Structure

- Intro :
- Couplet 1 :
- Pré-refrain :
- Refrain :
- Couplet 2 :
- Pont :
- Dernier refrain :
- Outro :

## Prompt SUNO

```text
PROMPT FINAL À COPIER ICI
```

## Éléments à éviter

```text
ÉLÉMENTS À ÉVITER ICI
```

## Paroles

```text
[Intro]

[Couplet 1]

[Refrain]

[Couplet 2]

[Pont]

[Refrain final]
```

## Historique des versions

### Version 1

**Date :**  
**Résultat :**  
**Points positifs :**  
**Problèmes :**  
**Modifications prévues :**  

### Version 2

**Date :**  
**Résultat :**  
**Points positifs :**  
**Problèmes :**  
**Modifications prévues :**  

## Validation

- [ ] Le morceau correspond à la station
- [ ] Le genre est identifiable
- [ ] L’introduction n’est pas trop longue
- [ ] La voix correspond au personnage
- [ ] Le refrain ou thème principal fonctionne
- [ ] Les paroles sont adaptées à la durée
- [ ] Le morceau ne ressemble pas trop aux autres titres
- [ ] La qualité sonore est suffisante
- [ ] Le fichier final est exporté
- [ ] Le morceau est prêt pour l’intégration

## Fichiers liés

- Audio final :
- Version alternative :
- Paroles :
- Pochette :
- Notes :
```

---

# 8. Modèle rapide pour proposer une idée

Lorsqu’une nouvelle idée de morceau est ajoutée, elle peut être envoyée sous cette forme très simple :

```markdown
## Nouvelle idée

**Station envisagée :**  
**Genre :**  
**Sujet :**  
**Ambiance :**  
**Type de voix :**  
**Référence générale :**  
**Détail important :**  
```

Il n’est pas nécessaire de remplir tous les champs. Une seule phrase peut suffire pour démarrer.

Exemple :

```markdown
## Nouvelle idée

Un vieux rock de routier sur un homme qui déteste les voitures électriques et pense que son diesel comprend ses émotions. Le morceau doit être drôle, très premier degré dans l’interprétation et adapté à la radio beauf.
```

---

# 9. Modèle de prompt SUNO

Un prompt musical peut être construit avec les blocs suivants.

```text
[Genre et époque], [tempo], [rythme principal], [instruments principaux], [type de voix], [interprétation], [ambiance], [structure], [évolution du morceau], [type de production], [élément original].
```

Exemple générique :

```text
Raw French road rock at 118 BPM, heavy straight drums, overdriven electric guitars, simple bassline and occasional harmonica, middle-aged raspy male voice singing with excessive confidence, catchy pub-style chorus, immediate opening with the main riff, short guitar solo, slightly cheap late-1980s production, humorous but performed completely seriously.
```

## Éléments négatifs ou à éviter

```text
Avoid polished pop production, modern metal, electronic drums, cinematic orchestration, comedy sound effects, exaggerated cartoon vocals and long ambient intros.
```

---

# 10. Règles pour les paroles

## Une chanson doit avoir un point de vue

Le narrateur doit être identifiable.

Exemples :

- un routier nostalgique ;
- une chanteuse de cabaret fatiguée ;
- un rappeur qui ment sur sa réussite ;
- une star pop qui parle à un satellite ;
- un ravisseur extraterrestre devenu DJ ;
- un animateur de radio persuadé d’être un héros national.

## Le refrain doit être simple

Le refrain doit généralement contenir :

- une phrase centrale ;
- une image forte ;
- un rythme facile à retenir ;
- suffisamment de répétition pour être mémorisable ;
- peu de mots compliqués.

## Les couplets doivent faire avancer l’idée

Chaque couplet doit apporter une nouvelle information, une nouvelle scène ou une nouvelle émotion.

## Les paroles doivent correspondre à la durée

Pour un morceau de trois minutes, il est souvent inutile d’écrire quatre longs couplets, deux ponts et trois refrains différents.

La quantité de texte doit rester adaptée au débit vocal.

## Les indications de structure doivent rester simples

Balises recommandées :

```text
[Intro]
[Verse 1]
[Pre-Chorus]
[Chorus]
[Verse 2]
[Bridge]
[Final Chorus]
[Outro]
```

Pour les chansons françaises, il est possible d’utiliser :

```text
[Couplet 1]
[Refrain]
[Couplet 2]
[Pont]
[Refrain final]
```

---

# 11. Variété du catalogue

Pour éviter que les radios deviennent répétitives, il faut surveiller plusieurs éléments.

## Varier les tempos

Une station ne doit pas contenir uniquement des morceaux à la même vitesse.

## Varier les voix

Prévoir :

- voix masculines ;
- voix féminines ;
- voix graves ;
- voix aiguës ;
- voix propres ;
- voix cassées ;
- voix parlées ;
- duos ;
- morceaux instrumentaux.

## Varier les structures

Tous les titres ne doivent pas suivre exactement : couplet, refrain, couplet, refrain.

## Varier les thèmes

Même une radio spécialisée doit pouvoir parler de plusieurs sujets.

## Varier le niveau de qualité fictive

Tous les artistes ne doivent pas sembler être des superstars. Certaines chansons peuvent volontairement paraître locales, anciennes, étranges, artisanales ou légèrement ratées.

Cela rend l’univers plus crédible.

---

# 12. Équilibrage recommandé pour chaque station

Pour une première version, une station peut viser entre 8 et 15 morceaux.

Exemple de répartition pour 10 morceaux :

- 3 morceaux très représentatifs de la station ;
- 2 morceaux plus accessibles ;
- 2 morceaux plus originaux ou expérimentaux ;
- 1 morceau lent ;
- 1 morceau humoristique ou narratif ;
- 1 morceau rare ou surprenant.

Le catalogue initial complet pourrait donc contenir environ 50 morceaux pour cinq stations.

Il n’est pas nécessaire de tous les produire immédiatement. Une première version jouable peut commencer avec 3 à 5 morceaux par station.

---

# 13. Jingles, animateurs et publicités

## Jingles

Un jingle doit généralement durer entre quelques secondes et une quinzaine de secondes.

Il peut contenir :

- le nom de la station ;
- le slogan ;
- une signature sonore ;
- un effet particulier ;
- une courte voix reconnaissable.

## Interventions d’animateurs

Les animateurs permettent de donner de la personnalité à la station.

Types d’interventions :

- présentation du morceau suivant ;
- commentaire sur l’actualité du jeu ;
- blague ;
- dispute entre animateurs ;
- message d’un auditeur ;
- faux concours ;
- annonce locale ;
- réaction à un événement du monde.

## Publicités fictives

Les publicités peuvent enrichir l’univers.

Exemples :

- magasin fictif ;
- boisson ;
- véhicule ;
- médicament absurde ;
- événement ;
- restaurant ;
- entreprise douteuse ;
- produit technologique ;
- service politique ou administratif.

Chaque station peut diffuser des publicités adaptées à son public.

---

# 14. Arborescence de fichiers recommandée

```text
Radios/
│
├── README.md
├── Catalogue_Global.md
│
├── R01_Electro_Techno_Rave/
│   ├── Station.md
│   ├── Morceaux/
│   │   ├── R01-T01_Titre/
│   │   │   ├── Fiche.md
│   │   │   ├── Prompt.txt
│   │   │   ├── Paroles.txt
│   │   │   ├── Audio/
│   │   │   └── Notes/
│   ├── Jingles/
│   ├── Publicites/
│   └── Animateurs/
│
├── R02_Chanson_Francaise/
├── R03_Rap/
├── R04_Radio_Beauf_Satirique/
└── R05_Alternative_Commerciale/
```

---

# 15. Catalogue global

Le catalogue général doit permettre de retrouver rapidement tous les morceaux.

Exemple :

| ID | Station | Titre | Artiste | Genre | Langue | BPM | Statut |
|---|---|---|---|---|---|---:|---|
| R01-T01 | R01 | Titre | Artiste | Acid techno | Instrumental | 145 | Validé |
| R02-T01 | R02 | Titre | Artiste | Chanson réaliste | Français | 82 | À générer |
| R03-T01 | R03 | Titre | Artiste | Boom bap | Français | 92 | Idée |

Des colonnes supplémentaires peuvent être ajoutées :

- durée ;
- humeur ;
- niveau d’énergie ;
- voix ;
- date de création ;
- version finale ;
- fichier intégré au jeu ;
- licence ou conditions d’utilisation.

---

# 16. Processus de travail recommandé dans la discussion

Pour chaque nouvelle idée :

1. L’idée brute est proposée.
2. La station et le genre précis sont déterminés.
3. Le concept est clarifié.
4. Un titre et un artiste fictif sont proposés.
5. La direction musicale est écrite.
6. Le prompt SUNO est préparé.
7. Les paroles sont écrites si nécessaire.
8. Le morceau est généré dans SUNO.
9. Les résultats sont analysés.
10. Le prompt ou les paroles sont corrigés.
11. La meilleure version est validée.
12. La fiche finale est ajoutée au catalogue.

Cette méthode permet de travailler morceau par morceau sans perdre la cohérence générale.

---

# 17. Ordre de travail conseillé

## Phase 1 — Définition des stations

Pour chaque station :

- trouver son nom ;
- trouver son slogan ;
- définir son ton ;
- définir ses animateurs ;
- choisir ses sous-genres ;
- définir ses règles éditoriales.

## Phase 2 — Premiers morceaux

Créer trois morceaux pilotes par station :

- un morceau très représentatif ;
- un morceau plus accessible ;
- un morceau plus original.

Cela permet de tester rapidement si la station possède une identité suffisante.

## Phase 3 — Jingles et habillage

Créer :

- un jingle principal ;
- deux ou trois variantes courtes ;
- quelques interventions d’animateurs ;
- une ou deux publicités fictives.

## Phase 4 — Extension du catalogue

Ajouter progressivement de nouveaux morceaux en surveillant la variété.

## Phase 5 — Intégration en jeu

Tester :

- la fréquence de répétition ;
- les transitions ;
- les niveaux sonores ;
- le comportement lorsque le joueur change de station ;
- les reprises après interruption ;
- la diffusion des jingles ;
- le déclenchement des événements spéciaux.

---

# 18. Principes à conserver pendant tout le projet

- Une radio doit avoir une personnalité, pas seulement une playlist.
- Chaque morceau doit remplir une fonction précise.
- Les artistes fictifs doivent être réutilisés lorsque cela apporte de la cohérence.
- Les prompts SUNO doivent décrire le son, pas raconter le contexte du projet.
- Les paroles doivent être pensées pour la musique.
- Les versions non retenues peuvent servir plus tard.
- Les stations doivent être suffisamment variées pour ne pas fatiguer le joueur.
- La satire doit rester identifiable comme satire.
- Les titres commerciaux doivent rester mémorables sans devenir génériques.
- Les morceaux expérimentaux doivent rester compatibles avec le gameplay.
- Chaque élément validé doit être documenté immédiatement.

---

# 19. Première étape concrète

La prochaine étape consiste à définir les identités des cinq stations :

- nom ;
- slogan ;
- tonalité ;
- animateur ou animatrice ;
- sous-genres principaux ;
- type de public ;
- place de la station dans l’univers du jeu.

Une fois cette base établie, les premières idées de morceaux pourront être transformées en fiches complètes.

---

# 20. Résumé du workflow

```text
IDÉE BRUTE
    ↓
CONCEPT
    ↓
STATION + GENRE
    ↓
ARTISTE FICTIF + TITRE
    ↓
DIRECTION MUSICALE
    ↓
PROMPT SUNO
    ↓
PAROLES
    ↓
GÉNÉRATION
    ↓
ANALYSE
    ↓
CORRECTIONS
    ↓
VALIDATION
    ↓
INTÉGRATION AU CATALOGUE
```

Ce document doit rester vivant. Il pourra être enrichi au fur et à mesure avec les noms définitifs des stations, les fiches des artistes, les morceaux validés et les règles spécifiques découvertes pendant les générations.
