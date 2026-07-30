/**
 * 💬 Répertoire et conversations du téléphone.
 *
 * ⚠️ C'est du **contenu figé** : ces messages sont écrits d'avance et ne
 * réagissent à rien. Les vrais échanges (missions, embrouilles, réponses du
 * joueur) arriveront avec les PNJ et le système de dialogues — c'est à ce
 * moment-là que ce fichier deviendra une simple liste de contacts, alimentée
 * par le système de quêtes.
 *
 * Les appels, eux, ne sont pas branchés du tout : pas d'audio, pas de dialogue.
 */

export interface PhoneMessage {
  /** `them` = le contact, `me` = Chibrux. */
  from: 'them' | 'me'
  text: string
  /** Heure affichée à côté du message (décorative). */
  at: string
}

export interface PhoneContact {
  id: string
  name: string
  /** Emoji d'avatar, en attendant de vraies têtes de PNJ. */
  avatar: string
  /** Qui c'est, en trois mots. */
  role: string
  messages: PhoneMessage[]
}

export const PHONE_CONTACTS: PhoneContact[] = [
  {
    id: 'mario',
    name: 'Mario du kebab',
    avatar: '🥙',
    role: 'Restaurateur, philosophe',
    messages: [
      { from: 'them', text: 'Chibrux. Ton ardoise commence à ressembler à un roman.', at: '11:02' },
      { from: 'me', text: 'Je passe ce soir je te jure', at: '11:04' },
      { from: 'them', text: 'Tu as dit ça mardi. Et le mardi d’avant.', at: '11:04' },
    ],
  },
  {
    id: 'kevin',
    name: 'Kevin',
    avatar: '🛴',
    role: 'Voisin du dessus',
    messages: [
      { from: 'them', text: 'Tu sais que la gare c’est direct Paris ? Faut juste le billet.', at: '09:41' },
      { from: 'me', text: 'Et le billet il vient d’où ?', at: '09:47' },
      { from: 'them', text: 'Ah. Ouais. Bon courage.', at: '09:48' },
    ],
  },
  {
    id: 'travaux',
    name: 'Mairie de Beauvais',
    avatar: '🚧',
    role: 'Ne répond jamais',
    messages: [
      {
        from: 'them',
        text: 'Info travaux : la sortie sud est fermée jusqu’à nouvel ordre. Merci de votre compréhension.',
        at: '07:00',
      },
      { from: 'me', text: 'Et la sortie nord ?', at: '07:31' },
      { from: 'them', text: 'Info travaux : la sortie nord est fermée jusqu’à nouvel ordre.', at: '07:32' },
    ],
  },
  {
    id: 'mamie',
    name: 'Mamie',
    avatar: '👵',
    role: 'Toujours de bon conseil',
    messages: [
      { from: 'them', text: 'Tu manges correctement au moins ?', at: '18:12' },
      { from: 'me', text: 'Oui oui', at: '18:40' },
      { from: 'them', text: 'Le kebab ce n’est pas un légume mon grand.', at: '18:41' },
    ],
  },
]
