import { countUnread, useNotificationStore } from '../../gameplay/phone/notificationStore'
import { usePhoneStore } from '../../gameplay/phone/phoneStore'
import {
  formatGameTime,
  getDayName,
  getDayNumber,
  useGameTimeStore,
} from '../../gameplay/time/gameTimeStore'
import { PHONE, card } from './phoneStyle'

/**
 * 🔒 Écran de verrouillage : ce qu'on voit en sortant le téléphone.
 *
 * Il existe pour une raison de confort, pas pour faire joli : la plupart du
 * temps on sort son tel pour savoir **quelle heure il est** et **si on a raté
 * quelque chose**. Les avoir sans naviguer, c'est un geste en moins à chaque
 * fois. Un clic (ou Entrée) déverrouille et amène à l'accueil.
 */
export default function PhoneLockScreen() {
  const unlock = usePhoneStore((s) => s.unlock)
  const notifications = useNotificationStore((s) => s.notifications)
  const minute = useGameTimeStore((s) => Math.floor(s.totalMinutes))

  const unread = notifications.filter((item) => !item.read).slice(0, 4)
  const unreadCount = countUnread(notifications)

  return (
    <button
      type="button"
      onClick={unlock}
      style={{
        display: 'grid',
        alignContent: 'start',
        gap: 12,
        padding: '26px 14px 14px',
        border: 'none',
        background: 'none',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        minHeight: 0,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ font: `200 52px ${PHONE.font}`, lineHeight: 1, letterSpacing: -1, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
          {formatGameTime(minute)}
        </div>
        <div style={{ marginTop: 5, font: `700 12px ${PHONE.font}`, color: PHONE.textDim }}>
          {getDayName(minute)} — Jour {getDayNumber(minute)}
        </div>
      </div>

      {unread.length > 0 ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {unread.map((item) => (
            <div key={item.id} style={{ ...card, display: 'grid', gap: 2, background: 'rgba(15, 23, 42, 0.55)' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ font: `800 11px ${PHONE.font}` }}>{item.title}</strong>
                <span style={{ font: `700 9px ${PHONE.mono}`, color: PHONE.muted }}>{item.at}</span>
              </span>
              <span style={{ font: `10px ${PHONE.font}`, color: PHONE.textDim, lineHeight: 1.4 }}>{item.body}</span>
            </div>
          ))}
          {unreadCount > unread.length && (
            <span style={{ font: `700 10px ${PHONE.font}`, color: PHONE.muted, textAlign: 'center' }}>
              + {unreadCount - unread.length} autre{unreadCount - unread.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', font: `10px ${PHONE.font}`, color: PHONE.muted }}>
          Aucune notification.
        </div>
      )}
    </button>
  )
}
