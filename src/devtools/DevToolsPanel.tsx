import { useMemo, useState } from 'react'
import { useCharacterStatsStore } from '../gameplay/stats/characterStatsStore'
import { useGameTimeStore } from '../gameplay/time/gameTimeStore'
import { getGroups } from './devTuningGroups'
import { DEV_TUNING_FIELDS } from './devTuningSchema'
import {
  getBaseValue,
  getCameraTuning,
  getInventoryTuning,
  getPlayerTuning,
  getSkyTuning,
  getVehicleTuning,
  useDevTuningStore,
} from './devTuningStore'
import type { DevFieldLevel, DevSectionId, DevTuningField } from './devTuningTypes'
import { getPathValue } from './devTuningUtils'
import HelpPanel from './panel/HelpPanel'
import JsonTools from './panel/JsonTools'
import SavedPresetsTools from './panel/SavedPresetsTools'
import StatsTools from './panel/StatsTools'
import TimeTools from './panel/TimeTools'
import TuningSection from './panel/TuningSection'
import {
  activeTabStyle,
  activeToggleStyle,
  backdropStyle,
  bodyStyle,
  buttonStyle,
  footerStyle,
  ghostButtonStyle,
  headerStyle,
  noticeStyle,
  panelStyle,
  scrollAreaStyle,
  searchInputStyle,
  smallButtonStyle,
  splitBodyStyle,
  subtitleStyle,
  tabStyle,
  tabsStyle,
  titleStyle,
} from './panel/devPanelStyles'

type TabId = DevSectionId | 'stats' | 'time' | 'presets' | 'json'

const TABS: { id: TabId; label: string }[] = [
  { id: 'car', label: '🚗 Voiture' },
  { id: 'scooter', label: '🛵 Scooter' },
  { id: 'player', label: '🚶 Joueur' },
  { id: 'camera', label: '🎥 Camera' },
  { id: 'inventory', label: '🎒 Inventaire' },
  { id: 'sky', label: '🌤️ Ciel' },
  { id: 'stats', label: '❤️ Stats' },
  { id: 'time', label: '🕒 Temps' },
  { id: 'presets', label: '⭐ Mes reglages' },
  { id: 'json', label: '{ } JSON' },
]

const TUNING_TABS: DevSectionId[] = ['car', 'scooter', 'player', 'camera', 'inventory', 'sky']

/**
 * Panneau de reglages `F2` (DEV uniquement).
 *
 * Il est concu pour etre utilisable SANS lire le code : noms en francais,
 * descriptions, categories, prereglages, valeur d origine visible et bouton de
 * retour arriere sur chaque reglage. Le detail de chaque brique vit dans
 * `panel/`, le contenu des reglages dans `schema/`.
 */
