import { create } from 'zustand'
import { PHONE_CONTACTS } from '../../data/phoneContacts'

/**
 * 🔔 Les notifications du téléphone.
 *
 * Elles servent à trois endroits : la **pastille** sur l'icône d'une app, la
 * **bannière** qui glisse en haut de l'écran quand il en arrive une, et l'**écran
 * de verrouillage** qui les liste.
 *
 * Une notification appartient à une application (`appId`, le même identifiant que
 * dans `ui/phone/apps.tsx`) : ouvrir l'app marque les siennes comme lues. C'est
 * la règle la plus simple à comprendre, et elle évite d'avoir à gérer un état de
 * lecture par élément.
 */

export interface PhoneNotification {
  id: string
  /** Application concernée (`contacts`, `camera`...). */
  appId: string
  title: string
  body: string
  /** Heure affichée, en texte (souvent l'heure du jeu). */
  at: string
  read: boolean
}

interface NotificationState {
  notifications: PhoneNotification[]
  /** Empile une notification (la plus récente en premier). */
  notify: (notification: Omit<PhoneNotification, 'id' | 'read'>) => void
  /** Marque comme lues toutes les notifications d'une application. */
  markAppRead: (appId: string) => void
  markAllRead: () => void
}

/**
 * Au démarrage, les conversations existantes sont NON LUES : c'est le seul état
 * initial honnête (Chibrux a des messages en attente, ils sont écrits dans
 * `src/data/phoneContacts.ts`). Le jour où les dialogues existeront, ces
 * notifications viendront du système de messages au lieu d'être dérivées ici.
 */
const seedNotifications = (): PhoneNotification[] =>
  PHONE_CONTACTS.filter((contact) => contact.messages[contact.messages.length - 1]?.from === 'them').map(
    (contact) => {
      const last = contact.messages[contact.messages.length - 1]
      return {
        id: `contact-${contact.id}`,
        appId: 'contacts',
        title: contact.name,
        body: last.text,
        at: last.at,
        read: false,
      }
    },
  )

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: seedNotifications(),

  notify: (notification) =>
    set((state) => ({
      notifications: [
        { ...notification, id: `${notification.appId}-${Date.now()}`, read: false },
        ...state.notifications,
      ].slice(0, 20),
    })),

  markAppRead: (appId) =>
    set((state) => {
      // On ne recrée le tableau que s'il y a vraiment quelque chose à marquer,
      // sinon chaque ouverture d'app déclencherait un rendu pour rien.
      if (!state.notifications.some((item) => item.appId === appId && !item.read)) return state
      return {
        notifications: state.notifications.map((item) =>
          item.appId === appId ? { ...item, read: true } : item,
        ),
      }
    }),

  markAllRead: () =>
    set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, read: true })) })),
}))

/** Nombre de non-lues, toutes apps confondues ou pour une app précise. */
export function countUnread(notifications: PhoneNotification[], appId?: string): number {
  return notifications.filter((item) => !item.read && (!appId || item.appId === appId)).length
}
