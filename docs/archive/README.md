# 📦 Archive — docs d'une version précédente du monde

⚠️ **Ces documents ne décrivent PAS l'état actuel du code.** Ils datent d'avant la
**remise à plat du monde** (2026-07, voir [`../04-MONDE-BEAUVAIS.md`](../04-MONDE-BEAUVAIS.md)),
où le relief et les ~48 composants de décor du centre-ville ont été supprimés.

Ils sont gardés parce que la **recherche sur le vrai Beauvais qu'ils contiennent reste vraie** :
dimensions des monuments, enseignes réelles rue par rue, tracés, repères. C'est utile le jour où
on refera le centre-ville — mais tout ce qu'ils disent sur des **fichiers de code** est périmé.

| Fichier | Ce qui reste utile | Ce qui est périmé |
|---------|--------------------|-------------------|
| `06-CAP-GRAPHIQUE-IGN.md` | Où trouver les données IGN (LiDAR HD, BD TOPO) et comment les traiter | Tout le code : `lidarTerrain.ts`, `TerrainLidar.tsx`, `build-terrain-*.mjs`, `public/terrain/` — supprimés |
| `07-BEAUVAIS-REPERES-IMPORTANTS.md` | La liste des lieux réels et leurs coordonnées | Les composants qui les affichaient |
| `08-ROUTES-TROTTOIRS-PIETONS.md` | Quelles rues sont piétonnes, leurs vrais tracés | Le découpage bitume/trottoir/bordure |
| `09-MONUMENTS-ET-ENSEIGNES.md` | Dimensions réelles des monuments, vraies enseignes, **commerces fermés à ne pas remettre** | `CentreVilleEnseignes.tsx`, `CathedralPrecinct.tsx` |
| `10-CATHEDRALE-FOCUS-BD.md` | Le plan réel de la cathédrale Saint-Pierre | Sa modélisation à la main |