export default function DevToolsPanel() {
  const isOpen = useDevTuningStore((s) => s.isOpen)
  const overrides = useDevTuningStore((s) => s.overrides)
  const projectStatus = useDevTuningStore((s) => s.projectStatus)
  const compareMode = useDevTuningStore((s) => s.compareMode)
  const setNumber = useDevTuningStore((s) => s.setNumber)
  const setNumbers = useDevTuningStore((s) => s.setNumbers)
  const resetPath = useDevTuningStore((s) => s.resetPath)
  const resetPaths = useDevTuningStore((s) => s.resetPaths)
  const resetLocal = useDevTuningStore((s) => s.resetLocal)
  const revertSession = useDevTuningStore((s) => s.revertSession)
  const toggleCompare = useDevTuningStore((s) => s.toggleCompare)
  const importJson = useDevTuningStore((s) => s.importJson)
  const exportJson = useDevTuningStore((s) => s.exportJson)
  const loadProjectTuning = useDevTuningStore((s) => s.loadProjectTuning)

  const [tab, setTab] = useState<TabId>('car')
  const [level, setLevel] = useState<DevFieldLevel>('simple')
  const [search, setSearch] = useState('')
  const [selectedField, setSelectedField] = useState<DevTuningField | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [jsonInfo, setJsonInfo] = useState<string | null>(null)

  const totalMinutes = useGameTimeStore((s) => s.totalMinutes)
  const timeScale = useGameTimeStore((s) => s.timeScale)
  const isPaused = useGameTimeStore((s) => s.isPaused)
  const stats = useCharacterStatsStore()

  // Valeurs actives (defauts du code + overrides projet + overrides locaux).
  const values = useMemo(
    () => ({
      player: getPlayerTuning(),
      vehicles: { car: getVehicleTuning('car'), scooter: getVehicleTuning('scooter') },
      camera: getCameraTuning(),
      inventory: getInventoryTuning(),
      sky: getSkyTuning(),
    }),
    [overrides],
  )

  const getValue = (path: string): number | undefined => {
    const raw = getPathValue(values, path)
    return typeof raw === 'number' ? raw : undefined
  }

  const modifiedCount = useMemo(
    () =>
      DEV_TUNING_FIELDS.filter((field) => {
        const raw = getPathValue(values, field.id)
        const base = getBaseValue(field.id)
        return typeof raw === 'number' && base !== undefined && Math.abs(raw - base) > 1e-9
      }).length,
    [values],
  )

  if (!import.meta.env.DEV || !isOpen) return null

  const isTuningTab = TUNING_TABS.includes(tab as DevSectionId)
  const section = tab as DevSectionId
  const activeGroup = isTuningTab
    ? (getGroups(section).find((group) => group.id === (selectedField?.group ?? activeGroupId)) ?? null)
    : null

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
            <div style={titleStyle}>Reglages du jeu (outil dev)</div>
            <div style={subtitleStyle}>
              F2 pour fermer · {modifiedCount} reglage(s) modifie(s) · fichier projet :{' '}
              {getProjectStatusLabel(projectStatus)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isTuningTab && (
              <>
                <input
                  style={searchInputStyle}
                  placeholder="Rechercher un reglage..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <button
                  type="button"
                  style={level === 'simple' ? activeToggleStyle : ghostButtonStyle}
                  title="Seulement les reglages qui changent le ressenti"
                  onClick={() => setLevel('simple')}
                >
                  Simple
                </button>
                <button
                  type="button"
                  style={level === 'advanced' ? activeToggleStyle : ghostButtonStyle}
                  title="Tous les reglages, y compris les valeurs techniques"
                  onClick={() => setLevel('advanced')}
                >
                  Avance
                </button>
              </>
            )}
            <button style={smallButtonStyle} onClick={() => useDevTuningStore.getState().setOpen(false)}>
              X
            </button>
          </div>
        </header>

        <nav style={tabsStyle}>
          {TABS.map((item) => (
            <button
              key={item.id}
              style={item.id === tab ? activeTabStyle : tabStyle}
              onClick={() => {
                setTab(item.id)
                setSelectedField(null)
                setActiveGroupId(null)
                if (item.id === 'json') setJsonText(exportJson())
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main style={isTuningTab ? splitBodyStyle : bodyStyle}>
          <div style={scrollAreaStyle}>
            {compareMode && (
              <div style={noticeStyle}>
                Mode avant / apres : le jeu tourne avec les valeurs d avant l ouverture du panneau.
                Les reglages sont bloques le temps de comparer.
              </div>
            )}

            {isTuningTab && (
              <TuningSection
                section={section}
                level={level}
                search={search}
                disabled={compareMode}
                getValue={getValue}
                getBase={getBaseValue}
                onChange={setNumber}
                onChangeMany={setNumbers}
                onResetField={resetPath}
                onResetPaths={resetPaths}
                onSelectField={setSelectedField}
                onSelectGroup={setActiveGroupId}
                activeGroupId={activeGroupId}
              />
            )}
            {tab === 'stats' && <StatsTools stats={stats} />}
            {tab === 'time' && (
              <TimeTools totalMinutes={totalMinutes} timeScale={timeScale} isPaused={isPaused} />
            )}
            {tab === 'presets' && <SavedPresetsTools />}
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
          </div>

          {isTuningTab && (
            <HelpPanel
              field={selectedField}
              group={activeGroup}
              value={selectedField ? getValue(selectedField.id) : undefined}
              baseValue={selectedField ? getBaseValue(selectedField.id) : undefined}
            />
          )}
        </main>

        <footer style={footerStyle}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              style={compareMode ? activeToggleStyle : ghostButtonStyle}
              title="Rejoue les valeurs d avant l ouverture du panneau, sans perdre tes changements"
              onClick={toggleCompare}
            >
              {compareMode ? 'Revenir a mes reglages' : 'Comparer avant / apres'}
            </button>
            <button
              style={ghostButtonStyle}
              title="Annule tout ce qui a ete change depuis l ouverture du panneau"
              onClick={revertSession}
            >
              Annuler mes changements
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={buttonStyle} onClick={resetLocal}>Tout remettre par defaut</button>
            <button style={buttonStyle} onClick={loadProjectTuning}>Recharger le fichier projet</button>
            <button
              style={buttonStyle}
              onClick={() => {
                setJsonText(exportJson())
                setTab('json')
              }}
            >
              Voir le JSON
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}

function getProjectStatusLabel(status: 'idle' | 'loaded' | 'missing' | 'error') {
  if (status === 'loaded') return 'dev-tuning.json charge'
  if (status === 'missing') return 'aucun fichier'
  if (status === 'error') return 'erreur JSON'
  return 'chargement'
}
