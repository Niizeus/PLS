import { useEffect } from 'react'
import { KEY } from '../gameplay/input/keyMap'
import { useRadioStore } from './radioStore'

/**
 * 📻 La touche R change de station, quand une radio joue.
 *
 * Ce composant n'affiche rien : il ne fait qu'écouter le clavier. Il est séparé de
 * `RadioAudioSystem` exprès — celui-ci s'occupe déjà du son (chargement, timeline,
 * filtre), et lui mélanger la saisie clavier le rendrait illisible.
 *
 * Le changement de son est automatique : `RadioAudioSystem` réagit tout seul au
 * changement de `currentStationId`. Ici on ne fait que pousser le bouton.
 */
export default function RadioControls() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== KEY.RADIO_NEXT || event.repeat) return
      // Pas de zapping quand on tape dans un champ, ni l'inventaire ouvert.
      if (isTypingTarget(event.target)) return
      if (document.body.dataset.plsInventoryOpen === 'true') return
      useRadioStore.getState().nextStation()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return null
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}
