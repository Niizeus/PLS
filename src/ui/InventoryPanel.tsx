import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ITEMS_BY_ID, type EquipmentSlot, type ItemCategory, type ItemEffectKey } from '../data/items'
import { KEY } from '../gameplay/input/keyMap'
import { QUICK_SLOT_IDS, useInventoryStore } from '../gameplay/inventory/inventoryStore'
import { formatWeight, getInventoryWeight, MAX_CARRY_WEIGHT } from '../gameplay/inventory/inventoryWeight'
import { usePickupStore } from '../gameplay/inventory/pickupStore'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { isBlocked } from '../world/beauvais/collision'
import { SPAWN } from '../world/beauvais/cityData'

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  arme: 'Armes',
  arme_lancer: 'Lancer',
  consommable_nourriture: 'Bouffe',
  consommable_boisson: 'Boissons',
  consommable_chelou: 'Chelou',
  alcool: 'Alcools',
  armure_tete: 'Tete',
  armure_torse: 'Torse',
  armure_jambes: 'Jambes',
  armure_pieds: 'Pieds',
  accessoire: 'Accessoires',
  vehicule: 'Vehicules',
}

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  head: 'Tete',
  torso: 'Torse',
  legs: 'Jambes',
  feet: 'Pieds',
  accessory: 'Accessoire',
  rightHand: 'Main droite',
  leftHand: 'Main gauche',
}

const EFFECT_LABEL: Record<ItemEffectKey, string> = {
  health: 'Sante',
  hunger: 'Faim',
  thirst: 'Soif',
  mental: 'Mental',
  attack: 'Attaque',
  defense: 'Defense',
  agility: 'Agilite',
  chance: 'Chance',
  speed: 'Vitesse',
  chaos: 'Chaos',
}

const CATEGORY_ORDER: ItemCategory[] = [
  'arme',
  'arme_lancer',
  'consommable_nourriture',
  'consommable_boisson',
  'consommable_chelou',
  'alcool',
  'armure_tete',
  'armure_torse',
  'armure_jambes',
  'armure_pieds',
  'accessoire',
  'vehicule',
]

const SLOTS: EquipmentSlot[] = ['head', 'torso', 'legs', 'feet', 'accessory', 'rightHand', 'leftHand']
type InventorySortMode = 'name' | 'quantity' | 'weight' | 'price'

const SORT_LABEL: Record<InventorySortMode, string> = {
  name: 'Nom',
  quantity: 'Quantite',
  weight: 'Poids',
  price: 'Valeur',
}

const SORT_MODES: InventorySortMode[] = ['name', 'quantity', 'weight', 'price']

