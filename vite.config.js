import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import localMediaPlugin from './vite-plugin-local-media.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localMediaPlugin()],
})
