import { useMemo, useState, type FormEvent } from 'react'
import runBibleFile from '../data/runBible.json'

type View = 'timeline' | 'endings' | 'paths' | 'entities' | 'audit'
type EndingType = 'escape' | 'death' | 'special'
type EntityType = 'character' | 'location' | 'item' | 'faction' | 'info' | 'radio' | 'system'

interface RunBibleSettings {
  realDurationMinutes: number
  inGameDays: number
}

interface Ending {
  id: string
  name: string
  type: EndingType
  conditions: string
  consequences: string
  notes: string
  status: string
}

interface RunPath {
  id: string
  name: string
  endingId: string
  summary: string
  steps: PathStep[]
  notes: string
}

interface PathStep {
  id: string
  title: string
  requirements: string
  methods: string
  links: string
}

interface TimelineEvent {
  id: string
  minute: number
  title: string
  effects: string
  links: string
  notes: string
}

interface Entity {
  id: string
  name: string
  type: EntityType
  description: string
  links: string
  notes: string
}

interface RunBibleData {
  version: number
  settings: RunBibleSettings
  endings: Ending[]
  paths: RunPath[]
  events: TimelineEvent[]
  entities: Entity[]
}

const DEFAULT_STATUS = 'idee'
const ENDING_TYPES: EndingType[] = ['escape', 'death', 'special']
const ENTITY_TYPES: EntityType[] = ['character', 'location', 'item', 'faction', 'info', 'radio', 'system']
const TABS: { key: View; label: string }[] = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'endings', label: 'Fins' },
  { key: 'paths', label: 'Chemins' },
  { key: 'entities', label: 'Entites' },
  { key: 'audit', label: 'Audit' },
]

