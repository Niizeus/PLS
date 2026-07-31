import { useEffect } from 'react'
import { usePickupStore } from '../gameplay/inventory/pickupStore'
import { useMapMarkerStore } from '../gameplay/map/mapMarkerStore'
import { HUD, hardShadow, kbd, outline } from './hudStyle'

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
        padding: '8px 14px',
        borderRadius: 12,
        // Fermé = jaune franc (« attention »), ouvert = papier.
        background: blocked ? '#ffd83d' : HUD.paper,
        border: outline,
        color: HUD.ink,
        font: `800 14px ${HUD.font}`,
        pointerEvents: 'none',
        boxShadow: hardShadow,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {nearbyMarker && (
          <kbd style={{ ...kbd, flex: '0 0 auto' }}>E</kbd>
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
                color: blocked ? '#7a4a06' : HUD.textDim,
                font: `800 12px ${HUD.font}`,
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
