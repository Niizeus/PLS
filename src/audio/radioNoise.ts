/**
 * 📡 LE BRUIT DE LA RADIO — souffle de fond et bouffée de zapping.
 *
 * Tout est **synthétisé**, il n'y a aucun fichier audio à fournir : du bruit
 * blanc, deux filtres et une enveloppe suffisent. C'est aussi ce qui permet que
 * chaque zapping sonne un peu différemment, alors qu'un échantillon rejoué à
 * l'identique se remarque au bout de trois fois.
 *
 * Deux effets :
 *
 *  - **le souffle** (`setHiss`) : une nappe de bruit très basse, en permanence
 *    sous le programme, dont le niveau respire lentement et au hasard. C'est ce
 *    détail qui fait « vraie radio » plutôt que « lecteur de fichiers » ;
 *  - **le zapping** (`zap`) : une bouffée de bruit dont la bande passante
 *    BALAIE le spectre, doublée d'un sifflement qui glisse — l'imitation d'une
 *    molette qu'on tourne entre deux fréquences.
 */

/**
 * Niveau nominal du souffle. Très bas : environ 30 dB sous la musique, donc on
 * l'entend dans les passages calmes et jamais par-dessus un morceau.
 */
const HISS_LEVEL = 0.024
/** Cadence à laquelle le souffle change d'intensité (ms). */
const HISS_BREATH_MS = 700
/** Durée d'une bouffée de zapping (s). */
const ZAP_SECONDS = 0.38

export interface RadioNoise {
  /** Règle le souffle permanent. `0` = silence, `1` = niveau nominal. */
  setHiss: (level: number) => void
  /** Joue une bouffée de zapping. */
  zap: () => void
  dispose: () => void
}

/**
 * @param context     le contexte audio déjà ouvert par la régie
 * @param destination où brancher le bruit — après le filtre du programme, car
 *                    le souffle a son propre timbre et ne doit pas être coloré
 *                    une deuxième fois.
 */
export function createRadioNoise(context: AudioContext, destination: AudioNode): RadioNoise {
  const noiseBuffer = createNoiseBuffer(context)

  // --- Souffle permanent ---
  const hissGain = context.createGain()
  hissGain.gain.value = 0

  // Passe-haut + passe-bas : le bruit blanc brut est agressif, on ne garde que
  // la bande où souffle un poste de radio.
  const hissHigh = context.createBiquadFilter()
  hissHigh.type = 'highpass'
  hissHigh.frequency.value = 1200
  const hissLow = context.createBiquadFilter()
  hissLow.type = 'lowpass'
  hissLow.frequency.value = 6500

  const hissSource = context.createBufferSource()
  hissSource.buffer = noiseBuffer
  hissSource.loop = true
  hissSource.connect(hissHigh)
  hissHigh.connect(hissLow)
  hissLow.connect(hissGain)
  hissGain.connect(destination)
  hissSource.start()

  let hissLevel = 0

  // La respiration : plutôt qu'un oscillateur régulier (qui s'entend comme un
  // battement mécanique), on tire un niveau au hasard et on y glisse doucement.
  const breathId = window.setInterval(() => {
    if (hissLevel <= 0) return
    const target = hissLevel * HISS_LEVEL * (0.35 + Math.random() * 1.5)
    hissGain.gain.setTargetAtTime(target, context.currentTime, 0.4)
  }, HISS_BREATH_MS)

  return {
    setHiss(level) {
      hissLevel = Math.max(0, level)
      hissGain.gain.setTargetAtTime(hissLevel * HISS_LEVEL, context.currentTime, 0.25)
    },

    zap() {
      const now = context.currentTime
      const end = now + ZAP_SECONDS

      const gain = context.createGain()
      gain.connect(destination)
      // Attaque quasi immédiate puis extinction : c'est un « chhht », pas une nappe.
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(1.35, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)

      // Bruit dont la bande passante balaie le spectre : le son d'une molette.
      // ⚠️ Q volontairement bas : une bande étroite ne laisse presque plus
      // d'énergie passer, et le zapping s'entendait 13 dB sous la musique.
      const band = context.createBiquadFilter()
      band.type = 'bandpass'
      band.Q.value = 1.1
      const from = 300 + Math.random() * 500
      const to = 2200 + Math.random() * 2200
      band.frequency.setValueAtTime(from, now)
      band.frequency.exponentialRampToValueAtTime(to, end)

      const source = context.createBufferSource()
      source.buffer = noiseBuffer
      source.loop = true
      source.connect(band)
      band.connect(gain)
      source.start(now)
      source.stop(end + 0.05)

      // Le sifflement d'accord, qui glisse en sens inverse du balayage.
      const whistleGain = context.createGain()
      whistleGain.gain.setValueAtTime(0.0001, now)
      whistleGain.gain.exponentialRampToValueAtTime(0.06, now + 0.05)
      whistleGain.gain.exponentialRampToValueAtTime(0.0001, end)
      whistleGain.connect(destination)

      const whistle = context.createOscillator()
      whistle.type = 'sine'
      whistle.frequency.setValueAtTime(to * 0.8, now)
      whistle.frequency.exponentialRampToValueAtTime(Math.max(120, from * 0.6), end)
      whistle.connect(whistleGain)
      whistle.start(now)
      whistle.stop(end + 0.05)

      // On débranche une fois éteint, sinon les nœuds s'accumulent à chaque zapping.
      source.onended = () => {
        band.disconnect()
        gain.disconnect()
      }
      whistle.onended = () => whistleGain.disconnect()
    },

    dispose() {
      window.clearInterval(breathId)
      try {
        hissSource.stop()
      } catch {
        // Déjà arrêté : rien à faire.
      }
      hissGain.disconnect()
    },
  }
}

/**
 * Deux secondes de bruit blanc, générées une fois et jouées en boucle.
 *
 * Deux secondes suffisent : le bruit blanc n'a pas de motif, on n'entend donc
 * pas la boucle. Un buffer plus long ne ferait que consommer de la mémoire.
 */
function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = context.sampleRate * 2
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}
