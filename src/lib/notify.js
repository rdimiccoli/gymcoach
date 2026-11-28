// Canale unico per gli avvisi a schermo.
// Serve perché fino ad ora ogni errore di Supabase veniva ignorato in silenzio:
// il coach vedeva il valore salvato anche quando la scrittura era fallita.

const listeners = new Set()

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(type, text) {
  const msg = { id: Date.now() + Math.random(), type, text }
  listeners.forEach(fn => fn(msg))
}

// Chi vuole sapere degli avvisi rossi oltre a mostrarli: il registro degli
// errori (vedi registroErrori.js). Si aggancia da lì, così questo file non
// dipende dal database e resta provabile da solo.
let osservatore = null
export function osservaErrori(fn) { osservatore = fn }

/** `dettaglio`: cosa ha risposto il database, per il registro. A schermo va solo `text`. */
export const notifyError = (text, dettaglio) => {
  emit('error', text)
  try { osservatore?.(text, dettaglio ?? null) } catch { /* il registro non deve mai rompere l'avviso */ }
}
export const notifyOk = text => emit('ok', text)

/** «42501 · permission denied»: il codice e il testo dell'errore del database. */
const comeDettaglio = error => [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(' · ') || null

/**
 * Esegue una query Supabase mostrando un avviso se fallisce.
 * Ritorna { data, error }: chi chiama DEVE controllare `error` prima di
 * aggiornare lo stato locale, altrimenti si torna al bug di prima.
 */
export async function run(query, messaggioErrore) {
  const { data, error } = await query
  if (error) {
    console.error(messaggioErrore, error)
    notifyError(messaggioErrore, comeDettaglio(error))
    return { data: null, error }
  }
  return { data, error: null }
}
