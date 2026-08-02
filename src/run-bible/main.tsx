import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RunBibleApp from './RunBibleApp'
import './RunBible.css'

createRoot(document.getElementById('run-bible')!).render(
  <StrictMode>
    <RunBibleApp />
  </StrictMode>,
)
