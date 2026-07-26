import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ScheduleEditor from './ScheduleEditor'

/**
 * Point d'entrée de la **Régie** — l'outil de programmation des radios.
 *
 * C'est une page à part (`regie.html`), pas un écran du jeu : elle n'est servie
 * qu'en `npm run dev` et ne fait pas partie du build. Ouvre-la sur
 * http://localhost:5173/regie.html
 */
createRoot(document.getElementById('regie')!).render(
  <StrictMode>
    <ScheduleEditor />
  </StrictMode>,
)
