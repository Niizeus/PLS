import { useMemo, useState, type CSSProperties } from 'react'
import scheduleFile from '../data/radioSchedule.json'
import { RADIO_STATIONS, type RadioStationId } from '../audio/radioCatalog'
import { DAYS_PER_WEEK, HOURS_PER_DAY, type RadioScheduleFile, type RadioSlot, type RadioSlotKind } from '../audio/radioSchedule'
import { MINUTES_PER_DAY, REAL_SECONDS_PER_GAME_DAY } from '../gameplay/time/gameTimeStore'
import { CELL, DAY_NAMES, KIND_COLORS, KIND_LABELS, page, toolbar } from './regieStyle'

/** 1 minute de jeu = 2,5 secondes réelles. */
const GAME_SECONDS_PER_GAME_MINUTE = REAL_SECONDS_PER_GAME_DAY / MINUTES_PER_DAY

/**
 * 🎛️ LA RÉGIE — grille de programmation 7 jours × 24 heures.
 *
 * Une case = une heure de jeu d'une station. On y pose une émission, de la
 * musique, de la pub, ou une coupure d'antenne. « Enregistrer » réécrit
 * `src/data/radioSchedule.json` via le plugin Vite, et le jeu recharge tout seul.
 *
 * L'écran montre deux choses qu'on ne devine pas autrement :
 *  - **le débordement** d'une émission (hachures) : une heure de jeu ne valant
 *    que 2 min 30 réelles, une émission de 14 minutes occupe 6 heures de grille.
 *    Sans cet affichage, on programmerait à l'aveugle ;
 *  - **la durée réelle** de chaque émission, lue au scan des fichiers.
 */
