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
import { ordinaElenco, numeraDaCapo, spostaDi, daSalvare } from './ordinePersone'

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

/**
 * Sposta una persona nel posto di un'altra, e salva.
 *
 * Si ragiona per «vicino» e non per «un passo su»: sotto un esercizio può
 * comparire solo una parte del turno — chi segue quella scheda — e spostare
 * di un posto nell'elenco intero scambierebbe il nome con qualcuno che lì
 * non si vede nemmeno. Il vicino lo sceglie chi chiama, guardando l'elenco
 * che ha davvero a schermo.
 *
 * `tutte` sono tutte le persone del turno, nell'ordine attuale: servono
 * intere perché la prima volta nessuno ha un numero, e numerarne solo una
 * parte manderebbe tutti gli altri in fondo.
 *
 * Torna il nuovo elenco, o quello di prima se non c'era niente da fare o se
 * il salvataggio non è passato.
 */
export async function spostaAccanto(tutte, id, idVicino) {
  const numerati = numeraDaCapo(tutte)
  const da = numerati.findIndex(p => p.id === id)
  const a = numerati.findIndex(p => p.id === idVicino)
  if (da < 0 || a < 0 || da === a) return tutte
  const dopo = spostaDi(numerati, da, a - da)
  return await salvaOrdine(daSalvare(tutte, dopo)) ? dopo : tutte
}
