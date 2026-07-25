import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward any request starting with /api to the Express backend.
    // Lets the frontend call "/api/..." without hardcoding the backend URL.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
