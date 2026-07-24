import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Config Vite. On garde le minimum : le plugin React suffit pour du R3F.
export default defineConfig({
  plugins: [react()],
})
