import { create } from 'zustand'
import { INTERIORS, serializeInterior, type InteriorDefinition } from '../data/interiors'
import { MAP_MARKERS, type MapMarker } from '../data/mapMarkers'

/**
 * 🧰 L'atelier : l'etat que les modules de l'editeur se partagent.
 *
 * Pourquoi un store plutot que de l'etat local ? Parce que creer un interieur commence dans
 * le module **Carte** (on selectionne un point d'interet, on clique "Creer l'interieur") et
 * se termine dans le module **Interieurs**. Les deux ont besoin de voir la meme liste, et le
 * nouvel interieur doit exister AVANT d'etre sauvegarde sur le disque — sinon il faudrait
 * sauvegarder pour pouvoir editer, ce qui est le mauvais sens.
 *
 * On reste sur Zustand, le choix d'etat du projet (voir AGENTS.md).
 */

export type EditorModule = 'map' | 'interiors'

interface EditorWorkspaceState {
  /** Tous les interieurs connus : ceux du disque au demarrage, plus ceux crees dans la session. */
  interiors: InteriorDefinition[]
  /** Interieur ouvert dans le module Interieurs. */
  activeInteriorId: string | null
  /** Module affiche par le hub. */
  module: EditorModule
  /**
   * Copie en lecture des points d'interet du module Carte, tenue a jour par EditorApp.
   * Sert au module Interieurs a afficher de quel point vient l'interieur ouvert.
   * ⚠️ La source de verite reste l'etat de EditorApp : ne pas editer les POI depuis ici.
   */
  markers: MapMarker[]

  setMarkers: (markers: MapMarker[]) => void
  setInteriors: (interiors: InteriorDefinition[]) => void
  setActiveInteriorId: (id: string | null) => void
  setModule: (module: EditorModule) => void
  /** Ajoute un interieur et l'ouvre immediatement dans le module Interieurs. */
  addInterior: (interior: InteriorDefinition) => void
  /** Ouvre un interieur existant : bascule sur le module Interieurs et le selectionne. */
  openInterior: (id: string) => void
}

export const useEditorWorkspace = create<EditorWorkspaceState>((set) => ({
  interiors: INTERIORS.map((interior) => serializeInterior(interior)),
  activeInteriorId: INTERIORS[0]?.id ?? null,
  module: 'map',
  markers: MAP_MARKERS,

  setMarkers: (markers) => set({ markers }),
  setInteriors: (interiors) => set({ interiors }),
  setActiveInteriorId: (activeInteriorId) => set({ activeInteriorId }),
  setModule: (module) => set({ module }),

  addInterior: (interior) =>
    set((state) => ({
      interiors: [...state.interiors, serializeInterior(interior)],
      activeInteriorId: interior.id,
      module: 'interiors',
    })),

  openInterior: (id) => set({ activeInteriorId: id, module: 'interiors' }),
}))
