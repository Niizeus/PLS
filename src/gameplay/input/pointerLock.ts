/**
 * 🖱️ Rendre le curseur au joueur quand une interface cliquable est ouverte.
 *
 * Pendant le jeu, la souris est « capturée » par le canvas (pointer lock) : le
 * curseur disparaît et les mouvements font tourner la caméra (voir `useMouse.ts`).
 * Dès qu'on ouvre une interface CLIQUABLE — téléphone, panneau dev `F2` — il faut
 * rendre le curseur, sinon on voit des boutons sans pouvoir les viser.
 *
 * Deux choses à faire, et pas une seule :
 *  1. **libérer** le curseur à l'ouverture (`releaseCursor`) ;
 *  2. **empêcher de le recapturer** tant que l'interface est ouverte, sinon le
 *     premier clic un peu à côté le ferait disparaître à nouveau, téléphone
 *     toujours ouvert. C'est le rôle du registre ci-dessous, que `useMouse.ts`
 *     consulte avant de redemander la capture.
 *
 * ⚠️ On ne recapture PAS automatiquement à la fermeture : le navigateur limite
 * les demandes rapprochées et n'autorise en pratique que celles qui suivent un
 * clic. Le joueur reprend la main en cliquant sur le décor — ce premier clic ne
 * déclenche aucune attaque (`useMouse.ts` s'en assure).
 */

/**
 * Les interfaces cliquables ouvertes en ce moment (par identifiant : `phone`,
 * `devtools`...). Un simple booléen ne suffirait pas : si le téléphone ET le
 * panneau dev sont ouverts, fermer l'un ne doit pas rendre la capture à l'autre.
 */
const openCursorUis = new Set<string>()

/** Libère le curseur (sortie du pointer lock). */
export function releaseCursor(): void {
  document.exitPointerLock?.()
}

/**
 * Déclare qu'une interface cliquable vient de s'ouvrir ou de se fermer.
 * À appeler dans un `useEffect` piloté par l'état d'ouverture de l'interface.
 */
export function setCursorUiOpen(id: string, open: boolean): void {
  const wasOpen = openCursorUis.has(id)
  if (open === wasOpen) return

  if (open) {
    openCursorUis.add(id)
    releaseCursor()
  } else {
    openCursorUis.delete(id)
  }
}

/** Vrai si au moins une interface cliquable est ouverte. */
export function isCursorUiOpen(): boolean {
  return openCursorUis.size > 0
}
