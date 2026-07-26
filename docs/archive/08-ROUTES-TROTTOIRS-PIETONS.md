# Routes, trottoirs et zones pietonnes

## Routes avec relief

`src/world/beauvais/Roads.tsx` differencie maintenant clairement la chaussee et les trottoirs :

- bitume bas ;
- trottoirs sureleves ;
- bande de bordure en pierre ;
- face verticale de trottoir visible entre route et trottoir.

Le rendu garde les fissures, reprises d'asphalte, variations de teinte et lignes centrales existantes.

## Zones pietonnes

`src/world/beauvais/CentreVillePedestrianAxes.tsx` ajoute des plaques pietonnes larges sur les zones centrales : Place Jeanne Hachette, parvis de la mairie, liaison Saint-Pierre/Carnot, rue Gambetta et rue du 27 Juin. Ces plaques reprennent un pavage varie et des joints visibles pour que les zones pietonnes ne ressemblent plus a de simples routes.

## Rue Gambetta

`src/world/beauvais/Lamps.tsx` complete la rue Gambetta avec deux lignes de lampadaires places le long de l'axe, avec les bras orientes vers la rue.
