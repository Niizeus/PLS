import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EditorHub from './EditorHub'
import './EditorApp.css'

/**
 * Point d'entree de l'editeur PLS.
 *
 * Page dev-only separee du jeu principal : http://localhost:5173/editor.html
 */
createRoot(document.getElementById('editor')!).render(
  <StrictMode>
    <EditorHub />
  </StrictMode>,
)
