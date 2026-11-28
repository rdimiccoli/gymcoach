/**
 * L'app vera con il collegamento VERO a Supabase (supabaseClient.js, la copia
 * dei dati sul telefono, l'accesso senza rete), ma puntato a un indirizzo
 * finto: le risposte le dà la prova stessa (rete.spec.js). Così si prova il
 * turno che si apre senza rete passando da tutti i pezzi veri.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const radice = path.resolve(import.meta.dirname, '..')

function senzaAggiornamenti() {
  return {
    name: 'senza-aggiornamenti', enforce: 'pre',
    resolveId(richiesto) {
      if (richiesto === 'virtual:pwa-register/react') return path.join(radice, 'prove/finto-pwa.js')
      return null
    },
  }
}

export default defineConfig({
  root: radice,
  plugins: [senzaAggiornamenti(), react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://finto.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('chiave-anonima-finta'),
    __VERSIONE__: JSON.stringify('prova'),
  },
  server: { port: 5198, strictPort: true },
})
