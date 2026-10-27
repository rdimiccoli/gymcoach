/**
 * Il catalogo degli esercizi: rinominare, unire due doppioni, eliminare.
 *
 * Il catalogo è uno solo per tutta la palestra: «Panca piana» è la stessa
 * riga in tutte le schede di tutti i coach. Cambiarne il nome lo cambia
 * ovunque, anche nelle schede finite e nello storico dei clienti.
 *
 * ── Perché eliminare è in due tempi ──────────────────────────────────────
 * Nel database `cycle_exercises → exercises` NON ha la cancellazione a
 * cascata (è scritto in SICUREZZA.md): un esercizio usato in una scheda non
 * si può cancellare, il database lo rifiuta. Per eliminarlo davvero bisogna
 * prima toglierlo da tutte le schede — e lì sì, a cascata, se ne vanno
 * carichi e note dei clienti — e solo dopo cancellarlo dal catalogo.
 *
 * L'ordine conta. Si prova PRIMA a cancellare l'esercizio dal catalogo:
 *  - se passa, non era usato da nessuno e non si è perso niente;
 *  - se il database risponde «è ancora usato» (23503), allora vuol dire che
 *    il permesso di cancellarlo c'è, e solo allora si tolgono le schede;
 *  - se non succede niente — nessun errore, nessuna riga — è il permesso
 *    che manca, e ci si ferma PRIMA di aver toccato un solo carico.
 * Così non può mai capitare di cancellare i carichi e poi scoprire che
 * l'esercizio non si poteva eliminare.
 */

import { supabase } from '../supabaseClient'
import { run, notifyError } from './notify'

// Gli id vanno nell'indirizzo della richiesta: a blocchi, per non farlo
// diventare troppo lungo con un esercizio usato in cento schede.
const BLOCCO = 100

/**
 * Dove è usato un esercizio: in quante schede e quanti carichi ci sono
 * sopra. Torna `null` se non si è riusciti a saperlo — e allora chi chiama
 * non deve proporre di eliminare, perché non saprebbe cosa dire.
 */
export async function quantoEUsato(idEsercizio) {
  const { data: righe, error } = await run(
    supabase.from('cycle_exercises').select('id, cycle_id').eq('exercise_id', idEsercizio),
    'Impossibile sapere in quali schede è usato questo esercizio.')
  if (error) return null

  const ids = (righe || []).map(r => r.id)
  let carichi = 0
  for (let i = 0; i < ids.length; i += BLOCCO) {
    const { count, error: e } = await run(
      supabase.from('client_loads').select('*', { count: 'exact', head: true })
        .in('cycle_exercise_id', ids.slice(i, i + BLOCCO)).not('kg', 'is', null),
      'Impossibile contare i carichi registrati.')
    if (e) return null
    carichi += count || 0
  }
  return { schede: new Set((righe || []).map(r => r.cycle_id)).size, righe: ids.length, carichi }
}

/**
 * Cambia il nome nel catalogo, quindi ovunque. Torna `true` se il nome è
 * stato salvato davvero: un aggiornamento negato dai permessi non dà errore,
 * semplicemente non cambia nessuna riga, e va riconosciuto.
 */
export async function rinominaEsercizio(id, nome) {
  const { data, error } = await run(
    supabase.from('exercises').update({ name: nome }).eq('id', id).select('id'),
    'Nome non salvato.')
  if (error) return false
  if (!data?.length) { notifyError('Il database non ha permesso di cambiare il nome.'); return false }
  return true
}

/** Prova a cancellare la riga del catalogo. Non mostra messaggi: decide chi chiama. */
async function cancellaRiga(id) {
  const { data, error } = await supabase.from('exercises').delete().eq('id', id).select('id')
  if (error?.code === '23503') return 'usato'
  if (error) { console.error('cancellazione esercizio', error); return 'errore' }
  return data?.length ? 'ok' : 'negato'
}

const MESSAGGIO_NEGATO =
  'Il database non permette ancora di eliminare esercizi: va lanciato lo script migrazione-elimina-esercizi.sql. Non è stato toccato niente.'

/**
 * Elimina un esercizio dal catalogo, togliendolo prima da tutte le schede
 * se serve. Torna `true` solo se alla fine l'esercizio non c'è più.
 */
export async function eliminaEsercizio(id) {
  const primo = await cancellaRiga(id)
  if (primo === 'ok') return true
  if (primo === 'negato') { notifyError(MESSAGGIO_NEGATO); return false }
  if (primo === 'errore') { notifyError('Eliminazione non riuscita. Non è stato toccato niente.'); return false }

  // È usato, e il permesso di cancellarlo c'è: si tolgono le schede.
  // client_loads e client_notes hanno la cascata su cycle_exercises.
  const { error } = await run(
    supabase.from('cycle_exercises').delete().eq('exercise_id', id),
    'Non è stato possibile toglierlo dalle schede.')
  if (error) return false

  const secondo = await cancellaRiga(id)
  if (secondo === 'ok') return true
  // Qui le schede sono già state svuotate di questo esercizio: lo si dice
  // com'è, invece di lasciar credere che non sia successo niente.
  notifyError('Tolto dalle schede, ma è rimasto nel catalogo. Riprova a eliminarlo.')
  return false
}

/**
 * Unisce un doppione all'esercizio giusto: tutte le schede che usano
 * `daId` passano ad `aId`, con i loro carichi, e `daId` sparisce.
 *
 * Il caso per cui esiste: un coach crea «Panca pianaa» per sbaglio, ci
 * registra dei carichi, e poi vuole tornare a «Panca piana». Eliminarlo
 * butterebbe i carichi; unirlo li tiene.
 *
 * Qui non si cancella MAI nessuna scheda: se dopo lo spostamento il
 * doppione risulta ancora usato, ci si ferma e lo si dice.
 */
export async function unisciEsercizi(daId, aId) {
  const { error } = await run(
    supabase.from('cycle_exercises').update({ exercise_id: aId }).eq('exercise_id', daId),
    'Unione non riuscita: le schede non sono state spostate.')
  if (error) return false

  const esito = await cancellaRiga(daId)
  if (esito === 'ok') return true
  if (esito === 'negato') {
    notifyError('Le schede sono passate all\'esercizio giusto, ma il doppione è rimasto nel catalogo: va lanciato lo script migrazione-elimina-esercizi.sql.')
  } else if (esito === 'usato') {
    notifyError('Alcune schede non sono state spostate: il doppione è rimasto. Nessun carico è stato cancellato.')
  } else {
    notifyError('Le schede sono passate all\'esercizio giusto, ma il doppione è rimasto nel catalogo.')
  }
  return false
}
