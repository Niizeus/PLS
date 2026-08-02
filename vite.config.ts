import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import radioManifestPlugin from './vite/radioManifestPlugin'
import radioSchedulePlugin from './vite/radioSchedulePlugin'
import mapMarkersPlugin from './vite/mapMarkersPlugin'
import zonesPlugin from './vite/zonesPlugin'
import devTuningPlugin from './vite/devTuningPlugin'
import interiorsPlugin from './vite/interiorsPlugin'
import perfReportPlugin from './vite/perfReportPlugin'
import chunkOverridesPlugin from './vite/chunkOverridesPlugin'
import runBiblePlugin from './vite/runBiblePlugin'

// Config Vite. Le plugin React suffit pour du R3F ; `radioManifestPlugin` scanne
// `public/musique/radio/` pour que les fichiers audio déposés soient joués sans code,
// et `radioSchedulePlugin` laisse la page Régie enregistrer la grille sur le disque
// (en développement uniquement — voir vite/radioSchedulePlugin.ts).
//
// ⚠️ `regie.html` est un outil de développement : il n'est PAS dans les entrées du
// build, donc il ne part pas dans le jeu compilé.
export default defineConfig({
  plugins: [
    react(),
    radioManifestPlugin(),
    radioSchedulePlugin(),
    mapMarkersPlugin(),
    zonesPlugin(),
    interiorsPlugin(),
    devTuningPlugin(),
    perfReportPlugin(),
    chunkOverridesPlugin(),
    runBiblePlugin(),
  ],
})
