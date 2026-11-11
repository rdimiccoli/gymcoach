/**
 * Scambiare due giorni di una scheda: tutti gli esercizi del Giorno 1 vanno
 * al Giorno 2, e quelli del Giorno 2 al Giorno 1.
 *
 * Si cambia solo il numero del giorno di ogni esercizio. L'esercizio resta
 * la stessa riga, quindi i carichi e le note dei clienti — appesi a quella
 * riga — vanno con lui: non si perde niente.
 *
 * Nel database sono due scritture (prima un giorno, poi l'altro). Se la
 * seconda non passa, la prima si rimette com'era: meglio nessuno scambio
 * che due giorni mescolati.
 */
import { supabase } from '../supabaseClient'
import { notifyError } from './notify'
import { raggruppaEsercizi, TIPO } from './schede'

/** Lo scambio nell'elenco che si ha in memoria: { 1: [...], 2: [...] }. */
export function scambiaNellaMappa(mappa, a, b) {
  return { ...mappa, [a]: mappa[b] || [], [b]: mappa[a] || [] }
}

/**
 * Cosa c'è in un giorno, scritto per chi legge: le superserie e i circuiti
 * restano insieme («Rematore + Lat machine»). Dopo `massimo` voci si
 * riassume con «e altri N», così la finestra non diventa un muro.
 */
export function vociDelGiorno(esercizi, massimo = 6) {
  const voci = raggruppaEsercizi(esercizi).map(g => {
    const nomi = g.exercises.map(e => e.name ?? e.exercises?.name).filter(Boolean).join(' + ')
    return g.type === TIPO.CIRCUITO ? `Circuito: ${nomi}` : nomi
  }).filter(Boolean)
  if (voci.length <= massimo) return voci
  const resto = voci.length - (massimo - 1)
  return [...voci.slice(0, massimo - 1), `e altri ${resto}`]
}

/** Sposta le righe al giorno dato. Vero solo se le ha spostate tutte. */
async function sposta(ids, giorno) {
  if (!ids.length) return true
  // `.select` perché un aggiornamento rifiutato dai permessi non dà errore:
  // torna semplicemente senza righe. Si contano.
  const { data, error } = await supabase.from('cycle_exercises')
    .update({ day: giorno }).in('id', ids).select('id')
  return !error && (data?.length ?? 0) === ids.length
}

/**
 * Scambia i giorni `a` e `b` nel database.
 * `idsA`: gli esercizi che ora sono nel giorno a; `idsB` quelli del b.
 *
 * Ritorna:
 *   'fatto'      — scambiati
 *   'annullato'  — non è passato, ma tutto è tornato com'era
 *   'misto'      — non è passato e non si è potuto rimettere a posto
 *                  (rete caduta a metà): la scheda va ricaricata
 */
export async function scambiaGiorniDb(idsA, idsB, a, b) {
  if (await sposta(idsA, b) && await sposta(idsB, a)) return 'fatto'
  const rimessi = (await sposta(idsA, a)) && (await sposta(idsB, b))
  notifyError(rimessi
    ? `Giorni non scambiati: la scheda è rimasta com'era. Controlla la connessione e riprova.`
    : `Scambio interrotto a metà. Riapri la scheda per vedere com'è adesso.`)
  return rimessi ? 'annullato' : 'misto'
}
