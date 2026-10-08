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
 */
export const SOGLIA_AFFIANCATO = '(min-width: 1100px)'

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
