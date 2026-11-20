/**
 * Chi si può aggiungere come ospite: l'elenco da mostrare, diviso in gruppi e
 * filtrato da quello che il coach scrive nella ricerca.
 *
 * Fino al 20/11/2026 come ospite si poteva aggiungere solo un atleta Silver.
 * Poi i coach hanno chiesto di poter aggiungere chiunque: capita che una
 * persona recuperi una lezione in un altro turno, anche se non è Silver, e
 * capita che il turno sia di un altro coach. Il Silver resta, ma serve solo a
 * mettere quelle persone in cima.
 *
 * Le persone sono centinaia: senza ricerca nessuno le scorre tutte.
 */

/** Minuscolo, senza accenti e senza spazi doppi: «Nicolò » → «nicolo». */
export function semplifica(testo) {
  return String(testo ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Vero se ogni parola scritta sta nel nome o nel cognome, in qualsiasi
 * ordine: «rossi mar», «maria ross» e «ROSSI» trovano tutti Maria Rossi.
 */
export function corrisponde(persona, cerca) {
  const parole = semplifica(cerca).split(' ').filter(Boolean)
  if (!parole.length) return true
  const nome = semplifica(`${persona.name ?? ''} ${persona.surname ?? ''}`)
  return parole.every(p => nome.includes(p))
}

/**
 * I gruppi da mostrare, nell'ordine:
 *   1. GIÀ QUI OGGI — chi era già ospite quando si è aperto l'elenco;
 *   2. SILVER — da tutti i turni di tutti i coach;
 *   3. TUTTI GLI ALTRI.
 *
 * `giaQui` va preso quando l'elenco si apre e non cambiato dopo: se una
 * persona saltasse in cima appena la tocchi, il dito toccherebbe quella
 * che le scivola sotto.
 *
 * I gruppi vuoti non ci sono. Dentro ogni gruppo l'ordine è quello ricevuto.
 */
export function gruppiOspiti(persone, giaQui = new Set(), cerca = '') {
  const trovate = (persone || []).filter(p => corrisponde(p, cerca))
  const gruppi = [
    { titolo: 'GIÀ QUI OGGI', persone: trovate.filter(p => giaQui.has(p.id)) },
    { titolo: 'SILVER', persone: trovate.filter(p => !giaQui.has(p.id) && p.silver) },
    { titolo: 'TUTTI GLI ALTRI', persone: trovate.filter(p => !giaQui.has(p.id) && !p.silver) },
  ]
  return gruppi.filter(g => g.persone.length)
}
