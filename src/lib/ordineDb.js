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

import { capacita } from './capacita'
import { ordinaElenco } from './ordinePersone'

export async function conOrdineDelTurno(query) {
  const { ordinePersone } = await capacita()
  return ordinaElenco(query, ordinePersone)
}
