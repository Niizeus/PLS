import { useMemo, useState, type CSSProperties } from 'react'
import { useCarStore } from '../entities/vehicles/carStore'
import { useScooterStore } from '../entities/vehicles/scooterStore'
import { useCharacterStatsStore, type CharacterStats } from '../gameplay/stats/characterStatsStore'
import {
  MINUTES_PER_DAY,
  formatGameTime,
  getDayNumber,
  useGameTimeStore,
} from '../gameplay/time/gameTimeStore'
import { DEV_TUNING_FIELDS } from './devTuningSchema'
import {
  getCameraTuning,
  getInventoryTuning,
  getPlayerTuning,
  getSkyTuning,
  getVehicleTuning,
  useDevTuningStore,
} from './devTuningStore'
import type { DevTuningField } from './devTuningTypes'
import { getPathValue } from './devTuningUtils'

type TabId = 'player' | 'car' | 'scooter' | 'camera' | 'inventory' | 'sky' | 'stats' | 'time' | 'json'

const TABS: { id: TabId; label: string }[] = [
  { id: 'player', label: 'Joueur' },
  { id: 'car', label: 'Voiture' },
  { id: 'scooter', label: 'Scooter' },
  { id: 'camera', label: 'Camera' },
  { id: 'inventory', label: 'Inventaire' },
  { id: 'sky', label: 'Ciel' },
  { id: 'stats', label: 'Stats' },
  { id: 'time', label: 'Temps' },
  { id: 'json', label: 'JSON' },
]

const STAT_FIELDS: { key: keyof CharacterStats; label: string; max: number }[] = [
  { key: 'health', label: 'Vie', max: 100 },
  { key: 'hunger', label: 'Faim', max: 100 },
  { key: 'thirst', label: 'Soif', max: 100 },
  { key: 'mental', label: 'Mental', max: 100 },
  { key: 'attack', label: 'Attaque', max: 99 },
  { key: 'defense', label: 'Defense', max: 99 },
  { key: 'agility', label: 'Agilite', max: 99 },
  { key: 'chance', label: 'Chance', max: 99 },
  { key: 'speed', label: 'Vitesse stat', max: 99 },
  { key: 'chaos', label: 'Chaos', max: 99 },
]

