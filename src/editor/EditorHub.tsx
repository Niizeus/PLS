import { useState } from 'react'
import EditorApp from './EditorApp'
import InteriorEditor from './InteriorEditor'

type EditorModule = 'map' | 'interiors'

export default function EditorHub() {
  const [module, setModule] = useState<EditorModule>('map')

  const tabs = (
    <div className="editor-module-tabs" aria-label="Module editeur">
      <button type="button" className={module === 'map' ? 'active' : ''} onClick={() => setModule('map')}>
        Carte
      </button>
      <button
        type="button"
        className={module === 'interiors' ? 'active' : ''}
        onClick={() => setModule('interiors')}
      >
        Interieurs
      </button>
    </div>
  )

  if (module === 'interiors') return <InteriorEditor moduleTabs={tabs} />
  return <EditorApp moduleTabs={tabs} />
}
