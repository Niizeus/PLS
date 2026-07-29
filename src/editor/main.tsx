import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EditorHub from './EditorHub'
import EditorErrorBoundary from './EditorErrorBoundary'
import './EditorApp.css'

/**
 * Point d'entree de l'editeur PLS.
 *
 * Page dev-only separee du jeu principal : http://localhost:5173/editor.html
 *
 * L'ErrorBoundary evite la page blanche muette : si un composant plante, on voit
 * l'erreur et le fichier fautif au lieu d'un ecran vide (voir EditorErrorBoundary.tsx).
 */
createRoot(document.getElementById('editor')!).render(
  <StrictMode>
    <EditorErrorBoundary>
      <EditorHub />
    </EditorErrorBoundary>
  </StrictMode>,
)
