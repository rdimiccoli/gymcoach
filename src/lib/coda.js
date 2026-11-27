// Coda di scrittura per i carichi, per sopravvivere al segnale che salta.
//
// La coach registra i pesi con il telefono in mano girando per la sala pesi,
// dove il segnale va e viene. Prima di questa coda un salvataggio fallito
// veniva segnalato — meglio del silenzio di partenza — ma il dato era perso
// comunque, e con decine di atlete un carico perso non si recupera.
//
// Qui il salvataggio non fallisce mai dal punto di vista della coach: o passa
// subito, o resta in coda e parte appena torna la rete.

import { supabase } from '../supabaseClient'
import { notifyError } from './notify'

const CHIAVE = 'gymcoach.coda.carichi'
const MAX_ELEMENTI = 500
const GIORNI_VALIDI = 14

const ascoltatori = new Set()

// ── persistenza difensiva ───────────────────────────────────────────────────
function leggiCoda() {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    const dati = grezzo ? JSON.parse(grezzo) : []
    return Array.isArray(dati) ? dati : []
  } catch { return [] }
}

function scriviCoda(elementi) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(elementi)) } catch { /* modalità privata */ }
  ascoltatori.forEach(fn => fn(elementi.length))
}

export function subscribeCoda(fn) {
  ascoltatori.add(fn)
  fn(leggiCoda().length)
  return () => ascoltatori.delete(fn)
}

/**
 * Quanti carichi aspettano di partire da questo telefono.
 *
 * Fino a ottobre 2026 la coda era divisa per account: ogni voce portava lo
 * `userId` di chi l'aveva messa, e partivano solo le proprie. Serviva finché
 * ogni coach aveva la sua credenziale.
 *
 * Con la credenziale unica quella divisione fa solo danno: i carichi messi in
 * coda con le vecchie credenziali resterebbero lì per sempre, senza che
 * nessuno li veda partire, finché non scadono dopo quattordici giorni. E un
 * carico perso in silenzio è esattamente ciò che questa coda esiste per
 * evitare.
 *
 * Ora la coda è del telefono: qualunque coach sia collegato la svuota. Può
 * farlo perché dopo questa modifica il database lascia scrivere i carichi di
 * chiunque a chi è entrato.
 */
export function inAttesa() {
  return leggiCoda().length
}

// ── decidere se accodare o segnalare ────────────────────────────────────────
/**
 * Un errore di rete si riprova; un rifiuto del server no, altrimenti la coda
 * ritenterebbe all'infinito una scrittura che non passerà mai.
 * Gli errori di Postgres/PostgREST portano un `code`; quelli di connettività no.
 */
function eProblemaDiRete(errore) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (!errore) return false
  if (errore.code) return false
  const m = String(errore.message || '').toLowerCase()
  return m.includes('fetch') || m.includes('network') || m.includes('timeout') || m.includes('offline')
}

// ── API ─────────────────────────────────────────────────────────────────────

/**
 * Salva i carichi. Ritorna { differito, errore }:
 *  - differito true  → in coda, partirà da solo
 *  - errore         → il server ha rifiutato, non è un problema di rete
 */
export async function salvaCarichi(righe) {
  if (!righe?.length) return { differito: false, errore: null }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    accoda(righe)
    return { differito: true, errore: null }
  }

  const { error } = await supabase
    .from('client_loads')
    .upsert(righe, { onConflict: 'client_id,cycle_exercise_id,week' })

  if (!error) return { differito: false, errore: null }

  if (eProblemaDiRete(error)) {
    accoda(righe)
    return { differito: true, errore: null }
  }
  console.error('carichi rifiutati dal server', error)
  return { differito: false, errore: error }
}

function chiave(r) {
  return `${r.client_id}_${r.cycle_exercise_id}_${r.week}`
}

function accoda(righe) {
  const coda = leggiCoda()
  righe.forEach(r => {
    const k = chiave(r)
    // Ripesare lo stesso esercizio sostituisce il valore in attesa invece di
    // accodarne un secondo: conta l'ultimo, non la sequenza.
    const esistente = coda.findIndex(e => e.k === k)
    const voce = { k, ts: Date.now(), ...r }
    if (esistente >= 0) coda[esistente] = voce
    else coda.push(voce)
  })
  scriviCoda(coda.slice(-MAX_ELEMENTI))
}

