import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 📐 Volets lateraux de l'editeur : redimensionnables et repliables.
 *
 * La carte est la zone utile ; les volets doivent pouvoir s'effacer. On peut donc tirer leur
 * bord pour changer leur largeur, ou les replier d'un clic. Les largeurs et l'etat replie sont
 * gardes en `localStorage`, pour ne pas avoir a tout reregler a chaque rechargement.
 *
 * L'implementation passe par une variable CSS (`--left-width` / `--right-width`) posee sur la
 * grille `.editor-shell`, plutot que par un style en ligne sur chaque volet : c'est la grille
 * qui decide des colonnes, donc c'est elle qu'il faut piloter.
 */

const MIN_WIDTH = 180
const MAX_WIDTH = 560
const STORAGE_KEY = 'pls-editor-panels'

export type PanelSide = 'left' | 'right'

interface PanelLayout {
  leftWidth: number
  rightWidth: number
  leftCollapsed: boolean
  rightCollapsed: boolean
}

const DEFAULT_LAYOUT: PanelLayout = {
  leftWidth: 250,
  rightWidth: 300,
  leftCollapsed: false,
  rightCollapsed: false,
}

function clampWidth(value: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))
}

function readLayout(): PanelLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw) as Partial<PanelLayout>
    return {
      leftWidth: clampWidth(Number(parsed.leftWidth) || DEFAULT_LAYOUT.leftWidth),
      rightWidth: clampWidth(Number(parsed.rightWidth) || DEFAULT_LAYOUT.rightWidth),
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
    }
  } catch {
    // localStorage illisible (mode prive, quota...) : on repart sur les valeurs par defaut.
    return DEFAULT_LAYOUT
  }
}

export interface EditorPanelsApi {
  layout: PanelLayout
  toggle: (side: PanelSide) => void
  /** Style a poser sur `.editor-shell` : donne les largeurs de colonnes a la grille. */
  shellStyle: React.CSSProperties
  /** Poignee de redimensionnement a placer entre un volet et la carte. */
  renderHandle: (side: PanelSide) => ReactNode
}

export function useEditorPanels(): EditorPanelsApi {
  const [layout, setLayout] = useState<PanelLayout>(readLayout)
  const dragRef = useRef<{ side: PanelSide; startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    } catch {
      // Pas de persistance possible : ce n'est pas bloquant, on continue.
    }
  }, [layout])

  const toggle = useCallback((side: PanelSide) => {
    setLayout((current) =>
      side === 'left'
        ? { ...current, leftCollapsed: !current.leftCollapsed }
        : { ...current, rightCollapsed: !current.rightCollapsed },
    )
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      // Le volet de droite grandit quand la souris va vers la GAUCHE : d'ou le signe inverse.
      const delta = drag.side === 'left' ? event.clientX - drag.startX : drag.startX - event.clientX
      const width = clampWidth(drag.startWidth + delta)
      setLayout((current) => (drag.side === 'left' ? { ...current, leftWidth: width } : { ...current, rightWidth: width }))
    }
    const onUp = () => {
      dragRef.current = null
      document.body.classList.remove('editor-resizing')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const startDrag = (side: PanelSide, event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      side,
      startX: event.clientX,
      startWidth: side === 'left' ? layout.leftWidth : layout.rightWidth,
    }
    // Empeche la selection de texte et garde le curseur de redimensionnement partout.
    document.body.classList.add('editor-resizing')
  }

  const renderHandle = (side: PanelSide) => {
    const collapsed = side === 'left' ? layout.leftCollapsed : layout.rightCollapsed
    if (collapsed) return null
    return (
      <div
        className={`panel-handle panel-handle-${side}`}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionner le volet ${side === 'left' ? 'gauche' : 'droite'}`}
        onPointerDown={(event) => startDrag(side, event)}
        onDoubleClick={() => toggle(side)}
        title="Tirer pour redimensionner, double-clic pour replier"
      />
    )
  }

  const shellStyle = {
    '--left-width': `${layout.leftCollapsed ? 0 : layout.leftWidth}px`,
    '--right-width': `${layout.rightCollapsed ? 0 : layout.rightWidth}px`,
  } as React.CSSProperties

  return { layout, toggle, shellStyle, renderHandle }
}

/** Petit bouton fleche qui replie ou deplie un volet. */
export function PanelToggle({
  side,
  collapsed,
  onToggle,
}: {
  side: PanelSide
  collapsed: boolean
  onToggle: () => void
}) {
  const label = side === 'left' ? 'volet gauche' : 'volet droite'
  // La fleche pointe toujours vers l'endroit ou le volet va aller.
  const arrow = side === 'left' ? (collapsed ? '›' : '‹') : collapsed ? '‹' : '›'
  return (
    <button
      type="button"
      className={`panel-toggle panel-toggle-${side}`}
      onClick={onToggle}
      title={`${collapsed ? 'Afficher' : 'Masquer'} le ${label}`}
      aria-label={`${collapsed ? 'Afficher' : 'Masquer'} le ${label}`}
    >
      {arrow}
    </button>
  )
}