export default function ScheduleEditor() {
  const [slots, setSlots] = useState<RadioSlot[]>(() => (scheduleFile as RadioScheduleFile).slots)
  const [stationId, setStationId] = useState<RadioStationId>(RADIO_STATIONS[0].id)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const station = RADIO_STATIONS.find((s) => s.id === stationId)!

  /** Cases de la station courante, rangées par `jour|heure` pour un accès direct. */
  const byCell = useMemo(() => {
    const map = new Map<string, RadioSlot>()
    for (const slot of slots) {
      if (slot.station === stationId) map.set(`${slot.day}|${slot.hour}`, slot)
    }
    return map
  }, [slots, stationId])

  /** Durée d'une émission en HEURES DE JEU : c'est ce qui détermine son débordement. */
  const showLengthHours = useMemo(() => {
    const map = new Map<string, number>()
    for (const program of station.scheduledPrograms) {
      // On prend l'épisode le plus long : c'est le pire cas de débordement.
      const longest = Math.max(0, ...program.episodes.map((e) => e.durationSeconds))
      map.set(program.folder, longest / GAME_SECONDS_PER_GAME_MINUTE / 60)
    }
    return map
  }, [station])

  /**
   * Pour chaque case, l'émission qui l'occupe par débordement.
   *
   * On rejoue exactement la règle de `radioSchedule.ts` : une émission déborde
   * sur les cases vides ou « musique », s'arrête sur une pub, une coupure, une
   * autre émission, ou à minuit.
   */
  const spillover = useMemo(() => {
    const map = new Map<string, string>()
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
        const slot = byCell.get(`${day}|${hour}`)
        if (slot?.kind !== 'show' || !slot.show) continue
        const hours = showLengthHours.get(slot.show) ?? 0
        for (let h = hour + 1; h < Math.min(HOURS_PER_DAY, hour + Math.ceil(hours)); h++) {
          const next = byCell.get(`${day}|${h}`)
          if (next && next.kind !== 'music') break
          map.set(`${day}|${h}`, slot.show)
        }
      }
    }
    return map
  }, [byCell, showLengthHours])

  const setCell = (day: number, hour: number, kind: RadioSlotKind | null, show?: string) => {
    setDirty(true)
    setStatus(null)
    setSlots((current) => {
      const rest = current.filter((s) => !(s.station === stationId && s.day === day && s.hour === hour))
      if (!kind) return rest
      return [...rest, { station: stationId, day, hour, kind, ...(show ? { show } : {}) }]
    })
  }

  const copyDayToWeek = (from: number) => {
    setDirty(true)
    setStatus(null)
    setSlots((current) => {
      const source = current.filter((s) => s.station === stationId && s.day === from)
      const others = current.filter((s) => s.station !== stationId)
      const copies: RadioSlot[] = []
      for (let day = 0; day < DAYS_PER_WEEK; day++) {
        for (const slot of source) copies.push({ ...slot, day })
      }
      return [...others, ...copies]
    })
  }

  const save = async () => {
    setStatus('Enregistrement…')
    try {
      const ordered = [...slots].sort(
        (a, b) => a.station.localeCompare(b.station) || a.day - b.day || a.hour - b.hour,
      )
      const response = await fetch('/__pls/radio-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, slots: ordered }),
      })
      if (!response.ok) throw new Error(await response.text())
      setDirty(false)
      setStatus(`Grille enregistrée (${ordered.length} cases). Le jeu se recharge tout seul.`)
    } catch (error) {
      setStatus(`Échec : ${(error as Error).message}`)
    }
  }

  return (
    <div style={page}>
      <h1 style={{ margin: 0, font: '800 20px system-ui, sans-serif' }}>Régie radio — grille de programmation</h1>
      <p style={{ margin: '6px 0 0', color: '#94a3b8', font: '400 13px system-ui, sans-serif' }}>
        Une case = <strong>une heure de jeu</strong>, qui ne vaut que <strong>2 min 30 réelles</strong>. Une émission
        démarre à son heure et <strong>dure ce qu'elle dure</strong> : les cases hachurées montrent jusqu'où elle
        déborde. Pour l'arrêter plus tôt, pose une <em>pub</em>, une <em>coupure</em> ou une autre émission.
      </p>

      <div style={toolbar}>
        {RADIO_STATIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setStationId(s.id)}
            style={tabStyle(s.id === stationId)}
            title={`${s.scheduledPrograms.length} émission(s), ${s.musicTracks.length} musique(s)`}
          >
            {s.shortName}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {dirty && <span style={{ color: '#fbbf24', font: '700 12px system-ui' }}>modifications non enregistrées</span>}
        <button onClick={save} style={saveStyle}>Enregistrer</button>
      </div>

      {status && <div style={statusStyle}>{status}</div>}

      <ShowLegend station={station} showLengthHours={showLengthHours} />

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...CELL.head, width: 52 }}>h</th>
              {DAY_NAMES.map((name, day) => (
                <th key={name} style={CELL.head}>
                  {name}
                  <button onClick={() => copyDayToWeek(day)} style={copyStyle} title="Copier cette journée sur toute la semaine">
                    ⇥ semaine
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
              <tr key={hour}>
                <td style={CELL.hour}>{String(hour).padStart(2, '0')}:00</td>
                {Array.from({ length: DAYS_PER_WEEK }, (_, day) => (
                  <Cell
                    key={day}
                    slot={byCell.get(`${day}|${hour}`) ?? null}
                    spill={spillover.get(`${day}|${hour}`) ?? null}
                    station={station}
                    onPick={(kind, show) => setCell(day, hour, kind, show)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ShowLegend({
  station,
  showLengthHours,
}: {
  station: (typeof RADIO_STATIONS)[number]
  showLengthHours: Map<string, number>
}) {
  if (station.scheduledPrograms.length === 0) {
    return (
      <div style={legendStyle}>
        Aucune émission détectée pour cette station — dépose des fichiers dans{' '}
        <code>{station.folder}/Emissions/</code>.
      </div>
    )
  }

  return (
    <div style={legendStyle}>
      {station.scheduledPrograms.map((program) => {
        const hours = showLengthHours.get(program.folder) ?? 0
        const longest = Math.max(0, ...program.episodes.map((e) => e.durationSeconds))
        return (
          <span key={program.folder} style={legendItemStyle}>
            <strong>{program.title}</strong> — {program.episodes.length} épisode
            {program.episodes.length > 1 ? 's' : ''}, le plus long {formatDuration(longest)} →{' '}
            <em>{hours.toFixed(1)} h de grille</em>
          </span>
        )
      })}
    </div>
  )
}

function Cell({
  slot,
  spill,
  station,
  onPick,
}: {
  slot: RadioSlot | null
  spill: string | null
  station: (typeof RADIO_STATIONS)[number]
  onPick: (kind: RadioSlotKind | null, show?: string) => void
}) {
  const [open, setOpen] = useState(false)

  const kind = slot?.kind ?? null
  const showTitle = slot?.show
    ? (station.scheduledPrograms.find((p) => p.folder === slot.show)?.title ?? slot.show)
    : null
  const spillTitle = spill ? (station.scheduledPrograms.find((p) => p.folder === spill)?.title ?? spill) : null

  const background = kind
    ? KIND_COLORS[kind]
    : spill
      ? 'repeating-linear-gradient(45deg, rgba(56,189,248,0.16) 0 6px, transparent 6px 12px)'
      : 'transparent'

  return (
    <td style={{ ...CELL.cell, background, position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={CELL.button}>
        {showTitle ?? (kind ? KIND_LABELS[kind] : spillTitle ? `↳ ${spillTitle}` : '·')}
      </button>

      {open && (
        <div style={CELL.palette}>
          <button style={CELL.option} onClick={() => { onPick(null); setOpen(false) }}>Vider (musique)</button>
          <button style={CELL.option} onClick={() => { onPick('music'); setOpen(false) }}>Musique</button>
          <button style={CELL.option} onClick={() => { onPick('ads'); setOpen(false) }}>Publicités</button>
          <button style={CELL.option} onClick={() => { onPick('off'); setOpen(false) }}>Antenne coupée</button>
          {station.scheduledPrograms.map((program) => (
            <button
              key={program.folder}
              style={CELL.option}
              onClick={() => { onPick('show', program.folder); setOpen(false) }}
            >
              🎙️ {program.title}
            </button>
          ))}
        </div>
      )}
    </td>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m} min ${String(s).padStart(2, '0')}`
}

const tabStyle = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: `1px solid ${active ? '#38bdf8' : 'rgba(148,163,184,0.35)'}`,
  background: active ? 'rgba(56,189,248,0.18)' : 'transparent',
  color: active ? '#e0f2fe' : '#cbd5e1',
  font: '700 13px system-ui, sans-serif',
  cursor: 'pointer',
})

const saveStyle: CSSProperties = {
  padding: '7px 16px',
  borderRadius: 6,
  border: '1px solid #22c55e',
  background: 'rgba(34,197,94,0.18)',
  color: '#dcfce7',
  font: '800 13px system-ui, sans-serif',
  cursor: 'pointer',
}

const copyStyle: CSSProperties = {
  display: 'block',
  margin: '4px auto 0',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'transparent',
  color: '#94a3b8',
  font: '600 10px system-ui, sans-serif',
  cursor: 'pointer',
}

const statusStyle: CSSProperties = {
  marginTop: 8,
  padding: '6px 10px',
  borderRadius: 6,
  background: 'rgba(56,189,248,0.12)',
  color: '#e0f2fe',
  font: '600 12px system-ui, sans-serif',
}

const legendStyle: CSSProperties = {
  marginTop: 12,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 14,
  color: '#cbd5e1',
  font: '400 12px system-ui, sans-serif',
}

const legendItemStyle: CSSProperties = {
  padding: '4px 8px',
  borderRadius: 5,
  background: 'rgba(148,163,184,0.12)',
}
