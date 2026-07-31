/**
 * 🔊 Les bruitages du téléphone, SYNTHÉTISÉS.
 *
 * Même parti pris que le klaxon (`entities/vehicles/vehicleHorn.ts`) : ces sons
 * sont des enveloppes de quelques dizaines de millisecondes, donc les écrire en
 * WebAudio évite d'embarquer six fichiers, de les charger, et d'avoir un premier
 * clic muet le temps du téléchargement.
 *
 * ⚠️ Contrairement au klaxon, ces sons ne sont **pas positionnels** : le
 * téléphone est dans la main de Chibrux, pas à 20 mètres. On branche donc
 * directement sur la sortie.
 *
 * Le contexte audio n'est créé qu'au premier son (les navigateurs refusent d'en
 * ouvrir un avant une interaction du joueur) et reste ensuite en place.
 */

import { getSfxVolume } from '../settings/settingsStore'

export type PhoneSound =
  /** Le téléphone sort de la poche. */
  | 'open'
  /** On le range. */
  | 'close'
  /** Déverrouillage. */
  | 'unlock'
  /** Ouverture d'une application / clic sur un élément. */
  | 'tap'
  /** Retour en arrière. */
  | 'back'
  /** Déclencheur de l'appareil photo. */
  | 'shutter'
  /** Notification reçue. */
  | 'notify'

interface Note {
  /** Fréquence en Hz. */
  hz: number
  /** Décalage du début, en secondes, par rapport au déclenchement. */
  delay: number
  duration: number
  gain: number
  type: OscillatorType
}

/**
 * Chaque son est une petite suite de notes. Deux notes qui montent = « ça
 * s'ouvre », deux qui descendent = « ça se ferme » : c'est ce contraste qui rend
 * l'interface lisible à l'oreille, bien plus que le timbre exact.
 */
const SOUNDS: Record<PhoneSound, Note[]> = {
  open: [
    { hz: 520, delay: 0, duration: 0.07, gain: 0.1, type: 'triangle' },
    { hz: 780, delay: 0.05, duration: 0.09, gain: 0.09, type: 'triangle' },
  ],
  close: [
    { hz: 660, delay: 0, duration: 0.06, gain: 0.09, type: 'triangle' },
    { hz: 420, delay: 0.045, duration: 0.09, gain: 0.08, type: 'triangle' },
  ],
  unlock: [
    { hz: 640, delay: 0, duration: 0.05, gain: 0.09, type: 'sine' },
    { hz: 880, delay: 0.04, duration: 0.06, gain: 0.08, type: 'sine' },
    { hz: 1180, delay: 0.09, duration: 0.1, gain: 0.06, type: 'sine' },
  ],
  tap: [{ hz: 900, delay: 0, duration: 0.035, gain: 0.06, type: 'sine' }],
  back: [{ hz: 480, delay: 0, duration: 0.045, gain: 0.06, type: 'sine' }],
  // Un obturateur, c'est un claquement : très court, très haut, sans hauteur nette.
  shutter: [
    { hz: 2400, delay: 0, duration: 0.022, gain: 0.09, type: 'square' },
    { hz: 1500, delay: 0.03, duration: 0.03, gain: 0.07, type: 'square' },
  ],
  notify: [
    { hz: 990, delay: 0, duration: 0.08, gain: 0.08, type: 'sine' },
    { hz: 1320, delay: 0.08, duration: 0.14, gain: 0.07, type: 'sine' },
  ],
}

let context: AudioContext | null = null

function ensureContext(): AudioContext | null {
  if (context) return context
  const Ctor =
    window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context = new Ctor()
  return context
}

export function playPhoneSound(sound: PhoneSound): void {
  // Volume des bruitages choisi par le joueur (`gameplay/settings/`). Lu au
  // moment de jouer le son : le curseur peut bouger entre deux clics.
  const volume = getSfxVolume()
  if (volume <= 0) return

  const ctx = ensureContext()
  if (!ctx) return
  // Le navigateur suspend le contexte tant qu'il n'y a pas eu d'interaction.
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime

  for (const note of SOUNDS[sound]) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = note.type
    oscillator.frequency.value = note.hz

    const start = now + note.delay
    const end = start + note.duration
    // Attaque très courte puis extinction : sans enveloppe, chaque note ferait
    // un « clac » parasite au début et à la fin.
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(note.gain * volume, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(end + 0.02)
  }
}
