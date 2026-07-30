import type { ReactNode } from 'react'
import NotesApp from './apps/NotesApp'
import StatsApp from './apps/StatsApp'

/**
 * 📇 Le CATALOGUE des applications du téléphone.
 *
 * C'est le cœur du prototype : ajouter une application = créer un fichier dans
 * `apps/` et ajouter UNE entrée ici. Rien d'autre à toucher — ni l'accueil, ni la
 * navigation clavier, ni la coque. C'est exactement ce que le backlog demandait
 * de valider (`docs/07-BACKLOG-IDEES.md` § 2.3).
 *
 * Les applications sans `Screen` sont affichées grisées sur l'accueil et
 * ouvrent un écran « pas encore branché » (voir `ComingSoonApp.tsx`). On les
 * laisse VISIBLES exprès : elles montrent où va le téléphone, sans faire croire
 * que ça marche déjà.
 */
export interface PhoneApp {
  id: string
  /** Nom affiché sous l'icône. Court, sinon ça déborde de la tuile. */
  label: string
  /** Icône : un emoji suffit pour le prototype (pas d'asset à charger). */
  icon: string
  /** Couleur de la pastille de l'icône. */
  color: string
  /**
   * Le contenu de l'application. Absent = application prévue mais pas encore
   * développée → écran « pas encore branché ».
   */
  Screen?: () => ReactNode
  /** Ce que l'app fera un jour. Affiché sur l'écran « pas encore branché ». */
  soon?: string
}

export const PHONE_APPS: PhoneApp[] = [
  {
    id: 'stats',
    label: 'Santé',
    icon: '❤️',
    color: 'linear-gradient(150deg, #fb7185, #be123c)',
    Screen: StatsApp,
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: '📝',
    color: 'linear-gradient(150deg, #fcd34d, #d97706)',
    Screen: NotesApp,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: '💬',
    color: 'linear-gradient(150deg, #4ade80, #15803d)',
    soon: "Appels, messages, embrouilles et plans foireux. Il faudra d'abord des PNJ et des dialogues.",
  },
  {
    id: 'camera',
    label: 'Photo',
    icon: '📷',
    color: 'linear-gradient(150deg, #a78bfa, #6d28d9)',
    soon: 'Photos de preuves, d’indices et de conneries. Demande une capture de la vue 3D.',
  },
  {
    id: 'bank',
    label: 'Banque',
    icon: '💳',
    color: 'linear-gradient(150deg, #38bdf8, #0369a1)',
    soon: "Argent, salaire, amendes, dettes. Il n'existe encore aucun système d'argent dans le jeu.",
  },
  {
    id: 'map',
    label: 'GPS',
    icon: '🗺️',
    color: 'linear-gradient(150deg, #34d399, #047857)',
    soon: 'Lieux connus et points d’intérêt. La carte du jeu (touche M) existe déjà : elle sera branchée ici.',
  },
  {
    id: 'shop',
    label: 'Boutiques',
    icon: '🛒',
    color: 'linear-gradient(150deg, #fb923c, #c2410c)',
    soon: 'Achats en ligne, livraisons et arnaques. Dépend de l’argent et des livraisons.',
  },
  {
    id: 'social',
    label: 'Réseaux',
    icon: '📡',
    color: 'linear-gradient(150deg, #f472b6, #a21caf)',
    soon: 'Rumeurs et conséquences de tes actes. Dépend de la réputation, qui n’existe pas encore.',
  },
  {
    id: 'settings',
    label: 'Réglages',
    icon: '⚙️',
    color: 'linear-gradient(150deg, #94a3b8, #475569)',
    soon:
      "Volumes, luminosité, touches. Le jeu n'a PAS encore de système de paramètres joueur " +
      '(le panneau F2 est un outil de dev, pas un menu options) : c’est un chantier à part.',
  },
]

export const findPhoneApp = (id: string | null): PhoneApp | undefined =>
  PHONE_APPS.find((app) => app.id === id)
