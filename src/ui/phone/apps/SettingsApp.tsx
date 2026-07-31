import { getCurrentRadioLabel, useRadioStore } from '../../../audio/radioStore'
import { playPhoneSound } from '../../../gameplay/phone/phoneSounds'
import { SETTINGS_RANGE, useSettingsStore } from '../../../gameplay/settings/settingsStore'
import { PHONE, appScroll, appSectionLabel, card } from '../phoneStyle'

/**
 * ⚙️ Application Réglages — le menu d'options du jeu.
 *
 * Elle n'invente rien : elle pilote `gameplay/settings/settingsStore.ts` (son,
 * image, souris — sauvegardés) et `audio/radioStore.ts` pour ce qui appartient
 * à la radio. Le jour où il y aura un menu pause, il lira les mêmes stores :
 * cette app n'est qu'une **façade**, pas le système.
 *
 * ⚠️ À ne pas confondre avec le panneau **DEV `F2`** (`src/devtools/`), qui
 * expose des constantes d'équilibrage et reste réservé au développement.
 */
export default function SettingsApp() {
  const settings = useSettingsStore()
  const radioVolume = useRadioStore((s) => s.volume)
  const setRadioVolume = useRadioStore((s) => s.setVolume)
  const radioFilterEnabled = useRadioStore((s) => s.radioFilterEnabled)
  const setRadioFilterEnabled = useRadioStore((s) => s.setRadioFilterEnabled)
  const stationLabel = getCurrentRadioLabel()

  return (
    <div style={appScroll}>
      <div style={appSectionLabel}>Son</div>
      <div style={{ ...card, display: 'grid', gap: 12 }}>
        <Slider
          label="Volume général"
          value={settings.masterVolume}
          range={SETTINGS_RANGE.masterVolume}
          format={percent}
          onChange={(value) => settings.set('masterVolume', value)}
        />
        <Slider
          label="Bruitages"
          hint="Téléphone, klaxon…"
          value={settings.sfxVolume}
          range={SETTINGS_RANGE.sfxVolume}
          format={percent}
          onChange={(value) => settings.set('sfxVolume', value)}
        />
        <Slider
          label="Radio"
          hint={stationLabel ? `En cours : ${stationLabel}` : 'Aucune radio allumée.'}
          value={radioVolume}
          range={{ min: 0, max: 1 }}
          format={percent}
          onChange={setRadioVolume}
        />
      </div>

      <Toggle
        label="Grain radio"
        hint="Le son passe par un filtre « vieux poste »."
        checked={radioFilterEnabled}
        onChange={setRadioFilterEnabled}
      />

      <div style={appSectionLabel}>Image</div>
      <div style={{ ...card, display: 'grid', gap: 6 }}>
        <Slider
          label="Luminosité"
          value={settings.brightness}
          range={SETTINGS_RANGE.brightness}
          step={0.02}
          format={(value) => `${Math.round(value * 100)} %`}
          onChange={(value) => settings.set('brightness', value)}
        />
        <span style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
          Agit sur l’image finie, comme le bouton de ton écran — l’ambiance du jeu (ciel,
          lumières, brouillard) n’est pas touchée.
        </span>
      </div>

      <div style={appSectionLabel}>Souris</div>
      <div style={{ ...card, display: 'grid', gap: 12 }}>
        <Slider
          label="Sensibilité"
          value={settings.mouseSensitivity}
          range={SETTINGS_RANGE.mouseSensitivity}
          step={0.05}
          format={(value) => `×${value.toFixed(2)}`}
          onChange={(value) => settings.set('mouseSensitivity', value)}
        />
      </div>

      <Toggle
        label="Inverser l’axe vertical"
        hint="Souris vers le haut = la vue baisse."
        checked={settings.invertY}
        onChange={(value) => settings.set('invertY', value)}
      />

      <div style={appSectionLabel}>Touches</div>
      <div style={{ ...card, borderStyle: 'dashed', font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.5 }}>
        La configuration des touches n’est <strong>pas encore modifiable</strong> : la carte des
        touches (`keyMap.ts`) est une constante figée, la rendre remappable est un chantier à part.
        Le rappel des touches actuelles s’ouvre avec <strong>F1</strong>.
      </div>

      <button
        type="button"
        onClick={() => {
          playPhoneSound('back')
          settings.resetSettings()
        }}
        style={{
          ...card,
          textAlign: 'center',
          cursor: 'pointer',
          color: PHONE.text,
          font: `800 11px ${PHONE.font}`,
        }}
      >
        Rétablir les valeurs par défaut
      </button>

      <div style={{ font: `10px ${PHONE.font}`, color: PHONE.muted, lineHeight: 1.45 }}>
        Ces réglages sont sauvegardés : tu les retrouveras au prochain lancement.
      </div>
    </div>
  )
}

const percent = (value: number) => `${Math.round(value * 100)} %`

interface SliderProps {
  label: string
  hint?: string
  value: number
  range: { min: number; max: number }
  step?: number
  format: (value: number) => string
  onChange: (value: number) => void
}

/**
 * Un curseur. Il travaille en valeurs RÉELLES (0.6, 1.4, ×1.35...) et pas en
 * pourcentages : c'est le store qui définit les bornes, l'interface s'y plie.
 */
function Slider({ label, hint, value, range, step = 0.01, format, onChange }: SliderProps) {
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: `800 11px ${PHONE.font}` }}>
        <span>{label}</span>
        <span style={{ color: PHONE.accent, font: `800 11px ${PHONE.mono}` }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: PHONE.accent, cursor: 'pointer' }}
      />
      {hint && <span style={{ font: `10px ${PHONE.font}`, color: PHONE.textDim }}>{hint}</span>}
    </div>
  )
}

/** Un interrupteur maison : pas de dépendance, et il suit le style du téléphone. */
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        playPhoneSound('tap')
        onChange(!checked)
      }}
      style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', font: `800 11px ${PHONE.font}` }}>{label}</strong>
        {hint && <span style={{ font: `10px ${PHONE.font}`, color: PHONE.textDim }}>{hint}</span>}
      </span>
      <span
        style={{
          flex: '0 0 auto',
          width: 38,
          height: 21,
          borderRadius: 999,
          padding: 2,
          background: checked ? 'rgba(125, 211, 252, 0.8)' : 'rgba(148, 163, 184, 0.3)',
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
            transform: checked ? 'translateX(17px)' : 'none',
            transition: 'transform 160ms ease',
          }}
        />
      </span>
    </button>
  )
}
