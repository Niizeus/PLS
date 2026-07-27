import { createRadioNoise, type RadioNoise } from './radioNoise'

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
 * ## ⚠️ On se place dans le morceau UNE SEULE FOIS
 *
 * Se brancher sur une station en cours de diffusion oblige forcément à démarrer
 * au milieu d'un fichier — c'est tout l'intérêt : on entend ce que la station
 * diffuse, pas un morceau qui recommence pour nous.
 *
 * Mais ce placement n'a lieu qu'**une fois**, à l'instant où on se branche.
 * Ensuite, l'antenne et le lecteur avancent sur la **même horloge** (le temps
 * réel) : il n'y a plus rien à rattraper. C'est la version précédente qui
 * plantait, parce qu'elle recalait le lecteur toutes les 250 ms sur l'heure du
 * JEU — laquelle dérive. Or chaque replacement annule le chargement en cours :
 * sur des `.wav` de 30 Mo, le morceau ne démarrait jamais, alors que le zapping
 * (synthétisé) continuait de fonctionner.
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
 * Les gains A et B ne servent QU'au fondu (0 → 1). Le volume du joueur vit sur
 * le gain final : régler le volume ne perturbe donc jamais un fondu en cours.
 * Le bruit se branche **après** le filtre du programme : il a déjà son propre
 * timbre (voir `radioNoise.ts`), le colorer une seconde fois l'étoufferait.
 *
 * ⚠️ Le contexte audio est construit **au premier son**, pas au chargement : les
 * navigateurs refusent de démarrer un `AudioContext` tant que le joueur n'a rien
 * touché. Tant qu'il est suspendu, on réessaie simplement au coup suivant.
 */

export interface PlayoutRequest {
  src: string
  /**
   * Où se placer dans le fichier, en secondes.
   *
   * ⚠️ N'est appliqué qu'**une seule fois**, au moment où on se branche sur ce
   * fichier. Ensuite le lecteur se déroule tout seul : l'antenne et lui avancent
   * sur la même horloge (le temps réel), il n'y a donc rien à rattraper.
   */
  offsetSeconds: number
}

export interface RadioPlayout {
  /** Se branche sur ce fichier, en fondu. `null` = antenne coupée. */
  play: (request: PlayoutRequest | null, fadeSeconds: number) => void
  /**
   * Temps restant sur le morceau en cours, en secondes.
   * `null` tant que la durée n'est pas connue — on ne décide rien dans ce cas.
   */
  remaining: () => number | null
  /** Vrai si le morceau en cours est en erreur (fichier illisible, réseau...). */
  failed: () => boolean
  /**
   * Vrai si le morceau en cours est arrivé au bout.
   *
   * Sert de filet : si la durée annoncée par le catalogue était fausse,
   * l'antenne croirait le morceau encore en cours alors que le lecteur s'est
   * tu. On la fait alors avancer, au lieu de rester bloqué sur un silence.
   */
  ended: () => boolean
  /**
   * Relance la lecture si le lecteur s'est arrêté tout seul.
   *
   * Un navigateur peut refuser `play()` tant que le joueur n'a rien touché.
   * Sans ce rattrapage, l'antenne resterait muette pour toujours alors que tout
   * le reste fonctionne — exactement le genre de panne silencieuse à éviter ici.
   */
  ensurePlaying: () => void
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

  let noise: RadioNoise | null = null
  let volume = 1
  let filterEnabled = false
  /** Souffle demandé avant que le contexte n'existe : appliqué à l'ouverture. */
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

      // Déjà la bonne source : on s'assure juste que ça joue. Surtout, on ne
      // touche PAS à `currentTime` — c'est ce harcèlement qui empêchait les gros
      // fichiers de démarrer.
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
      next.gain?.gain.setValueAtTime(SILENCE, ctx.currentTime)
      void next.audio.play().catch(() => undefined)
      fade(next, 1, fadeSeconds)

      if (current.src) {
        fade(current, 0, fadeSeconds)
        stopAfter(current, fadeSeconds)
      }

      active = 1 - active
    },

    remaining() {
      const audio = decks[active].audio
      if (!decks[active].src) return null
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return null
      return audio.duration - audio.currentTime
    },

    failed() {
      const deck = decks[active]
      return Boolean(deck.src && deck.audio.error)
    },

    ensurePlaying() {
      const deck = decks[active]
      if (!deck.src || deck.audio.error || !deck.audio.paused) return
      // ⚠️ NE JAMAIS relancer un morceau terminé : appeler `play()` sur un
      // lecteur arrivé au bout le fait repartir de ZÉRO. C'est ce qui faisait
      // réentendre la même musique en boucle au lieu de passer à la suivante.
      // Un morceau fini, c'est à l'antenne de le remplacer, pas à nous.
      if (deck.audio.ended) return
      if (context?.state === 'suspended') void context.resume().catch(() => undefined)
      void deck.audio.play().catch(() => undefined)
    },

    ended() {
      const deck = decks[active]
      return Boolean(deck.src && deck.audio.ended)
    },

    setVolume(next) {
      volume = Math.min(1, Math.max(0, next))
      if (master && context) master.gain.setTargetAtTime(volume, context.currentTime, 0.05)
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

function createDeck(): Deck {
  const audio = new Audio()
  audio.preload = 'auto'
  audio.loop = false
  return { audio, gain: null, src: null, stopTimer: null }
}

/**
 * Se place dans le morceau, en attendant que le fichier soit ouvrable.
 *
 * ⚠️ Écrire `currentTime` juste après avoir posé `src` échoue : le navigateur ne
 * connaît pas encore la durée du fichier. L'ancien code avalait l'erreur, la
 * lecture repartait donc de zéro, et le recalage suivant sautait — un tourniquet
 * dont les gros fichiers ne sortaient jamais. On attend les métadonnées, et on
 * ne se place qu'une seule fois.
 */
function seekWhenReady(deck: Deck, seconds: number) {
  const audio = deck.audio
  const wanted = deck.src

  const apply = () => {
    try {
      audio.currentTime = Math.max(0, seconds)
    } catch {
      // Fichier décidément pas ouvrable : on laisse jouer depuis le début.
    }
  }

  if (audio.readyState >= 1) {
    apply()
    return
  }
  audio.addEventListener(
    'loadedmetadata',
    () => {
      // Le lecteur a pu être réaffecté à un autre morceau entre-temps.
      if (deck.src === wanted) apply()
    },
    { once: true },
  )
}

function applyFilter(filter: BiquadFilterNode | null, enabled: boolean) {
  if (!filter) return
  filter.type = 'bandpass'
  filter.frequency.value = enabled ? 1850 : 12000
  filter.Q.value = enabled ? 0.82 : 0.0001
}
