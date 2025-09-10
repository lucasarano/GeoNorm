import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: './frontend',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true
  },
  envPrefix: ['VITE_', 'FIREBASE_'],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.NODE_ENV === 'production' ? "http://localhost:8080" : "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: process.env.NODE_ENV === 'production' ? "http://localhost:8080" : "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
