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
 * 🔊 Niveau nominal du souffle — **le réglage à toucher s'il gêne**.
 *
 * Il vise environ **45 dB sous la musique**, ce qui correspond au souffle d'une
 * bande magnétique : présent quand on tend l'oreille, invisible sous un morceau.
 *
 * ⚠️ Un premier réglage à `0.024` sortait le souffle à **−22 dB**, et il mangeait
 * les musiques. C'est le piège du bruit large bande : à niveau égal, il masque
 * infiniment plus qu'un son musical, parce qu'il occupe TOUTES les fréquences à
 * la fois. Un souffle « discret » se règle donc beaucoup plus bas que l'intuition
 * ne le suggère.
 *
 * Pour l'ajuster : `0` le supprime, `0.005` le rend franchement audible.
 */
const HISS_LEVEL = 0.0018
/** Cadence à laquelle le souffle change d'intensité (ms). */
const HISS_BREATH_MS = 900
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
  //
  // ⚠️ La bande a été REMONTÉE (elle allait de 1,2 à 6,5 kHz). C'est exactement
  // là que vit le corps d'un morceau — voix, caisse claire, synthés : le souffle
  // se posait donc pile dessus et le masquait, même à faible niveau. En le
  // plaçant au-dessus, il s'entend comme un souffle de poste sans jamais entrer
  // en concurrence avec la musique.
  const hissHigh = context.createBiquadFilter()
  hissHigh.type = 'highpass'
  hissHigh.frequency.value = 3800
  const hissLow = context.createBiquadFilter()
  hissLow.type = 'lowpass'
  hissLow.frequency.value = 9500

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
  // La plupart du temps le souffle reste sous son niveau nominal ; il ne monte
  // au-dessus que de temps en temps. C'est ce que veut dire « un petit grain
  // parfois » : une nappe constante s'entend comme un défaut, une nappe qui
  // respire s'entend comme un poste.
  const breathId = window.setInterval(() => {
    if (hissLevel <= 0) return
    const swell = Math.random() < 0.25 ? 0.9 + Math.random() * 0.5 : 0.15 + Math.random() * 0.5
    hissGain.gain.setTargetAtTime(hissLevel * HISS_LEVEL * swell, context.currentTime, 0.5)
  }, HISS_BREATH_MS)

  return {
    setHiss(level) {
      const next = Math.max(0, level)
      // ⚠️ Sans ce garde-fou, la régie rappelait `setHiss` toutes les 250 ms et
      // écrasait à chaque fois l'automation de la respiration : le souffle
      // restait collé à son niveau nominal au lieu de vivre.
      if (next === hissLevel) return
      hissLevel = next
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
