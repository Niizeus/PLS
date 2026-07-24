# 🗺️ 04 — Le monde : Beauvais pour de vrai

On veut que la map soit **vraiment Beauvais** : on part des **vraies données de la ville**
pour placer les bâtiments, les rues, et pour l'ambiance/le climat.

---

## 📍 Repères réels

- **Ville** : Beauvais, préfecture de l'**Oise (60)**, région **Hauts-de-France** (ancienne **Picardie**).
- **Coordonnées (centre)** : environ **49.4295° N, 2.0808° E**.
- **Population** : ~57 000 habitants.
- **Climat** : **océanique** (doux, humide, ciel souvent gris) → parfait pour une **ambiance
  automnale/pluvieuse** caractéristique.

### Lieux emblématiques à mettre dans le jeu
- ⛪ **Cathédrale Saint-Pierre de Beauvais** — le **chœur gothique le plus haut du monde**,
  monument inratable, jamais totalement achevée : un super repère central.
- ✈️ **Aéroport de Beauvais-Tillé (BVA)** — hub low-cost, potentiel comique.
- 🏛️ Centre-ville, halles, rues piétonnes, l'Église Saint-Étienne, les bords du Thérain.
- *(à compléter avec les lieux liés à la vie du pote)*

> ⚠️ Vérifiez toujours les détails sur la vraie carte (voir sources ci-dessous) plutôt que de
> se fier à la mémoire.

---

## 🧭 D'où viennent les données de la vraie ville

### Source principale : OpenStreetMap (OSM) — gratuit et libre
OSM contient les **contours des bâtiments**, les **rues**, les **points d'intérêt** de Beauvais.

**Manières de récupérer les données :**
1. **overpass-turbo.eu** — un site où on écrit une petite requête et on **exporte en GeoJSON**
   la zone de Beauvais (bâtiments, routes...). Le plus simple pour commencer.
2. **API Overpass** — pour automatiser la récupération depuis le code.
3. **BD TOPO® de l'IGN** (données officielles françaises, gratuites) — plus précis, notamment
   pour la **hauteur des bâtiments**, si on veut aller loin.

**Ambiance / météo réelle :**
- **Open-Meteo** (API gratuite, sans clé) — météo réelle de Beauvais pour caler l'ambiance
  (pluie, ciel gris, saisons).

---

## 🏗️ Du monde réel au jeu 3D (le pipeline)

L'idée générale, étape par étape :

1. **Choisir la zone** (ex : centre-ville de Beauvais autour de la cathédrale) sur overpass-turbo.
2. **Exporter en GeoJSON** les bâtiments (`building`) et les routes (`highway`).
3. **Convertir les coordonnées GPS** (latitude/longitude) en **coordonnées de la scène 3D**
   (x, z), en prenant un point de Beauvais comme "origine" (0,0) — par ex. la cathédrale.
4. **Générer les bâtiments** : chaque contour de bâtiment est un polygone → on l'**extrude**
   en hauteur (hauteur réelle si dispo dans OSM via `height` / `building:levels`, sinon estimée)
   pour créer un volume 3D.
5. **Styliser** en cell-shading (voir [Game Design](03-GAME-DESIGN.md)) : on ne cherche pas le
   réalisme, mais une **version cartoon fidèle** de la ville.
6. **Placer les lieux clés** (cathédrale, etc.) en modèles soignés faits main par-dessus la base.

> On garde ces données dans `src/world/beauvais/` (le GeoJSON + le code qui le transforme).

### Deux stratégies possibles (à choisir ensemble)
- **A — Fidèle & auto** : on génère toute la ville depuis OSM (beaucoup de bâtiments génériques,
  vraie topologie des rues). Rapide à peupler, look "vrai Beauvais".
- **B — Fait main & ciblé** : on ne reconstruit à la main que les quartiers utiles au gameplay,
  en s'inspirant de la vraie carte. Plus de contrôle artistique, plus de boulot.
- 👉 Recommandé : **B pour les lieux importants**, **A pour remplir le décor autour**.

---

## ✅ Prochaines actions concrètes (map)
- [ ] Délimiter la zone jouable de Beauvais (quels quartiers ?).
- [ ] Faire un premier export GeoJSON de test depuis overpass-turbo.
- [ ] Écrire le convertisseur GPS → scène 3D dans `src/world/beauvais/`.
- [ ] Prototype : afficher les bâtiments extrudés d'un quartier.
- [ ] Placer la cathédrale comme repère central.

---

## 🔗 Sources
- OpenStreetMap : https://www.openstreetmap.org
- Overpass Turbo (export GeoJSON) : https://overpass-turbo.eu
- IGN / Géoportail (BD TOPO) : https://geoservices.ign.fr
- Open-Meteo (météo réelle) : https://open-meteo.com

> 📝 Note licence : OSM est libre mais demande d'**attribuer** ("© OpenStreetMap contributors").
> On mettra cette mention dans le jeu (écran crédits).
