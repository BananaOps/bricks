// `vitest/config` et non `vite` : depuis Vitest 4, le bloc `test` n'est plus
// greffé sur le type de configuration de Vite et doit venir d'ici.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API is proxied in development so the browser sees one origin and
    // CORS never enters the picture while working locally.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:8080', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
