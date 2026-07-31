import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ITEMS_BY_ID, type EquipmentSlot, type ItemCategory, type ItemEffectKey } from '../data/items'
import { KEY } from '../gameplay/input/keyMap'
import { QUICK_SLOT_IDS, useInventoryStore } from '../gameplay/inventory/inventoryStore'
import { formatWeight, getInventoryWeight, getMaxCarryWeight } from '../gameplay/inventory/inventoryWeight'
import { usePickupStore } from '../gameplay/inventory/pickupStore'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { isBlocked } from '../world/beauvais/collision'
import { SPAWN } from '../world/beauvais/cityData'
import { HUD, hardShadow, hardShadowSmall, outline, outlineThin, sectionLabel } from './hudStyle'

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
      if ((event.code === KEY.INVENTORY || event.code === KEY.INVENTORY_ALT) && !event.repeat) {
        // ⚠️ Tab déplace le focus dans la page par défaut : sans ce preventDefault,
        // l'inventaire s'ouvrirait ET le navigateur sauterait sur un bouton.
        event.preventDefault()
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
  const maxCarryWeight = getMaxCarryWeight()
  const weightRatio = Math.min(1, totalWeight / maxCarryWeight)
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
            <strong>{formatWeight(totalWeight)} / {formatWeight(maxCarryWeight)}</strong>
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

/**
 * 🎨 L'inventaire suit le même langage que le HUD (`ui/hudStyle.ts`) : papier
 * crème, contour d'encre épais, ombre dure, aplats francs. Il ne réinvente ni
 * fond ni bordure — quand le style du jeu bougera, il suivra tout seul.
 */
const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  pointerEvents: 'auto',
  display: 'grid',
  placeItems: 'center',
  // Le voile est ENCRE, pas gris-bleu : on assombrit la page, on ne la teinte pas.
  background: 'rgba(22, 26, 36, 0.62)',
  color: HUD.text,
}

const panelStyle: CSSProperties = {
  width: 'min(1080px, calc(100vw - 32px))',
  height: 'min(680px, calc(100vh - 32px))',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  borderRadius: HUD.radius + 4,
  border: outline,
  background: HUD.paper,
  boxShadow: `8px 8px 0 ${HUD.ink}`,
  overflow: 'hidden',
  font: `700 14px ${HUD.font}`,
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
  padding: '16px 20px',
  borderBottom: outline,
  background: '#ffd83d',
  color: HUD.ink,
}

const weightBoxStyle: CSSProperties = {
  width: 220,
  display: 'grid',
  gap: 4,
  color: HUD.ink,
  font: `800 12px ${HUD.font}`,
}

const weightLabelStyle: CSSProperties = {
  ...sectionLabel,
  color: HUD.ink,
}

const weightTrackStyle: CSSProperties = {
  height: 11,
  borderRadius: 999,
  overflow: 'hidden',
  background: HUD.paper,
  border: outlineThin,
}

const weightFillStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  borderRadius: 999,
  background: HUD.ink,
}

const eyebrowStyle: CSSProperties = {
  ...sectionLabel,
  color: HUD.ink,
  opacity: 0.72,
}

const titleStyle: CSSProperties = {
  margin: '2px 0 0',
  font: `900 26px ${HUD.font}`,
  lineHeight: 1.05,
  letterSpacing: 0.5,
}

const closeButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  border: outline,
  background: HUD.paper,
  color: HUD.ink,
  cursor: 'pointer',
  font: `900 15px ${HUD.font}`,
  boxShadow: hardShadowSmall,
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
  borderRight: outline,
  background: HUD.paperShade,
  overflow: 'auto',
}

const compactSidebarStyle: CSSProperties = {
  ...sidebarStyle,
  gridAutoFlow: 'column',
  gridAutoColumns: 'max-content',
  borderRight: 'none',
  borderBottom: outline,
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
  borderRadius: 9,
  border: '2px solid transparent',
  background: 'transparent',
  color: HUD.textDim,
  cursor: 'pointer',
  font: `800 13px ${HUD.font}`,
  textAlign: 'left',
}

/** La catégorie ouverte est un onglet PLEIN, pas une nuance de gris. */
const activeCategoryStyle: CSSProperties = {
  ...categoryStyle,
  background: HUD.ink,
  border: outlineThin,
  color: HUD.paper,
}

const countStyle: CSSProperties = {
  minWidth: 24,
  textAlign: 'center',
  padding: '1px 7px',
  borderRadius: 999,
  background: 'rgba(22, 26, 36, 0.14)',
  color: 'inherit',
  font: `800 12px ${HUD.mono}`,
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
  borderRadius: 9,
  border: outlineThin,
  background: HUD.paper,
  color: HUD.textDim,
  cursor: 'pointer',
  font: `800 12px ${HUD.font}`,
}

const activeSortButtonStyle: CSSProperties = {
  ...sortButtonStyle,
  background: HUD.ink,
  color: HUD.paper,
}

