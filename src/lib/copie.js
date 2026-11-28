/**
 * Le copie di sicurezza.
 *
 * Il piano gratuito di Supabase non fa copie da solo (verificato sul sito di
 * Supabase il 28/11/2026: le copie giornaliere partono dal piano Pro, 25
 * dollari al mese). Un errore — una pulizia sbagliata, un turno cancellato
 * — e i pesi di mesi sarebbero persi. Le copie le fa quindi l'app, in due modi:
 *
 *  - DA SOLA, una volta a settimana: il primo telefono che apre l'app dopo
 *    sette giorni dall'ultima copia ne mette una nuova nello spazio privato
 *    «copie» di Supabase (migrazione del 28/11/2026). Da lì l'app può solo
 *    aggiungere e leggere: nessuno, dall'app, può cancellarle o cambiarle;
 *  - A MANO, dalle impostazioni: «Scarica una copia di tutto» la salva sul
 *    telefono o sul computer. È la copia che sopravvive anche se un giorno
 *    sparisse tutto il progetto Supabase.
 *
 * La copia è un file JSON con tutte le tabelle, riga per riga. Per rimettere
 * i dati: supabase/come-rimettere-una-copia.md.
 */
import { supabase } from '../supabaseClient'
import { VERSIONE } from './registroErrori'
import { SENZA_COPIA } from './copiaDati'

export const SPAZIO = 'copie'
export const GIORNI_TRA_COPIE = 7
const ORE_TRA_CONTROLLI = 12
const CHIAVE_CONTROLLO = 'gymcoach.copie-controllo'
// Quando QUESTO telefono ha fatto l'ultima copia: se un giorno l'elenco delle
// copie tornasse vuoto per un permesso sbagliato, non ne farebbe comunque
// più di una a settimana.
const CHIAVE_FATTA = 'gymcoach.copie-fatta'
const PAGINA = 1000

/**
 * Le tabelle, nell'ordine in cui si rimettono: prima quelle a cui le altre
 * si appoggiano. `ordine`: le colonne che rendono fisso l'ordine delle righe,
 * per leggere a pagine senza saltarne (vedi tutteLeRighe.js).
 */
export const TABELLE = [
  { nome: 'coaches', ordine: ['id'] },
  { nome: 'turns', ordine: ['id'] },
  { nome: 'clients', ordine: ['id'] },
  { nome: 'exercises', ordine: ['id'] },
  { nome: 'cycles', ordine: ['id'] },
  { nome: 'cycle_exercises', ordine: ['id'] },
  { nome: 'client_loads', ordine: ['id'] },
  { nome: 'client_notes', ordine: ['id'] },
  { nome: 'cycle_clients', ordine: ['cycle_id', 'client_id'] },
  { nome: 'giorni_persona', ordine: ['cycle_id', 'client_id'] },
  { nome: 'client_visits', ordine: ['id'] },
  { nome: 'client_attendance', ordine: ['id'] },
  { nome: 'turn_coaches', ordine: ['turn_id', 'coach_id'] },
  { nome: 'frasi_record', ordine: ['id'] },
]

// Le tabelle che possono mancare in un database più vecchio: si saltano.
const ASSENTE = new Set(['42P01', 'PGRST205'])

async function leggiTabella({ nome, ordine }) {
  const righe = []
  for (let da = 0; ; da += PAGINA) {
    // Dritto dal database: una copia di sicurezza non si fa con i dati
    // salvati sul telefono, e non deve riempirne la memoria (vedi copiaDati.js).
    let q = supabase.from(nome).select('*').setHeader(SENZA_COPIA, '1')
    for (const colonna of ordine) q = q.order(colonna)
    const { data, error } = await q.range(da, da + PAGINA - 1)
    if (error) return { righe: null, error }
    righe.push(...(data || []))
    if (!data || data.length < PAGINA) return { righe, error: null }
  }
}

/**
 * Tutti i dati in un oggetto solo. Se una tabella che esiste non si riesce
 * a leggere, la copia non si fa: mezza copia presa per intera sarebbe peggio
 * di nessuna.
 */
export async function preparaCopia({ coach } = {}) {
  const tabelle = {}
  const righe = {}
  const mancanti = []
  for (const t of TABELLE) {
    const { righe: r, error } = await leggiTabella(t)
    if (error && ASSENTE.has(error.code)) { mancanti.push(t.nome); continue }
    if (error) return { copia: null, errore: `Non riesco a leggere «${t.nome}»: ${error.message || error.code || 'errore'}` }
    tabelle[t.nome] = r
    righe[t.nome] = r.length
  }
  return {
    copia: { app: 'GymCoach', formato: 1, fatta: new Date().toISOString(), versione: VERSIONE, da: coach || null, righe, mancanti, tabelle },
    errore: null,
  }
}

