import { getCurrentRadioLabel, useRadioStore } from '../../../audio/radioStore'
import { PHONE, appScroll, appSectionLabel, card } from '../phoneStyle'

/**
 * ⚙️ Application Réglages — volontairement PETITE.
 *
 * Elle n'expose que les réglages qui existent **vraiment** aujourd'hui, c'est-à-dire
 * ceux de la radio (`audio/radioStore.ts`, déjà sauvegardés). Tout le reste
 * (luminosité, volumes séparés, sensibilité, touches) attend un **vrai système de
 * paramètres joueur**, qui n'existe pas encore et qui est un chantier à part —
 * voir `docs/07-BACKLOG-IDEES.md` § 2.2.
 *
 * ⚠️ À ne pas confondre avec le panneau **DEV `F2`** (`src/devtools/`), qui reste
 * réservé au développement et ne doit pas devenir le menu options du jeu.
 */

/** Ce qui devra atterrir ici quand le système de paramètres existera. */
const PLANNED = [
  'Volume général',
  'Volume musique',
  'Volume effets',
  'Luminosité',
  'Sensibilité souris',
  'Configuration des touches',
]

export default function SettingsApp() {
  const volume = useRadioStore((s) => s.volume)
  const setVolume = useRadioStore((s) => s.setVolume)
  const radioFilterEnabled = useRadioStore((s) => s.radioFilterEnabled)
  const setRadioFilterEnabled = useRadioStore((s) => s.setRadioFilterEnabled)
  const stationLabel = getCurrentRadioLabel()

  return (
    <div style={appScroll}>
      <div style={appSectionLabel}>Radio</div>

      <div style={{ ...card, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: `800 11px ${PHONE.font}` }}>
          <span>Volume</span>
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
        <span style={{ font: `10px ${PHONE.font}`, color: PHONE.textDim }}>
          {stationLabel ? `En cours : ${stationLabel}` : 'Aucune radio allumée (monte en voiture, touche R).'}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setRadioFilterEnabled(!radioFilterEnabled)}
        style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
      >
        <span style={{ flex: 1 }}>
          <strong style={{ display: 'block', font: `800 11px ${PHONE.font}` }}>Grain radio</strong>
          <span style={{ font: `10px ${PHONE.font}`, color: PHONE.textDim }}>
            Le son passe par un filtre « vieux poste ».
          </span>
        </span>
        {/* Interrupteur maison : pas de dépendance, et il suit le style du tel. */}
        <span
          style={{
            width: 38,
            height: 21,
            borderRadius: 999,
            padding: 2,
            background: radioFilterEnabled ? 'rgba(125, 211, 252, 0.8)' : 'rgba(148, 163, 184, 0.3)',
            transition: 'background 160ms ease',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: '#fff',
              transform: radioFilterEnabled ? 'translateX(17px)' : 'none',
              transition: 'transform 160ms ease',
            }}
          />
        </span>
      </button>

      <div style={appSectionLabel}>Pas encore branché</div>
      <div style={{ display: 'grid', gap: 5 }}>
        {PLANNED.map((label) => (
          <div
            key={label}
            style={{
              ...card,
              borderStyle: 'dashed',
              font: `800 10px ${PHONE.font}`,
              color: PHONE.muted,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
        Le jeu n’a pas encore de système de paramètres joueur. Ces réglages arriveront tous
        ensemble, et le téléphone n’en sera qu’une façade.
      </div>
    </div>
  )
}
