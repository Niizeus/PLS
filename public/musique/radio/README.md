# Radios du jeu

Ces dossiers sont lus directement par le jeu.

Structure prevue pour chaque station :

```text
RXX/
  Musiques/              RXX-T01.wav a RXX-T05.wav
  Jingles/               RXX-J01.wav a RXX-J03.wav
  Publicites/            RXX-P01.wav a RXX-P03.wav
  Emissions/
    Podcast_Du_Soir/     RXX-E01.wav a RXX-E10.wav
```

Programmation actuelle :

- de 18h00 a 19h00 dans le temps du jeu : `Podcast_Du_Soir` ;
- un episode est choisi par jour de jeu, dans l'ordre, puis la liste boucle ;
- hors emission, la station diffuse les fichiers du dossier `Musiques` en boucle coherente.

Important : le temps du jeu est accelere. Une emission d'une heure de jeu correspond donc a une
fenetre audio compressee, pour que la radio reste synchronisee avec l'horloge du monde.