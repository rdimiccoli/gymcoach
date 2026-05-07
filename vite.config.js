import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'logo_OAD.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      manifest: {
        name: 'GymCoach',
        short_name: 'GymCoach',
        description: 'Gestione schede, carichi e progressi',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
