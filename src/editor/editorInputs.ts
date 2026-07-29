/**
 * Petits utilitaires de saisie partages par les modules de l'editeur.
 *
 * 🐛 Contexte : deux pieges de React reviennent sans arret dans les inspecteurs.
 *
 * 1. `Number('')` vaut **0**, pas NaN. Un champ `<input type="number">` qu'on efface pour
 *    retaper renvoyait donc 0, et l'element sautait a l'origine de la carte.
 *    → `readNumberInput` renvoie NaN dans ce cas, a l'appelant d'ignorer la saisie.
 *
 * 2. `event.currentTarget` est remis a `null` par React des que le handler `onChange`
 *    rend la main. Le lire plus tard (par exemple dans le callback passe a `setState`,
 *    que React n'execute qu'au rendu suivant) leve un TypeError EN PLEIN RENDU, ce qui
 *    demonte tout l'arbre React : page blanche. Il faut toujours lire la valeur tout de
 *    suite, dans le corps du handler.
 */

/**
 * Lit la valeur d'un `<input type="number">`.
 * Renvoie NaN si le champ est vide ou en cours de frappe ("-", "1e"...), pour que
 * l'appelant puisse ignorer la saisie plutot que d'appliquer un 0 involontaire.
 */
export function readNumberInput(raw: string) {
  return raw.trim() === '' ? NaN : Number(raw)
}
