import { useEffect, useRef, useState } from 'react'
import { getRadioStation, getStationPlayableTracks, type RadioStationId, type RadioTrack } from './radioCatalog'
import { getRadioTimelinePosition } from './radioTimeline'
import { createRadioPlayout, type RadioPlayout } from './radioPlayout'
import { useRadioStore } from './radioStore'
import {
  MINUTES_PER_DAY,
  REAL_SECONDS_PER_GAME_DAY,
  useGameTimeStore,
} from '../gameplay/time/gameTimeStore'

type StationAvailability = Partial<Record<RadioStationId, RadioTrack[]>>

/** 1 minute de jeu = 2,5 secondes réelles. */
const GAME_SECONDS_PER_GAME_MINUTE = REAL_SECONDS_PER_GAME_DAY / MINUTES_PER_DAY

/** Durée d'un fondu enchaîné entre deux morceaux (s). */
const TRACK_FADE = 0.9
/** Fondu plus franc quand on change de station ou qu'on coupe l'antenne. */
const STATION_FADE = 0.35

/**
 * Cadence à laquelle on redemande « qu'est-ce qui devrait passer ? ».
 *
 * L'ancienne version interrogeait la timeline toutes les **1 000 ms**, et
 * attendait la fin d'un morceau pour découvrir le suivant : il y avait donc
 * jusqu'à une seconde de silence à chaque enchaînement.
 */
const POLL_MS = 250

/**
 * ⏱️ On demande à la timeline ce qui passera dans `TRACK_FADE` secondes, pas ce
 * qui passe maintenant.
 *
 * C'est l'astuce qui rend l'enchaînement propre : la timeline étant une simple
 * fonction du temps, on peut la consulter dans le futur. Quand la fin d'un
 * morceau approche, elle annonce donc le suivant AVANT qu'il ne commence — on a
 * tout le temps de lancer le fondu, et au moment où il se termine le nouveau
 * morceau est exactement là où il devrait être.
 */
const LOOK_AHEAD_GAME_MINUTES = TRACK_FADE / GAME_SECONDS_PER_GAME_MINUTE

/**
 * 🕰️ Écart toléré entre l'horloge du JEU et le morceau qui joue — très large,
 * et c'est volontaire.
 *
 * ## Pourquoi il ne faut PAS courir après l'horloge
 *
 * La timeline dit quoi jouer à partir du **temps de jeu**, mais un fichier audio
 * avance en **temps réel**. Or les deux divergent forcément :
 * `GameTimeTicker` avance avec `requestAnimationFrame` et **plafonne son pas à
 * 0,25 s**. Chaque image longue (chargement, à-coup) lui fait donc perdre du
 * temps, et si la fenêtre passe en arrière-plan `requestAnimationFrame` s'arrête
 * carrément. Ce retard **ne se rattrape jamais**.
 *
 * Avec une tolérance serrée, l'écart finissait par la dépasser en permanence :
 * la régie repositionnait le lecteur toutes les 250 ms, ce qui annulait à chaque
 * fois le chargement du fichier en cours. Sur des `.wav` de 30 Mo, le morceau ne
 * démarrait tout simplement plus — alors que le bruit de zapping, lui, continuait
 * de marcher puisqu'il est synthétisé. C'était exactement le bug « plus aucune
 * musique mais le zapping fonctionne ».
 *
 * 👉 La timeline choisit donc **quoi** jouer et **où démarrer** ; ensuite le
 * morceau se déroule tout seul. Le recalage n'est plus qu'un filet de sécurité
 * pour les gros décrochages (longue mise en veille). Quelques secondes de
 * décalage ne s'entendent pas sur une radio ; un morceau muet, si.
 */
const DRIFT_TOLERANCE_SECONDS = 45

export default function RadioAudioSystem() {
  const stationId = useRadioStore((state) => state.currentStationId)
  const activeSource = useRadioStore((state) => state.activeSource)
  const volume = useRadioStore((state) => state.volume)
  const radioFilterEnabled = useRadioStore((state) => state.radioFilterEnabled)

  const playoutRef = useRef<RadioPlayout | null>(null)
  const [availability, setAvailability] = useState<StationAvailability>({})
  /** Station diffusée à l'image précédente : sert à détecter un zapping. */
  const previousStationRef = useRef<RadioStationId | null>(null)

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

  // --- Disponibilité des fichiers de la station (une fois par station) ---
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

  // --- La régie : on interroge la timeline et on suit ---
  useEffect(() => {
    const playout = playoutRef.current
    if (!playout) return

    const tick = () => {
      const stopped = !stationId || !sourceKey
      const tracks = stationId ? availability[stationId] : undefined

      if (stopped || !tracks || tracks.length === 0) {
        // `undefined` = sondage en cours : on ne coupe pas l'antenne pour si peu.
        if (stopped || tracks) {
          playout.play(null, STATION_FADE)
          playout.setHiss(0)
          useRadioStore.getState().setCurrentContentLabel(null)
          previousStationRef.current = null
        }
        return
      }

      const station = getRadioStation(stationId)
      const totalMinutes = useGameTimeStore.getState().totalMinutes
      const position = getRadioTimelinePosition(station, totalMinutes + LOOK_AHEAD_GAME_MINUTES, tracks)

      if (!position) {
        playout.play(null, STATION_FADE)
        useRadioStore.getState().setCurrentContentLabel(null)
        return
      }

      useRadioStore.getState().setCurrentContentLabel(position.label)

      // Zapper doit s'entendre : bouffée de bruit + fondu court et net, pas un
      // enchaînement doux comme entre deux titres.
      const zapped = previousStationRef.current !== null && previousStationRef.current !== stationId
      // Le poste s'allume aussi avec un coup de molette.
      if (zapped || previousStationRef.current === null) playout.zap()
      previousStationRef.current = stationId
      playout.setHiss(1)

      const request = { src: position.track.src, offsetSeconds: position.offsetSeconds }

      if (playout.currentSrc() === request.src) {
        playout.resync(request.offsetSeconds, DRIFT_TOLERANCE_SECONDS)
        playout.play(request, TRACK_FADE)
        return
      }

      playout.play(request, zapped ? STATION_FADE : TRACK_FADE)
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
  // Duree deja MESUREE au scan : le fichier existe forcement, puisque Vite l'a
  // lu sur le disque. Rien a telecharger.
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
