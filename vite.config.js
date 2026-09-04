import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // 1,9 MB di sourcemap servite pubblicamente a ogni deploy. Il repo e' gia'
  // pubblico quindi non era un segreto, ma era peso inutile sul CDN.
  build: { sourcemap: false },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // skipWaiting/clientsClaim erano in contraddizione con registerType:'prompt':
        // facevano attivare subito il nuovo service worker, quindi non c'era mai un
        // SW "in attesa", needRefresh non diventava mai true e il banner
        // "Aggiornamento disponibile" non compariva mai. In più il SW prendeva il
        // controllo a metà sessione dopo che cleanupOutdatedCaches aveva già
        // buttato i chunk vecchi, con il rischio di pagine che non si caricavano.
        cleanupOutdatedCaches: true,
      },
      includeAssets: ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'logo_OAD.png'],
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
