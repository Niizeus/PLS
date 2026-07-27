/**
 * 🎛️ LA RÉGIE AUDIO — deux lecteurs qui s'enchaînent en fondu.
 *
 * ## Pourquoi deux lecteurs
 *
 * Avec un seul élément `<audio>`, changer de morceau veut dire écraser sa
 * source : le son s'arrête net, puis reprend. Aucun fondu n'est possible, parce
 * qu'on n'a jamais les deux morceaux en même temps.
 *
 * On garde donc **deux lecteurs (A et B) qui alternent** : pendant que l'un
 * finit en fondu sortant, l'autre démarre en fondu entrant. C'est exactement le
 * fonctionnement d'une régie de radio.
 *
 * ## Le graphe audio
 *
 * ```text
 *   lecteur A ─▶ gain A ─┐
 *                        ├─▶ programme ─▶ filtre radio ─┐
 *   lecteur B ─▶ gain B ─┘                              ├─▶ volume ─▶ sortie
 *                    souffle + zapping ─────────────────┘
 * ```
 *
 * Le bruit se branche **après** le filtre du programme : il a déjà son propre
 * timbre (voir `radioNoise.ts`), le colorer une seconde fois l'étoufferait. En
 * revanche il passe bien par le volume — c'est le poste entier qu'on baisse.
 *
 * Les gains A et B ne servent QU'au fondu (0 → 1). Le volume du joueur vit sur
 * le gain final : régler le volume ne perturbe donc jamais un fondu en cours.
 *
 * ⚠️ Le contexte audio est construit **au premier son**, pas au chargement : les
 * navigateurs refusent de démarrer un `AudioContext` tant que le joueur n'a rien
 * touché. Tant qu'il est suspendu, on réessaie simplement au coup suivant.
 */

import { createRadioNoise, type RadioNoise } from './radioNoise'

export interface PlayoutRequest {
  /** URL du fichier à diffuser. */
  src: string
  /** Où en être dans ce fichier, en secondes. */
  offsetSeconds: number
}

export interface RadioPlayout {
  /** Diffuse `request`, en fondu si la source change. `null` = antenne coupée. */
  play: (request: PlayoutRequest | null, fadeSeconds: number) => void
  /** Recale la lecture si elle a dérivé de plus de `toleranceSeconds`. */
  resync: (offsetSeconds: number, toleranceSeconds: number) => void
  setVolume: (volume: number) => void
  setFilterEnabled: (enabled: boolean) => void
  /** Souffle de fond permanent. `0` = antenne coupée, `1` = niveau nominal. */
  setHiss: (level: number) => void
  /** Bouffée de bruit de changement de station. */
  zap: () => void
  /** Source en cours de diffusion, ou `null`. */
  currentSrc: () => string | null
  dispose: () => void
}

interface Deck {
  audio: HTMLAudioElement
  gain: GainNode | null
  src: string | null
  /** Minuterie qui met le lecteur en pause une fois son fondu sortant terminé. */
  stopTimer: number | null
  /** Horodatage du dernier saut dans le fichier — voir `RESYNC_MIN_SECONDS`. */
  lastSeekAt: number
}

/** Un fondu ne descend jamais tout à fait à zéro : `exponentialRamp` l'interdit. */
const SILENCE = 0.0001

/**
 * ⏳ Délai minimum entre deux sauts dans un même fichier (s).
 *
 * **C'est un garde-fou vital, pas un détail de confort.** Les musiques du jeu
 * sont des `.wav` de plusieurs dizaines de mégaoctets, et la station dépose
 * l'auditeur au MILIEU du morceau. Le navigateur doit donc charger le fichier
 * jusqu'à cet endroit avant de pouvoir sortir un son.
 *
 * Or chaque saut ANNULE ce chargement et en relance un ailleurs. En recalant à
 * chaque passage de la régie (toutes les 250 ms), on empêchait purement et
 * simplement le morceau de démarrer : le lecteur passait son temps à chercher
 * sa place et ne jouait jamais. Résultat en jeu : le bruit de zapping
 * fonctionnait (il est synthétisé) mais plus aucune musique ne sortait.
 */
const RESYNC_MIN_SECONDS = 20

