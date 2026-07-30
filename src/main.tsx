import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installConsoleNoiseFilters } from './devtools/consoleNoiseFilters'
import './index.css'

installConsoleNoiseFilters()

// Point d'entree : on n'y touche presque jamais (voir docs/02-ARCHITECTURE.md).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
