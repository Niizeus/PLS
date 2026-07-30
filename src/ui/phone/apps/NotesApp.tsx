import { PHONE_NOTES, type PhoneNote } from '../../../data/phoneNotes'
import { PHONE, appScroll, appSectionLabel, card } from '../phoneStyle'

/**
 * 📝 Application « Notes » — les pistes de Chibrux pour se casser de Beauvais.
 *
 * Elle ne dépend d'AUCUN système de jeu : c'est volontaire. Elle sert de preuve
 * qu'une application entièrement autonome se branche sur le téléphone avec un
 * fichier de données (`src/data/phoneNotes.ts`) et une entrée dans `apps.tsx`.
 */

const TAG_COLOR: Record<PhoneNote['tag'], string> = {
  Train: '#38bdf8',
  Avion: '#a78bfa',
  Fric: '#fcd34d',
  Chelou: '#4ade80',
  Rumeur: '#fb7185',
}

export default function NotesApp() {
  return (
    <div style={appScroll}>
      <div style={appSectionLabel}>{PHONE_NOTES.length} notes</div>

      {PHONE_NOTES.map((note) => (
        <div key={note.id} style={{ ...card, display: 'grid', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <strong style={{ font: `800 12px ${PHONE.font}` }}>{note.title}</strong>
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 999,
                background: `${TAG_COLOR[note.tag]}22`,
                color: TAG_COLOR[note.tag],
                font: `800 9px ${PHONE.font}`,
                whiteSpace: 'nowrap',
              }}
            >
              {note.tag}
            </span>
          </div>
          <p style={{ font: `11px ${PHONE.font}`, color: PHONE.textDim, lineHeight: 1.5 }}>{note.body}</p>
        </div>
      ))}

      <div style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
        Toutes les notes sont visibles pour l’instant. Quand il y aura des quêtes, seules
        les pistes découvertes apparaîtront ici.
      </div>
    </div>
  )
}
