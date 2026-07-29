import EditorApp from './EditorApp'
import InteriorEditor from './InteriorEditor'
import { useEditorWorkspace } from './editorWorkspace'
import { useEditorPanels } from './EditorPanels'

/**
 * Hub de l'editeur : choisit le module affiche.
 *
 * Le module actif vit dans l'atelier partage (`editorWorkspace`) et pas en etat local, parce
 * que le module Carte doit pouvoir basculer ici tout seul quand on clique "Creer l'interieur"
 * sur un point d'interet.
 *
 * ⚠️ Les deux modules sont montes EN PERMANENCE, celui du fond etant simplement masque en CSS.
 * Avant, changer d'onglet demontait le module quitte : tout son travail non sauvegarde (points
 * deplaces, quartiers redessines, historique d'annulation) partait a la poubelle en silence.
 * C'est d'autant plus genant que "Creer l'interieur" change d'onglet tout seul. Chaque module
 * recoit donc `active` pour mettre en pause ce qui n'a pas de sens hors ecran (boucles de
 * dessin, scene 3D).
 *
 * Les volets lateraux sont geres ici, une seule fois, pour que leur largeur soit la meme d'un
 * module a l'autre.
 */
export default function EditorHub() {
  const module = useEditorWorkspace((state) => state.module)
  const setModule = useEditorWorkspace((state) => state.setModule)
  const panels = useEditorPanels()

  const tabs = (
    <div className="editor-module-tabs" aria-label="Module editeur">
      <button type="button" className={module === 'map' ? 'active' : ''} onClick={() => setModule('map')}>
        Carte
      </button>
      <button
        type="button"
        className={module === 'interiors' ? 'active' : ''}
        onClick={() => setModule('interiors')}
      >
        Interieurs
      </button>
    </div>
  )

  return (
    <>
      <EditorApp moduleTabs={tabs} panels={panels} active={module === 'map'} />
      <InteriorEditor moduleTabs={tabs} panels={panels} active={module === 'interiors'} />
    </>
  )
}
