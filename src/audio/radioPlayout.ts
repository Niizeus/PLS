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
 *                        ├─▶ programme ─▶ filtre radio ─▶ volume ─▶ sortie
 *   lecteur B ─▶ gain B ─┘                    ▲
 *                                             │
 *                       (étape suivante : souffle et zapping se branchent ici)
 * ```
 *
 * Les gains A et B ne servent QU'au fondu (0 → 1). Le volume du joueur vit sur
 * le gain final : régler le volume ne perturbe donc jamais un fondu en cours.
 *
 * ⚠️ Le contexte audio est construit **au premier son**, pas au chargement : les
 * navigateurs refusent de démarrer un `AudioContext` tant que le joueur n'a rien
 * touché. Tant qu'il est suspendu, on réessaie simplement au coup suivant.
 */

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
}

/** Un fondu ne descend jamais tout à fait à zéro : `exponentialRamp` l'interdit. */
const SILENCE = 0.0001

export function createRadioPlayout(): RadioPlayout {
  const decks: Deck[] = [createDeck(), createDeck()]
  let active = 0

  let context: AudioContext | null = null
  let program: GainNode | null = null
  let filter: BiquadFilterNode | null = null
  let master: GainNode | null = null

  let volume = 1
  let filterEnabled = false

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
      seek(next.audio, request.offsetSeconds)
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
      if (!deck.src || deck.audio.readyState === 0) return
      if (Math.abs(deck.audio.currentTime - offsetSeconds) <= toleranceSeconds) return
      seek(deck.audio, offsetSeconds)
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
    },

    currentSrc: () => decks[active].src,

    dispose() {
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

function createDeck(): Deck {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.loop = false
  return { audio, gain: null, src: null, stopTimer: null }
}

function seek(audio: HTMLAudioElement, seconds: number) {
  const desired = Math.max(0, seconds)
  try {
    audio.currentTime = desired
  } catch {
    // Le fichier n'est pas encore assez chargé pour qu'on puisse s'y déplacer :
    // on repassera au prochain recalage.
  }
}

function applyFilter(filter: BiquadFilterNode | null, enabled: boolean) {
  if (!filter) return
  filter.type = 'bandpass'
  filter.frequency.value = enabled ? 1850 : 12000
  filter.Q.value = enabled ? 0.82 : 0.0001
}