export default function InventoryPanel() {
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ItemCategory>('arme')
  const [sortMode, setSortMode] = useState<InventorySortMode>('name')
  const compact = useCompactLayout()
  const items = useInventoryStore((s) => s.items)
  const equipped = useInventoryStore((s) => s.equipped)
  const quickSlots = useInventoryStore((s) => s.quickSlots)
  const selectedItemId = useInventoryStore((s) => s.selectedItemId)
  const lastMessage = useInventoryStore((s) => s.lastMessage)
  const selectItem = useInventoryStore((s) => s.selectItem)
  const useItem = useInventoryStore((s) => s.useItem)
  const equipItem = useInventoryStore((s) => s.equipItem)
  const unequipSlot = useInventoryStore((s) => s.unequipSlot)
  const assignQuickSlot = useInventoryStore((s) => s.assignQuickSlot)
  const removeItem = useInventoryStore((s) => s.removeItem)
  const clearMessage = useInventoryStore((s) => s.clearMessage)
  const addDroppedPickup = usePickupStore((s) => s.addDroppedPickup)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === KEY.INVENTORY && !event.repeat) {
        setOpen((current) => !current)
        document.exitPointerLock?.()
      } else if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) document.body.dataset.plsInventoryOpen = 'true'
    else delete document.body.dataset.plsInventoryOpen

    return () => {
      delete document.body.dataset.plsInventoryOpen
    }
  }, [open])

  useEffect(() => {
    if (!lastMessage) return
    const timeoutId = window.setTimeout(clearMessage, 2600)
    return () => window.clearTimeout(timeoutId)
  }, [clearMessage, lastMessage])

  const visibleItems = useMemo(
    () =>
      items
        .filter((entry) => ITEMS_BY_ID[entry.itemId]?.category === activeCategory)
        .sort((a, b) => compareEntries(a, b, sortMode)),
    [activeCategory, items, sortMode],
  )
  const totalWeight = useMemo(() => getInventoryWeight(items), [items])
  const weightRatio = Math.min(1, totalWeight / MAX_CARRY_WEIGHT)
  const selectedItem = selectedItemId ? ITEMS_BY_ID[selectedItemId] : null
  const selectedEntry = selectedItemId ? items.find((entry) => entry.itemId === selectedItemId) : null
  const occupiedSlot = selectedItemId
    ? (Object.entries(equipped).find(([, itemId]) => itemId === selectedItemId)?.[0] as EquipmentSlot | undefined)
    : undefined
  const canDropSelectedItem = selectedItem?.id !== 'poing-basique'

  const dropSelectedItem = (quantity: number) => {
    if (!selectedItem || !selectedEntry || !canDropSelectedItem) return
    const dropQuantity = Math.min(quantity, selectedEntry.quantity)
    if (dropQuantity <= 0) return

    const spot = findDropSpot()
    addDroppedPickup({
      id: createDroppedPickupId(selectedItem.id),
      itemId: selectedItem.id,
      quantity: dropQuantity,
      x: spot.x,
      z: spot.z,
    })
    if (occupiedSlot && dropQuantity >= selectedEntry.quantity) unequipSlot(occupiedSlot)
    removeItem(selectedItem.id, dropQuantity)
  }

  if (!open) {
    return lastMessage ? <Toast>{lastMessage}</Toast> : null
  }

  return (
    <div style={overlayStyle}>
      <div style={compact ? compactPanelStyle : panelStyle}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>Chibrux</div>
            <h2 style={titleStyle}>Inventaire</h2>
          </div>
          <div style={weightBoxStyle}>
            <span style={weightLabelStyle}>Charge</span>
            <strong>{formatWeight(totalWeight)} / {formatWeight(MAX_CARRY_WEIGHT)}</strong>
            <span style={weightTrackStyle}>
              <span style={{ ...weightFillStyle, width: `${weightRatio * 100}%` }} />
            </span>
          </div>
          <button onClick={() => setOpen(false)} style={closeButtonStyle} title="Fermer">
            X
          </button>
        </div>

        <div style={compact ? compactContentStyle : contentStyle}>
          <aside style={compact ? compactSidebarStyle : sidebarStyle}>
            {CATEGORY_ORDER.map((category) => {
              const count = items.filter((entry) => ITEMS_BY_ID[entry.itemId]?.category === category).length
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  style={category === activeCategory ? activeCategoryStyle : categoryStyle}
                >
                  <span>{CATEGORY_LABEL[category]}</span>
                  <span style={countStyle}>{count}</span>
                </button>
              )
            })}
          </aside>

          <main style={listStyle}>
            <div style={sortBarStyle}>
              {SORT_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  style={sortMode === mode ? activeSortButtonStyle : sortButtonStyle}
                >
                  {SORT_LABEL[mode]}
                </button>
              ))}
            </div>
            {visibleItems.length === 0 ? (
              <div style={emptyStyle}>Rien ici pour le moment.</div>
            ) : (
              visibleItems.map((entry) => {
                const item = ITEMS_BY_ID[entry.itemId]
                const isSelected = selectedItemId === entry.itemId
                const isEquipped = Object.values(equipped).includes(entry.itemId)
                const stackText = item.stackable ? `${entry.quantity}/${item.maxStack ?? 99}` : `${entry.quantity}/1`
                return (
                  <button
                    key={entry.itemId}
                    onClick={() => selectItem(entry.itemId)}
                    style={isSelected ? selectedItemStyle : itemStyle}
                  >
                    <span style={itemNameStyle}>{item.name}</span>
                    <span style={metaStyle}>
                      x{stackText} / {item.rarity}
                      {isEquipped ? ' / equipe' : ''}
                    </span>
                  </button>
                )
              })
            )}
          </main>

          <section style={compact ? compactDetailsStyle : detailsStyle}>
            {selectedItem && selectedEntry ? (
              <>
                <div style={detailTopStyle}>
                  <div>
                    <div style={eyebrowStyle}>{CATEGORY_LABEL[selectedItem.category]}</div>
                    <h3 style={detailTitleStyle}>{selectedItem.name}</h3>
                  </div>
                  <div style={priceStackStyle}>
                    <div style={priceStyle}>{selectedItem.price} EUR</div>
                    <div style={weightPillStyle}>{formatWeight(selectedItem.weightKg)}</div>
                    <div style={stackPillStyle}>
                      Pile {selectedEntry.quantity}/{selectedItem.stackable ? selectedItem.maxStack ?? 99 : 1}
                    </div>
                  </div>
                </div>

                <p style={descriptionStyle}>{selectedItem.description}</p>

                <div style={effectsStyle}>
                  {selectedItem.effects ? (
                    <>
                      {Object.entries(selectedItem.effects).map(([key, value]) => (
                        <span key={key} style={effectPillStyle}>
                          {EFFECT_LABEL[key as ItemEffectKey]} {value && value > 0 ? '+' : ''}
                          {value}
                        </span>
                      ))}
                      {selectedItem.effectDurationMs ? (
                        <span style={durationPillStyle}>Duree {Math.round(selectedItem.effectDurationMs / 1000)}s</span>
                      ) : null}
                    </>
                  ) : (
                    <span style={effectPillStyle}>Aucun effet direct</span>
                  )}
                </div>

                <div style={actionsStyle}>
                  {selectedItem.consumable && (
                    <button onClick={() => useItem(selectedItem.id)} style={primaryButtonStyle}>
                      Utiliser
                    </button>
                  )}
                  {selectedItem.equipSlot && (
                    <button onClick={() => equipItem(selectedItem.id)} style={primaryButtonStyle}>
                      Equiper
                    </button>
                  )}
                  {occupiedSlot && (
                    <button onClick={() => unequipSlot(occupiedSlot)} style={secondaryButtonStyle}>
                      Retirer
                    </button>
                  )}
                  {canDropSelectedItem && (
                    <button onClick={() => dropSelectedItem(1)} style={dangerButtonStyle}>
                      Deposer 1
                    </button>
                  )}
                  {canDropSelectedItem && selectedEntry.quantity > 1 && (
                    <button onClick={() => dropSelectedItem(selectedEntry.quantity)} style={dangerButtonStyle}>
                      Tout
                    </button>
                  )}
                </div>

                <div style={quickAssignStyle}>
                  <span style={sectionTitleStyle}>Raccourcis</span>
                  <div style={quickAssignButtonsStyle}>
                    {QUICK_SLOT_IDS.map((slot, index) => (
                      <button
                        key={slot}
                        onClick={() => assignQuickSlot(slot, quickSlots[slot] === selectedItem.id ? null : selectedItem.id)}
                        style={quickSlots[slot] === selectedItem.id ? activeQuickAssignButtonStyle : quickAssignButtonStyle}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={emptyStyle}>Selectionne un objet.</div>
            )}

            <div style={equipmentStyle}>
              <div style={sectionTitleStyle}>Equipement</div>
              {SLOTS.map((slot) => {
                const itemId = equipped[slot]
                const item = itemId ? ITEMS_BY_ID[itemId] : null
                return (
                  <button key={slot} onClick={() => itemId && selectItem(itemId)} style={slotStyle}>
                    <span style={slotLabelStyle}>{SLOT_LABEL[slot]}</span>
                    <span style={slotItemStyle}>{item?.name ?? 'Vide'}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {lastMessage && <div style={messageStyle}>{lastMessage}</div>}
      </div>
    </div>
  )
}

function Toast({ children }: { children: string }) {
  return <div style={toastStyle}>{children}</div>
}

function compareEntries(
  a: { itemId: string; quantity: number },
  b: { itemId: string; quantity: number },
  sortMode: InventorySortMode,
) {
  const itemA = ITEMS_BY_ID[a.itemId]
  const itemB = ITEMS_BY_ID[b.itemId]
  if (!itemA || !itemB) return 0

  if (sortMode === 'quantity') return b.quantity - a.quantity || itemA.name.localeCompare(itemB.name)
  if (sortMode === 'weight') return itemB.weightKg * b.quantity - itemA.weightKg * a.quantity || itemA.name.localeCompare(itemB.name)
  if (sortMode === 'price') return itemB.price * b.quantity - itemA.price * a.quantity || itemA.name.localeCompare(itemB.name)
  return itemA.name.localeCompare(itemB.name)
}

function createDroppedPickupId(itemId: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
  return `dropped-${itemId}-${suffix}`
}

function findDropSpot() {
  const player = usePlayerStore.getState().playerObject
  const baseX = player?.position.x ?? SPAWN.x
  const baseZ = player?.position.z ?? SPAWN.z
  const rot = player?.rotation.y ?? 0

  const firstX = baseX + Math.sin(rot) * 2
  const firstZ = baseZ + Math.cos(rot) * 2
  if (!isBlocked(firstX, firstZ)) return { x: firstX, z: firstZ }

  for (let radius = 1.5; radius <= 5; radius += 0.75) {
    for (let step = 0; step < 12; step++) {
      const angle = rot + (step / 12) * Math.PI * 2
      const x = baseX + Math.sin(angle) * radius
      const z = baseZ + Math.cos(angle) * radius
      if (!isBlocked(x, z)) return { x, z }
    }
  }

  return { x: baseX, z: baseZ }
}

function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.innerWidth < 820)

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 820)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return compact
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  pointerEvents: 'auto',
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(7, 10, 18, 0.56)',
  color: '#ecf2ff',
}

const panelStyle: CSSProperties = {
  width: 'min(1080px, calc(100vw - 32px))',
  height: 'min(680px, calc(100vh - 32px))',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.34)',
  background: 'rgba(13, 18, 32, 0.96)',
  boxShadow: '0 18px 60px rgba(0,0,0,0.42)',
  overflow: 'hidden',
  font: '14px system-ui, sans-serif',
}

const compactPanelStyle: CSSProperties = {
  ...panelStyle,
  width: 'calc(100vw - 20px)',
  height: 'calc(100vh - 20px)',
}

const headerStyle: CSSProperties = {
  minHeight: 76,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 20px',
  borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
  background: '#111827',
}

const weightBoxStyle: CSSProperties = {
  width: 220,
  display: 'grid',
  gap: 4,
  color: '#dbeafe',
  font: '800 12px system-ui',
}

const weightLabelStyle: CSSProperties = {
  color: '#9ca3af',
  textTransform: 'uppercase',
}

const weightTrackStyle: CSSProperties = {
  height: 7,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'rgba(148, 163, 184, 0.22)',
}

const weightFillStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  borderRadius: 999,
  background: '#38bdf8',
}

