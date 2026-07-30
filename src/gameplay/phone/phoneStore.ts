import { create } from 'zustand'
import { playPhoneSound } from './phoneSounds'

/**
 * 📱 État du téléphone de Chibrux.
 *
 * Volontairement MINUSCULE : ce store ne connaît que « le téléphone est-il
 * sorti ? », « est-il verrouillé ? » et « quelle application est ouverte ? ». Il
 * ne stocke AUCUNE donnée de jeu (vie, argent, stats...) — c'est la règle de
 * conception du téléphone : il CONSULTE les stores existants, il n'en garde
 * jamais une deuxième copie. Voir `docs/03-GAME-DESIGN.md` § Smartphone.
 *
 * `appId` est une simple `string` (et pas une union d'identifiants) pour que ce
 * fichier n'ait pas à connaître la liste des applications : le catalogue vit
 * dans `src/ui/phone/apps.tsx`, côté interface.
 *
 * Les bruitages sont joués ICI, dans les actions, et pas dans les composants :
 * clic souris et raccourci clavier passent par les mêmes fonctions, donc le son
 * est le même quoi qu'on fasse — impossible d'en oublier un.
 */
interface PhoneState {
  /** Le téléphone est-il sorti de la poche ? */
  isOpen: boolean
  /**
   * Écran de verrouillage affiché ? On le sort TOUJOURS verrouillé : c'est ce
   * qui donne l'heure et les notifications d'un coup d'œil, sans naviguer.
   */
  locked: boolean
  /** Application affichée, ou `null` = écran d'accueil. */
  appId: string | null
  /**
   * Photo utilisée en fond d'écran (`id` dans `photoStore`), ou `null` pour le
   * fond par défaut. En mémoire seulement, comme les photos elles-mêmes.
   */
  wallpaperPhotoId: number | null

  toggle: () => void
  open: () => void
  /** Range le téléphone. Il se reverrouille pour la prochaine fois. */
  close: () => void
  unlock: () => void
  openApp: (appId: string) => void
  goHome: () => void
  setWallpaper: (photoId: number | null) => void
  /**
   * Le geste « retour » (Échap) : on quitte d'abord l'application ouverte,
   * et seulement au deuxième appui on range le téléphone. Comme sur un vrai
   * tel — on ne perd pas sa navigation par erreur.
   */
  back: () => void
}

export const usePhoneStore = create<PhoneState>((set, get) => ({
  isOpen: false,
  locked: true,
  appId: null,
  wallpaperPhotoId: null,

  toggle: () => (get().isOpen ? get().close() : get().open()),

  open: () => {
    playPhoneSound('open')
    set({ isOpen: true })
  },

  close: () => {
    playPhoneSound('close')
    set({ isOpen: false, appId: null, locked: true })
  },

  unlock: () => {
    if (!get().locked) return
    playPhoneSound('unlock')
    set({ locked: false })
  },

  openApp: (appId) => {
    playPhoneSound('tap')
    set({ isOpen: true, locked: false, appId })
  },

  goHome: () => {
    playPhoneSound('back')
    set({ appId: null })
  },

  setWallpaper: (photoId) => set({ wallpaperPhotoId: photoId }),

  back: () => (get().appId ? get().goHome() : get().close()),
}))
