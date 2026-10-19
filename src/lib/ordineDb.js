/**
 * Leggere le persone di un turno nell'ordine giusto, anche prima della
 * migrazione.
 *
 * Ordinare per una colonna che nel database non c'è non dà un elenco
 * disordinato: dà un errore, e l'elenco resta vuoto. Siccome l'app esce
 * prima che qualcuno lanci lo script SQL, qui si chiede a `capacita()` se la
 * colonna esiste e si ordina per cognome e basta finché non c'è — cioè
 * esattamente come faceva l'app prima.
 */

import { supabase } from '../supabaseClient'
import { run } from './notify'
import { capacita } from './capacita'
import { ordinaElenco } from './ordinePersone'

export async function conOrdineDelTurno(query) {
  const { ordinePersone } = await capacita()
  return ordinaElenco(query, ordinePersone)
}

/**
 * Scrive il nuovo ordine, una riga per volta.
 *
 * Un `upsert` sarebbe una scrittura sola, ma mandando solo l'id e il numero
 * svuoterebbe le altre colonne della riga — nome, cognome, turno. Le righe
 * da scrivere sono comunque poche: due per ogni spostamento, tutte solo la
 * prima volta.
 *
 * Torna `false` se qualcosa non è passato, così chi chiama può rimettere
 * l'elenco com'era invece di mostrare un ordine che il database non ha.
 */
export async function salvaOrdine(righe) {
  for (const r of righe) {
    const { error } = await run(
      supabase.from('clients').update({ sort_order: r.sort_order }).eq('id', r.id),
      'Ordine non salvato.')
    if (error) return false
  }
  return true
}
