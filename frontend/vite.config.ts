import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/baixar-modelo': 'http://localhost:3000',
    },
  },
})
