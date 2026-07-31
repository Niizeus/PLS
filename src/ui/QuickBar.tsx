import { useEffect, type CSSProperties } from 'react'
import { ITEMS_BY_ID } from '../data/items'
import { KEY } from '../gameplay/input/keyMap'
import { QUICK_SLOT_IDS, type QuickSlotId, useInventoryStore } from '../gameplay/inventory/inventoryStore'
import { HUD, hardShadow, outline, outlineThin } from './hudStyle'

const KEY_TO_SLOT: Record<string, QuickSlotId> = {
  [KEY.QUICK_1]: 'slot1',
  [KEY.QUICK_2]: 'slot2',
  [KEY.QUICK_3]: 'slot3',
  [KEY.QUICK_4]: 'slot4',
}

export default function QuickBar() {
  const stacks = useInventoryStore((s) => s.stacks)
  const equipped = useInventoryStore((s) => s.equipped)
  const quickSlots = useInventoryStore((s) => s.quickSlots)
  const activateQuickSlot = useInventoryStore((s) => s.activateQuickSlot)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const slot = KEY_TO_SLOT[event.code]
      if (!slot || event.repeat || isTypingTarget(event.target) || document.body.dataset.plsInventoryOpen === 'true') return
      activateQuickSlot(slot)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activateQuickSlot])

  return (
    <div style={barStyle}>
      {QUICK_SLOT_IDS.map((slot, index) => {
        const itemId = quickSlots[slot]
        const item = itemId ? ITEMS_BY_ID[itemId] : null
        // Quantité totale de cet objet dans le sac, toutes piles confondues.
        const quantity = itemId
          ? stacks.reduce((total, stack) => (stack.itemId === itemId ? total + stack.quantity : total), 0)
          : 0
        const isEquipped = itemId ? Object.values(equipped).includes(itemId) : false
        const stackText = item && quantity > 0 ? `${quantity}` : ''

        return (
          <button key={slot} onClick={() => activateQuickSlot(slot)} style={isEquipped ? equippedSlotStyle : slotStyle}>
            <span style={numberStyle}>{index + 1}</span>
            <span style={nameStyle}>{item?.name ?? 'Vide'}</span>
            <span style={qtyStyle}>{stackText ? `x${stackText}` : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

const barStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 14,
  transform: 'translateX(-50%)',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(92px, 1fr))',
  gap: 8,
  width: 'min(456px, calc(100vw - 24px))',
  pointerEvents: 'auto',
}

const slotStyle: CSSProperties = {
  minWidth: 0,
  height: 52,
  padding: '6px 8px',
  display: 'grid',
  gridTemplateColumns: '22px 1fr',
  gridTemplateRows: '1fr auto',
  alignItems: 'center',
  gap: '1px 7px',
  borderRadius: 12,
  border: outline,
  background: HUD.paper,
  color: HUD.ink,
  cursor: 'pointer',
  boxShadow: hardShadow,
}

/**
 * L'objet équipé n'est pas signalé par une bordure d'une autre couleur (trop
 * discret quand tous les contours sont déjà noirs) mais par un fond JAUNE et un
 * décalage vers le haut : il sort littéralement de la rangée.
 */
const equippedSlotStyle: CSSProperties = {
  ...slotStyle,
  background: '#ffd83d',
  transform: 'translateY(-4px)',
  boxShadow: `4px 8px 0 ${HUD.ink}`,
}

const numberStyle: CSSProperties = {
  gridRow: '1 / span 2',
  width: 22,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 7,
  background: HUD.ink,
  border: outlineThin,
  color: HUD.paper,
  font: `800 12px ${HUD.mono}`,
}

const nameStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  font: `800 12px ${HUD.font}`,
}

const qtyStyle: CSSProperties = {
  minHeight: 14,
  color: HUD.textDim,
  textAlign: 'left',
  font: `800 11px ${HUD.font}`,
}
