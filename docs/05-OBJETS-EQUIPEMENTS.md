# Objets, equipements et consommables

Ce document regroupe les idees d'objets pour le jeu PLS. Il sert de base de game design avant
integration dans les fichiers de donnees du jeu.

## Structure conseillee

Chaque objet pourra ensuite etre decrit avec les champs suivants :

| Champ | Role |
|---|---|
| `nom` | Nom affiche en jeu |
| `categorie` | Famille de l'objet |
| `rarete` | Commun, rare, epique, legendaire, etc. |
| `prix` | Valeur chez les marchands ou a la revente |
| `degats` | Degats pour les armes |
| `defense` | Protection pour les armures |
| `soin` | Recuperation pour les consommables |
| `effet_special` | Bonus, malus ou effet absurde |
| `durabilite` | Nombre d'utilisations ou solidite |
| `description` | Texte court dans l'inventaire |

## Categories

| Categorie | Usage |
|---|---|
| `arme` | Armes principales reutilisables |
| `arme_lancer` | Objets lances ponctuellement |
| `consommable_nourriture` | Nourriture et soins simples |
| `consommable_boisson` | Boissons sans alcool |
| `consommable_chelou` | Produits avec effets forts ou aleatoires |
| `alcool` | Boissons alcoolisees |
| `armure_tete` | Equipement de tete |
| `armure_torse` | Equipement de torse |
| `armure_jambes` | Equipement de jambes |
| `armure_pieds` | Equipement de pieds |
| `accessoire` | Bijoux, colliers, objets portes |
| `vehicule` | Moyens de deplacement |

## Armes

| Objet | Type | Idee d'effet |
|---|---|---|
| Taser | Arme electrique | Etourdit brievement la cible |
| Pistolet 9mm | Arme a feu | Gros degats, munitions limitees |
| Sniper a bille airsoft | Arme a distance | Faibles degats, haute precision |
| Poing americain | Corps a corps | Augmente les degats des coups de poing |
| Pelle | Corps a corps lourd | Degats moyens, repousse la cible |
| Poing basique | Arme de depart | Aucun bonus particulier |
| Bouche d'egouts | Arme lourde | Tres lente, tres gros degats |
| Canne | Corps a corps leger | Bonus contre les ennemis proches |
| Deambulateur | Arme defensive | Reduit les degats recus pendant l'utilisation |
| Gode-michet | Arme absurde | Peut infliger confusion ou humiliation |
| Arbalete | Arme a distance | Gros degats, cadence lente |
| Fouet | Portee moyenne | Chance de desarmer ou de ralentir |
| Chevrotine a sel | Arme a feu | Repousse fortement la cible |
| Hache | Corps a corps lourd | Gros degats, attaque lente |
| Arc | Arme a distance | Silencieux, munitions craftables |
| Javelot | Distance / corps a corps | Peut etre lance ou utilise en melee |
| T-bone | Corps a corps absurde | Degats moyens, peut attirer l'attention des ennemis |
| Ghetto blaster | Arme sonore | Etourdit en zone, bruyant et encombrant |

## Objets de lancer ponctuel

| Objet | Idee d'effet |
|---|---|
| Flechette | Petit degat, chance d'empoisonner |
| Cendrier | Degat moyen, chance d'assommer |
| Bouteille d'alcool en tout genre | Degat avec eclats, peut se casser |
| Cailloux | Faible degat, tres commun |
| Poudre de perlimpinpin | Effet aleatoire |
| Bang | Degat sonore ou explosion de surprise, usage unique |
| Parasol de terrasse | Gros lancer absurde, repousse |
| Table | Tres lourd, zone d'impact |
| Chaise | Degat moyen, facile a trouver |
| Allumette | Peut enflammer certains objets |
| Bougie | Petit degat, feu leger |

## Consommables

