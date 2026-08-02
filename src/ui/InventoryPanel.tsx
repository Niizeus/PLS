import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ITEMS_BY_ID,
  getItemSize,
  isItemRotatable,
  type EquipmentSlot,
  type ItemCategory,
  type ItemEffectKey,
  type ItemLegality,
} from '../data/items'
import { KEY } from '../gameplay/input/keyMap'
import { setCursorUiOpen } from '../gameplay/input/pointerLock'
import {
  BACKPACK_COLS,
  BACKPACK_ROWS,
  buildOccupancy,
  canPlace,
  countUsedCells,
  findMergeTarget,
  getFootprint,
} from '../gameplay/inventory/backpackGrid'
import { QUICK_SLOT_IDS, useInventoryStore } from '../gameplay/inventory/inventoryStore'
import { getInventoryWeight, getMaxCarryWeight, formatWeight } from '../gameplay/inventory/inventoryWeight'
import { usePendingPlacementStore } from '../gameplay/inventory/pendingPlacementStore'
import { usePickupStore } from '../gameplay/inventory/pickupStore'
import { usePlayerStore } from '../gameplay/stats/playerStore'
import { isBlocked } from '../world/beauvais/collision'
import { SPAWN } from '../world/beauvais/cityData'
import { HUD, hardShadow, hardShadowSmall, outline, outlineThin, sectionLabel } from './hudStyle'

/**
 * 🎒 LE SAC À DOS — une grille de 8×5 cases.
 *
 * ── Comment ça se manipule ─────────────────────────────────────────────────
 * • **Un clic** sur un objet le prend en main, **un clic** sur une case le
 *   repose. Pas de glisser-déposer maintenu : c'est plus tolérant à la souris
 *   qui dérape, et ça marche pareil sur un pavé tactile.
 * • **R** fait pivoter l'objet tenu (s'il n'est pas carré).
 * • **Échap** repose ce qu'on tient / referme le sac.
 * • Lâcher une pile sur une pile identique les **fusionne**.
 *
 * ── Le ramassage ───────────────────────────────────────────────────────────
 * Quand le joueur appuie sur `E` devant un objet du monde, celui-ci arrive
 * **en main** et le sac s'ouvre tout seul : il faut lui trouver une place. Tant
 * qu'il n'est pas posé, **l'objet reste par terre** — annuler ne perd rien.
 * Voir `gameplay/inventory/pendingPlacementStore.ts`.
 */

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  arme: 'Arme',
  arme_lancer: 'Lancer',
  consommable_nourriture: 'Bouffe',
  consommable_boisson: 'Boisson',
  consommable_chelou: 'Chelou',
  alcool: 'Alcool',
  armure_tete: 'Tete',
  armure_torse: 'Torse',
  armure_bras: 'Bras',
  armure_jambes: 'Jambes',
  vehicule: 'Vehicule',
}

/** Une pastille par famille : on reconnaît un objet dans la grille sans le lire. */
const CATEGORY_ICON: Record<ItemCategory, string> = {
  arme: '🔨',
  arme_lancer: '🧱',
  consommable_nourriture: '🍔',
  consommable_boisson: '🥤',
  consommable_chelou: '💊',
  alcool: '🍺',
  armure_tete: '🧢',
  armure_torse: '🦺',
  armure_bras: '💍',
  armure_jambes: '👖',
  vehicule: '🛵',
}

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  head: 'Tete',
  torso: 'Torse',
  arms: 'Bras',
  legs: 'Jambes',
  hand: 'Main',
}

const SLOTS: EquipmentSlot[] = ['head', 'torso', 'arms', 'legs', 'hand']

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

const LEGALITY_LABEL: Record<ItemLegality, string> = {
  legal: 'Legal',
  prescription: 'Ordonnance',
  grey_market: 'Zone grise',
  illegal: 'Illegal',
}

const LEGALITY_COLOR: Record<ItemLegality, string> = {
  legal: '#5aa832',
  prescription: '#9ed3ef',
  grey_market: '#ffd83d',
  illegal: '#e63946',
}

/** Côté d'une case, en pixels. Toute la grille se dimensionne à partir de là. */
const CELL = 48
const CELL_GAP = 3