const eyebrowStyle: CSSProperties = {
  color: '#9ca3af',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: '2px 0 0',
  fontSize: 24,
  lineHeight: 1.1,
  letterSpacing: 0,
}

const closeButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 6,
  border: '1px solid rgba(148, 163, 184, 0.36)',
  background: '#1f2937',
  color: '#ecf2ff',
  cursor: 'pointer',
  font: '700 14px system-ui',
}

const contentStyle: CSSProperties = {
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '180px minmax(220px, 1fr) minmax(280px, 360px)',
}

const compactContentStyle: CSSProperties = {
  ...contentStyle,
  gridTemplateColumns: '1fr',
  gridTemplateRows: 'auto minmax(170px, 1fr) auto',
  overflow: 'auto',
}

const sidebarStyle: CSSProperties = {
  padding: 12,
  display: 'grid',
  alignContent: 'start',
  gap: 6,
  borderRight: '1px solid rgba(148, 163, 184, 0.18)',
  overflow: 'auto',
}

const compactSidebarStyle: CSSProperties = {
  ...sidebarStyle,
  gridAutoFlow: 'column',
  gridAutoColumns: 'max-content',
  borderRight: 'none',
  borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
  overflowX: 'auto',
  overflowY: 'hidden',
}

const categoryStyle: CSSProperties = {
  height: 34,
  padding: '0 10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  borderRadius: 6,
  border: '1px solid transparent',
  background: 'transparent',
  color: '#cbd5e1',
  cursor: 'pointer',
  font: '650 13px system-ui',
  textAlign: 'left',
}

