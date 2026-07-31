import { useInventoryStore } from '../gameplay/inventory/inventoryStore'
import { getAddItemFailureReason, getPickupHint } from '../gameplay/inventory/inventoryRules'
import { usePickupStore } from '../gameplay/inventory/pickupStore'
import { HUD, hardShadow, kbd, outline } from './hudStyle'

export default function PickupPrompt() {
  const nearbyPickup = usePickupStore((s) => s.nearbyPickup)
  const stacks = useInventoryStore((s) => s.stacks)

  if (!nearbyPickup) return null

  const failureReason = getAddItemFailureReason(stacks, nearbyPickup.itemId, nearbyPickup.quantity)
  const hint = getPickupHint(stacks, nearbyPickup.itemId, nearbyPickup.quantity)
  const blocked = Boolean(failureReason)

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 102,
        transform: 'translateX(-50%) scale(var(--pls-pickup-pulse, 1))',
        padding: '8px 14px',
        borderRadius: 12,
        // Bloqué = fond rouge franc, pas juste une bordure rougeâtre : ça se voit
        // du coin de l'œil, sans avoir à lire.
        background: blocked ? '#e63946' : HUD.paper,
        border: outline,
        color: blocked ? HUD.paper : HUD.ink,
        font: `800 14px ${HUD.font}`,
        pointerEvents: 'none',
        boxShadow: hardShadow,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <kbd style={{ ...kbd, background: blocked ? '#7f1d1d' : HUD.ink }}>E</kbd>
        <span>
          {blocked ? 'Impossible' : 'Ramasser'} {nearbyPickup.itemName}
          {nearbyPickup.quantity > 1 ? ` x${nearbyPickup.quantity}` : ''}
        </span>
        <span style={{ color: blocked ? '#fee2e2' : HUD.textDim, font: `800 12px ${HUD.font}` }}>{hint}</span>
      </div>
    </div>
  )
}
