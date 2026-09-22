/**
 * Lettura e scrittura delle assegnazioni scheda → persone.
 *
 * Separato da assegnazioni.js, che resta senza database per poterlo testare.
 */

import { supabase } from '../supabaseClient'
import { run } from './notify'
import { mappaAssegnazioni } from './assegnazioni'

/** { idScheda: Set(idAtleta) } per le schede richieste. */
export async function caricaAssegnazioni(idSchede) {
  if (!idSchede?.length) return {}
  const { data } = await run(
    supabase.from('cycle_clients').select('cycle_id, client_id').in('cycle_id', idSchede),
    'Impossibile sapere a chi sono assegnate le schede.'
  )
  return mappaAssegnazioni(data || [])
}

/**
 * Salva la scelta: null = tutto il turno, Set = solo quelle persone.
 *
 * Prima si aggiunge chi manca, poi si toglie chi non c'è più — e non il
 * contrario. Se la connessione cade a metà, nel peggiore dei casi la scheda
 * mostra una persona in più, mai una in meno: chi deve allenarsi non sparisce.
 */
export async function salvaAssegnazioni(idScheda, scelte) {
  if (scelte === null) {
    return run(
      supabase.from('cycle_clients').delete().eq('cycle_id', idScheda),
      'Non sono riuscito a riassegnare la scheda a tutto il turno.'
    )
  }

  const ids = [...scelte]
  const aggiunta = await run(
    supabase.from('cycle_clients')
      .upsert(ids.map(client_id => ({ cycle_id: idScheda, client_id })),
        { onConflict: 'cycle_id,client_id', ignoreDuplicates: true }),
    'Le persone della scheda non sono state salvate.'
  )
  if (aggiunta.error) return aggiunta

  return run(
    supabase.from('cycle_clients').delete()
      .eq('cycle_id', idScheda)
      .not('client_id', 'in', `(${ids.join(',')})`),
    'Le persone tolte dalla scheda non sono state rimosse.'
  )
}