const activeCategoryStyle: CSSProperties = {
  ...categoryStyle,
  background: '#263247',
  border: '1px solid rgba(125, 211, 252, 0.36)',
  color: '#f8fafc',
}

const countStyle: CSSProperties = {
  minWidth: 24,
  textAlign: 'center',
  padding: '2px 7px',
  borderRadius: 999,
  background: 'rgba(148, 163, 184, 0.18)',
  color: '#cbd5e1',
  font: '700 12px system-ui',
}

const listStyle: CSSProperties = {
  padding: 14,
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  overflow: 'auto',
}

const sortBarStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 6,
  marginBottom: 4,
}

const sortButtonStyle: CSSProperties = {
  minWidth: 0,
  height: 30,
  borderRadius: 6,
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: '#111827',
  color: '#aeb8c8',
  cursor: 'pointer',
  font: '800 12px system-ui',
}

const activeSortButtonStyle: CSSProperties = {
  ...sortButtonStyle,
  border: '1px solid rgba(56, 189, 248, 0.48)',
  background: '#20324c',
  color: '#f8fafc',
}

const itemStyle: CSSProperties = {
  minHeight: 62,
  padding: '10px 12px',
  display: 'grid',
  gap: 4,
  borderRadius: 7,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  background: '#172033',
  color: '#ecf2ff',
  cursor: 'pointer',
  textAlign: 'left',
}