/** Ce que le joueur tient en main, en attente d'être posé. */
interface HeldItem {
  itemId: string
  quantity: number
  rotated: boolean
  /** Pile déjà dans le sac qu'on est en train de déplacer. */
  fromUid?: string
  /** Objet du monde à consommer une fois posé. */
  pickupId?: string
}

export default function InventoryPanel() {
  const [open, setOpen] = useState(false)
  const [held, setHeld] = useState<HeldItem | null>(null)
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const stacks = useInventoryStore((s) => s.stacks)
  const equipped = useInventoryStore((s) => s.equipped)
  const quickSlots = useInventoryStore((s) => s.quickSlots)
  const selectedUid = useInventoryStore((s) => s.selectedUid)
  const lastMessage = useInventoryStore((s) => s.lastMessage)
  const clearMessage = useInventoryStore((s) => s.clearMessage)
  const addDroppedPickup = usePickupStore((s) => s.addDroppedPickup)
  const collectPickup = usePickupStore((s) => s.collectPickup)
  const pending = usePendingPlacementStore((s) => s.pending)

  // Un objet ramassé arrive « en main » : le sac s'ouvre tout seul dessus.
  useEffect(() => {
    if (!pending) return
    setHeld({ itemId: pending.itemId, quantity: pending.quantity, rotated: pending.rotated, pickupId: pending.pickupId })
    setOpen(true)
  }, [pending])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.code === KEY.INVENTORY || event.code === KEY.INVENTORY_ALT) && !event.repeat) {
        // ⚠️ Tab déplace le focus dans la page par défaut : sans ce preventDefault,
        // l'inventaire s'ouvrirait ET le navigateur sauterait sur un bouton.
        event.preventDefault()
        setOpen((current) => !current)
        return
      }
      if (!open) return

      if (event.code === 'Escape') {
        // Premier Échap : on repose ce qu'on tient. Deuxième : on ferme.
        if (held) releaseHeld()
        else setOpen(false)
        return
      }
      // R fait pivoter l'objet tenu — seule touche utile pendant un placement.
      if (event.code === 'KeyR' && held && isItemRotatable(held.itemId)) {
        event.preventDefault()
        setHeld({ ...held, rotated: !held.rotated })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // Sac ouvert = curseur rendu au joueur (voir `gameplay/input/pointerLock.ts`).
  useEffect(() => {
    setCursorUiOpen('inventory', open)
    if (open) document.body.dataset.plsInventoryOpen = 'true'
    else delete document.body.dataset.plsInventoryOpen

    return () => {
      setCursorUiOpen('inventory', false)
      delete document.body.dataset.plsInventoryOpen
    }
  }, [open])

  useEffect(() => {
    if (!lastMessage) return
    const timeoutId = window.setTimeout(clearMessage, 2600)
    return () => window.clearTimeout(timeoutId)
  }, [clearMessage, lastMessage])

  const usedCells = useMemo(() => countUsedCells(stacks), [stacks])
  const totalCells = BACKPACK_COLS * BACKPACK_ROWS
  const totalWeight = useMemo(() => getInventoryWeight(stacks), [stacks])
  const maxCarryWeight = getMaxCarryWeight()
  const overloaded = totalWeight > maxCarryWeight * 0.72

  const selectedStack = stacks.find((stack) => stack.uid === selectedUid) ?? null
  const selectedItem = selectedStack ? ITEMS_BY_ID[selectedStack.itemId] : null

  /** Repose ce qu'on tient : soit on annule le ramassage, soit rien ne bouge. */
  const releaseHeld = () => {
    if (held?.pickupId) usePendingPlacementStore.getState().cancelPlacement()
    setHeld(null)
  }

  /** Clic sur une case de la grille. */
  const onCellClick = (x: number, y: number) => {
    const store = useInventoryStore.getState()

    if (held) {
      const placed = held.fromUid
        ? store.moveStack(held.fromUid, x, y, held.rotated)
        : store.placeItem(held.itemId, held.quantity, x, y, held.rotated)

      if (!placed) return
      // Posé pour de bon : l'objet du monde peut enfin disparaître.
      if (held.pickupId) {
        collectPickup(held.pickupId)
        usePendingPlacementStore.getState().cancelPlacement()
      }
      setHeld(null)
      return
    }

    // Main vide : on prend la pile qui est sous le curseur.
    const uid = buildOccupancy(stacks)[y]?.[x]
    const stack = uid ? stacks.find((candidate) => candidate.uid === uid) : null
    if (!stack) return
    store.selectStack(stack.uid)
    setHeld({ itemId: stack.itemId, quantity: stack.quantity, rotated: stack.rotated, fromUid: stack.uid })
  }

  const dropStack = (uid: string, quantity: number) => {
    const stack = stacks.find((candidate) => candidate.uid === uid)
    if (!stack) return
    const spot = findDropSpot()
    addDroppedPickup({
      id: createDroppedPickupId(stack.itemId),
      itemId: stack.itemId,
      quantity: Math.min(quantity, stack.quantity),
      x: spot.x,
      z: spot.z,
    })
    useInventoryStore.getState().removeStack(uid, quantity)
  }

  if (!open) return lastMessage ? <Toast>{lastMessage}</Toast> : null

  const occupancy = buildOccupancy(stacks)
  const heldFootprint = held ? getFootprint(held.itemId, held.rotated) : null
  // Aperçu sous le curseur : vert si ça rentre, rouge sinon. Le joueur voit
  // AVANT de cliquer, il ne découvre pas le refus après coup.
  const previewValid =
    held && hovered
      ? Boolean(
          findMergeTarget(stacks, held.itemId, hovered.x, hovered.y, held.quantity, { ignoreUid: held.fromUid }) ||
            canPlace(stacks, held.itemId, hovered.x, hovered.y, held.rotated, { ignoreUid: held.fromUid }),
        )
      : false

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>Chibrux</div>
            <h2 style={titleStyle}>Sac à dos</h2>
          </div>
          <div style={statsBoxStyle}>
            <span>
              <strong>{usedCells}</strong>/{totalCells} cases
            </span>
            <span style={{ color: overloaded ? '#b32217' : HUD.ink }}>
              {formatWeight(totalWeight)}
              {overloaded ? ' · chargé' : ''}
            </span>
          </div>
          <button onClick={() => setOpen(false)} style={closeButtonStyle} title="Fermer (Échap)">
            ✕
          </button>
        </div>

        <div style={contentStyle}>
          <div style={gridColumnStyle}>
            <div
              ref={gridRef}
              style={gridStyle}
              onMouseLeave={() => setHovered(null)}
              onContextMenu={(event) => {
                // Clic droit = rotation : le réflexe de tous les jeux à grille.
                event.preventDefault()
                if (held && isItemRotatable(held.itemId)) setHeld({ ...held, rotated: !held.rotated })
              }}
            >
              {/* Les cases vides : le quadrillage. */}
              {Array.from({ length: BACKPACK_ROWS }).map((_, y) =>
                Array.from({ length: BACKPACK_COLS }).map((__, x) => (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    onMouseEnter={() => setHovered({ x, y })}
                    onClick={() => onCellClick(x, y)}
                    style={{
                      ...cellStyle,
                      left: x * (CELL + CELL_GAP),
                      top: y * (CELL + CELL_GAP),
                    }}
                    aria-label={`case ${x + 1}, ${y + 1}`}
                  />
                )),
              )}

              {/* Les objets posés. */}
              {stacks.map((stack) => {
                const item = ITEMS_BY_ID[stack.itemId]
                if (!item) return null
                const footprint = getFootprint(stack.itemId, stack.rotated)
                const isHeld = held?.fromUid === stack.uid
                return (
                  <div
                    key={stack.uid}
                    style={{
                      ...tileStyle,
                      left: stack.x * (CELL + CELL_GAP),
                      top: stack.y * (CELL + CELL_GAP),
                      width: footprint.w * CELL + (footprint.w - 1) * CELL_GAP,
                      height: footprint.h * CELL + (footprint.h - 1) * CELL_GAP,
                      background: stack.uid === selectedUid ? '#ffd83d' : HUD.paper,
                      // La pile qu'on déplace reste visible mais en retrait.
                      opacity: isHeld ? 0.35 : 1,
                    }}
                  >
                    <span style={tileIconStyle}>{CATEGORY_ICON[item.category]}</span>
                    <span style={tileNameStyle}>{item.name}</span>
                    {stack.quantity > 1 && <span style={tileQtyStyle}>×{stack.quantity}</span>}
                  </div>
                )
              })}

              {/* L'aperçu de ce qu'on tient. */}
              {held && hovered && heldFootprint && (
                <div
                  style={{
                    ...previewStyle,
                    left: hovered.x * (CELL + CELL_GAP),
                    top: hovered.y * (CELL + CELL_GAP),
                    width: heldFootprint.w * CELL + (heldFootprint.w - 1) * CELL_GAP,
                    height: heldFootprint.h * CELL + (heldFootprint.h - 1) * CELL_GAP,
                    background: previewValid ? 'rgba(90, 168, 50, 0.5)' : 'rgba(230, 57, 70, 0.5)',
                  }}
                />
              )}
            </div>

            <div style={handBarStyle}>
              {held ? (
                <>
                  <span>
                    En main : <strong>{ITEMS_BY_ID[held.itemId]?.name}</strong>
                    {held.quantity > 1 ? ` ×${held.quantity}` : ''}
                  </span>
                  <span style={{ color: HUD.textDim }}>
                    Clic : poser
                    {isItemRotatable(held.itemId) ? ' · R ou clic droit : tourner' : ''} · Échap : annuler
                  </span>
                </>
              ) : (
                <span style={{ color: HUD.textDim }}>
                  Clic sur un objet pour le prendre en main. {occupancy.length ? '' : ''}
                </span>
              )}
            </div>
          </div>

          <section style={detailsStyle}>
            <div style={sectionTitleStyle}>Équipement</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {SLOTS.map((slot) => {
                const itemId = equipped[slot]
                const item = itemId ? ITEMS_BY_ID[itemId] : null
                return (
                  <button
                    key={slot}
                    onClick={() => itemId && useInventoryStore.getState().unequipSlot(slot)}
                    style={slotStyle}
                    title={item ? `Retirer ${item.name}` : 'Emplacement vide'}
                  >
                    <span style={slotLabelStyle}>{SLOT_LABEL[slot]}</span>
                    <span style={slotItemStyle}>{item?.name ?? '—'}</span>
                  </button>
                )
              })}
            </div>

            {selectedItem && selectedStack ? (
              <>
                <div style={sectionTitleStyle}>{CATEGORY_LABEL[selectedItem.category]}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <h3 style={detailTitleStyle}>{selectedItem.name}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={priceStyle}>{selectedItem.price} €</span>
                    {selectedItem.legality && (
                      <span
                        style={{
                          ...legalityPillStyle,
                          background: LEGALITY_COLOR[selectedItem.legality],
                          color: selectedItem.legality === 'illegal' ? HUD.paper : HUD.ink,
                        }}
                      >
                        {LEGALITY_LABEL[selectedItem.legality]}
                      </span>
                    )}
                    <span style={weightPillStyle}>{formatWeight(selectedItem.weightKg)}</span>
                    <span style={stackPillStyle}>
                      {getItemSize(selectedItem.id).w}×{getItemSize(selectedItem.id).h}
                    </span>
                    {selectedStack.quantity > 1 && (
                      <span style={weightPillStyle}>×{selectedStack.quantity}</span>
                    )}
                  </div>
                  <p style={descriptionStyle}>{selectedItem.description}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedItem.effects ? (
                      Object.entries(selectedItem.effects).map(([key, value]) => (
                        <span key={key} style={effectPillStyle}>
                          {EFFECT_LABEL[key as ItemEffectKey]} {value && value > 0 ? '+' : ''}
                          {value}
                        </span>
                      ))
                    ) : (
                      <span style={effectPillStyle}>Aucun effet</span>
                    )}
                    {selectedItem.effectDurationMs ? (
                      <span style={durationPillStyle}>{Math.round(selectedItem.effectDurationMs / 1000)}s</span>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {selectedItem.consumable && (
                      <button onClick={() => useInventoryStore.getState().useStack(selectedStack.uid)} style={primaryButtonStyle}>
                        Utiliser
                      </button>
                    )}
                    {selectedItem.equipSlot && (
                      <button onClick={() => useInventoryStore.getState().equipStack(selectedStack.uid)} style={primaryButtonStyle}>
                        Équiper
                      </button>
                    )}
                    <button onClick={() => dropStack(selectedStack.uid, 1)} style={dangerButtonStyle}>
                      Jeter 1
                    </button>
                    {selectedStack.quantity > 1 && (
                      <button onClick={() => dropStack(selectedStack.uid, selectedStack.quantity)} style={dangerButtonStyle}>
                        Tout jeter
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <span style={sectionTitleStyle}>Raccourcis</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 36px)', gap: 7 }}>
                      {QUICK_SLOT_IDS.map((slot, index) => (
                        <button
                          key={slot}
                          onClick={() =>
                            useInventoryStore
                              .getState()
                              .assignQuickSlot(slot, quickSlots[slot] === selectedItem.id ? null : selectedItem.id)
                          }
                          style={quickSlots[slot] === selectedItem.id ? activeQuickAssignButtonStyle : quickAssignButtonStyle}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={emptyStyle}>Clique un objet du sac.</div>
            )}
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

function createDroppedPickupId(itemId: string) {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
  return `dropped-${itemId}-${suffix}`
}

/** Une case libre devant le joueur pour y déposer un objet. */
function findDropSpot() {
  const player = usePlayerStore.getState().playerObject
  const baseX = player?.position.x ?? SPAWN.x
  const baseZ = player?.position.z ?? SPAWN.z
  const rot = player?.rotation.y ?? 0

  const firstX = baseX + Math.sin(rot) * 2
  const firstZ = baseZ + Math.cos(rot) * 2
  if (!isBlocked(firstX, firstZ)) return { x: firstX, z: firstZ }

  for (let radius = 1.5; radius <= 6; radius += 1.5) {
    for (let step = 0; step < 10; step++) {
      const angle = (step / 10) * Math.PI * 2
      const x = baseX + Math.cos(angle) * radius
      const z = baseZ + Math.sin(angle) * radius
      if (!isBlocked(x, z)) return { x, z }
    }
  }

  return { x: baseX, z: baseZ }
}

/**
 * 🎨 Tout part de `ui/hudStyle.ts` : papier crème, contour d'encre épais, ombre
 * dure, aplats francs. Aucun fond ni bordure réinventé ici.
 */
const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  pointerEvents: 'auto',
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(22, 26, 36, 0.62)',
  color: HUD.text,
}

const panelStyle: CSSProperties = {
  width: 'min(980px, calc(100vw - 32px))',
  maxHeight: 'calc(100vh - 32px)',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  borderRadius: HUD.radius + 4,
  border: outline,
  background: HUD.paper,
  boxShadow: `8px 8px 0 ${HUD.ink}`,
  overflow: 'hidden',
  font: `700 14px ${HUD.font}`,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 18px',
  borderBottom: outline,
  background: '#ffd83d',
  color: HUD.ink,
}

const eyebrowStyle: CSSProperties = { ...sectionLabel, color: HUD.ink, opacity: 0.72 }

const titleStyle: CSSProperties = {
  margin: '2px 0 0',
  font: `900 26px ${HUD.font}`,
  lineHeight: 1.05,
  letterSpacing: 0.5,
}

const statsBoxStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
  gap: 2,
  font: `800 12px ${HUD.font}`,
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
  gridTemplateColumns: 'auto minmax(260px, 1fr)',
  gap: 0,
}

const gridColumnStyle: CSSProperties = {
  padding: 16,
  display: 'grid',
  gap: 10,
  alignContent: 'start',
  background: HUD.paperShade,
  borderRight: outline,
}

const gridStyle: CSSProperties = {
  position: 'relative',
  width: BACKPACK_COLS * CELL + (BACKPACK_COLS - 1) * CELL_GAP,
  height: BACKPACK_ROWS * CELL + (BACKPACK_ROWS - 1) * CELL_GAP,
}

const cellStyle: CSSProperties = {
  position: 'absolute',
  width: CELL,
  height: CELL,
  padding: 0,
  borderRadius: 8,
  border: `2px dashed rgba(22, 26, 36, 0.28)`,
  background: 'rgba(247, 240, 225, 0.55)',
  cursor: 'pointer',
}

const tileStyle: CSSProperties = {
  position: 'absolute',
  borderRadius: 9,
  border: outline,
  boxShadow: hardShadowSmall,
  display: 'grid',
  alignContent: 'center',
  justifyItems: 'center',
  gap: 1,
  padding: 2,
  // Les clics traversent la tuile : c'est la CASE en dessous qui les reçoit,
  // donc on n'a pas à recalculer quelle case a été visée.
  pointerEvents: 'none',
  overflow: 'hidden',
}

const tileIconStyle: CSSProperties = { fontSize: 17, lineHeight: 1 }

const tileNameStyle: CSSProperties = {
  font: `800 9px ${HUD.font}`,
  textAlign: 'center',
  lineHeight: 1.1,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}

const tileQtyStyle: CSSProperties = {
  position: 'absolute',
  right: 3,
  bottom: 2,
  font: `900 10px ${HUD.mono}`,
  color: HUD.ink,
}

const previewStyle: CSSProperties = {
  position: 'absolute',
  borderRadius: 9,
  border: outline,
  pointerEvents: 'none',
}

const handBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 30,
  padding: '6px 10px',
  borderRadius: 10,
  border: outlineThin,
  background: HUD.paper,
  font: `800 11px ${HUD.font}`,
}

const detailsStyle: CSSProperties = {
  padding: 16,
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  overflow: 'auto',
}

const sectionTitleStyle: CSSProperties = { ...sectionLabel }

const detailTitleStyle: CSSProperties = {
  margin: 0,
  font: `900 20px ${HUD.font}`,
  lineHeight: 1.14,
}

const priceStyle: CSSProperties = {
  padding: '3px 9px',
  borderRadius: 999,
  border: outlineThin,
  background: '#5aa832',
  color: HUD.paper,
  font: `800 12px ${HUD.font}`,
}

const weightPillStyle: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 999,
  border: outlineThin,
  background: HUD.paper,
  color: HUD.text,
  font: `800 12px ${HUD.font}`,
}

const legalityPillStyle: CSSProperties = { ...weightPillStyle, color: HUD.ink }

const stackPillStyle: CSSProperties = { ...weightPillStyle, background: '#c9b6ef' }

const descriptionStyle: CSSProperties = {
  color: HUD.text,
  font: `700 12px ${HUD.font}`,
  lineHeight: 1.45,
}

const effectPillStyle: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 999,
  border: outlineThin,
  background: HUD.paper,
  color: HUD.text,
  font: `800 11px ${HUD.font}`,
}

const durationPillStyle: CSSProperties = { ...effectPillStyle, background: '#9ed3ef' }

const primaryButtonStyle: CSSProperties = {
  minHeight: 34,
  padding: '0 14px',
  borderRadius: 10,
  border: outline,
  background: '#ffd83d',
  color: HUD.ink,
  cursor: 'pointer',
  font: `800 13px ${HUD.font}`,
  boxShadow: hardShadowSmall,
}

const dangerButtonStyle: CSSProperties = { ...primaryButtonStyle, background: '#e63946', color: HUD.paper }

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

const slotStyle: CSSProperties = {
  minHeight: 34,
  padding: '5px 9px',
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

const slotLabelStyle: CSSProperties = { color: HUD.textDim, font: `800 11px ${HUD.font}` }

const slotItemStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  font: `800 12px ${HUD.font}`,
}

const emptyStyle: CSSProperties = {
  minHeight: 90,
  display: 'grid',
  placeItems: 'center',
  color: HUD.textDim,
  border: `2px dashed ${HUD.ink}`,
  borderRadius: 11,
  font: `800 13px ${HUD.font}`,
}

const messageStyle: CSSProperties = {
  minHeight: 34,
  padding: '8px 16px',
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
