import { useState } from 'react'
import { PHONE_CONTACTS } from '../../../data/phoneContacts'
import { PHONE, appScroll, appSectionLabel, card } from '../phoneStyle'

/**
 * 💬 Application Contacts — répertoire + conversations.
 *
 * Le contenu est FIGÉ (`src/data/phoneContacts.ts`) : ces messages ne réagissent
 * à rien pour l'instant. C'est volontaire — il n'y a ni PNJ ni système de
 * dialogues. L'app pose la mise en page ; le jour où les dialogues existeront,
 * seule la source des messages changera.
 */
export default function ContactsApp() {
  const [openedId, setOpenedId] = useState<string | null>(null)
  const opened = PHONE_CONTACTS.find((contact) => contact.id === openedId)

  if (opened) {
    return (
      <div style={appScroll}>
        <button type="button" onClick={() => setOpenedId(null)} style={backStyle}>
          ‹ Tous les contacts
        </button>

        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 22 }}>{opened.avatar}</span>
          <span>
            <strong style={{ display: 'block', font: `800 12px ${PHONE.font}` }}>{opened.name}</strong>
            <span style={{ font: `10px ${PHONE.font}`, color: PHONE.textDim }}>{opened.role}</span>
          </span>
        </div>

        <div style={{ display: 'grid', gap: 7 }}>
          {opened.messages.map((message, index) => (
            <div
              key={index}
              style={{
                justifySelf: message.from === 'me' ? 'end' : 'start',
                maxWidth: '82%',
                padding: '7px 10px',
                borderRadius: 14,
                // Bulles vertes à droite pour Chibrux, grises à gauche pour l'autre :
                // le réflexe de lecture de n'importe quelle messagerie.
                background: message.from === 'me' ? 'rgba(34, 197, 94, 0.28)' : 'rgba(148, 163, 184, 0.16)',
                border: PHONE.cardBorder,
                font: `11px ${PHONE.font}`,
                lineHeight: 1.45,
              }}
            >
              {message.text}
              <span style={{ display: 'block', marginTop: 3, font: `700 9px ${PHONE.mono}`, color: PHONE.muted }}>
                {message.at}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            ...card,
            textAlign: 'center',
            font: `10px ${PHONE.font}`,
            color: PHONE.muted,
            borderStyle: 'dashed',
          }}
        >
          Répondre et appeler : pas encore branché (il faut d’abord des PNJ et des dialogues).
        </div>
      </div>
    )
  }

  return (
    <div style={appScroll}>
      <div style={appSectionLabel}>{PHONE_CONTACTS.length} contacts</div>

      {PHONE_CONTACTS.map((contact) => {
        const last = contact.messages[contact.messages.length - 1]
        return (
          <button
            key={contact.id}
            type="button"
            onClick={() => setOpenedId(contact.id)}
            style={{ ...card, display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
          >
            <span style={{ fontSize: 20 }}>{contact.avatar}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ display: 'block', font: `800 11px ${PHONE.font}` }}>{contact.name}</strong>
              <span style={ellipsisStyle}>
                {last.from === 'me' ? 'Toi : ' : ''}
                {last.text}
              </span>
            </span>
            <span style={{ font: `700 9px ${PHONE.mono}`, color: PHONE.muted }}>{last.at}</span>
          </button>
        )
      })}
    </div>
  )
}

const ellipsisStyle = {
  display: 'block',
  font: `10px ${PHONE.font}`,
  color: PHONE.textDim,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
}

const backStyle = {
  justifySelf: 'start' as const,
  padding: '4px 10px',
  borderRadius: 999,
  border: PHONE.cardBorder,
  background: PHONE.card,
  color: PHONE.text,
  font: `800 10px ${PHONE.font}`,
  cursor: 'pointer',
}
