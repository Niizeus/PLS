import { useEffect, useRef, useState } from 'react'
import { getRadioStation, getStationPlayableTracks, type RadioStationId, type RadioTrack } from './radioCatalog'
import { getBroadcast, skipCurrent } from './radioBroadcast'
import { createRadioPlayout, type RadioPlayout } from './radioPlayout'
import { useRadioStore } from './radioStore'
import { useGameTimeStore } from '../gameplay/time/gameTimeStore'

type StationAvailability = Partial<Record<RadioStationId, RadioTrack[]>>

/** Durée d'un fondu enchaîné entre deux morceaux (s). */
const TRACK_FADE = 0.9
/** Fondu plus franc quand on change de station ou qu'on coupe le poste. */
const STATION_FADE = 0.35
/** Cadence à laquelle le récepteur interroge l'antenne. */
const POLL_MS = 250

/**
 * ⏱️ On demande à l'antenne ce qui passera dans `TRACK_FADE` secondes.
 *
 * L'antenne étant une fonction du temps, on peut la consulter dans le futur.
 * Quand la fin d'un morceau approche, elle annonce donc le suivant AVANT qu'il
 * ne commence — on a tout le temps de lancer le fondu, et au moment où il se
 * termine le nouveau morceau est exactement là où il doit être.
 */
const LOOK_AHEAD_MS = TRACK_FADE * 1000

/**
 * 📻 UN RÉCEPTEUR branché sur l'antenne.
 *
 * Ce composant ne décide de rien : il demande à `radioBroadcast` ce que la
 * station diffuse **maintenant**, et se cale dessus. C'est ce qui fait que
 * plusieurs sources — l'autoradio, un magasin, un bar — réglées sur la même
 * station diffusent **la même musique au même instant**. On sort de la voiture
 * en pleine chanson, on entre dans le magasin : c'est la même chanson.
 *
 * Le seul moment où l'on se place dans un fichier est **l'allumage du poste**.
 * Ensuite l'antenne et le lecteur avancent sur la même horloge — le temps réel —
 * et il n'y a plus rien à synchroniser.
 */
export default function RadioAudioSystem() {
  const stationId = useRadioStore((state) => state.currentStationId)
  const activeSource = useRadioStore((state) => state.activeSource)
  const volume = useRadioStore((state) => state.volume)
  const radioFilterEnabled = useRadioStore((state) => state.radioFilterEnabled)

  const playoutRef = useRef<RadioPlayout | null>(null)
  const [availability, setAvailability] = useState<StationAvailability>({})

  const sourceKey = activeSource ? `${activeSource.kind}:${activeSource.id}` : null

  useEffect(() => {
    const playout = createRadioPlayout()
    playoutRef.current = playout
    return () => {
      playout.dispose()
      playoutRef.current = null
    }
  }, [])

  useEffect(() => {
    playoutRef.current?.setVolume(volume)
  }, [volume])

  useEffect(() => {
    playoutRef.current?.setFilterEnabled(radioFilterEnabled)
  }, [radioFilterEnabled])

  // --- Quels fichiers de la station sont réellement lisibles ---
  useEffect(() => {
    if (!stationId || availability[stationId]) return
    let alive = true
    const station = getRadioStation(stationId)

    Promise.all(getStationPlayableTracks(station).map(probeTrack)).then((tracks) => {
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

  // --- Le poste : on se branche sur l'antenne et on suit ---
  useEffect(() => {
    const playout = playoutRef.current
    if (!playout) return

    const tracks = stationId ? availability[stationId] : undefined

    if (!stationId || !sourceKey) {
      playout.play(null, STATION_FADE)
      playout.setHiss(0)
      useRadioStore.getState().setCurrentContentLabel(null)
      return
    }
    // Sondage encore en cours : on attend, sans couper ce qui joue.
    if (!tracks) return

    const station = getRadioStation(stationId)
    // Allumage du poste : coup de molette.
    playout.zap()
    playout.setHiss(1)

    /** Vrai tant qu'on n'a pas encore accroché la station : premier calage. */
    let tuning = true

    const tick = () => {
      // Filet de sécurité : si le navigateur a refusé de démarrer la lecture
      // (autorisation audio pas encore acquise), on retente à chaque passage.
      playout.ensurePlaying()

      const nowMs = Date.now() + LOOK_AHEAD_MS
      const gameMinutes = useGameTimeStore.getState().totalMinutes

      // Filet : un fichier illisible, ou un morceau qui se termine alors que
      // l'antenne le croyait encore en cours (durée annoncée fausse), la
      // bloquerait sur un silence. On la fait avancer.
      if (playout.failed() || playout.ended()) skipCurrent(station, tracks, nowMs, gameMinutes)

      const position = getBroadcast(station, tracks, nowMs, gameMinutes)
      if (!position) {
        playout.play(null, STATION_FADE)
        useRadioStore.getState().setCurrentContentLabel(null)
        return
      }

      useRadioStore.getState().setCurrentContentLabel(position.item.label)

      // Déjà branché sur ce fichier : on ne touche à RIEN. Surtout pas à sa
      // position — c'est ce harcèlement qui empêchait les gros fichiers de
      // démarrer.
      if (playout.currentSrc() === position.item.track.src) return

      playout.play(
        { src: position.item.track.src, offsetSeconds: position.offsetSeconds },
        tuning ? STATION_FADE : TRACK_FADE,
      )
      tuning = false
    }

    tick()
    const intervalId = window.setInterval(tick, POLL_MS)
    return () => window.clearInterval(intervalId)
  }, [stationId, sourceKey, availability])

  return null
}

/** Delai au-dela duquel on considere que la duree ne viendra pas, sans pour autant jeter le morceau. */
const METADATA_TIMEOUT_MS = 10_000

/**
 * Verifie qu'un fichier existe vraiment et releve sa duree reelle.
 *
 * Ne sert plus qu'aux formats dont la duree n'a pas pu etre lue au scan (voir
 * `radioManifestPlugin.ts`) : un `.wav` arrive ici avec sa duree deja connue et
 * ne declenche aucune requete.
 */
function probeTrack(track: RadioTrack): Promise<RadioTrack | null> {
  if (track.durationKnown) return Promise.resolve(track)

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
        finish({ ...track, durationSeconds: duration, durationKnown: true })
      },
      { once: true },
    )
    probe.addEventListener('error', () => finish(null), { once: true })

    probe.src = track.src
  })
}
