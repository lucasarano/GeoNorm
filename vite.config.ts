import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devPort = Number(process.env.VITE_PORT || process.env.PORT || 5174)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    // Enable React Refresh for development
    fastRefresh: true
  })],
  root: './frontend',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend"),
    },
  },
  optimizeDeps: {
    include: ['firebase/auth', 'firebase/firestore', 'firebase/app']
  },
  build: {
    target: 'esnext',
    minify: 'esbuild'
  },
  server: {
    port: devPort,
    host: '0.0.0.0',
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/health": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