const due = n => String(n).padStart(2, '0')

/** «gymcoach-copia-2026-11-28-0835.json», con l'ora del telefono. */
export function nomeCopia(quando = new Date(), coda = '') {
  const d = quando
  const data = `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}-${due(d.getHours())}${due(d.getMinutes())}`
  return `gymcoach-copia-${data}${coda ? `-${coda}` : ''}.json`
}

/** «3 giorni fa», «oggi», «ieri». */
export function quantoTempoFa(data, adesso = new Date()) {
  const inizio = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const giorni = Math.round((inizio(adesso) - inizio(new Date(data))) / 86_400_000)
  if (giorni <= 0) return 'oggi'
  if (giorni === 1) return 'ieri'
  return `${giorni} giorni fa`
}

/** «1,3 MB», «840 kB». */
export function peso(byte) {
  const b = Number(byte) || 0
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(b / 1000))} kB`
}

/** Le ultime copie automatiche, dalla più recente. { copie, errore }. */
export async function elencoCopie(quante = 5) {
  try {
    const { data, error } = await supabase.storage.from(SPAZIO)
      .list('', { limit: quante, sortBy: { column: 'created_at', order: 'desc' } })
    if (error) return { copie: null, errore: error }
    return { copie: (data || []).filter(f => f.name?.endsWith('.json')), errore: null }
  } catch (errore) {
    return { copie: null, errore }
  }
}

/** Serve una copia nuova? Sì se non ce n'è nessuna, o se l'ultima ha 7 giorni. */
export function serveCopia(ultima, adesso = Date.now()) {
  if (!ultima?.created_at) return true
  return adesso - new Date(ultima.created_at).getTime() >= GIORNI_TRA_COPIE * 86_400_000
}

let inCorso = false

/**
 * La copia della settimana, fatta da sola. Da chiamare all'avvio: guarda al
 * massimo ogni 12 ore per telefono, e lavora solo se serve. Non fa mai
 * comparire niente a schermo, e se non riesce riprova al giro dopo.
 */
export async function copiaDellaSettimana({ coach } = {}) {
  if (inCorso) return 'gia-in-corso'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'senza-rete'
  try {
    const ultimoControllo = Number(localStorage.getItem(CHIAVE_CONTROLLO)) || 0
    if (Date.now() - ultimoControllo < ORE_TRA_CONTROLLI * 3_600_000) return 'controllata-da-poco'
    const fattaQui = Number(localStorage.getItem(CHIAVE_FATTA)) || 0
    if (!serveCopia({ created_at: fattaQui ? new Date(fattaQui).toISOString() : null })) return 'fatta-da-poco-qui'
  } catch { /* modalità privata: si controlla comunque */ }

  inCorso = true
  try {
    const { copie, errore } = await elencoCopie(1)
    // Spazio «copie» che non c'è ancora (migrazione non lanciata) o rete giù.
    if (errore) return 'spazio-assente'
    try { localStorage.setItem(CHIAVE_CONTROLLO, String(Date.now())) } catch { /* modalità privata */ }
    if (!serveCopia(copie[0])) return 'non-serve'
    const { copia } = await preparaCopia({ coach })
    if (!copia) return 'lettura-fallita'
    const coda = Math.random().toString(36).slice(2, 6)
    const { error } = await supabase.storage.from(SPAZIO)
      .upload(nomeCopia(new Date(), coda), new Blob([JSON.stringify(copia)], { type: 'application/json' }),
        { contentType: 'application/json', upsert: false })
    if (error) return 'caricamento-fallito'
    try { localStorage.setItem(CHIAVE_FATTA, String(Date.now())) } catch { /* modalità privata */ }
    return 'fatta'
  } catch {
    return 'errore'
  } finally {
    inCorso = false
  }
}

/** Una copia automatica, scaricata dallo spazio «copie». */
export async function scaricaCopiaSalvata(nome) {
  const { data, error } = await supabase.storage.from(SPAZIO).download(nome)
  if (error || !data) return { file: null, errore: error || new Error('vuoto') }
  return { file: data, errore: null }
}

/**
 * Consegna un file a chi lo chiede: sul telefono e sul tablet con il foglio
 * di condivisione («Salva su File», WhatsApp, email), sul computer come
 * download. Torna 'condivisa', 'scaricata' o 'annullata'.
 */
export async function consegnaFile(blob, nome) {
  const file = new File([blob], nome, { type: 'application/json' })
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Copia di GymCoach' }); return 'condivisa' } catch (e) {
      if (e?.name === 'AbortError') return 'annullata'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'scaricata'
}
