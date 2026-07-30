import { RADIO_STATIONS } from '../../../audio/radioCatalog'
import { useRadioStore } from '../../../audio/radioStore'
import { playPhoneSound } from '../../../gameplay/phone/phoneSounds'
import { PHONE, appScroll, appSectionLabel, card } from '../phoneStyle'

/**
 * 🎧 Application Radio — écouter les stations du jeu **à pied**, au casque.
 *
 * Rien du système audio n'a été dupliqué : `RadioAudioSystem` ne connaît que
 * « une source active » + « une station ». Le téléphone est simplement une
 * source de plus (`PHONE_RADIO_ID`), au même titre que l'autoradio. Deux sources
 * réglées sur la même station diffusent la même chanson au même instant : sortir
 * de la voiture avec le casque, c'est la même chanson qui continue.
 *
 * ⚠️ Une seule source à la fois. **Au volant, l'autoradio a la main** : l'app
 * bascule alors en télécommande de l'autoradio (choisir la station depuis le
 * téléphone plutôt qu'en martelant R), et le casque n'est pas proposé.
 */
export default function RadioApp() {
  const activeSource = useRadioStore((s) => s.activeSource)
  const currentStationId = useRadioStore((s) => s.currentStationId)
  const contentLabel = useRadioStore((s) => s.currentContentLabel)
  const phoneStationId = useRadioStore((s) => s.phoneStationId)
  const volume = useRadioStore((s) => s.volume)
  const setVolume = useRadioStore((s) => s.setVolume)

  const inVehicle = activeSource?.kind === 'vehicle'
  const onHeadphones = activeSource?.kind === 'phone'

  /** Un clic sur une station : télécommande au volant, casque à pied. */
  const pickStation = (stationId: (typeof RADIO_STATIONS)[number]['id']) => {
    playPhoneSound('tap')
    const radio = useRadioStore.getState()
    if (inVehicle) radio.setStation(stationId)
    else radio.startPhoneRadio(stationId)
  }

  const togglePower = () => {
    playPhoneSound('tap')
    const radio = useRadioStore.getState()
    if (inVehicle) {
      radio.setStation(currentStationId ? null : (phoneStationId ?? RADIO_STATIONS[0].id))
      return
    }
    if (onHeadphones) radio.stopPhoneRadio()
    else radio.startPhoneRadio(phoneStationId ?? RADIO_STATIONS[0].id)
  }

  const playing = Boolean(currentStationId)

  return (
    <div style={appScroll}>
      <div
        style={{
          ...card,
          display: 'grid',
          gap: 8,
          background: playing
            ? 'linear-gradient(150deg, rgba(56,189,248,0.22), rgba(37,99,235,0.18))'
            : PHONE.card,
          borderColor: playing ? 'rgba(56, 189, 248, 0.35)' : undefined,
        }}
      >
        <span style={{ font: `800 9px ${PHONE.font}`, letterSpacing: 0.8, color: PHONE.textDim, textTransform: 'uppercase' }}>
          {inVehicle ? 'Autoradio' : onHeadphones ? 'Écouteurs' : 'Éteint'}
        </span>
        <strong style={{ font: `900 15px ${PHONE.font}` }}>
          {currentStationId ? RADIO_STATIONS.find((s) => s.id === currentStationId)?.shortName : 'Silence'}
        </strong>
        <span style={{ font: `10px ${PHONE.font}`, color: PHONE.textDim, minHeight: 13 }}>
          {playing ? (contentLabel ?? 'Antenne muette') : 'Choisis une station.'}
        </span>

        <button type="button" onClick={togglePower} style={{ ...buttonStyle, marginTop: 2 }}>
          {playing ? '■ Couper' : inVehicle ? '▶ Allumer l’autoradio' : '🎧 Mettre les écouteurs'}
        </button>
      </div>

      {inVehicle && (
        <div style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
          Tu es au volant : le téléphone pilote l’autoradio (comme la touche R). Le casque
          revient dès que tu descends.
        </div>
      )}

      <div style={appSectionLabel}>Stations</div>
      {RADIO_STATIONS.map((station) => {
        const isCurrent = station.id === currentStationId
        return (
          <button
            key={station.id}
            type="button"
            onClick={() => pickStation(station.id)}
            style={{
              ...card,
              display: 'grid',
              gap: 2,
              textAlign: 'left',
              cursor: 'pointer',
              color: 'inherit',
              borderColor: isCurrent ? 'rgba(125, 211, 252, 0.55)' : undefined,
              background: isCurrent ? 'rgba(125, 211, 252, 0.14)' : PHONE.card,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong style={{ font: `800 12px ${PHONE.font}` }}>{station.name}</strong>
              {isCurrent && <span style={{ font: `800 9px ${PHONE.font}`, color: PHONE.accent }}>● EN COURS</span>}
              {station.musicTracks.length === 0 && (
                <span style={{ font: `700 9px ${PHONE.font}`, color: PHONE.muted }}>· sans musique</span>
              )}
            </span>
            <span style={{ font: `italic 10px ${PHONE.font}`, color: PHONE.textDim, lineHeight: 1.4 }}>
              {station.slogan}
            </span>
            <span style={{ font: `9px ${PHONE.font}`, color: PHONE.muted }}>{station.style}</span>
          </button>
        )
      })}

      <div style={appSectionLabel}>Volume</div>
      <div style={{ ...card, display: 'grid', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: `800 11px ${PHONE.font}` }}>
          <span>Sortie radio</span>
          <span style={{ color: PHONE.accent, font: `800 11px ${PHONE.mono}` }}>{Math.round(volume * 100)} %</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => setVolume(Number(event.target.value) / 100)}
          style={{ width: '100%', accentColor: PHONE.accent, cursor: 'pointer' }}
        />
      </div>

      <div style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
        Les stations diffusent en direct : elles jouent la même chose pour tout le monde, au
        même moment. Une station sans fichier dans <code>public/musique/radio/</code> reste muette.
      </div>
    </div>
  )
}

const buttonStyle = {
  padding: '8px 0',
  borderRadius: 10,
  border: PHONE.cardBorder,
  background: 'rgba(148, 163, 184, 0.16)',
  color: PHONE.text,
  font: `800 11px ${PHONE.font}`,
  cursor: 'pointer',
}
