import { useState } from 'react'
import { useDevTuningStore } from '../devTuningStore'
import {
  buttonStyle,
  fieldStyle,
  ghostButtonStyle,
  helpStyle,
  searchInputStyle,
  dangerButtonStyle,
} from './devPanelStyles'

/**
 * Onglet « Mes reglages » : enregistrer une configuration complete sous un nom,
 * la recharger plus tard, comparer deux ambiances de conduite.
 *
 * Ces prereglages vivent dans le navigateur (localStorage), pas dans le depot :
 * pour partager un reglage a l autre dev, il faut passer par l onglet JSON.
 */
export default function SavedPresetsTools() {
  const savedPresets = useDevTuningStore((s) => s.savedPresets)
  const saveUserPreset = useDevTuningStore((s) => s.saveUserPreset)
  const applyUserPreset = useDevTuningStore((s) => s.applyUserPreset)
  const deleteUserPreset = useDevTuningStore((s) => s.deleteUserPreset)
  const [name, setName] = useState('')

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={fieldStyle}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>Enregistrer les reglages actuels</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={searchInputStyle}
            placeholder="Nom (ex. voiture arcade, scooter realiste)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            style={buttonStyle}
            disabled={!name.trim()}
            onClick={() => {
              saveUserPreset(name)
              setName('')
            }}
          >
            Enregistrer
          </button>
        </div>
        <small style={helpStyle}>
          Enregistre TOUS les reglages en cours (joueur, vehicules, camera, ciel). Reutiliser un nom
          existant l ecrase.
        </small>
      </div>

      {savedPresets.length === 0 ? (
        <small style={helpStyle}>Aucun reglage enregistre pour l instant.</small>
      ) : (
        savedPresets.map((preset) => (
          <div key={preset.name} style={{ ...fieldStyle, gridTemplateColumns: '1fr auto auto', display: 'grid', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 750, fontSize: 13 }}>{preset.name}</div>
              <small style={helpStyle}>
                Enregistre le {new Date(preset.createdAt).toLocaleString('fr-FR')}
              </small>
            </div>
            <button style={ghostButtonStyle} onClick={() => applyUserPreset(preset.name)}>
              Charger
            </button>
            <button style={dangerButtonStyle} onClick={() => deleteUserPreset(preset.name)}>
              Supprimer
            </button>
          </div>
        ))
      )}
    </div>
  )
}
