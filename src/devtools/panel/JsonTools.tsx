import {
  actionRowStyle,
  buttonStyle,
  dangerButtonStyle,
  errorStyle,
  helpStyle,
  infoStyle,
  jsonBoxStyle,
  textareaStyle,
} from './devPanelStyles'

/** Onglet JSON : l'export brut des reglages, pour les partager au projet. */
export default function JsonTools({
  jsonText,
  jsonError,
  jsonInfo,
  onChange,
  onApply,
  onSaveProject,
  onRefresh,
}: {
  jsonText: string
  jsonError: string | null
  jsonInfo: string | null
  onChange: (json: string) => void
  onApply: () => void
  onSaveProject: () => void
  onRefresh: () => void
}) {
  return (
    <div style={jsonBoxStyle}>
      <small style={helpStyle}>
        Ce texte est l export de TOUS les reglages modifies. « Importer » l applique dans ton
        navigateur seulement. « Ecrire dev-tuning.json » le rend officiel pour tout le projet.
      </small>
      <textarea
        style={textareaStyle}
        spellCheck={false}
        value={jsonText}
        onChange={(event) => onChange(event.target.value)}
      />
      {jsonError && <div style={errorStyle}>{jsonError}</div>}
      {jsonInfo && <div style={infoStyle}>{jsonInfo}</div>}
      <div style={actionRowStyle}>
        <button style={buttonStyle} onClick={onRefresh}>Rafraichir</button>
        <button style={buttonStyle} onClick={onApply}>Importer</button>
        <button style={dangerButtonStyle} onClick={onSaveProject}>Ecrire dev-tuning.json</button>
      </div>
    </div>
  )
}