export default function DevToolsPanel() {
  const isOpen = useDevTuningStore((s) => s.isOpen)
  const overrides = useDevTuningStore((s) => s.overrides)
  const projectStatus = useDevTuningStore((s) => s.projectStatus)
  const setNumber = useDevTuningStore((s) => s.setNumber)
  const resetLocal = useDevTuningStore((s) => s.resetLocal)
  const importJson = useDevTuningStore((s) => s.importJson)
  const exportJson = useDevTuningStore((s) => s.exportJson)
  const loadProjectTuning = useDevTuningStore((s) => s.loadProjectTuning)
  const [tab, setTab] = useState<TabId>('player')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [jsonInfo, setJsonInfo] = useState<string | null>(null)

  const player = getPlayerTuning()
  const car = getVehicleTuning('car')
  const scooter = getVehicleTuning('scooter')
  const camera = getCameraTuning()
  const inventory = getInventoryTuning()
  const sky = getSkyTuning()
  const totalMinutes = useGameTimeStore((s) => s.totalMinutes)
  const timeScale = useGameTimeStore((s) => s.timeScale)
  const isPaused = useGameTimeStore((s) => s.isPaused)
  const stats = useCharacterStatsStore()

  const values = useMemo(
    () => ({
      player,
      vehicles: { car, scooter },
      camera,
      inventory,
      sky,
    }),
    [overrides],
  )

  if (!import.meta.env.DEV || !isOpen) return null

  const fields = DEV_TUNING_FIELDS.filter((field) => field.section === tab)

  const applyJson = () => {
    try {
      importJson(jsonText)
      setJsonError(null)
      setJsonInfo('JSON importe en local.')
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'JSON invalide')
      setJsonInfo(null)
    }
  }

  const saveProjectJson = async () => {
    const message =
      'Confirmation requise.\n\n' +
      'Cette action va REMPLACER le fichier officiel du projet :\n' +
      'public/dev/dev-tuning.json\n\n' +
      'Les reglages actuels deviendront la base chargee par tout le projet en DEV.\n' +
      'Les overrides locaux du navigateur seront ensuite effaces.\n\n' +
      'Continuer ?'

    if (!window.confirm(message)) return

    try {
      const parsed = JSON.parse(jsonText) as unknown
      const prettyJson = JSON.stringify(parsed, null, 2)
      const response = await fetch('/__pls/dev-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: prettyJson,
      })
      if (!response.ok) throw new Error(await response.text())

      resetLocal()
      await loadProjectTuning()
      setJsonText(prettyJson)
      setJsonError(null)
      setJsonInfo('Fichier public/dev/dev-tuning.json mis a jour.')
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Sauvegarde impossible')
      setJsonInfo(null)
    }
  }

  return (
    <div
      style={backdropStyle}
      onKeyDownCapture={(event) => event.stopPropagation()}
      onKeyUpCapture={(event) => event.stopPropagation()}
      onPointerDownCapture={(event) => event.stopPropagation()}
      onPointerUpCapture={(event) => event.stopPropagation()}
    >
      <aside style={panelStyle}>
        <header style={headerStyle}>
          <div>
            <div style={titleStyle}>Outil dev PLS</div>
            <div style={subtitleStyle}>
              F2 pour fermer - projet: {getProjectStatusLabel(projectStatus)} - localStorage au-dessus
            </div>
          </div>
          <button style={smallButtonStyle} onClick={() => useDevTuningStore.getState().setOpen(false)}>
            X
          </button>
        </header>

        <nav style={tabsStyle}>
          {TABS.map((item) => (
            <button
              key={item.id}
              style={item.id === tab ? activeTabStyle : tabStyle}
              onClick={() => {
                setTab(item.id)
                if (item.id === 'json') setJsonText(exportJson())
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main style={bodyStyle}>
          {['player', 'car', 'scooter', 'camera', 'inventory', 'sky'].includes(tab) && (
            <FieldList fields={fields} values={values} onChange={setNumber} />
          )}
          {tab === 'stats' && <StatsTools stats={stats} />}
          {tab === 'time' && (
            <TimeTools totalMinutes={totalMinutes} timeScale={timeScale} isPaused={isPaused} />
          )}
          {tab === 'json' && (
            <JsonTools
              jsonText={jsonText}
              jsonError={jsonError}
              jsonInfo={jsonInfo}
              onChange={setJsonText}
              onApply={applyJson}
              onSaveProject={saveProjectJson}
              onRefresh={() => {
                setJsonText(exportJson())
                setJsonError(null)
                setJsonInfo(null)
              }}
            />
          )}
        </main>

        <footer style={footerStyle}>
          <button style={buttonStyle} onClick={resetLocal}>Reset local</button>
          <button style={buttonStyle} onClick={loadProjectTuning}>Recharger projet</button>
          <button
            style={buttonStyle}
            onClick={() => {
              setJsonText(exportJson())
              setTab('json')
            }}
          >
            Voir JSON
          </button>
        </footer>
      </aside>
    </div>
  )
}

function FieldList({
  fields,
  values,
  onChange,
}: {
  fields: DevTuningField[]
  values: Record<string, unknown>
  onChange: (path: string, value: number) => void
}) {
  return (
    <div style={fieldGridStyle}>
      {fields.map((field) => {
        const raw = getPathValue(values, field.id)
        const value = typeof raw === 'number' ? raw : field.min
        return (
          <label key={field.id} style={fieldStyle} title={field.help}>
            <span style={fieldTopStyle}>
              <span>{field.label}</span>
              <input
                style={numberInputStyle}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={roundForInput(value)}
                onChange={(event) => onChange(field.id, Number(event.target.value))}
              />
            </span>
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value}
              onChange={(event) => onChange(field.id, Number(event.target.value))}
            />
            <small style={helpStyle}>{field.help}</small>
          </label>
        )
      })}
    </div>
  )
}

function StatsTools({ stats }: { stats: CharacterStats }) {
  const setStat = (key: keyof CharacterStats, next: number) => {
    const current = useCharacterStatsStore.getState()[key]
    useCharacterStatsStore.getState().applyEffects({ [key]: next - current })
  }

  return (
    <div style={fieldGridStyle}>
      <div style={actionRowStyle}>
        <button style={buttonStyle} onClick={() => refillVitals()}>Refill vital</button>
        <button style={buttonStyle} onClick={() => refillFuel()}>Refill carburant</button>
      </div>
      {STAT_FIELDS.map((field) => (
        <label key={field.key} style={fieldStyle}>
          <span style={fieldTopStyle}>
            <span>{field.label}</span>
            <input
              style={numberInputStyle}
              type="number"
              min={0}
              max={field.max}
              step={1}
              value={stats[field.key]}
              onChange={(event) => setStat(field.key, Number(event.target.value))}
            />
          </span>
          <input
            type="range"
            min={0}
            max={field.max}
            step={1}
            value={stats[field.key]}
            onChange={(event) => setStat(field.key, Number(event.target.value))}
          />
        </label>
      ))}
    </div>
  )
}

function TimeTools({
  totalMinutes,
  timeScale,
  isPaused,
}: {
  totalMinutes: number
  timeScale: number
  isPaused: boolean
}) {
  const setHour = (hour: number) => {
    const currentDayStart = Math.floor(useGameTimeStore.getState().totalMinutes / MINUTES_PER_DAY) * MINUTES_PER_DAY
    useGameTimeStore.getState().setTotalMinutes(currentDayStart + hour * 60)
  }

  return (
    <div style={fieldGridStyle}>
      <div style={readoutStyle}>
        Jour {getDayNumber(totalMinutes)} - {formatGameTime(totalMinutes)} - x{timeScale}
      </div>
      <div style={actionRowStyle}>
        <button style={buttonStyle} onClick={() => useGameTimeStore.getState().setPaused(!isPaused)}>
          {isPaused ? 'Play' : 'Pause'}
        </button>
        {[1, 12, 60, 240, 720].map((scale) => (
          <button key={scale} style={buttonStyle} onClick={() => useGameTimeStore.getState().setTimeScale(scale)}>
            x{scale}
          </button>
        ))}
      </div>
      <div style={actionRowStyle}>
        <button style={buttonStyle} onClick={() => setHour(5.5)}>Aube</button>
        <button style={buttonStyle} onClick={() => setHour(12)}>Midi</button>
        <button style={buttonStyle} onClick={() => setHour(22)}>Nuit</button>
      </div>
      <label style={fieldStyle}>
        <span style={fieldTopStyle}>
          <span>Heure</span>
          <input
            style={numberInputStyle}
            type="number"
            min={0}
            max={23.75}
            step={0.25}
            value={Math.round(((totalMinutes % MINUTES_PER_DAY) / 60) * 4) / 4}
            onChange={(event) => setHour(Number(event.target.value))}
          />
        </span>
        <input
          type="range"
          min={0}
          max={23.75}
          step={0.25}
          value={(totalMinutes % MINUTES_PER_DAY) / 60}
          onChange={(event) => setHour(Number(event.target.value))}
        />
      </label>
    </div>
  )
}

function JsonTools({
  jsonText,
  jsonError,
  jsonInfo,
  onChange,
  onApply,
  onSaveProject,
  onRefresh,
}: {
  jsonText: string
  jsonError: string | null
  jsonInfo: string | null
  onChange: (json: string) => void
  onApply: () => void
  onSaveProject: () => void
  onRefresh: () => void
}) {
  return (
    <div style={jsonBoxStyle}>
      <textarea
        style={textareaStyle}
        spellCheck={false}
        value={jsonText}
        onChange={(event) => onChange(event.target.value)}
      />
      {jsonError && <div style={errorStyle}>{jsonError}</div>}
      {jsonInfo && <div style={infoStyle}>{jsonInfo}</div>}
      <div style={actionRowStyle}>
        <button style={buttonStyle} onClick={onRefresh}>Rafraichir</button>
        <button style={buttonStyle} onClick={onApply}>Importer</button>
        <button style={dangerButtonStyle} onClick={onSaveProject}>Ecrire dev-tuning.json</button>
      </div>
    </div>
  )
}

function refillVitals() {
  const store = useCharacterStatsStore.getState()
  store.applyEffects({
    health: 100 - store.health,
    hunger: 100 - store.hunger,
    thirst: 100 - store.thirst,
    mental: 100 - store.mental,
  })
}

function refillFuel() {
  useCarStore.setState((state) => ({ fuelLiters: state.fuelCapacityLiters }))
  useScooterStore.setState((state) => ({ fuelLiters: state.fuelCapacityLiters }))
}

function roundForInput(value: number): number {
  return Number(value.toFixed(3))
}

function getProjectStatusLabel(status: 'idle' | 'loaded' | 'missing' | 'error') {
  if (status === 'loaded') return 'dev-tuning.json charge'
  if (status === 'missing') return 'aucun fichier'
  if (status === 'error') return 'erreur JSON'
  return 'chargement'
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  pointerEvents: 'auto',
  background: 'rgba(3,7,18,0.32)',
}

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 18,
  right: 18,
  bottom: 18,
  width: 'min(760px, calc(100vw - 36px))',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  border: '1px solid rgba(148,163,184,0.34)',
  borderRadius: 8,
  background: 'rgba(15,23,42,0.96)',
  color: '#e5e7eb',
  fontFamily: 'system-ui, sans-serif',
  boxShadow: '0 24px 70px rgba(0,0,0,0.38)',
  overflow: 'hidden',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '14px 16px',
  borderBottom: '1px solid rgba(148,163,184,0.22)',
}

const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 900 }
const subtitleStyle: CSSProperties = { marginTop: 3, fontSize: 12, color: '#94a3b8' }

const tabsStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '10px 12px',
  borderBottom: '1px solid rgba(148,163,184,0.18)',
  overflowX: 'auto',
}

