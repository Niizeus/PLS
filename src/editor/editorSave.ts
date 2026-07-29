/**
 * 💾 Envoi des donnees de l'editeur vers le serveur de dev (plugins Vite de `vite/`).
 *
 * Le serveur refuse (statut 409) une sauvegarde qui viderait un fichier contenant encore
 * des donnees — c'est le garde-fou qui manquait quand `mapMarkers.json` est reparti a `[]`.
 * Ici on transforme ce refus en question claire posee a l'humain, et on rejoue la requete
 * avec l'en-tete `x-pls-force` seulement s'il confirme.
 *
 * Voir `vite/plsDataFile.ts` pour le detail cote serveur (copies de secours comprises).
 */

export type SaveOutcome =
  | { status: 'ok'; message: string }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string }

interface SaveDataOptions<T> {
  /** Endpoint du plugin Vite, ex: '/__pls/map-markers'. */
  endpoint: string
  /** Donnees a ecrire, deja normalisees. */
  payload: T
  /** Message a afficher quand tout s'est bien passe. */
  successMessage: string
  /**
   * Question posee avant un ecrasement destructeur. Recoit l'explication du serveur.
   * Si elle renvoie `false`, rien n'est ecrit.
   */
  confirmDestructive?: (serverMessage: string) => boolean
}

async function post(endpoint: string, payload: unknown, force: boolean) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (force) headers['x-pls-force'] = '1'
  return fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) })
}

export async function saveData<T>({
  endpoint,
  payload,
  successMessage,
  confirmDestructive = (message) =>
    window.confirm(`${message}\n\nEcrire quand meme ? Une copie de secours de l'ancien fichier sera gardee.`),
}: SaveDataOptions<T>): Promise<SaveOutcome> {
  try {
    let response = await post(endpoint, payload, false)

    if (response.status === 409) {
      const serverMessage = await response.text()
      if (!confirmDestructive(serverMessage)) {
        return { status: 'cancelled', message: 'Sauvegarde annulee, le fichier est intact' }
      }
      response = await post(endpoint, payload, true)
    }

    if (!response.ok) return { status: 'error', message: `Sauvegarde impossible : ${await response.text()}` }
    return { status: 'ok', message: successMessage }
  } catch (error) {
    return { status: 'error', message: `Sauvegarde impossible : ${(error as Error).message}` }
  }
}
