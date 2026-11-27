/**
 * Quanto è grande il testo su QUESTO telefono o tablet.
 *
 * Chi ci vede meno lo ingrandisce da IMPOSTAZIONI; gli altri non vedono
 * cambiare niente. Si ingrandisce tutto insieme — scritte e tasti — con lo
 * stesso `zoom` che index.css usa per i tablet: un'etichetta più grande dentro
 * un tasto rimasto piccolo andrebbe a capo.
 *
 * Sta nel telefono e non nel profilo: lo stesso coach può volerlo grande sul
 * telefono e normale sul tablet.
 */

const CHIAVE = 'gymcoach.testo'

export const MISURE = [
  { id: 'normale', nome: 'Normale', lettera: 16 },
  { id: 'grande', nome: 'Grande', lettera: 21 },
  { id: 'molto', nome: 'Molto grande', lettera: 26 },
]

export function leggiTesto() {
  try {
    const v = localStorage.getItem(CHIAVE)
    return MISURE.some(m => m.id === v) ? v : 'normale'
  } catch { return 'normale' }
}

/** Mette la misura sulla pagina: la legge index.css (`:root[data-testo]`). */
export function applicaTesto(misura = leggiTesto()) {
  if (typeof document === 'undefined') return
  if (misura === 'normale') delete document.documentElement.dataset.testo
  else document.documentElement.dataset.testo = misura
}

export function scegliTesto(misura) {
  try { localStorage.setItem(CHIAVE, misura) } catch { /* vale per questa visita */ }
  applicaTesto(misura)
}