const itemStyle: CSSProperties = {
  minHeight: 62,
  padding: '10px 12px',
  display: 'grid',
  gap: 4,
  borderRadius: 11,
  border: outlineThin,
  background: HUD.paper,
  color: HUD.text,
  cursor: 'pointer',
  textAlign: 'left',
}

/**
 * L'objet sélectionné est JAUNE et décalé, comme l'objet équipé de la barre de
 * raccourcis : même code visuel pour « c'est celui-là », partout dans le jeu.
 */
const selectedItemStyle: CSSProperties = {
  ...itemStyle,
  border: outline,
  background: '#ffd83d',
  boxShadow: hardShadowSmall,
}

const itemNameStyle: CSSProperties = {
  font: `800 15px ${HUD.font}`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const metaStyle: CSSProperties = {
  color: HUD.textDim,
  font: `700 12px ${HUD.font}`,
}

const detailsStyle: CSSProperties = {
  padding: 16,
  display: 'grid',
  gridTemplateRows: 'auto auto auto auto 1fr',
  gap: 14,
  borderLeft: outline,
  background: HUD.paperShade,
  overflow: 'auto',
}

const compactDetailsStyle: CSSProperties = {
  ...detailsStyle,
  borderLeft: 'none',
  borderTop: outline,
}

const detailTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'start',
  justifyContent: 'space-between',
  gap: 12,
}

const detailTitleStyle: CSSProperties = {
  margin: '2px 0 0',
  font: `900 22px ${HUD.font}`,
  lineHeight: 1.14,
  letterSpacing: 0.3,
}

const priceStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '4px 9px',
  borderRadius: 999,
  border: outlineThin,
  background: '#5aa832',
  color: HUD.paper,
  font: `800 13px ${HUD.font}`,
}

const priceStackStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
  gap: 6,
}

const weightPillStyle: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 999,
  border: outlineThin,
  background: HUD.paper,
  color: HUD.text,
  font: `800 12px ${HUD.font}`,
}

const stackPillStyle: CSSProperties = {
  ...weightPillStyle,
  background: '#c9b6ef',
}

const descriptionStyle: CSSProperties = {
  color: HUD.text,
  font: `700 13px ${HUD.font}`,
  lineHeight: 1.45,
}

const effectsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
}

const effectPillStyle: CSSProperties = {
  padding: '4px 8px',
  borderRadius: 999,
  border: outlineThin,
  background: HUD.paper,
  color: HUD.text,
  font: `800 12px ${HUD.font}`,
}

const durationPillStyle: CSSProperties = {
  ...effectPillStyle,
  background: '#9ed3ef',
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
  borderRadius: 9,
  border: outlineThin,
  background: HUD.paper,
  color: HUD.text,
  cursor: 'pointer',
  font: `800 13px ${HUD.mono}`,
}

const activeQuickAssignButtonStyle: CSSProperties = {
  ...quickAssignButtonStyle,
  background: '#ffd83d',
  border: outline,
}

/** L'action principale : jaune, contour épais, ombre — le bouton qu'on voit. */
const primaryButtonStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 10,
  border: outline,
  background: '#ffd83d',
  color: HUD.ink,
  cursor: 'pointer',
  font: `800 13px ${HUD.font}`,
  boxShadow: hardShadowSmall,
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: HUD.paper,
  boxShadow: 'none',
}

const dangerButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: '#e63946',
  color: HUD.paper,
}

const equipmentStyle: CSSProperties = {
  alignSelf: 'end',
  display: 'grid',
  gap: 7,
  paddingTop: 12,
  borderTop: `2px dashed ${HUD.ink}`,
}

const sectionTitleStyle: CSSProperties = {
  ...sectionLabel,
}

const slotStyle: CSSProperties = {
  minHeight: 36,
  padding: '6px 9px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  borderRadius: 9,
  border: outlineThin,
  background: HUD.paper,
  color: HUD.text,
  cursor: 'pointer',
  textAlign: 'left',
}

const slotLabelStyle: CSSProperties = {
  color: HUD.textDim,
  font: `800 12px ${HUD.font}`,
}

const slotItemStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  font: `800 12px ${HUD.font}`,
}

const emptyStyle: CSSProperties = {
  minHeight: 140,
  display: 'grid',
  placeItems: 'center',
  color: HUD.textDim,
  border: `2px dashed ${HUD.ink}`,
  borderRadius: 11,
  font: `800 13px ${HUD.font}`,
}

const messageStyle: CSSProperties = {
  minHeight: 36,
  padding: '9px 16px',
  color: HUD.ink,
  borderTop: outline,
  background: '#ffd83d',
  font: `800 13px ${HUD.font}`,
}

const toastStyle: CSSProperties = {
  position: 'fixed',
  right: 14,
  bottom: 14,
  zIndex: 70,
  maxWidth: 360,
  padding: '9px 12px',
  borderRadius: 11,
  pointerEvents: 'none',
  background: HUD.paper,
  border: outline,
  boxShadow: hardShadow,
  color: HUD.ink,
  font: `800 13px ${HUD.font}`,
}