| Objet | Type | Idee d'effet |
|---|---|---|
| Royale Pizza | Nourriture | Gros soin |
| Kebab du chef | Nourriture | Soin et bonus de force temporaire |
| Pates de la hess | Nourriture | Petit soin, tres commun |
| Krousti poulet | Nourriture | Soin moyen et bonus de vitesse |
| Diverses boissons | Boisson | Energie, endurance ou bonus temporaire selon la marque parodiee |
| La frappe de l'ancien | Consommable chelou | Gros boost d'attaque, contrecoup apres effet |
| Zombie Kush | Consommable chelou | Reduit le stress, ralentit les deplacements |
| Doliprane | Soin | Reduit les malus de douleur |
| Gaviscon | Soin | Annule un malus lie a la nourriture douteuse |
| Anxiolytique | Soin / chelou | Reduit la panique, baisse les reflexes |
| CBD chelou | Consommable chelou | Effet aleatoire leger |
| Champignon hallucitripogene | Consommable chelou | Vision alteree, bonus perception ou confusion |
| Acide du hippy | Consommable chelou | Effet visuel fort, statistiques instables |
| Cocaine coupee au platre | Consommable chelou | Vitesse forte, gros contrecoup |
| Ketamine du centre equestre | Consommable chelou | Reduction des degats, deplacement altere |
| Pilon coupe au pneu | Consommable chelou | Resistance temporaire, malus de precision |
| Camelito tabac | Consommable chelou | Petit boost de calme, dependance possible |
| GHB | Consommable chelou | Effet narratif ou malus important a manier avec prudence |
| PCP | Consommable chelou | Rage temporaire, perte de controle possible |
| Petits plats maison de foncede | Nourriture | Soin aleatoire |
| Beauvaisienne | Nourriture | Pain lardon, soin et endurance |
| Sandwich du ter ter | Nourriture | Soin moyen, bonus de bagarre |

## Armures et equipements

| Objet | Emplacement | Idee d'effet |
|---|---|---|
| Nouveau maillot du PSG | Torse | Charisme et provocation |
| Divers maillots de foot | Torse | Boost different selon le club ou la couleur |
| Bagouze du gitan | Accessoire | Chance et intimidation |
| Collier du bon samaritain | Accessoire | Bonus aux soins recus |
| Collier d'expiation | Accessoire | Defense accrue, malus de vitesse |
| Casquette a l'envers | Tete | Style et esquive |
| Casque de chantier | Tete | Defense de tete |
| Gilet fluorescent | Torse | Visibilite et securite |
| Pompes de securite | Pieds | Defense et stabilite |
| Crocs | Pieds | Vitesse faible, bonus de style douteux |
| Tong de touriste | Pieds | Mobilite legere, defense tres basse |
| Jean troue | Jambes | Esquive legere |
| Pantalon chic | Jambes | Charisme |
| Chemise en lin de bobo | Torse | Charisme et negociation |
| Debardeur en maille | Torse | Intimidation |
| String | Jambes | Defense nulle, bonus absurde |
| Nike ton pied | Pieds | Vitesse et esquive |
| TeHaine du bled | Pieds | Endurance |
| Gilet par balle | Torse | Defense contre les projectiles |
| Blouson en cuir | Torse | Defense et style |
| Veste Hidolf Aterre | Torse | Intimidation absurde, attire aussi les ennuis |
| Veste de Ronoara Zoro | Torse | Bonus de determination et d'attaque au corps a corps |
| Camelto | Accessoire | Bonus social ou absurde |
| Lunette de Jeffrey D. | Accessoire | Bonus d'observation, malus de confiance des PNJ |
| Croix de Jesus | Accessoire | Chance ou resistance morale |
| Kippa du seigneur | Tete | Bonus de sagesse ou de foi |
| Casque VR | Tete | Bonus d'immersion, baisse la perception du danger reel |

## Vehicules

| Vehicule | Idee de role |
|---|---|
| Trottinette electrique de la ville | Rapide, fragile, facile a trouver |
| Honda | Vehicule fiable, vitesse correcte |
| Skateboard | Leger et maniable |
| Rollers d'enfant de 8 ans | Rapides mais instables |
| Scooter debride | Tres rapide, bruyant |
| Clio en ruine | Solide mais lente |
| Monocycle electrique | Tres maniable, ridicule, difficile a controler |

## Alcools

| Objet | Idee d'effet |
|---|---|
| Chouffe du guerrier | Force et courage temporaires |
| HK paillette | Charisme et confusion |
| Gin supertonic | Bonus social, malus d'equilibre |
| Whisky extra sec | Resistance, malus de vitesse |
| Rhum caraibeen | Moral et chaleur |
| Calvados fermier | Gros courage, grosse gueule de bois |
| Cidre brut de pomme | Petit boost d'endurance |

## Notes d'equilibrage

- Les armes lourdes doivent taper fort mais etre lentes.
- Les objets de lancer doivent etre puissants uniquement sur une courte fenetre.
- Les consommables chelous doivent toujours avoir un contrecoup ou un risque.
- Les armures doivent avoir un emplacement clair pour eviter les empilements trop forts.
- Les vehicules doivent surtout changer la sensation de deplacement, pas seulement la vitesse.
- Les objets absurdes doivent rester lisibles en jeu : un effet simple, un nom drole, une consequence claire.
