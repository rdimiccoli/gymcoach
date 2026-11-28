import { useState, useEffect } from 'react'

/**
 * Se c'è spazio per affiancare l'elenco delle persone e la scheda aperta.
 *
 * In palestra il tablet lo tengono sdraiato: 1180x820, oppure 1280x800. Lì
 * c'è larghezza per due colonne e manca l'altezza per una sola lunga, che
 * costringe a scorrere su e giù con le mani sporche.
 *
 * La soglia è sulla larghezza VERA dello schermo, non su quella già divisa
 * per l'ingrandimento: è la stessa misura con cui `index.css` decide di
 * spostare il menu di lato, e le due cose devono scattare insieme.
 *
 * ── Perché 1000 e non più 1100 (28/11/2026) ──────────────────────────────
 * Con 1100 le due colonne comparivano solo sugli iPad larghi almeno 1100
 * punti in orizzontale. I coach usano iPad di modelli diversi:
 *   iPad Air 3ª generazione     1112 × 834   → funzionava
 *   iPad 9ª generazione         1080 × 810   → no, per 20 punti
 *   iPad Pro 9,7" e iPad «vecchi» 1024 × 768 → no
 * Su questi ultimi il menu andava di lato (che scatta a 1000), ma la seduta
 * restava in una colonna: sembrava una funzione rotta. Ora la soglia è la
 * stessa del menu, come diceva già questo commento. Un tablet in piedi
 * (768–834 punti) resta in una colonna, con la barra in basso.
 */
export const SOGLIA_AFFIANCATO = '(min-width: 1000px)'

export function useSchermoLargo(query = SOGLIA_AFFIANCATO) {
  const [largo, setLargo] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const cambia = e => setLargo(e.matches)
    // Girare il tablet cambia la risposta: va seguito, non letto una volta.
    mq.addEventListener('change', cambia)
    setLargo(mq.matches)
    return () => mq.removeEventListener('change', cambia)
  }, [query])

  return largo
}
