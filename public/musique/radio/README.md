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
    La_Zone_Libre/          un dossier par emission, un fichier par episode
```

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

- Hors emission, la station enchaine les fichiers de `Musiques/` en boucle.
- Chaque sous-dossier de `Emissions/` occupe une tranche d'une heure de jeu a partir de 18h00,
  dans l'ordre alphabetique (la premiere de 18h00 a 19h00, la suivante de 19h00 a 20h00).
- Un episode est choisi par jour de jeu, dans l'ordre, puis la liste boucle.

Le temps du jeu est accelere : une heure de jeu correspond a une fenetre audio courte, pour que
la radio reste synchronisee avec l'horloge du monde. La station joue « en continu » meme quand
personne n'ecoute : en montant dans un vehicule, on tombe au milieu d'un morceau.

## Details techniques

Le scan est fait par `vite/radioManifestPlugin.ts`, qui expose le resultat au jeu via le module
virtuel `virtual:pls-radio-manifest`. `src/audio/radioCatalog.ts` y ajoute les identites des
stations ; la duree reelle de chaque fichier est mesuree au chargement par `RadioAudioSystem`.

Un dossier dont le nom ne commence pas par `RXX` est ignore.
