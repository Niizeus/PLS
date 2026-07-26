import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import radioManifestPlugin from './vite/radioManifestPlugin'

// Config Vite. Le plugin React suffit pour du R3F ; `radioManifestPlugin` scanne
// `public/musique/radio/` pour que les fichiers audio déposés soient joués sans code.
export default defineConfig({
  plugins: [react(), radioManifestPlugin()],
})
