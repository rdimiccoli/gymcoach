/**
 * Che cosa sa fare il database che c'è sotto.
 *
 * Le presenze, i turni condivisi e le categorie richiedono una migrazione SQL
 * che si esegue a mano su Supabase. Fra il momento in cui esce una versione
 * dell'app e il momento in cui qualcuno lancia quello script può passare del
 * tempo — e nel frattempo l'app non deve mostrare pulsanti che finiscono in
 * errore.
 *
 * Quindi lo chiede al database, una volta sola all'avvio, e nasconde le
 * funzioni che non trova. La stessa versione dell'app gira identica prima e
 * dopo la migrazione: non c'è un istante in cui è rotta.
 */

import { supabase } from '../supabaseClient'

// Codici che significano davvero «questo non esiste».
// 42P01 tabella assente, 42703 colonna assente (Postgres);
// PGRST20x le stesse cose viste da PostgREST, che tiene una sua cache dello schema.
const ASSENTE = new Set(['42P01', '42703', 'PGRST204', 'PGRST205'])

/**
 * Come leggere l'esito della prova.
 *
 * Distinguere «non esiste» da «non ho potuto chiedere» è tutto il punto:
 * confonderli significa far sparire una funzione perché il wifi della palestra
 * ha avuto un singhiozzo.
 */
export function leggiEsito(error) {
  if (!error) return true
  if (ASSENTE.has(error.code)) return false
  // Rete caduta, permesso negato, database in pausa: non sono prove di
  // assenza. Meglio mostrare la funzione e lasciare che sia il messaggio
  // d'errore a spiegare cos'è successo, che nasconderla senza dire niente.
  return true
}

async function presente(tabella, colonna) {
  const { error } = await supabase.from(tabella).select(colonna).limit(1)
  return leggiEsito(error)
}

let richiesta = null

/**
 * Le capacità disponibili. La prima chiamata interroga il database, le
 * successive riusano la stessa promessa: tre richieste in tutto, per sessione.
 */
export function capacita() {
  richiesta ||= (async () => {
    const [presenze, condivisione, categorie] = await Promise.all([
      presente('client_attendance', 'id'),
      presente('turn_coaches', 'turn_id'),
      presente('exercises', 'muscle_group'),
    ])
    return { presenze, condivisione, categorie }
  })()
  return richiesta
}

/** Solo per i test: fa dimenticare la risposta già ottenuta. */
export function dimentica() {
  richiesta = null
}
