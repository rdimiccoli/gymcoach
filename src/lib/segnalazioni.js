/**
 * Le segnalazioni dei coach: cosa non va, un'idea, cosa cambiare.
 *
 * Fino a novembre 2026 arrivavano su WhatsApp, spesso come audio: si
 * perdevano fra i messaggi, nessuno sapeva se erano state lette, e due coach
 * chiedevano la stessa cosa senza saperlo. Adesso stanno in un posto solo
 * (tabella `segnalazioni`, migrazione del 28/11/2026):
 *  - chi scrive sceglie di cosa si tratta, scrive (o detta col microfono
 *    della tastiera) e, se vuole, aggiunge una foto dello schermo;
 *  - l'app aggiunge da sola chi è, il telefono, la versione e, per un
 *    problema, gli ultimi errori di quel telefono;
 *  - chi sistema l'app, da un telefono «gestore», dice com'è messa e risponde;
 *  - chi l'ha scritta vede la risposta, e gli altri possono dire «anche io».
 *
 * Una segnalazione non si cancella: quando è chiusa (fatta, o non si fa)
 * scende fra le chiuse.
 */
import { supabase } from '../supabaseClient'
import { VERSIONE, descriviDispositivo, erroriRecenti } from './registroErrori'

export const TIPI = [
  { id: 'problema', icona: '🐞', nome: 'Qualcosa non va', domanda: 'Cosa è successo, e dove?',
    esempio: 'Es. «Nel turno delle 18 il + non salvava il peso di Rossi»' },
  { id: 'idea', icona: '💡', nome: 'Un\'idea', domanda: 'Cosa ti piacerebbe avere?',
    esempio: 'Es. «Vedere il peso massimo di ognuno nella seduta»' },
  { id: 'modifica', icona: '✏️', nome: 'Da cambiare', domanda: 'Cosa cambieresti, e come?',
    esempio: 'Es. «Il tasto DETTAGLI è troppo vicino al nome»' },
]
export const tipoDi = id => TIPI.find(t => t.id === id) || TIPI[0]

/** Com'è messa: il nome, e cosa vuol dire per chi l'ha scritta. */
export const STATI = {
  nuova: { nome: 'Nuova', spiegazione: 'Non ancora letta' },
  letta: { nome: 'Letta', spiegazione: 'Letta, ancora da decidere' },
  in_corso: { nome: 'In lavorazione', spiegazione: 'Ci si sta lavorando' },
  fatta: { nome: 'Fatta', spiegazione: 'Fatta: è nell\'app' },
  no: { nome: 'Non si fa', spiegazione: 'Non si fa, per ora' },
}
export const ORDINE_STATI = ['nuova', 'letta', 'in_corso', 'fatta', 'no']
export const aperta = s => s.stato !== 'fatta' && s.stato !== 'no'

export const TESTO_MINIMO = 3
export const TESTO_MASSIMO = 2000
export const RISPOSTA_MASSIMA = 1000

// ── Quello che resta sul telefono ───────────────────────────────────────────

const CHIAVE_GESTORE = 'gymcoach.segnalazioni-gestore'
const CHIAVE_VISITA = 'gymcoach.segnalazioni-visita'
const CHIAVE_BOZZA = 'gymcoach.segnalazioni-bozza'

function leggi(chiave) { try { return localStorage.getItem(chiave) } catch { return null } }
function scrivi(chiave, valore) {
  try { valore == null ? localStorage.removeItem(chiave) : localStorage.setItem(chiave, valore) } catch { /* modalità privata */ }
}

/**
 * Il telefono di chi sistema l'app: lì compaiono i tasti per dire com'è
 * messa una segnalazione e per rispondere. Vale solo su questo telefono.
 * Non è una protezione (la password è una per tutti): serve a non mettere
 * davanti ai coach dei tasti che non li riguardano.
 */
export const sonoGestore = () => leggi(CHIAVE_GESTORE) === '1'
export const impostaGestore = si => scrivi(CHIAVE_GESTORE, si ? '1' : null)

