import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { getRadioStation, getStationPlayableTracks, type RadioStationId, type RadioTrack } from './radioCatalog'
import { getRadioTimelinePosition } from './radioTimeline'
import { useRadioStore } from './radioStore'
import { useGameTimeStore } from '../gameplay/time/gameTimeStore'

type StationAvailability = Partial<Record<RadioStationId, RadioTrack[]>>

export default function RadioAudioSystem() {
  const stationId = useRadioStore((state) => state.currentStationId)
  const activeSource = useRadioStore((state) => state.activeSource)
  const volume = useRadioStore((state) => state.volume)
  const radioFilterEnabled = useRadioStore((state) => state.radioFilterEnabled)
  const setCurrentContentLabel = useRadioStore((state) => state.setCurrentContentLabel)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const radioFilterRef = useRef<BiquadFilterNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const currentTrackSrcRef = useRef<string | null>(null)
  const [availability, setAvailability] = useState<StationAvailability>({})
  const [timelineMinutes, setTimelineMinutes] = useState(() => useGameTimeStore.getState().totalMinutes)

  const sourceKey = activeSource ? `${activeSource.kind}:${activeSource.id}` : null

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio
    return () => {
      audio.pause()
      audioRef.current = null
      void audioContextRef.current?.close().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimelineMinutes(useGameTimeStore.getState().totalMinutes)
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = gainRef.current ? 1 : volume
    if (gainRef.current) gainRef.current.gain.value = volume
  }, [volume])

  useEffect(() => {
    applyRadioFilter(radioFilterRef.current, radioFilterEnabled)
  }, [radioFilterEnabled])

  useEffect(() => {
    if (!stationId || availability[stationId]) return
    let alive = true
    const station = getRadioStation(stationId)
    const playableTracks = getStationPlayableTracks(station)

    Promise.all(playableTracks.map(probeTrack)).then((tracks) => {
      if (!alive) return
      setAvailability((state) => ({
        ...state,
        [stationId]: tracks.filter((track): track is RadioTrack => Boolean(track)),
      }))
    })

    return () => {
      alive = false
    }
  }, [stationId, availability])

  const availableTracks = useMemo(() => {
    if (!stationId) return []
    return availability[stationId] ?? []
  }, [availability, stationId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!stationId || !sourceKey) {
      stopAudio(audio, currentTrackSrcRef)
      setCurrentContentLabel(null)
      return
    }

    const tracks = availability[stationId]
    if (!tracks) return
    if (tracks.length === 0) {
      stopAudio(audio, currentTrackSrcRef)
      setCurrentContentLabel(null)
      return
    }

    const station = getRadioStation(stationId)
    const position = getRadioTimelinePosition(station, timelineMinutes, tracks)
    if (!position) {
      stopAudio(audio, currentTrackSrcRef)
      setCurrentContentLabel(null)
      return
    }

    setCurrentContentLabel(position.label)

    if (currentTrackSrcRef.current === position.track.src) {
      syncCurrentTime(audio, position.offsetSeconds)
      if (audio.paused) void playRadio(audio, volume, radioFilterEnabled, audioContextRef, mediaSourceRef, radioFilterRef, gainRef)
      return
    }

    currentTrackSrcRef.current = position.track.src
    audio.src = position.track.src
    syncCurrentTime(audio, position.offsetSeconds, true)
    audio.loop = false
    audio.volume = gainRef.current ? 1 : volume
    if (gainRef.current) gainRef.current.gain.value = volume

    void playRadio(audio, volume, radioFilterEnabled, audioContextRef, mediaSourceRef, radioFilterRef, gainRef)
  }, [stationId, sourceKey, availableTracks, availability, timelineMinutes, volume, radioFilterEnabled, setCurrentContentLabel])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !stationId) return

    const onEnded = () => {
      setTimelineMinutes(useGameTimeStore.getState().totalMinutes)
    }

    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [stationId])

  return null
}

/** Delai au-dela duquel on considere que la duree ne viendra pas, sans pour autant jeter le morceau. */
const METADATA_TIMEOUT_MS = 10_000

/**
 * Verifie qu'un fichier existe vraiment et releve sa duree reelle.
 *
 * Le catalogue est construit a partir des noms de fichiers : il ne connait pas la duree.
 * Or la timeline en a besoin pour savoir ou en serait la station si personne n'ecoutait.
 * On charge donc juste les metadonnees (`preload = 'metadata'`), ce qui sert aussi de test
 * de presence : un fichier absent ou illisible declenche `error` et sort de la playlist.
 */
function probeTrack(track: RadioTrack): Promise<RadioTrack | null> {
  return new Promise((resolve) => {
    const probe = new Audio()
    probe.preload = 'metadata'

    let settled = false
    const finish = (result: RadioTrack | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      probe.removeAttribute('src')
      probe.load()
      resolve(result)
    }

    const timeoutId = window.setTimeout(() => finish(track), METADATA_TIMEOUT_MS)

    probe.addEventListener(
      'loadedmetadata',
      () => {
        const duration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : track.durationSeconds
        finish({ ...track, durationSeconds: duration })
      },
      { once: true },
    )
    probe.addEventListener('error', () => finish(null), { once: true })

    probe.src = track.src
  })
}

async function playRadio(
  audio: HTMLAudioElement,
  volume: number,
  radioFilterEnabled: boolean,
  contextRef: MutableRefObject<AudioContext | null>,
  sourceRef: MutableRefObject<MediaElementAudioSourceNode | null>,
  filterRef: MutableRefObject<BiquadFilterNode | null>,
  gainRef: MutableRefObject<GainNode | null>,
) {
  try {
    const context = ensureAudioGraph(audio, contextRef, sourceRef, filterRef, gainRef)
    applyRadioFilter(filterRef.current, radioFilterEnabled)
    gainRef.current!.gain.value = volume
    if (context.state === 'suspended') await context.resume()
    await audio.play()
  } catch {
    // Le navigateur peut refuser si l'interaction clavier n'a pas encore debloque l'audio.
  }
}

function stopAudio(audio: HTMLAudioElement, currentTrackSrcRef: MutableRefObject<string | null>) {
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  currentTrackSrcRef.current = null
}

function syncCurrentTime(audio: HTMLAudioElement, desiredSeconds: number, force = false) {
  const desired = Math.max(0, desiredSeconds)
  const drift = Math.abs(audio.currentTime - desired)
  if (!force && drift <= 3) return
  try {
    audio.currentTime = desired
  } catch {
    audio.currentTime = 0
  }
}

function ensureAudioGraph(
  audio: HTMLAudioElement,
  contextRef: MutableRefObject<AudioContext | null>,
  sourceRef: MutableRefObject<MediaElementAudioSourceNode | null>,
  filterRef: MutableRefObject<BiquadFilterNode | null>,
  gainRef: MutableRefObject<GainNode | null>,
): AudioContext {
  if (contextRef.current && sourceRef.current && filterRef.current && gainRef.current) {
    return contextRef.current
  }

  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) throw new Error('AudioContext unavailable')

  const context = new AudioContextCtor()
  const source = context.createMediaElementSource(audio)
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  applyRadioFilter(filter, false)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)

  contextRef.current = context
  sourceRef.current = source
  filterRef.current = filter
  gainRef.current = gain
  audio.volume = 1

  return context
}

function applyRadioFilter(filter: BiquadFilterNode | null, enabled: boolean) {
  if (!filter) return
  filter.type = 'bandpass'
  filter.frequency.value = enabled ? 1850 : 12000
  filter.Q.value = enabled ? 0.82 : 0.0001
}