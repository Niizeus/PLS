# Reperes importants de Beauvais

## Couche ajoutee

`src/world/beauvais/BeauvaisImportantPlaces.tsx` ajoute une couche 3D de lieux identifies a partir d'adresses publiques geocodees :

- mairie, commissariat, palais de justice et caserne des pompiers ;
- Galeries Lafayette, restaurants rapides, Basic-Fit et centre commercial Saint-Quentin ;
- zone commerciale d'Allonne, Leroy Merlin, Brico Depot et Mr.Bricolage ;
- boulangeries, boucheries et poissonnerie du centre-ville.

Les batiments publics ont une silhouette specifique : drapeau et horloge pour la mairie, panneaux bleus et plots pour le commissariat, colonnes pour la justice, portes rouges et tour pour la caserne. Les grandes enseignes ont des volumes commerciaux avec parkings, et les commerces de bouche ont des vitrines specialisees.

## Tabacs

`src/world/beauvais/BeauvaisTobaccoShops.tsx` ajoute les bureaux de tabac et bar-tabacs reperes par les annuaires publics. Chaque adresse est geocodee, puis rendue avec une devanture compacte, une carotte rouge, une vitrine presse/FDJ ou une terrasse quand il s'agit d'un bar-tabac.

## Implantation

Les positions viennent des adresses confirmees puis geocodees via l'API Adresse nationale. Les commerces situes seulement par rue ou zone commerciale sont poses sur le meilleur point geocode disponible pour cette rue ou cette zone, afin de rester coherents avec l'echelle actuelle du monde.