/** Quando si è aperta l'ultima volta la sezione, su questo telefono (ms). */
export const ultimaVisita = () => Number(leggi(CHIAVE_VISITA)) || 0
export const segnaVisita = (quando = Date.now()) => scrivi(CHIAVE_VISITA, String(quando))

/** Quello che si stava scrivendo: un'uscita per sbaglio non lo perde. */
export function leggiBozza() {
  try {
    const b = JSON.parse(leggi(CHIAVE_BOZZA) || 'null')
    return b && typeof b.testo === 'string' ? { tipo: TIPI.some(t => t.id === b.tipo) ? b.tipo : null, testo: b.testo } : null
  } catch { return null }
}
export const salvaBozza = ({ tipo, testo }) => scrivi(CHIAVE_BOZZA, testo?.trim() || tipo ? JSON.stringify({ tipo, testo }) : null)
export const dimenticaBozza = () => scrivi(CHIAVE_BOZZA, null)

// ── I conti ─────────────────────────────────────────────────────────────────

const ms = d => (d ? new Date(d).getTime() : 0)

/**
 * Le novità per chi guarda:
 *  - al gestore, le segnalazioni nuove (ancora da leggere);
 *  - a un coach, le sue che hanno cambiato stato o risposta dopo la sua
 *    ultima visita.
 */
export function novitaPer(elenco, { coachId, gestore, visita = 0 }) {
  if (gestore) return (elenco || []).filter(s => s.stato === 'nuova')
  return (elenco || []).filter(s => s.coach_id === coachId && ms(s.aggiornata) > visita)
}

/** «1 nuova», «3 nuove», «1 risposta», «2 risposte»; vuoto se zero. */
export function etichettaNovita(quante, gestore) {
  if (!quante) return ''
  if (gestore) return `${quante} ${quante === 1 ? 'nuova' : 'nuove'}`
  return `${quante} ${quante === 1 ? 'risposta' : 'risposte'}`
}

/** Aperte prima (dalla più recente), poi le chiuse (dalla chiusa da meno). */
export function ordina(elenco) {
  const aperte = (elenco || []).filter(aperta).sort((a, b) => ms(b.creata) - ms(a.creata))
  const chiuse = (elenco || []).filter(s => !aperta(s))
    .sort((a, b) => (ms(b.aggiornata) || ms(b.creata)) - (ms(a.aggiornata) || ms(a.creata)))
  return { aperte, chiuse }
}

const due = n => String(n).padStart(2, '0')
const giornoCorto = d => `${due(d.getDate())}/${due(d.getMonth() + 1)}`

/** Le segnalazioni aperte come testo, da incollare su WhatsApp o da girare a chi sistema l'app. */
export function testoSegnalazioni(elenco, nomiCoach = {}) {
  const { aperte } = ordina(elenco)
  if (!aperte.length) return ''
  const righe = aperte.map(s => {
    const tipo = tipoDi(s.tipo)
    const altri = (s.anche_io || []).map(id => nomiCoach[id]).filter(Boolean)
    return [
      `${tipo.icona} ${tipo.nome.toUpperCase()} · ${s.coach || '?'} · ${giornoCorto(new Date(s.creata))} · ${STATI[s.stato]?.nome || s.stato}`,
      `  ${s.testo.replace(/\s*\n\s*/g, ' / ')}`,
      altri.length ? `  ✋ anche: ${altri.join(', ')}` : null,
      s.risposta ? `  ↳ ${s.risposta}` : null,
    ].filter(Boolean).join('\n')
  })
  return [`GymCoach · segnalazioni aperte (${aperte.length})`, '', ...righe].join('\n\n').replace(/\n\n\n/g, '\n\n')
}

// ── Il database ─────────────────────────────────────────────────────────────

const COLONNE = 'id, creata, tipo, testo, coach_id, coach, versione, dispositivo, errori, foto, stato, risposta, aggiornata, anche_io'

/** Tutte le segnalazioni (sono poche: al massimo le ultime 300). */
export async function caricaSegnalazioni() {
  const { data, error } = await supabase.from('segnalazioni').select(COLONNE)
    .order('creata', { ascending: false }).limit(300)
  return { righe: data || [], errore: error }
}