const tabStyle: CSSProperties = {
  border: '1px solid rgba(148,163,184,0.25)',
  borderRadius: 6,
  padding: '7px 10px',
  background: 'rgba(30,41,59,0.8)',
  color: '#cbd5e1',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const activeTabStyle: CSSProperties = {
  ...tabStyle,
  background: '#eab308',
  borderColor: '#facc15',
  color: '#111827',
  fontWeight: 800,
}

const bodyStyle: CSSProperties = { overflow: 'auto', padding: 14 }

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: 10,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 10,
  borderRadius: 6,
  background: 'rgba(30,41,59,0.72)',
  border: '1px solid rgba(148,163,184,0.18)',
}

const fieldTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 750,
}

const numberInputStyle: CSSProperties = {
  width: 76,
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 5,
  background: '#020617',
  color: '#e5e7eb',
  padding: '4px 6px',
  font: '12px ui-monospace, monospace',
}

const helpStyle: CSSProperties = { minHeight: 28, color: '#94a3b8', fontSize: 11, lineHeight: 1.25 }

const footerStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  padding: 12,
  borderTop: '1px solid rgba(148,163,184,0.18)',
}

const buttonStyle: CSSProperties = {
  border: '1px solid rgba(234,179,8,0.48)',
  borderRadius: 6,
  background: 'rgba(113,63,18,0.7)',
  color: '#fef3c7',
  padding: '7px 10px',
  fontWeight: 750,
  cursor: 'pointer',
}

const smallButtonStyle: CSSProperties = { ...buttonStyle, padding: '5px 9px' }
const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: 'rgba(248,113,113,0.58)',
  background: 'rgba(127,29,29,0.82)',
  color: '#fee2e2',
}

const actionRowStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
}

const readoutStyle: CSSProperties = {
  gridColumn: '1 / -1',
  padding: 10,
  borderRadius: 6,
  background: 'rgba(2,6,23,0.7)',
  color: '#f8fafc',
  fontWeight: 850,
}

const jsonBoxStyle: CSSProperties = { display: 'grid', gap: 10 }
const textareaStyle: CSSProperties = {
  minHeight: 420,
  resize: 'vertical',
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 6,
  background: '#020617',
  color: '#dbeafe',
  padding: 12,
  font: '12px ui-monospace, monospace',
  lineHeight: 1.5,
}
const errorStyle: CSSProperties = { color: '#fecaca', fontSize: 12, fontWeight: 700 }
const infoStyle: CSSProperties = { color: '#bbf7d0', fontSize: 12, fontWeight: 700 }
