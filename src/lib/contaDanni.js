/**
 * Prima di cancellare: quanto si perde, contato davvero.
 *
 * Servono al banner rosso (AvvisoRosso) per dire «si cancellano 214 carichi»
 * invece di «verranno eliminati i dati associati». Ognuna torna l'elenco
 * delle cose che si perdono, già scritto in italiano e senza le voci a zero;
 * oppure `null` se il conto non è riuscito — e allora il banner usa la sua
 * frase generica, che resta vera.
 *
 * Le cancellazioni a cascata nel database sono scritte in SICUREZZA.md:
 * turno → persone e schede; persona → carichi e note; scheda → esercizi
 * della scheda → carichi e note.
 */

import { supabase } from '../supabaseClient'

// Gli id vanno nell'indirizzo della richiesta: a blocchi, per non farlo
// diventare troppo lungo.
const BLOCCO = 100

/** «1 carico registrato» / «12 carichi registrati». */
export const quanti = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`

async function conta(tabella, colonna, ids, soloConKg = false) {
  let totale = 0
  for (let i = 0; i < ids.length; i += BLOCCO) {
    let q = supabase.from(tabella).select('*', { count: 'exact', head: true }).in(colonna, ids.slice(i, i + BLOCCO))
    if (soloConKg) q = q.not('kg', 'is', null)
    const { count, error } = await q
    if (error) throw error
    totale += count || 0
  }
  return totale
}

async function idDove(tabella, colonna, valore) {
  const { data, error } = await supabase.from(tabella).select('id').eq(colonna, valore)
  if (error) throw error
  return (data || []).map(r => r.id)
}

function elenco(voci) {
  return voci.filter(([n]) => n > 0).map(([n, uno, tanti]) => quanti(n, uno, tanti))
}

async function provando(fn) {
  try { return await fn() } catch (e) { console.error('conteggio prima di cancellare', e); return null }
}

/** Una persona: i suoi carichi e le sue note, di tutte le schede. */
export const perditePersona = id => provando(async () => elenco([
  [await conta('client_loads', 'client_id', [id], true), 'carico registrato', 'carichi registrati'],
  [await conta('client_notes', 'client_id', [id]), 'nota', 'note'],
]))

/** Un turno: le sue persone, le sue schede, e tutti i carichi di quelle persone. */
export const perditeTurno = id => provando(async () => {
  const persone = await idDove('clients', 'turn_id', id)
  const schede = await idDove('cycles', 'turn_id', id)
  return elenco([
    [persone.length, 'persona', 'persone'],
    [schede.length, 'scheda', 'schede'],
    [persone.length ? await conta('client_loads', 'client_id', persone, true) : 0, 'carico registrato', 'carichi registrati'],
  ])
})

/** Una scheda: i suoi esercizi e i carichi registrati su di essi. */
export const perditeScheda = id => provando(async () => {
  const righe = await idDove('cycle_exercises', 'cycle_id', id)
  return elenco([
    [righe.length, 'esercizio della scheda', 'esercizi della scheda'],
    [righe.length ? await conta('client_loads', 'cycle_exercise_id', righe, true) : 0, 'carico registrato dai clienti', 'carichi registrati dai clienti'],
    [righe.length ? await conta('client_notes', 'cycle_exercise_id', righe) : 0, 'nota', 'note'],
  ])
})

/** Un esercizio dentro una scheda (una riga di cycle_exercises). */
export const perditeEsercizioDellaScheda = id => provando(async () => elenco([
  [await conta('client_loads', 'cycle_exercise_id', [id], true), 'carico registrato dai clienti', 'carichi registrati dai clienti'],
  [await conta('client_notes', 'cycle_exercise_id', [id]), 'nota', 'note'],
]))
