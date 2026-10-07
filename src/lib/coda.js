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

/** Prova a svuotare la coda. Ritorna quanti elementi restano. */
export async function sincronizza() {
  const limite = Date.now() - GIORNI_VALIDI * 24 * 60 * 60 * 1000
  const coda = leggiCoda().filter(e => e.ts > limite)

  if (!coda.length) { scriviCoda(coda); return 0 }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return coda.length

  const righe = coda.map(({ client_id, cycle_exercise_id, kg, week }) =>
    ({ client_id, cycle_exercise_id, kg, week }))

  const { error } = await supabase
    .from('client_loads')
    .upsert(righe, { onConflict: 'client_id,cycle_exercise_id,week' })

  if (error) {
    if (eProblemaDiRete(error)) return coda.length // ritenteremo
    // Rifiutati dal server: tenerli in coda significherebbe ritentare per
    // sempre. Meglio toglierli e dirlo, così la coach può reinserirli.
    console.error('carichi in coda rifiutati', error)
    notifyError(`${coda.length} carichi in attesa non sono stati accettati dal server. Vanno reinseriti.`)
    scriviCoda([])
    return 0
  }

  scriviCoda([])
  return 0
}

/**
 * Riprova da sola quando torna la rete o quando si riapre l'app.
 * `collegato` dice solo se c'è qualcuno dentro: senza accesso non si scrive.
 */
export function avviaSincronizzazioneAutomatica(collegato) {
  if (!collegato) return () => {}
  const prova = () => { sincronizza() }

  window.addEventListener('online', prova)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') prova()
  })
  const intervallo = setInterval(prova, 60_000)
  prova()

  return () => {
    window.removeEventListener('online', prova)
    clearInterval(intervallo)
  }
}