const selectedItemStyle: CSSProperties = {
  ...itemStyle,
  border: '1px solid rgba(56, 189, 248, 0.72)',
  background: '#20324c',
}

const itemNameStyle: CSSProperties = {
  font: '750 15px system-ui',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const metaStyle: CSSProperties = {
  color: '#aeb8c8',
  font: '12px system-ui',
}

const detailsStyle: CSSProperties = {
  padding: 16,
  display: 'grid',
  gridTemplateRows: 'auto auto auto auto 1fr',
  gap: 14,
  borderLeft: '1px solid rgba(148, 163, 184, 0.18)',
  background: '#0f1728',
  overflow: 'auto',
}

const compactDetailsStyle: CSSProperties = {
  ...detailsStyle,
  borderLeft: 'none',
  borderTop: '1px solid rgba(148, 163, 184, 0.18)',
}

const detailTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'start',
  justifyContent: 'space-between',
  gap: 12,
}

const detailTitleStyle: CSSProperties = {
  margin: '2px 0 0',
  fontSize: 22,
  lineHeight: 1.16,
  letterSpacing: 0,
}

const priceStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '5px 9px',
  borderRadius: 6,
  background: '#193528',
  color: '#bbf7d0',
  font: '800 13px system-ui',
}

const priceStackStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
  gap: 6,
}

