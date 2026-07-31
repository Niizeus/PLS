# Polices du jeu

## `pls-comic.woff2` — la police du HUD

Le HUD (`src/ui/hudStyle.ts`) demande une police nommée **`PLS Comic`**, déclarée dans
`src/index.css` et chargée depuis ce dossier : `public/fonts/pls-comic.woff2`.

**Tant que le fichier n'est pas là, rien ne casse** : le jeu retombe sur `Trebuchet MS`
puis sur la police système. Le HUD reste lisible et bien mis en page, il perd juste son
grain « bande dessinée ».

### Pour l'installer

1. Récupérer une police BD **libre de droits** (licence SIL Open Font License), par
   exemple *Bangers*, *Luckiest Guy* ou *Titan One*.
2. La convertir en `.woff2` si besoin (c'est le format le plus léger, ~20 à 40 ko).
3. La déposer ici sous le nom exact **`pls-comic.woff2`**.

Rien d'autre à modifier : le nom du fichier et le nom de la police sont écrits à un seul
endroit chacun (`src/index.css` pour le chargement, `src/ui/hudStyle.ts` pour l'usage).

### Pourquoi en local et pas depuis Google Fonts

Le jeu doit tourner **hors ligne**, et il sera empaqueté en `.exe` avec Tauri : une police
appelée sur Internet ne s'afficherait pas chez le joueur.

⚠️ Ne déposer ici que des polices dont la licence autorise la redistribution — le fichier
part dans le dépôt Git et, plus tard, dans l'exécutable du jeu.
