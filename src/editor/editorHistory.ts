import { useCallback, useRef, useState } from 'react'

/**
 * ↩️ Historique annuler / retablir partage par les modules de l'editeur.
 *
 * Principe : on ne stocke pas les actions, on stocke des **photos** de l'etat. Avant chaque
 * modification, l'appelant depose une photo de l'etat d'AVANT avec `push()`. `undo()` rend
 * cette photo, `redo()` rend celle d'apres. C'est simple, et ca ne peut pas desynchroniser
 * l'historique du contenu reel — contrairement a un systeme d'actions inversibles.
 *
 * Le regroupement (`coalesceKey`) evite qu'une frappe au clavier remplisse tout l'historique :
 * deux `push()` de suite avec la meme cle, a moins de `COALESCE_MS` d'intervalle, ne comptent
 * que pour un. Taper "Bar du coin" dans un champ = une seule annulation, pas onze.
 */

const DEFAULT_LIMIT = 80
const COALESCE_MS = 700

export interface EditorHistory<T> {
  /**
   * Depose l'etat d'AVANT modification.
   * @param coalesceKey regroupe les modifications rapprochees d'une meme nature
   *   (ex: 'marker-field' pour la frappe dans l'inspecteur). Omis = point d'annulation net.
   */
  push: (snapshot: T, coalesceKey?: string) => void
  /** Rend l'etat precedent, ou `null` s'il n'y a rien a annuler. `current` part dans la pile redo. */
  undo: (current: T) => T | null
  /** Rend l'etat suivant, ou `null` s'il n'y a rien a retablir. */
  redo: (current: T) => T | null
  /** Vide les deux piles (apres un rechargement de donnees, par exemple). */
  clear: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useEditorHistory<T>(limit = DEFAULT_LIMIT): EditorHistory<T> {
  const undoStack = useRef<T[]>([])
  const redoStack = useRef<T[]>([])
  const lastPush = useRef<{ key: string; at: number } | null>(null)
  // Les piles vivent dans des refs (lisibles depuis les gestionnaires souris du canvas, qui
  // ne sont attaches qu'une fois). Ce compteur sert juste a redemander un rendu pour que les
  // boutons Undo/Redo s'activent et se desactivent au bon moment.
  const [, bumpVersion] = useState(0)

  const push = useCallback(
    (snapshot: T, coalesceKey?: string) => {
      const now = Date.now()
      const recent = lastPush.current
      if (coalesceKey && recent?.key === coalesceKey && now - recent.at < COALESCE_MS) {
        lastPush.current = { key: coalesceKey, at: now }
        return
      }
      lastPush.current = coalesceKey ? { key: coalesceKey, at: now } : null
      undoStack.current = [...undoStack.current, snapshot].slice(-limit)
      redoStack.current = []
      bumpVersion((version) => version + 1)
    },
    [limit],
  )

  const undo = useCallback(
    (current: T) => {
      const previous = undoStack.current.pop()
      if (previous === undefined) return null
      redoStack.current = [...redoStack.current, current].slice(-limit)
      lastPush.current = null
      bumpVersion((version) => version + 1)
      return previous
    },
    [limit],
  )

  const redo = useCallback(
    (current: T) => {
      const next = redoStack.current.pop()
      if (next === undefined) return null
      undoStack.current = [...undoStack.current, current].slice(-limit)
      lastPush.current = null
      bumpVersion((version) => version + 1)
      return next
    },
    [limit],
  )

  const clear = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    lastPush.current = null
    bumpVersion((version) => version + 1)
  }, [])

  return {
    push,
    undo,
    redo,
    clear,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  }
}
