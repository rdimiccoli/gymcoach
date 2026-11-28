/**
 * L'app vera, ma con un database finto (finto-supabase.js) al posto di
 * Supabase: serve alle prove automatiche (app.spec.js), che girano su GitHub a
 * ogni modifica e non devono toccare i dati veri della palestra.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const radice = path.resolve(import.meta.dirname, '..')
const finti = {
  [path.join(radice, 'src/supabaseClient')]: path.join(radice, 'prove/finto-supabase.js'),
}

function scambiaModuli() {
  return {
    name: 'scambia-moduli', enforce: 'pre',
    async resolveId(richiesto, chi, opzioni) {
      if (richiesto === 'virtual:pwa-register/react') return path.join(radice, 'prove/finto-pwa.js')
      if (opzioni.isEntry || richiesto.startsWith('/prove')) return null
      const trovato = await this.resolve(richiesto, chi, { ...opzioni, skipSelf: true })
      if (!trovato) return null
      const senza = trovato.id.split('?')[0].replace(/\.(js|jsx)$/, '')
      return finti[senza] || trovato
    },
  }
}

export default defineConfig({ root: radice, plugins: [scambiaModuli(), react()], server: { port: 5199, strictPort: true } })