/** Solo quello che serve per contare le novità (Home e Impostazioni). */
export async function contaNovita({ coachId, gestore }) {
  const { data, error } = await supabase.from('segnalazioni').select('id, stato, coach_id, aggiornata').limit(300)
  if (error) return 0
  return novitaPer(data, { coachId, gestore, visita: ultimaVisita() }).length
}

function dispositivo() {
  try {
    return descriviDispositivo({
      ua: navigator.userAgent, tocchi: navigator.maxTouchPoints || 0,
      larghezza: window.innerWidth, altezza: window.innerHeight,
      installata: window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
    })
  } catch { return null }
}

/**
 * Una foto dello schermo, più piccola: il lato lungo a 1280 pixel, in JPEG.
 * Una schermata di iPad pesa due o tre megabyte; così sta sotto i 400 kB e
 * parte anche col wifi della palestra.
 */
export function ridimensiona(file, latoMassimo = 1280) {
  return new Promise((risolvi, rifiuta) => {
    const indirizzo = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(indirizzo)
      const scala = Math.min(1, latoMassimo / Math.max(img.width, img.height))
      const tela = document.createElement('canvas')
      tela.width = Math.round(img.width * scala)
      tela.height = Math.round(img.height * scala)
      tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height)
      tela.toBlob(b => (b ? risolvi(b) : rifiuta(new Error('foto non convertita'))), 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(indirizzo); rifiuta(new Error('foto non leggibile')) }
    img.src = indirizzo
  })
}

/**
 * Manda una segnalazione. Prima la foto (se c'è), poi la riga: se la foto non
 * parte, non parte niente, e quello che si è scritto resta lì.
 * Torna { riga, errore } — `errore` è un testo da mostrare.
 */
export async function inviaSegnalazione({ tipo, testo, coach, foto }) {
  let percorso = null
  if (foto) {
    try {
      const piccola = await ridimensiona(foto)
      percorso = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.jpg`
      const { error } = await supabase.storage.from('segnalazioni')
        .upload(percorso, piccola, { contentType: 'image/jpeg', upsert: false })
      if (error) return { riga: null, errore: 'La foto non è partita. Riprova, o mandala senza foto.' }
    } catch {
      return { riga: null, errore: 'Questa foto non si riesce a leggere. Prova con un\'altra, o mandala senza.' }
    }
  }
  const riga = {
    tipo, testo: testo.trim().slice(0, TESTO_MASSIMO),
    coach_id: coach?.id || null, coach: coach?.name?.slice(0, 40) || null,
    versione: VERSIONE.slice(0, 40), dispositivo: dispositivo()?.slice(0, 120) || null,
    errori: tipo === 'problema' ? erroriRecenti() : null,
    foto: percorso,
  }
  const { data, error } = await supabase.from('segnalazioni').insert(riga).select(COLONNE).single()
  if (error) return { riga: null, errore: 'Non è partita: controlla la rete e riprova. Quello che hai scritto resta qui.' }
  return { riga: Array.isArray(data) ? data[0] : data, errore: null }
}

/** Il gestore dice com'è messa, e risponde. */
export async function aggiornaSegnalazione(id, { stato, risposta }) {
  const modifiche = {}
  if (stato) modifiche.stato = stato
  if (risposta !== undefined) modifiche.risposta = risposta?.trim() ? risposta.trim().slice(0, RISPOSTA_MASSIMA) : null
  const { error } = await supabase.from('segnalazioni').update(modifiche).eq('id', id)
  return { errore: error }
}

/** «✋ Anche io», o toglierlo. Torna il nuovo elenco di chi lo vuole. */
export async function ancheIo(id, coachId, voglio) {
  const { data, error } = await supabase.rpc('segnalazione_anche_io', { segnalazione: id, chi: coachId, voglio })
  return { elenco: Array.isArray(data) ? data : null, errore: error }
}

/** L'indirizzo per vedere una foto, valido un'ora (lo spazio è privato). */
export async function indirizzoFotoSegnalazione(percorso) {
  if (!percorso) return null
  const { data, error } = await supabase.storage.from('segnalazioni').createSignedUrl(percorso, 3600)
  return error ? null : data?.signedUrl || null
}