export function createRadioPlayout(): RadioPlayout {
  const decks: Deck[] = [createDeck(), createDeck()]
  let active = 0

  let context: AudioContext | null = null
  let program: GainNode | null = null
  let filter: BiquadFilterNode | null = null
  let master: GainNode | null = null

  let noise: RadioNoise | null = null
  let volume = 1
  let filterEnabled = false
  /** Souffle demandé avant que le contexte n'existe : on l'appliquera à l'ouverture. */
  let hissLevel = 0

  function ensureGraph(): AudioContext | null {
    if (context) return context

    const Ctor =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null

    context = new Ctor()
    program = context.createGain()
    filter = context.createBiquadFilter()
    master = context.createGain()

    program.connect(filter)
    filter.connect(master)
    master.connect(context.destination)
    master.gain.value = volume
    applyFilter(filter, filterEnabled)

    for (const deck of decks) {
      const source = context.createMediaElementSource(deck.audio)
      const gain = context.createGain()
      gain.gain.value = SILENCE
      source.connect(gain)
      gain.connect(program)
      deck.gain = gain
      // Le volume vit sur le gain final : l'élément reste à fond.
      deck.audio.volume = 1
    }

    noise = createRadioNoise(context, master)
    noise.setHiss(hissLevel)

    return context
  }

  function fade(deck: Deck, to: number, seconds: number) {
    if (!deck.gain || !context) return
    const now = context.currentTime
    const target = Math.max(to, SILENCE)
    deck.gain.gain.cancelScheduledValues(now)
    deck.gain.gain.setValueAtTime(Math.max(deck.gain.gain.value, SILENCE), now)
    // Rampe exponentielle : c'est ainsi que l'oreille perçoit un fondu régulier.
    deck.gain.gain.exponentialRampToValueAtTime(target, now + Math.max(seconds, 0.01))
  }

  function stopAfter(deck: Deck, seconds: number) {
    if (deck.stopTimer !== null) window.clearTimeout(deck.stopTimer)
    deck.stopTimer = window.setTimeout(() => {
      deck.stopTimer = null
      deck.audio.pause()
      deck.src = null
    }, Math.max(0, seconds * 1000) + 60)
  }

  function cancelStop(deck: Deck) {
    if (deck.stopTimer === null) return
    window.clearTimeout(deck.stopTimer)
    deck.stopTimer = null
  }

  return {
    play(request, fadeSeconds) {
      const current = decks[active]

      if (!request) {
        if (current.src) {
          fade(current, 0, fadeSeconds)
          stopAfter(current, fadeSeconds)
        }
        return
      }

      const ctx = ensureGraph()
      if (!ctx) return
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)

      // Déjà la bonne source : on s'assure juste que ça joue.
      if (current.src === request.src) {
        cancelStop(current)
        fade(current, 1, fadeSeconds)
        if (current.audio.paused) void current.audio.play().catch(() => undefined)
        return
      }

      // On bascule sur l'autre lecteur : les deux sonnent pendant le fondu.
      const next = decks[1 - active]
      cancelStop(next)
      next.src = request.src
      next.audio.src = request.src
      seekWhenReady(next, request.offsetSeconds)
      next.lastSeekAt = ctx.currentTime
      next.gain?.gain.setValueAtTime(SILENCE, ctx.currentTime)
      void next.audio.play().catch(() => undefined)
      fade(next, 1, fadeSeconds)

      if (current.src) {
        fade(current, 0, fadeSeconds)
        stopAfter(current, fadeSeconds)
      }

      active = 1 - active
    },

    resync(offsetSeconds, toleranceSeconds) {
      const deck = decks[active]
      if (!deck.src || !context) return

      const audio = deck.audio
      // Tant que le lecteur cherche sa place ou n'a pas de quoi jouer, on ne le
      // dérange PAS : un saut de plus annulerait le chargement en cours.
      if (audio.seeking || audio.readyState < HAVE_FUTURE_DATA) return
      if (context.currentTime - deck.lastSeekAt < RESYNC_MIN_SECONDS) return
      if (Math.abs(audio.currentTime - offsetSeconds) <= toleranceSeconds) return

      deck.lastSeekAt = context.currentTime
      seek(audio, offsetSeconds)
    },

    setVolume(next) {
      volume = Math.min(1, Math.max(0, next))
      if (master && context) {
        master.gain.setTargetAtTime(volume, context.currentTime, 0.05)
      }
    },

    setFilterEnabled(enabled) {
      filterEnabled = enabled
      applyFilter(filter, enabled)
      // Poste « radio » assumé : on pousse le souffle avec.
      noise?.setHiss(hissLevel * (enabled ? 1.8 : 1))
    },

    setHiss(level) {
      hissLevel = Math.max(0, level)
      noise?.setHiss(hissLevel * (filterEnabled ? 1.8 : 1))
    },

    zap() {
      // Le zapping doit s'entendre même quand l'antenne était coupée : c'est lui
      // qui ouvre le poste.
      if (!ensureGraph()) return
      if (context?.state === 'suspended') void context.resume().catch(() => undefined)
      noise?.zap()
    },

    currentSrc: () => decks[active].src,

    dispose() {
      noise?.dispose()
      noise = null
      for (const deck of decks) {
        cancelStop(deck)
        deck.audio.pause()
        deck.audio.removeAttribute('src')
        deck.audio.load()
        deck.src = null
      }
      void context?.close().catch(() => undefined)
      context = null
    },
  }
}

/** `HTMLMediaElement.HAVE_FUTURE_DATA` : de quoi jouer au moins l'instant suivant. */
const HAVE_FUTURE_DATA = 3

function createDeck(): Deck {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.loop = false
  return { audio, gain: null, src: null, stopTimer: null, lastSeekAt: -Infinity }
}

/**
 * Se place dans le morceau, en attendant que le fichier soit ouvrable.
 *
 * ⚠️ Écrire `currentTime` juste après avoir posé `src` échoue : le navigateur ne
 * connaît pas encore la durée du fichier. L'ancien code se contentait d'avaler
 * l'erreur, et la lecture repartait donc du début — puis le recalage suivant
 * sautait, relançant le chargement. Sur des `.wav` de 30 Mo, ça tournait en rond.
 * On attend donc simplement les métadonnées.
 */
function seekWhenReady(deck: Deck, seconds: number) {
  const audio = deck.audio
  const wanted = deck.src

  if (audio.readyState >= 1) {
    seek(audio, seconds)
    return
  }

  audio.addEventListener(
    'loadedmetadata',
    () => {
      // Le lecteur a pu être réaffecté à un autre morceau entre-temps.
      if (deck.src !== wanted) return
      seek(audio, seconds)
    },
    { once: true },
  )
}

function seek(audio: HTMLAudioElement, seconds: number) {
  const desired = Math.max(0, seconds)
  try {
    audio.currentTime = desired
  } catch {
    // Fichier pas encore ouvrable : le recalage suivant s'en chargera.
  }
}

function applyFilter(filter: BiquadFilterNode | null, enabled: boolean) {
  if (!filter) return
  filter.type = 'bandpass'
  filter.frequency.value = enabled ? 1850 : 12000
  filter.Q.value = enabled ? 0.82 : 0.0001
}
