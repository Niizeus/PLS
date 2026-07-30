import { create } from 'zustand'

/**
 * 📱 État du téléphone de Chibrux.
 *
 * Volontairement MINUSCULE : ce store ne connaît que « le téléphone est-il
 * sorti ? » et « quelle application est ouverte ? ». Il ne stocke AUCUNE donnée
 * de jeu (vie, argent, stats...) — c'est la règle de conception du téléphone :
 * il CONSULTE les stores existants, il n'en garde jamais une deuxième copie.
 * Voir `docs/03-GAME-DESIGN.md` § Smartphone.
 *
 * `appId` est une simple `string` (et pas une union d'identifiants) pour que ce
 * fichier n'ait pas à connaître la liste des applications : le catalogue vit
 * dans `src/ui/phone/apps.tsx`, côté interface.
 */
interface PhoneState {
  /** Le téléphone est-il sorti de la poche ? */
  isOpen: boolean
  /** Application affichée, ou `null` = écran d'accueil. */
  appId: string | null

  toggle: () => void
  open: () => void
  /** Range le téléphone (et revient à l'accueil pour la prochaine ouverture). */
  close: () => void
  openApp: (appId: string) => void
  goHome: () => void
  /**
   * Le geste « retour » (Échap) : on quitte d'abord l'application ouverte,
   * et seulement au deuxième appui on range le téléphone. Comme sur un vrai
   * tel — on ne perd pas sa navigation par erreur.
   */
  back: () => void
}

export const usePhoneStore = create<PhoneState>((set, get) => ({
  isOpen: false,
  appId: null,

  toggle: () => (get().isOpen ? get().close() : get().open()),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, appId: null }),
  openApp: (appId) => set({ isOpen: true, appId }),
  goHome: () => set({ appId: null }),
  back: () => (get().appId ? get().goHome() : get().close()),
}))