export default function RunBibleApp() {
  const [data, setData] = useState<RunBibleData>(() => normalizeRunBible(runBibleFile as RunBibleData))
  const [view, setView] = useState<View>('timeline')
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('Pret')

  const audit = useMemo(() => buildAudit(data), [data])
  const timeRatio = useMemo(() => getTimeRatio(data.settings), [data.settings])

  const update = (next: RunBibleData) => {
    setData(next)
    setDirty(true)
    setStatus('Modifications non enregistrees')
  }

  const save = async () => {
    setStatus('Enregistrement...')
    const response = await fetch('/__pls/run-bible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      setStatus(`Echec : ${await response.text()}`)
      return
    }
    setDirty(false)
    setStatus('Run bible enregistree')
  }

  return (
    <main className="run-bible-shell">
      <header className="run-bible-header">
        <div>
          <p className="eyebrow">PLS design tool</p>
          <h1>Run Bible</h1>
          <p>
            {data.settings.realDurationMinutes} min IRL = {data.settings.inGameDays} jours IG. 1 heure IG ={' '}
            {formatRealDuration(timeRatio.realSecondsPerGameHour)} IRL.
          </p>
        </div>
        <div className="header-actions">
          <span className={dirty ? 'save-state dirty' : 'save-state'}>{status}</span>
          <button className="primary" type="button" onClick={save}>
            Enregistrer
          </button>
        </div>
      </header>

      <section className="settings-panel">
        <NumberField
          label="Minutes IRL"
          value={data.settings.realDurationMinutes}
          min={10}
          onChange={(value) => update({ ...data, settings: { ...data.settings, realDurationMinutes: value } })}
        />
        <NumberField
          label="Jours IG"
          value={data.settings.inGameDays}
          min={1}
          onChange={(value) => update({ ...data, settings: { ...data.settings, inGameDays: value } })}
        />
        <div className="ratio-grid">
          <strong>Jour IG</strong>
          <span>{formatRealDuration(timeRatio.realSecondsPerGameDay)} IRL</span>
          <strong>Heure IG</strong>
          <span>{formatRealDuration(timeRatio.realSecondsPerGameHour)} IRL</span>
        </div>
      </section>

      <nav className="run-tabs">
        {TABS.map((tab) => (
          <button
            className={tab.key === view ? 'active' : ''}
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {view === 'timeline' && <TimelineView data={data} update={update} />}
      {view === 'endings' && <EndingsView data={data} update={update} />}
      {view === 'paths' && <PathsView data={data} update={update} />}
      {view === 'entities' && <EntitiesView data={data} update={update} />}
      {view === 'audit' && <AuditView issues={audit} />}
    </main>
  )
}

function TimelineView({ data, update }: { data: RunBibleData; update: (data: RunBibleData) => void }) {
  const sorted = [...data.events].sort((a, b) => a.minute - b.minute)

  const addEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const item: TimelineEvent = {
      id: makeId('event'),
      minute: clampNumber(Number(form.get('minute') || 0), 0, data.settings.realDurationMinutes),
      title: String(form.get('title') || '').trim(),
      effects: String(form.get('effects') || '').trim(),
      links: String(form.get('links') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
    }
    if (!item.title) return
    event.currentTarget.reset()
    update({ ...data, events: [...data.events, item] })
  }

  return (
    <section className="workspace-grid">
      <form className="panel form-panel" onSubmit={addEvent}>
        <h2>Ajouter un evenement</h2>
        <label>
          Minute IRL
          <input name="minute" type="number" min={0} max={data.settings.realDurationMinutes} defaultValue={0} />
        </label>
        <label>
          Titre
          <input name="title" />
        </label>
        <label>
          Effets
          <textarea name="effects" rows={4} />
        </label>
        <label>
          Liens
          <textarea name="links" rows={3} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>
        <button className="primary" type="submit">
          Ajouter
        </button>
      </form>

      <section className="panel">
        <h2>Timeline</h2>
        <div className="timeline-list">
          {sorted.map((item) => (
            <article className="timeline-card" key={item.id}>
              <div>
                <strong>{formatClock(item.minute)}</strong>
                <span>{toGameTimeLabel(item.minute, data.settings)}</span>
              </div>
              <EditableCard
                title={item.title}
                body={item.effects}
                meta={item.links}
                notes={item.notes}
                onEdit={() => {
                  const title = window.prompt('Titre', item.title)?.trim() ?? item.title
                  const effects = window.prompt('Effets', item.effects)?.trim() ?? item.effects
                  const links = window.prompt('Liens', item.links)?.trim() ?? item.links
                  const notes = window.prompt('Notes', item.notes)?.trim() ?? item.notes
                  update({
                    ...data,
                    events: data.events.map((event) =>
                      event.id === item.id ? { ...event, title, effects, links, notes } : event,
                    ),
                  })
                }}
                onDelete={() => update({ ...data, events: data.events.filter((event) => event.id !== item.id) })}
              />
            </article>
          ))}
          {sorted.length === 0 && <p className="empty">Aucun evenement pose.</p>}
        </div>
      </section>
    </section>
  )
}

function EndingsView({ data, update }: { data: RunBibleData; update: (data: RunBibleData) => void }) {
  const addEnding = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const item: Ending = {
      id: makeId('ending'),
      name: String(form.get('name') || '').trim(),
      type: String(form.get('type') || 'escape') as EndingType,
      conditions: String(form.get('conditions') || '').trim(),
      consequences: String(form.get('consequences') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      status: String(form.get('status') || DEFAULT_STATUS).trim() || DEFAULT_STATUS,
    }
    if (!item.name) return
    event.currentTarget.reset()
    update({ ...data, endings: [...data.endings, item] })
  }

  return (
    <section className="workspace-grid">
      <form className="panel form-panel" onSubmit={addEnding}>
        <h2>Ajouter une fin</h2>
        <label>
          Nom
          <input name="name" />
        </label>
        <label>
          Type
          <select name="type" defaultValue="escape">
            {ENDING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Etat
          <input name="status" defaultValue={DEFAULT_STATUS} />
        </label>
        <label>
          Conditions
          <textarea name="conditions" rows={4} />
        </label>
        <label>
          Consequences
          <textarea name="consequences" rows={3} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>
        <button className="primary" type="submit">
          Ajouter
        </button>
      </form>

      <CardList
        empty="Aucune fin definie."
        items={data.endings.map((item) => ({
          id: item.id,
          title: item.name,
          meta: `${item.type} - ${item.status}`,
          body: item.conditions,
          notes: [item.consequences, item.notes].filter(Boolean).join('\n\n'),
          onEdit: () => {
            const name = window.prompt('Nom', item.name)?.trim() ?? item.name
            const conditions = window.prompt('Conditions', item.conditions)?.trim() ?? item.conditions
            const consequences = window.prompt('Consequences', item.consequences)?.trim() ?? item.consequences
            const notes = window.prompt('Notes', item.notes)?.trim() ?? item.notes
            update({
              ...data,
              endings: data.endings.map((ending) =>
                ending.id === item.id ? { ...ending, name, conditions, consequences, notes } : ending,
              ),
            })
          },
          onDelete: () => update({ ...data, endings: data.endings.filter((ending) => ending.id !== item.id) }),
        }))}
        title="Fins"
      />
    </section>
  )
}

function PathsView({ data, update }: { data: RunBibleData; update: (data: RunBibleData) => void }) {
  const addPath = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const item: RunPath = {
      id: makeId('path'),
      name: String(form.get('name') || '').trim(),
      endingId: String(form.get('endingId') || ''),
      summary: String(form.get('summary') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      steps: [],
    }
    if (!item.name) return
    event.currentTarget.reset()
    update({ ...data, paths: [...data.paths, item] })
  }

  const addStep = (pathId: string) => {
    const title = window.prompt('Titre de l etape ?')?.trim()
    if (!title) return
    update({
      ...data,
      paths: data.paths.map((path) =>
        path.id === pathId
          ? {
              ...path,
              steps: [
                ...path.steps,
                { id: makeId('step'), title, requirements: '', methods: '', links: '', },
              ],
            }
          : path,
      ),
    })
  }

  return (
    <section className="workspace-grid">
      <form className="panel form-panel" onSubmit={addPath}>
        <h2>Ajouter un chemin</h2>
        <label>
          Nom
          <input name="name" />
        </label>
        <label>
          Fin visee
          <select name="endingId" defaultValue="">
            <option value="">Non lie</option>
            {data.endings.map((ending) => (
              <option key={ending.id} value={ending.id}>
                {ending.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Resume
          <textarea name="summary" rows={4} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>
        <button className="primary" type="submit">
          Ajouter
        </button>
      </form>

      <section className="panel">
        <h2>Chemins</h2>
        <div className="card-list">
          {data.paths.map((path) => {
            const ending = data.endings.find((item) => item.id === path.endingId)
            return (
              <article className="idea-card" key={path.id}>
                <div className="card-head">
                  <div>
                    <strong>{path.name}</strong>
                    <span>{ending ? `Fin : ${ending.name}` : 'Fin non liee'}</span>
                  </div>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      const name = window.prompt('Nom', path.name)?.trim() ?? path.name
                      const summary = window.prompt('Resume', path.summary)?.trim() ?? path.summary
                      const notes = window.prompt('Notes', path.notes)?.trim() ?? path.notes
                      update({
                        ...data,
                        paths: data.paths.map((item) => (item.id === path.id ? { ...item, name, summary, notes } : item)),
                      })
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    className="danger"
                    type="button"
                    onClick={() => update({ ...data, paths: data.paths.filter((item) => item.id !== path.id) })}
                  >
                    Supprimer
                  </button>
                </div>
                {path.summary && <p>{path.summary}</p>}
                <div className="step-list">
                  {path.steps.map((step, index) => (
                    <div className="step-card" key={step.id}>
                      <strong>
                        {index + 1}. {step.title}
                      </strong>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => {
                          const methods = window.prompt('Methodes alternatives', step.methods)?.trim() ?? step.methods
                          update({
                            ...data,
                            paths: data.paths.map((item) =>
                              item.id === path.id
                                ? {
                                    ...item,
                                    steps: item.steps.map((current) =>
                                      current.id === step.id ? { ...current, methods } : current,
                                    ),
                                  }
                                : item,
                            ),
                          })
                        }}
                      >
                        Methodes
                      </button>
                      {step.methods && <p>{step.methods}</p>}
                    </div>
                  ))}
                </div>
                <div className="card-actions">
                  <button className="secondary" type="button" onClick={() => addStep(path.id)}>
                    Ajouter etape
                  </button>
                </div>
              </article>
            )
          })}
          {data.paths.length === 0 && <p className="empty">Aucun chemin defini.</p>}
        </div>
      </section>
    </section>
  )
}

function EntitiesView({ data, update }: { data: RunBibleData; update: (data: RunBibleData) => void }) {
  const addEntity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const item: Entity = {
      id: makeId('entity'),
      name: String(form.get('name') || '').trim(),
      type: String(form.get('type') || 'character') as EntityType,
      description: String(form.get('description') || '').trim(),
      links: String(form.get('links') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
    }
    if (!item.name) return
    event.currentTarget.reset()
    update({ ...data, entities: [...data.entities, item] })
  }

  return (
    <section className="workspace-grid">
      <form className="panel form-panel" onSubmit={addEntity}>
        <h2>Ajouter une entite</h2>
        <label>
          Nom
          <input name="name" />
        </label>
        <label>
          Type
          <select name="type" defaultValue="character">
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea name="description" rows={4} />
        </label>
        <label>
          Liens
          <textarea name="links" rows={3} />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>
        <button className="primary" type="submit">
          Ajouter
        </button>
      </form>

      <CardList
        empty="Aucune entite definie."
        items={data.entities.map((item) => ({
          id: item.id,
          title: item.name,
          meta: item.type,
          body: item.description,
          notes: [item.links, item.notes].filter(Boolean).join('\n\n'),
          onEdit: () => {
            const name = window.prompt('Nom', item.name)?.trim() ?? item.name
            const description = window.prompt('Description', item.description)?.trim() ?? item.description
            const links = window.prompt('Liens', item.links)?.trim() ?? item.links
            const notes = window.prompt('Notes', item.notes)?.trim() ?? item.notes
            update({
              ...data,
              entities: data.entities.map((entity) =>
                entity.id === item.id ? { ...entity, name, description, links, notes } : entity,
              ),
            })
          },
          onDelete: () => update({ ...data, entities: data.entities.filter((entity) => entity.id !== item.id) }),
        }))}
        title="Entites"
      />
    </section>
  )
}

function AuditView({ issues }: { issues: string[] }) {
  return (
    <section className="panel audit-panel">
      <h2>Audit non bloquant</h2>
      {issues.length === 0 ? (
        <p className="empty">Aucun probleme structurel detecte.</p>
      ) : (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CardList({
  empty,
  items,
  title,
}: {
  empty: string
  items: {
    id: string
    title: string
    meta: string
    body: string
    notes: string
    onDelete: () => void
    onEdit?: () => void
  }[]
  title: string
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="card-list">
        {items.map((item) => (
          <EditableCard
            body={item.body}
            key={item.id}
            meta={item.meta}
            notes={item.notes}
            onDelete={item.onDelete}
            onEdit={item.onEdit}
            title={item.title}
          />
        ))}
        {items.length === 0 && <p className="empty">{empty}</p>}
      </div>
    </section>
  )
}

function EditableCard({
  body,
  meta,
  notes,
  onDelete,
  onEdit,
  title,
}: {
  body: string
  meta: string
  notes: string
  onDelete: () => void
  onEdit?: () => void
  title: string
}) {
  return (
    <article className="idea-card">
      <div className="card-head">
        <div>
          <strong>{title}</strong>
          {meta && <span>{meta}</span>}
        </div>
        <div className="inline-actions">
          {onEdit && (
            <button className="ghost" type="button" onClick={onEdit}>
              Modifier
            </button>
          )}
          <button className="danger" type="button" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      </div>
      {body && <p>{body}</p>}
      {notes && <pre>{notes}</pre>}
    </article>
  )
}

function NumberField({
  label,
  min,
  onChange,
  value,
}: {
  label: string
  min: number
  onChange: (value: number) => void
  value: number
}) {
  return (
    <label>
      {label}
      <input type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function buildAudit(data: RunBibleData): string[] {
  const issues: string[] = []
  const endingIds = new Set(data.endings.map((ending) => ending.id))
  const linkedEndingIds = new Set(data.paths.map((path) => path.endingId).filter(Boolean))

  for (const ending of data.endings) {
    if (!linkedEndingIds.has(ending.id)) issues.push(`Fin sans chemin : ${ending.name}`)
    if (!ending.conditions.trim()) issues.push(`Fin sans conditions : ${ending.name}`)
  }

  for (const path of data.paths) {
    if (!path.endingId) issues.push(`Chemin sans fin liee : ${path.name}`)
    if (path.endingId && !endingIds.has(path.endingId)) issues.push(`Chemin lie a une fin introuvable : ${path.name}`)
    if (path.steps.length === 0) issues.push(`Chemin sans etape : ${path.name}`)
    if (path.steps.length === 1) issues.push(`Chemin tres lineaire : ${path.name}`)
    for (const step of path.steps) {
      if (!step.methods.trim()) issues.push(`Etape sans methode alternative : ${path.name} / ${step.title}`)
    }
  }

  for (const event of data.events) {
    if (event.minute > data.settings.realDurationMinutes) issues.push(`Evenement apres la fin de run : ${event.title}`)
  }

  return issues
}

function normalizeRunBible(input: RunBibleData): RunBibleData {
  return {
    version: input.version || 1,
    settings: {
      realDurationMinutes: input.settings?.realDurationMinutes || 90,
      inGameDays: input.settings?.inGameDays || 3,
    },
    endings: input.endings || [],
    paths: input.paths || [],
    events: input.events || [],
    entities: input.entities || [],
  }
}

function getTimeRatio(settings: RunBibleSettings) {
  const totalRealSeconds = settings.realDurationMinutes * 60
  const realSecondsPerGameDay = totalRealSeconds / settings.inGameDays
  const realSecondsPerGameHour = realSecondsPerGameDay / 24
  return { realSecondsPerGameDay, realSecondsPerGameHour }
}

function toGameTimeLabel(realMinute: number, settings: RunBibleSettings): string {
  const totalGameMinutes = settings.inGameDays * 24 * 60
  const gameMinute = Math.floor((realMinute / settings.realDurationMinutes) * totalGameMinutes)
  const day = Math.floor(gameMinute / (24 * 60)) + 1
  const minuteOfDay = gameMinute % (24 * 60)
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  return `Jour ${day}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatClock(minute: number): string {
  const safeMinute = Math.max(0, Math.floor(minute))
  return `${String(Math.floor(safeMinute / 60)).padStart(2, '0')}:${String(safeMinute % 60).padStart(2, '0')}`
}

function formatRealDuration(seconds: number): string {
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (minutes <= 0) return `${rest} s`
  return `${minutes} min ${String(rest).padStart(2, '0')}`
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
