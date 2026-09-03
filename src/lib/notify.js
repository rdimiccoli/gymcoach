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

export const notifyError = text => emit('error', text)
export const notifyOk = text => emit('ok', text)

/**
 * Esegue una query Supabase mostrando un avviso se fallisce.
 * Ritorna { data, error }: chi chiama DEVE controllare `error` prima di
 * aggiornare lo stato locale, altrimenti si torna al bug di prima.
 */
export async function run(query, messaggioErrore) {
  const { data, error } = await query
  if (error) {
    console.error(messaggioErrore, error)
    notifyError(messaggioErrore)
    return { data: null, error }
  }
  return { data, error: null }
}
