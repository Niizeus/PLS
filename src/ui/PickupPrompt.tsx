import { useInventoryStore } from '../gameplay/inventory/inventoryStore'
import { getAddItemFailureReason, getPickupHint } from '../gameplay/inventory/inventoryRules'
import { usePickupStore } from '../gameplay/inventory/pickupStore'

export default function PickupPrompt() {
  const nearbyPickup = usePickupStore((s) => s.nearbyPickup)
  const items = useInventoryStore((s) => s.items)

  if (!nearbyPickup) return null

  const failureReason = getAddItemFailureReason(items, nearbyPickup.itemId, nearbyPickup.quantity)
  const hint = getPickupHint(items, nearbyPickup.itemId, nearbyPickup.quantity)
  const blocked = Boolean(failureReason)

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 102,
        transform: 'translateX(-50%) scale(var(--pls-pickup-pulse, 1))',
        padding: '9px 13px',
        borderRadius: 7,
        background: blocked ? 'rgba(58, 19, 29, 0.9)' : 'rgba(13, 18, 32, 0.86)',
        border: blocked ? '1px solid rgba(248, 113, 113, 0.52)' : '1px solid rgba(148, 163, 184, 0.36)',
        color: '#ecf2ff',
        font: '750 14px system-ui, sans-serif',
        pointerEvents: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <kbd
          style={{
            padding: '2px 7px',
            borderRadius: 5,
            background: blocked ? '#7f1d1d' : '#2b3550',
            border: blocked ? '1px solid #ef4444' : '1px solid #45557f',
            font: '800 12px ui-monospace, monospace',
          }}
        >
          E
        </kbd>
        <span>
          {blocked ? 'Impossible' : 'Ramasser'} {nearbyPickup.itemName}
          {nearbyPickup.quantity > 1 ? ` x${nearbyPickup.quantity}` : ''}
        </span>
        <span style={{ color: blocked ? '#fecaca' : '#bfdbfe', font: '800 12px system-ui, sans-serif' }}>
          {hint}
        </span>
      </div>
    </div>
  )
}
