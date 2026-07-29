import { useEffect } from 'react'
import { usePickupStore } from '../gameplay/inventory/pickupStore'
import { useMapMarkerStore } from '../gameplay/map/mapMarkerStore'

export default function MapMarkerPrompt() {
  const nearbyMarker = useMapMarkerStore((state) => state.nearbyMarker)
  const interactionMessage = useMapMarkerStore((state) => state.interactionMessage)
  const interactionToken = useMapMarkerStore((state) => state.interactionToken)
  const clearInteractionMessage = useMapMarkerStore((state) => state.clearInteractionMessage)
  const nearbyPickup = usePickupStore((state) => state.nearbyPickup)

  useEffect(() => {
    if (!interactionMessage) return
    const timeout = window.setTimeout(clearInteractionMessage, 2400)
    return () => window.clearTimeout(timeout)
  }, [clearInteractionMessage, interactionMessage, interactionToken])

  if (nearbyPickup || (!nearbyMarker && !interactionMessage)) return null

  const marker = nearbyMarker?.marker
  const availability = nearbyMarker?.availability
  const blocked = availability ? !availability.isOpen : false
  const title = marker?.name ?? interactionMessage ?? ''
  const subtitle = interactionMessage || availability?.label || ''

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 102,
        transform: 'translateX(-50%) scale(var(--pls-poi-pulse, 1))',
        minWidth: 260,
        maxWidth: 'min(520px, calc(100vw - 28px))',
        padding: '9px 13px',
        borderRadius: 7,
        background: blocked ? 'rgba(64, 39, 18, 0.92)' : 'rgba(13, 18, 32, 0.88)',
        border: blocked ? '1px solid rgba(251, 191, 36, 0.48)' : '1px solid rgba(148, 163, 184, 0.36)',
        color: '#ecf2ff',
        font: '750 14px system-ui, sans-serif',
        pointerEvents: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {nearbyMarker && (
          <kbd
            style={{
              flex: '0 0 auto',
              padding: '2px 7px',
              borderRadius: 5,
              background: blocked ? '#713f12' : '#2b3550',
              border: blocked ? '1px solid #f59e0b' : '1px solid #45557f',
              font: '800 12px ui-monospace, monospace',
            }}
          >
            E
          </kbd>
        )}
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nearbyMarker ? (blocked ? 'Ferme' : 'Interagir') : 'Info'} - {title}
          </span>
          {subtitle && (
            <span
              style={{
                display: 'block',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: blocked ? '#fde68a' : '#bfdbfe',
                font: '800 12px system-ui, sans-serif',
              }}
            >
              {subtitle}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
