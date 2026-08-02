# Documentation PLS

Ce dossier est la memoire du projet. Il doit permettre a un humain ou a une IA de retrouver vite
la bonne information sans relire toute la documentation.

## Lire dans l'ordre

Pour comprendre le projet depuis zero :

1. [00 - Setup](00-SETUP.md) : installer et lancer le projet.
2. [01 - Workflow Git](01-WORKFLOW-GIT.md) : travailler a deux sans conflit.
3. [02 - Architecture](02-ARCHITECTURE.md) : ou ranger le code et les donnees.
4. [03 - Game Design](03-GAME-DESIGN.md) : gameplay, boucles, systemes et intentions.
5. [04 - Monde Beauvais](04-MONDE-BEAUVAIS.md) : vraie ville, quartiers, carte, relief, routes.
6. [05 - Objets et equipements](05-OBJETS-EQUIPEMENTS.md) : items, inventaire, equipements.
7. [06 - Editeur PLS](06-EDITEUR-PLS.md) : outil de production, carte, interieurs, futurs modules.
8. [07 - Backlog d'idees](07-BACKLOG-IDEES.md) : idees pas encore specifiees. **Rien n'y est a coder.**
9. [08 - ChunkForge](08-CHUNKFORGE.md) : generation de quartiers credibles (archetypes, confiance, chunks).
10. [09 - Substances](09-SUBSTANCES.md) : drogues, effets, legalite IG, prix et route psychique.

## Chercher vite

| Je cherche... | Aller dans... |
|---|---|
| Lancer le jeu, installer Node, demarrer Vite | [00 - Setup](00-SETUP.md) |
| Branches, commits, conflits Git | [01 - Workflow Git](01-WORKFLOW-GIT.md) |
| Ou mettre un fichier ou un systeme | [02 - Architecture](02-ARCHITECTURE.md) |
| Pitch, objectif, journee type, fins | [03 - Game Design](03-GAME-DESIGN.md) |
| Inventaire sac a dos, smartphone, PNJ, gangs, ragdoll | [03 - Game Design](03-GAME-DESIGN.md) |
| Beauvais, quartiers, centre-ville, police, relief, routes | [04 - Monde Beauvais](04-MONDE-BEAUVAIS.md) |
| Liste d'objets, categories, structure item, equipements | [05 - Objets et equipements](05-OBJETS-EQUIPEMENTS.md) |
| Drogues, effets, legalite, prix et monde psychique | [09 - Substances](09-SUBSTANCES.md) |
| Editeur carte, interieurs, items, PNJ, factions, validations | [06 - Editeur PLS](06-EDITEUR-PLS.md) |
| Archetypes de batiments, chunks, passeports, score de confiance | [08 - ChunkForge](08-CHUNKFORGE.md) |
| Radios, identite des stations, workflow audio | [Documentations RADIO](Documentations%20RADIO/) |
| Une idee pas encore tranchee, une envie, une piste a explorer | [07 - Backlog d'idees](07-BACKLOG-IDEES.md) |
| Anciennes recherches utiles mais plus forcement actuelles | [archive](archive/) |

## Regle de rangement

- **Decision de gameplay** : [03 - Game Design](03-GAME-DESIGN.md).
- **Detail sur Beauvais ou ses quartiers** : [04 - Monde Beauvais](04-MONDE-BEAUVAIS.md).
- **Objet, item, equipement, inventaire** : [05 - Objets et equipements](05-OBJETS-EQUIPEMENTS.md).
- **Drogue, substance, effet psychique, legalite ou prix de marche chelou** :
  [09 - Substances](09-SUBSTANCES.md).
- **Outil pour creer du contenu** : [06 - Editeur PLS](06-EDITEUR-PLS.md).
- **Generation d'un quartier, archetype de batiment, chunk** : [08 - ChunkForge](08-CHUNKFORGE.md).
- **Implementation et architecture de code** : [02 - Architecture](02-ARCHITECTURE.md).
- **Recherche ancienne ou piste mise de cote** : [archive](archive/).
- **Idee pas encore decidee ni specifiee** : [07 - Backlog d'idees](07-BACKLOG-IDEES.md). Des qu'elle
  devient une decision, elle demenage dans le document du systeme concerne.

Si une idee touche plusieurs domaines, on met la decision principale dans le document le plus
proche, puis on ajoute seulement un renvoi court dans les autres docs.

## Etat actuel des gros documents

| Document | Statut |
|---|---|
| [03 - Game Design](03-GAME-DESIGN.md) | Source principale des decisions gameplay. A reorganiser plus tard si le document devient trop gros. |
| [04 - Monde Beauvais](04-MONDE-BEAUVAIS.md) | A jour sur le monde actuel, mais contient beaucoup de notes techniques. |
| [05 - Objets et equipements](05-OBJETS-EQUIPEMENTS.md) | Base de bible items. Doit devenir plus data-driven avec les prochains objets. |
| [06 - Editeur PLS](06-EDITEUR-PLS.md) | Vision + roadmap + etat implemente. A separer plus tard entre vision et suivi technique si besoin. |
| [07 - Backlog d'idees](07-BACKLOG-IDEES.md) | Recueil d'idees non specifiees. Ne decrit PAS le jeu actuel et ne doit pas etre implemente sans demande explicite. |
| [08 - ChunkForge](08-CHUNKFORGE.md) | Specification validee, **pas encore implementee**. Contrat du systeme + suivi des lots. Ne decrit PAS du code existant. |
| [09 - Substances](09-SUBSTANCES.md) | V1 data jouable des drogues/produits chelous + direction du futur systeme psychique. |
