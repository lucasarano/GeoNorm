import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: './frontend',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend"),
    },
  },
  optimizeDeps: {
    include: ['firebase/auth', 'firebase/firestore', 'firebase/app']
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
