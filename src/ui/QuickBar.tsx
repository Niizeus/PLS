import { useEffect, type CSSProperties } from 'react'
import { ITEMS_BY_ID } from '../data/items'
import { KEY } from '../gameplay/input/keyMap'
import { QUICK_SLOT_IDS, type QuickSlotId, useInventoryStore } from '../gameplay/inventory/inventoryStore'

const KEY_TO_SLOT: Record<string, QuickSlotId> = {
  [KEY.QUICK_1]: 'slot1',
  [KEY.QUICK_2]: 'slot2',
  [KEY.QUICK_3]: 'slot3',
  [KEY.QUICK_4]: 'slot4',
}

export default function QuickBar() {
  const items = useInventoryStore((s) => s.items)
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
        const entry = itemId ? items.find((candidate) => candidate.itemId === itemId) : null
        const isEquipped = itemId ? Object.values(equipped).includes(itemId) : false
        const stackText = item && entry ? `${entry.quantity}/${item.stackable ? item.maxStack ?? 99 : 1}` : ''

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
  gridTemplateColumns: '20px 1fr',
  gridTemplateRows: '1fr auto',
  alignItems: 'center',
  gap: '1px 6px',
  borderRadius: 7,
  border: '1px solid rgba(148, 163, 184, 0.34)',
  background: 'rgba(13, 18, 32, 0.84)',
  color: '#ecf2ff',
  cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(0,0,0,0.26)',
}

const equippedSlotStyle: CSSProperties = {
  ...slotStyle,
  border: '1px solid rgba(56, 189, 248, 0.7)',
  background: 'rgba(21, 45, 69, 0.9)',
}

const numberStyle: CSSProperties = {
  gridRow: '1 / span 2',
  width: 20,
  height: 28,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 5,
  background: '#2b3550',
  border: '1px solid #45557f',
  color: '#dbeafe',
  font: '800 12px ui-monospace, monospace',
}

const nameStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  font: '800 12px system-ui',
}

const qtyStyle: CSSProperties = {
  minHeight: 14,
  color: '#aeb8c8',
  textAlign: 'left',
  font: '700 11px system-ui',
}
