import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En dev el navegador usa el mismo origen (/api, /images) y Vite proxya al
// backend, igual que nginx en produccion. Destino configurable con VITE_DEV_API
// (solo desarrollo; en produccion manda el proxy de nginx, sin IPs fijas).
const devApi = process.env.VITE_DEV_API || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: devApi, changeOrigin: true },
      '/images': { target: devApi, changeOrigin: true }
    }
  },
  preview: {
    port: 5173,
    proxy: {
      '/api': { target: devApi, changeOrigin: true },
      '/images': { target: devApi, changeOrigin: true }
    }
  }
})
