import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    host: true,
  },

  preview: {
    port: 4173,
    host: true,
  },

  build: {
    target: 'es2022',
    // Sourcemaps ficam fora do bundle de producao, mas continuam disponiveis
    // para depurar um build quando necessario (`npm run build -- --sourcemap`).
    sourcemap: false,
    // Avisa cedo se algum chunk crescer demais (BL-040: performance).
    chunkSizeWarningLimit: 500,
  },
})
