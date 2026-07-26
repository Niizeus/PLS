# Cathedrale seule - focus BD

## Objectif

Le monde est temporairement recentre sur la cathedrale Saint-Pierre de Beauvais : terrain, parvis, Haute-Oeuvre, Basse-Oeuvre et horloge. Les autres couches de ville restent dans le code, mais `World.tsx` utilise `CATHEDRAL_ONLY = true` pour repartir sur une base propre.

## Modele

`src/world/beauvais/CathedralPrecinct.tsx` rend maintenant la cathedrale plus autonome :

- les parties basses issues de l'emprise OSM sont integrees dans le composant ;
- les murs hauts, pignons, rosaces, verrieres, portails, arcs-boutants, tirants et contreforts restent construits a la main ;
- les rosaces ont un remplage graphique ;
- les pignons, portails et fenetres ont des traits BD plus nets ;
- la Basse-Oeuvre garde ses bandes de brique et sa silhouette basse differenciee.

## References de fidelite

Les marqueurs conserves sont : absence de nef, pas de fleche actuelle, choeur tres haut, deux facades de transept avec rosaces de 11 m, arcs-boutants rapproches, tirants metalliques et Basse-Oeuvre carolingienne a l'ouest.
