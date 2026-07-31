import * as THREE from 'three'
import { getSfxVolume } from '../../gameplay/settings/settingsStore'

/**
 * 📯 KLAXON (touche F).
 *
 * ## Pourquoi c'est synthétisé et pas un fichier .wav
 *
 * Un klaxon de voiture, c'est deux notes tenues à la tierce (typiquement ~400 et
 * ~500 Hz) passées dans un peu de distorsion. Ça tient en quelques oscillateurs
 * WebAudio — donc : aucun fichier à charger, aucun état d'attente au premier
 * appui, et surtout **un son par véhicule** gratuit (il suffit de changer les
 * fréquences). Un scooter n'a pas le même klaxon qu'une berline.
 *
 * ## Positionnel
 *
 * Le son passe par un `PannerNode` placé au véhicule, et le `listener` du
 * contexte suit la caméra. Le klaxon d'une voiture qui passe se déplace donc
 * vraiment dans le champ stéréo.
 *
 * ## Anti-empilement
 *
 * Maintenir F ne relance pas le son en boucle et deux appuis très rapprochés ne
 * se superposent pas : un klaxon déjà en cours est simplement PROLONGÉ. Sans ça,
 * marteler la touche saturerait la sortie audio en une seconde.
 */

export type HornVoice = 'car' | 'scooter'

interface VoiceSpec {
  /** Les deux fréquences tenues (Hz). */
  frequencies: [number, number]
  /** Volume de sortie (0-1). */
  gain: number
  type: OscillatorType
}

const VOICES: Record<HornVoice, VoiceSpec> = {
  // Deux notes à la tierce mineure : le klaxon "berline" classique.
  car: { frequencies: [392, 466], gain: 0.22, type: 'sawtooth' },
  // Plus aigu, plus fin, plus ridicule : c'est un scooter.
  scooter: { frequencies: [740, 880], gain: 0.13, type: 'square' },
}

/** Durée d'un coup de klaxon court (s). */
const BLIP_SECONDS = 0.32
/** Durée maxi d'un klaxon maintenu (s) : au-delà on coupe, par pitié. */
const MAX_HOLD_SECONDS = 4
const ATTACK = 0.012
const RELEASE = 0.09

interface ActiveHorn {
  voice: HornVoice
  oscillators: OscillatorNode[]
  gain: GainNode
  panner: PannerNode
  /** Instant (en temps du contexte) où le son doit s'éteindre. */
  stopAt: number
  startedAt: number
}

let context: AudioContext | null = null
let active: ActiveHorn | null = null

function ensureContext(): AudioContext | null {
  if (context) return context
  const Ctor =
    window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context = new Ctor()
  return context
}

/**
 * Déclenche (ou prolonge) le klaxon.
 *
 * À appeler tant que la touche est maintenue : la fonction est idempotente, elle
 * ne crée un son que s'il n'y en a pas déjà un en cours.
 */
export function playHorn(voice: HornVoice, position: THREE.Vector3, held: boolean) {
  const ctx = ensureContext()
  if (!ctx) return
  // Les navigateurs refusent de démarrer un AudioContext avant une interaction.
  // Appuyer sur F EST l'interaction : on peut réveiller le contexte ici.
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime

  if (active) {
    moveHorn(position)
    // Maintien : on repousse la fin, sans jamais dépasser le plafond.
    if (held && now - active.startedAt < MAX_HOLD_SECONDS) {
      active.stopAt = Math.max(active.stopAt, now + 0.12)
    }
    return
  }

  const spec = VOICES[voice]
  // Volume des bruitages choisi par le joueur (`gameplay/settings/`).
  const sfx = getSfxVolume()
  if (sfx <= 0) return

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(spec.gain * sfx, now + ATTACK)

  const panner = ctx.createPanner()
  panner.panningModel = 'HRTF'
  panner.distanceModel = 'inverse'
  panner.refDistance = 6
  panner.maxDistance = 140
  panner.rolloffFactor = 1.1
  panner.positionX.setValueAtTime(position.x, now)
  panner.positionY.setValueAtTime(position.y, now)
  panner.positionZ.setValueAtTime(position.z, now)

  const oscillators = spec.frequencies.map((frequency) => {
    const oscillator = ctx.createOscillator()
    oscillator.type = spec.type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.connect(gain)
    oscillator.start(now)
    return oscillator
  })

  gain.connect(panner)
  panner.connect(ctx.destination)

  active = {
    voice,
    oscillators,
    gain,
    panner,
    stopAt: now + (held ? 0.12 : BLIP_SECONDS),
    startedAt: now,
  }
}

/** Suit la position du véhicule tant que le klaxon sonne. */
export function moveHorn(position: THREE.Vector3) {
  if (!active || !context) return
  const now = context.currentTime
  active.panner.positionX.setValueAtTime(position.x, now)
  active.panner.positionY.setValueAtTime(position.y, now)
  active.panner.positionZ.setValueAtTime(position.z, now)
}

/** Place l'oreille du joueur. À appeler chaque image avec la caméra. */
export function setHornListener(camera: THREE.Camera) {
  const ctx = context
  if (!ctx) return
  const listener = ctx.listener
  const now = ctx.currentTime
  camera.getWorldPosition(listenerPosition)
  camera.getWorldDirection(listenerForward)

  // Les navigateurs récents exposent des AudioParam ; les plus anciens gardent
  // `setPosition`/`setOrientation`. On gère les deux sans casser.
  if (listener.positionX) {
    listener.positionX.setValueAtTime(listenerPosition.x, now)
    listener.positionY.setValueAtTime(listenerPosition.y, now)
    listener.positionZ.setValueAtTime(listenerPosition.z, now)
    listener.forwardX.setValueAtTime(listenerForward.x, now)
    listener.forwardY.setValueAtTime(listenerForward.y, now)
    listener.forwardZ.setValueAtTime(listenerForward.z, now)
    listener.upX.setValueAtTime(0, now)
    listener.upY.setValueAtTime(1, now)
    listener.upZ.setValueAtTime(0, now)
  } else {
    listener.setPosition(listenerPosition.x, listenerPosition.y, listenerPosition.z)
    listener.setOrientation(listenerForward.x, listenerForward.y, listenerForward.z, 0, 1, 0)
  }
}

/**
 * Éteint le klaxon quand son heure est venue.
 * À appeler chaque image : c'est ce qui libère les oscillateurs.
 */
export function updateHorn() {
  const ctx = context
  if (!ctx || !active) return
  const now = ctx.currentTime
  if (now < active.stopAt) return

  const horn = active
  active = null
  horn.gain.gain.cancelScheduledValues(now)
  horn.gain.gain.setValueAtTime(Math.max(0.0001, horn.gain.gain.value), now)
  horn.gain.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE)
  for (const oscillator of horn.oscillators) oscillator.stop(now + RELEASE + 0.02)
  window.setTimeout(() => {
    horn.gain.disconnect()
    horn.panner.disconnect()
  }, (RELEASE + 0.1) * 1000)
}

/** Coupe immédiatement (descente du véhicule, perte de focus). */
export function stopHorn() {
  if (!active || !context) return
  active.stopAt = context.currentTime
  updateHorn()
}

const listenerPosition = new THREE.Vector3()
const listenerForward = new THREE.Vector3()