/**
 * Toglie dalla coda le voci appena spedite — e SOLO quelle.
 *
 * Mentre la richiesta viaggia la coach può segnare un altro peso, che finisce
 * in coda. Prima, a spedizione finita, la coda veniva svuotata tutta: quel
 * peso nuovo spariva senza che nessuno lo sapesse. Ora si rilegge la coda e
 * si toglie una voce solo se è ancora quella spedita (stessa cella, stesso
 * momento): se nel frattempo è stata ripesata, resta e partirà al giro dopo.
 */
function togliSpediti(spediti) {
  const via = new Set(spediti.map(e => `${e.k}@${e.ts}`))
  const resto = leggiCoda().filter(e => !via.has(`${e.k}@${e.ts}`))
  scriviCoda(resto)
  return resto.length
}

const righeDa = voci => voci.map(({ client_id, cycle_exercise_id, kg, week }) =>
  ({ client_id, cycle_exercise_id, kg, week }))

const spedisci = voci => supabase
  .from('client_loads')
  .upsert(righeDa(voci), { onConflict: 'client_id,cycle_exercise_id,week' })

// Un giro di spedizione alla volta: il ritorno della rete, la riapertura
// dell'app e il controllo di ogni minuto possono cadere insieme, e due giri
// paralleli si toglierebbero le voci a vicenda.
let inCorso = null

/** Prova a svuotare la coda. Ritorna quanti elementi restano. */
export function sincronizza() {
  inCorso ||= svuota().finally(() => { inCorso = null })
  return inCorso
}

async function svuota() {
  const limite = Date.now() - GIORNI_VALIDI * 24 * 60 * 60 * 1000
  const tutta = leggiCoda()
  const scaduti = tutta.filter(e => !(e.ts > limite))
  if (scaduti.length) {
    // Un peso fermo sul telefono da più di due settimane non parte più: ma lo
    // si dice, invece di farlo sparire in silenzio.
    togliSpediti(scaduti)
    notifyError(`${scaduti.length} ${scaduti.length === 1 ? 'peso fermo' : 'pesi fermi'} sul telefono da più di ${GIORNI_VALIDI} giorni non ${scaduti.length === 1 ? 'è partito' : 'sono partiti'}: vanno riscritti.`)
  }
  const coda = tutta.filter(e => e.ts > limite)

  if (!coda.length) return 0
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return coda.length

  const { error } = await spedisci(coda)
  if (!error) return togliSpediti(coda)
  if (eProblemaDiRete(error)) return coda.length // ritenteremo

  // Il server ne rifiuta almeno uno, e con una spedizione unica li rifiuta
  // tutti. Prima si buttava via l'intera coda; ora si riprova uno per uno e
  // si scartano solo quelli che il server non vuole davvero.
  const rifiutati = []
  for (const voce of coda) {
    const { error: e } = await spedisci([voce])
    if (!e) { togliSpediti([voce]); continue }
    if (eProblemaDiRete(e)) return leggiCoda().length // la rete è caduta: si riprende dopo
    rifiutati.push(voce)
  }
  if (rifiutati.length) {
    console.error('carichi in coda rifiutati', rifiutati)
    togliSpediti(rifiutati)
    notifyError(`${rifiutati.length} ${rifiutati.length === 1 ? 'peso in attesa non è stato accettato' : 'pesi in attesa non sono stati accettati'} dal server: ${rifiutati.length === 1 ? 'va riscritto' : 'vanno riscritti'}.`)
  }
  return leggiCoda().length
}

/**
 * Riprova da sola quando torna la rete o quando si riapre l'app.
 * `collegato` dice solo se c'è qualcuno dentro: senza accesso non si scrive.
 */
export function avviaSincronizzazioneAutomatica(collegato) {
  if (!collegato) return () => {}
  const prova = () => { sincronizza() }

  const allaRiapertura = () => { if (document.visibilityState === 'visible') prova() }

  window.addEventListener('online', prova)
  document.addEventListener('visibilitychange', allaRiapertura)
  const intervallo = setInterval(prova, 60_000)
  prova()

  return () => {
    window.removeEventListener('online', prova)
    document.removeEventListener('visibilitychange', allaRiapertura)
    clearInterval(intervallo)
  }
}
