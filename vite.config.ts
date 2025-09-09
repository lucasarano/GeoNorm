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
  server: {
    proxy: {
      "/api": {
        target: "https://42f2424bd34d.ngrok-free.app",
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: "https://42f2424bd34d.ngrok-free.app",
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
