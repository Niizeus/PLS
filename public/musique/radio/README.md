# Radios du jeu

**C'est le seul dossier lu par le jeu.** Il n'y a plus de dossier de travail separe : tu deposes
un fichier audio ici, il est joue en jeu. Pas de code a toucher, pas de nom impose.

## Les cinq stations

| Dossier | Station | Identite |
|---|---|---|
| `R01_TekRadz/` | **TekRadz** | Tekno underground, militante, sans publicite |
| `R02_Franchon/` | **Franchon** | Musique francaise et ceux qui la fabriquent |
| `R03_NRV/` | **NRV** | Rap, clashs, scandales |
| `R04_Lys_France/` | **Lys France** | Info reactionnaire satirique |
| `R05_Alterz/` | **Alterz** | Grande radio commerciale internationale |

Identites completes : `docs/Documentations RADIO/Identite des radios du jeu.pdf`.

## Structure d'une station

```text
R01_TekRadz/
  Musiques/                 les morceaux diffuses hors emission
  Jingles/                  habillage court
  Publicites/               pubs et annonces
  Emissions/
    La_Zone_Libre/          un dossier par emission
```

## Emissions : episodes et parties

Une **emission** (`La_Zone_Libre/`) contient des **episodes** (une diffusion), et un episode peut
etre coupe en plusieurs **parties** qui s'ENCHAINENT sans interruption.

La regle est deduite de ce que tu ranges — tu n'as rien a declarer :

| Dans le dossier de l'emission | Ce que le jeu comprend |
|---|---|
| des **fichiers** | **un seul episode**, et ces fichiers en sont les **parties**, dans l'ordre |
| des **sous-dossiers** | **un sous-dossier = un episode**, ses fichiers en sont les parties |

Les deux peuvent cohabiter : les fichiers poses a la racine forment l'episode n°1, et chaque
sous-dossier ajoute un episode.

```text
Emissions/
  La_Zone_Libre/                    un seul episode en 3 parties
    ZoneLibrePartie (1).wav
    ZoneLibrePartie (2).wav
    ZoneLibrePartie (3).wav
  Chronique/                        un episode par sous-dossier
    Les billet d'humeur de jeanne/
      partie 1.wav
      partie 2.wav
```

> ⚠️ **Piege a connaitre.** Avant, chaque fichier d'une emission etait pris pour un episode a part,
> diffuse un jour different : trois parties d'une meme emission etaient etalees sur trois jours,
> separees par de la musique. C'est corrige — mais ca veut dire que si tu veux vraiment plusieurs
> episodes, il faut des **sous-dossiers**, pas des fichiers cote a cote.

## Comment ajouter une musique

1. Copie le fichier dans `Musiques/` de la station voulue.
2. C'est tout. Le nom du fichier n'a aucune importance.

Le jeu scanne le dossier au demarrage de Vite : en `npm run dev`, deposer ou retirer un fichier
recharge la page automatiquement. Le titre affiche sur le tableau de bord du vehicule est deduit
du nom du fichier (`Hartetek _ 01.wav` devient `Hartetek 01`), donc autant nommer proprement.

Formats acceptes : `.wav`, `.mp3`, `.ogg`, `.opus`, `.m4a`, `.aac`, `.flac`, `.webm`.

L'ordre de la playlist suit l'ordre alphabetique naturel des noms de fichiers (`T2` avant `T10`).
Si tu veux maitriser l'ordre, prefixe les fichiers : `01 - Titre.wav`, `02 - Titre.wav`.
Un prefixe d'identifiant a l'ancienne (`R01-T01 Titre.wav`) est reconnu et retire du titre affiche.

## Programmation

### 🎛️ La Regie : ou tu remplis le planning

La programmation n'est plus deduite des noms de dossiers : elle vit dans une **grille
7 jours x 24 heures** que tu remplis toi-meme.

```bash
npm run dev
```

Puis ouvre **http://localhost:5173/regie.html**.

- Une case = **une heure de jeu** d'une station. Tu y poses une **emission**, de la **musique**,
  de la **pub**, ou une **coupure d'antenne**. Une case vide vaut « musique ».
- Le bouton **⇥ semaine** copie une journee sur les sept.
- **Enregistrer** reecrit `src/data/radioSchedule.json` et le jeu se recharge tout seul.
- La Regie affiche la **duree reelle** de chaque emission et **jusqu'ou elle deborde** (cases
  hachurees). C'est important : une heure de jeu ne valant que 2 min 30, une emission de
  14 minutes occupe pres de 6 heures de grille.

> La Regie est un **outil de developpement** : elle n'existe qu'en `npm run dev` et ne part pas
> dans le jeu compile.

### Les regles de diffusion

- Hors emission, la station enchaine les fichiers de `Musiques/`.
- L'ordre de la playlist est **melange differemment chaque jour** (et differemment d'une station a
  l'autre). Aucun morceau ne repasse tant qu'on n'a pas fait le tour de la playlist.
- Une emission demarre a l'heure de sa case et dure **ce que dure vraiment son episode du jour**.
  Elle **deborde** sur les cases vides ou « musique » qui suivent. Seules une **autre emission**,
  une case **pub**, une case **antenne coupee** ou **minuit** l'interrompent.
- Un episode est choisi par jour de jeu, dans l'ordre, puis la liste boucle.

> ⚠️ **Une station sans fichier dans `Musiques/` est MUETTE hors de ses emissions.** Il n'y a rien
> a jouer, aucune programmation ne peut le rattraper. C'est le cas de `R04_Lys_France` aujourd'hui :
> elle ne diffuse que ses deux emissions du soir, et se tait le reste du temps.
>
> Pour eviter que ca ressemble a une radio cassee, la station attribuee automatiquement a un
> vehicule est tiree **uniquement parmi celles qui ont de la musique**. On peut toujours zapper
> sur une station muette avec **R** — c'est alors un choix.

⏱️ **Attention a l'echelle de temps.** Un jour de jeu dure une heure reelle, donc **une heure de jeu
ne vaut que 2 minutes 30 d'audio reel**. Une emission de 14 minutes occupe donc pres de 6 heures
de jeu. C'est normal, mais ca surprend quand on remplit le planning.

La station joue « en continu » meme quand personne n'ecoute : en montant dans un vehicule, on
tombe au milieu d'un morceau.

## Details techniques

Le scan est fait par `vite/radioManifestPlugin.ts`, qui expose le resultat au jeu via le module
virtuel `virtual:pls-radio-manifest`. `src/audio/radioCatalog.ts` y ajoute les identites des
stations.

La **duree** de chaque fichier est lue au scan, cote Node : pour un `.wav`, elle se lit directement
dans l'en-tete, sans rien decoder ni installer. Les formats compresses (`.mp3`, `.ogg`...) n'ont pas
cet en-tete simple : leur duree est alors mesuree par le navigateur au chargement, comme avant.
Autrement dit, **le `.wav` est le format le plus confortable ici** — le jeu demarre plus vite et la
grille de programmation connait les durees sans rien telecharger.

Un dossier dont le nom ne commence pas par `RXX` est ignore.
