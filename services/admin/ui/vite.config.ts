import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15_000,
    exclude: ['e2e/**', 'node_modules/**'],
  },
  build: {
    outDir: '../static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/usage': 'http://localhost:8002',
      '/health': 'http://localhost:8002',
      '/alerts': 'http://localhost:8002',
      '/admin': 'http://localhost:8002',
    },
  },
})
