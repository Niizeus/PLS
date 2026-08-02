# 09 - Substances, drogues et monde psychique

Ce document fixe la V1 des drogues et produits chelous de PLS. Le but n'est pas de simuler la
realite ni de donner des infos pratiques : les effets ci-dessous sont des traductions gameplay,
caricaturales, inspirees de grandes familles d'effets connues.

**Statut : V1 data jouable.** Les items existent dans `src/data/items.ts` comme consommables, avec
prix, duree, bonus/malus, legalite IG et tags. Le systeme dedie `src/gameplay/substances/` n'existe
pas encore.

## Intention

Les substances doivent etre utiles, droles et un peu dangereuses. Elles ne sont pas un simple bouton
"deviens plus fort" : chaque produit doit ouvrir une option et fermer autre chose.

- **Fun immediat** : changer le feeling de Chibrux pendant 45 a 150 secondes.
- **Choix tactique** : fuir, encaisser, calmer le mental, chercher une porte psychique, survivre a
  une soiree.
- **Contrecoup lisible** : perte de sante, soif, faim, mental, vitesse, agilite ou hausse du chaos.
- **Route psychique** : certains produits portent le tag `psychique` et serviront plus tard a
  remplir une jauge d'ouverture du monde psychique.
- **Pas de besoin obligatoire d'addiction** : le joueur ne doit pas etre force de reconsommer pour
  survivre. Les risques viennent du gameplay, de la police, du prix, du chaos et des effets
  secondaires.

## Legalite IG

La legalite est une regle du jeu, pas une information juridique reelle.

| Valeur code | Sens gameplay | Consequence prevue |
|---|---|---|
| `legal` | Vente normale | Disponible en boutiques classiques, pas de risque de possession. |
| `prescription` | Produit medical detourne | Achat/possession suspecte hors pharmacie ou quete. |
| `grey_market` | Zone grise | Vendeur de market, risque social faible, qualite douteuse. |
| `illegal` | Produit interdit IG | Dealers, planques, fouille policiere, confiscation, amende/recherche. |

## Liste V1

Les prix sont des prix de marche **en jeu**, volontairement abstraits. Ils servent a equilibrer le
risque, pas a representer des prix reels.

| Item | Inspiration | Role gameplay | Effets actuels | Legalite | Prix |
|---|---|---|---|---|---|
| `cbd-chelou` | Relaxant leger | Calmer sans gros danger | Mental +12, vitesse -1, chaos +1 | Zone grise | 9 EUR |
| `zombie-kush` | Cannabis | Detente, appetit, errance molle | Sante -2, faim +20, mental +18, vitesse -2, agilite -1, chaos +1 | Illegal | 15 EUR |
| `anxiolytique-du-tiroir` | Depresseur / anxiolytique | Stopper la panique | Mental +18, defense +1, vitesse -2, agilite -2, chaos -2 | Ordonnance | 14 EUR |
| `pilon-coupe-pneu` | Produit sale de quartier | Encaisser une embrouille | Sante -4, mental -6, attaque +1, defense +3, agilite -3, chaos +2 | Illegal | 12 EUR |
| `speed-beauvais-express` | Stimulant type amphetamine | Courir, bosser, fuir | Sante -5, faim -20, mental -7, vitesse +4, agilite +2, chaos +3 | Illegal | 32 EUR |
| `cocaine-platre` | Stimulant fort | Sprint social/violence/urgence | Sante -8, soif -15, mental -10, attaque +2, vitesse +5, chaos +4 | Illegal | 55 EUR |
| `taz-coeur-fluo` | MDMA | Soiree, empathie, portes sociales | Soif -20, mental +10, defense -2, vitesse +2, chance +2, chaos +2 | Illegal | 28 EUR |
| `champignon-hallucitripogene` | Psilocybine | Premiere cle psychique | Mental -8, agilite -2, chance +4, chaos +3 | Illegal | 22 EUR |
| `acide-du-hippy` | LSD | Exploration psychique forte | Mental -12, agilite -3, chance +5, chaos +5 | Illegal | 38 EUR |
| `ketamine-centre-equestre` | Dissociatif | Tank maladroit / seuil psychique | Sante -5, mental -12, defense +4, vitesse -4, agilite -5, chance +3, chaos +4 | Illegal | 45 EUR |
| `sirop-dodo-mamie` | Opioide / sedatif medical | Douleur et defense, mais lourd | Mental +12, defense +3, vitesse -4, agilite -3, chaos -2 | Ordonnance | 18 EUR |

## Traduction des effets reels en stats

| Famille | Effets inspires | Traduction PLS |
|---|---|---|
| Cannabis / detente | Relaxation, appetit, coordination reduite, jugement altere | Mental et faim montent ; vitesse/agilite baissent ; chaos leger. |
| Stimulants | Energie, vigilance, appetit reduit, agitation, crash mental/physique | Vitesse/agilite/attaque montent ; faim, sante, mental et calme baissent. |
| MDMA | Energie, empathie, perception/time alteres, soif/chaleur/risque de confusion | Mental/chance montent ; soif et defense baissent ; chaos de soiree. |
| Hallucinogenes | Perception deformee, mauvais jugement, anxiete possible | Chance et chaos montent ; mental/agilite baissent ; tag `psychique`. |
| Dissociatifs | Detachement, sedation, douleur distante, controle reduit | Defense monte ; vitesse/agilite/mental chutent ; tag `psychique`. |
| Depresseurs / sedatifs | Calme, somnolence, coordination et reflexes reduits | Mental/defense montent ; vitesse/agilite baissent ; chaos peut baisser. |

## Boucle de gameplay cible

1. Le joueur obtient une substance par boutique, dealer, loot, recompense ou event.
2. Il voit clairement le prix, la legalite et les effets dans l'inventaire.
3. Il consomme pour un besoin precis : fuir, tenir un combat, calmer le mental, passer une epreuve,
   ouvrir une hallucination ou avancer vers le monde psychique.
4. Le contrecoup cree une suite : boire, manger, dormir, eviter la police, trouver un endroit calme,
   ou assumer un gros pic de chaos.
5. Les substances `psychique` rempliront plus tard une jauge separee qui debloque des evenements,
   puis une entree jouable vers le monde psychique.

## Systeme a coder plus tard

- `src/gameplay/substances/` : jauge `psychicCharge`, tolerance soft, crash apres expiration,
  qualite/coupe aleatoire, interactions police et vendeurs.
- Effets visuels : chromatic aberration toon, wobble camera doux, sons filtres, panneaux qui
  changent de texte, silhouettes impossibles.
- Effets de controle : tres ponctuels et lisibles, jamais assez forts pour rendre le jeu injouable.
- Economie : stocks par quartier, heures de vente, prix variables, risques de transaction.
- Police : possession illegale visible en fouille, confiscation a l'arrestation, amende, niveau de
  recherche selon quantite et zone.

## Sources utilisees pour l'inspiration

- DEA Drug Fact Sheets : familles, effets generaux et risques de cannabis, stimulants, cocaine,
  MDMA, LSD, psilocybine, ketamine, benzodiazepines et opioides :
  https://www.dea.gov/factsheets
- EUDA Drug profiles : profils europeens et panorama des substances :
  https://d9www.euda.europa.eu/publications/drug-profiles_en
- MedlinePlus, Drug use first aid : effets generaux par classes et signaux de danger :
  https://medlineplus.gov/ency/article/000016.htm
- MedlinePlus, Substance use disorder : classification generale opioides, stimulants,
  depresseurs et hallucinogenes :
  https://medlineplus.gov/ency/article/001522.htm