const weightPillStyle: CSSProperties = {
  padding: '4px 8px',
  borderRadius: 6,
  background: '#273244',
  color: '#dbeafe',
  font: '800 12px system-ui',
}

const stackPillStyle: CSSProperties = {
  ...weightPillStyle,
  background: '#312e52',
  color: '#ddd6fe',
}

const descriptionStyle: CSSProperties = {
  color: '#d5deec',
  lineHeight: 1.45,
}

const effectsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
}

const effectPillStyle: CSSProperties = {
  padding: '5px 8px',
  borderRadius: 6,
  background: '#233044',
  color: '#dbeafe',
  font: '700 12px system-ui',
}

const durationPillStyle: CSSProperties = {
  ...effectPillStyle,
  background: '#173241',
  color: '#bae6fd',
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const quickAssignStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
}

const quickAssignButtonsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 36px)',
  gap: 7,
}

const quickAssignButtonStyle: CSSProperties = {
  width: 36,
  height: 34,
  borderRadius: 6,
  border: '1px solid rgba(148, 163, 184, 0.28)',
  background: '#283446',
  color: '#e5e7eb',
  cursor: 'pointer',
  font: '800 13px ui-monospace, monospace',
}

const activeQuickAssignButtonStyle: CSSProperties = {
  ...quickAssignButtonStyle,
  border: '1px solid rgba(56, 189, 248, 0.72)',
  background: '#0e7490',
  color: '#ecfeff',
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 13px',
  borderRadius: 6,
  border: '1px solid rgba(125, 211, 252, 0.42)',
  background: '#0e7490',
  color: '#ecfeff',
  cursor: 'pointer',
  font: '800 13px system-ui',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid rgba(148, 163, 184, 0.28)',
  background: '#283446',
  color: '#e5e7eb',
}

const dangerButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid rgba(248, 113, 113, 0.42)',
  background: '#7f1d1d',
  color: '#fee2e2',
}

const equipmentStyle: CSSProperties = {
  alignSelf: 'end',
  display: 'grid',
  gap: 7,
  paddingTop: 12,
  borderTop: '1px solid rgba(148, 163, 184, 0.18)',
}

const sectionTitleStyle: CSSProperties = {
  font: '800 13px system-ui',
  color: '#cbd5e1',
}

const slotStyle: CSSProperties = {
  minHeight: 36,
  padding: '7px 9px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  borderRadius: 6,
  border: '1px solid rgba(148, 163, 184, 0.16)',
  background: '#172033',
  color: '#ecf2ff',
  cursor: 'pointer',
  textAlign: 'left',
}

const slotLabelStyle: CSSProperties = {
  color: '#aeb8c8',
  font: '650 12px system-ui',
}

const slotItemStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  font: '750 12px system-ui',
}

const emptyStyle: CSSProperties = {
  minHeight: 140,
  display: 'grid',
  placeItems: 'center',
  color: '#9ca3af',
  border: '1px dashed rgba(148, 163, 184, 0.26)',
  borderRadius: 7,
}

const messageStyle: CSSProperties = {
  minHeight: 36,
  padding: '9px 16px',
  color: '#dbeafe',
  borderTop: '1px solid rgba(148, 163, 184, 0.18)',
  background: '#111827',
  font: '650 13px system-ui',
}

const toastStyle: CSSProperties = {
  position: 'fixed',
  right: 14,
  bottom: 14,
  zIndex: 70,
  maxWidth: 360,
  padding: '10px 12px',
  borderRadius: 7,
  pointerEvents: 'none',
  background: 'rgba(13, 18, 32, 0.9)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  color: '#ecf2ff',
  font: '700 13px system-ui',
}
