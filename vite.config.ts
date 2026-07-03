import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendor libraries into their own chunks so the app shell
        // stays small and these rarely-changing deps cache independently of
        // app code. recharts (+ its d3 deps) is by far the largest.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('recharts') ||
            id.includes('/d3-') ||
            id.includes('victory-vendor')
          ) {
            return 'recharts'
          }
          if (id.includes('/react') || id.includes('/scheduler/')) {
            return 'react'
          }
        },
      },
    },
  },
})
