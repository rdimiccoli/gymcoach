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
 *  - a chi sistema l'app arriva un'email (la manda il database, vedi la
 *    migrazione), con un pulsante RISPONDI: apre una pagina dell'app, anche
 *    senza entrare, dove si dice a che punto è e si risponde;
 *  - chi l'ha scritta vede la risposta, e gli altri possono dire «anche io».
 *  Ai coach non arriva nessun avviso: l'email è solo per chi sistema l'app.
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

const CHIAVE_VISITA = 'gymcoach.segnalazioni-visita'
const CHIAVE_BOZZA = 'gymcoach.segnalazioni-bozza'

function leggi(chiave) { try { return localStorage.getItem(chiave) } catch { return null } }
function scrivi(chiave, valore) {
  try { valore == null ? localStorage.removeItem(chiave) : localStorage.setItem(chiave, valore) } catch { /* modalità privata */ }
}

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
 * Le novità di un coach: le sue segnalazioni con una risposta o un passo
 * avanti arrivati dopo la sua ultima visita. (L'ora la mette il database,
 * e «letta» da sola non conta: vedi la migrazione.)
 */
export function novitaPer(elenco, { coachId, visita = 0 }) {
  return (elenco || []).filter(s => s.coach_id === coachId && ms(s.aggiornata) > visita)
}

/** «1 novità», «3 novità»; vuoto se zero. */
export const etichettaNovita = quante => (quante ? `${quante} novità` : '')

/** Aperte prima (dalla più recente), poi le chiuse (dalla chiusa da meno). */
export function ordina(elenco) {
  const aperte = (elenco || []).filter(aperta).sort((a, b) => ms(b.creata) - ms(a.creata))
  const chiuse = (elenco || []).filter(s => !aperta(s))
    .sort((a, b) => (ms(b.aggiornata) || ms(b.creata)) - (ms(a.aggiornata) || ms(a.creata)))
  return { aperte, chiuse }
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
export async function contaNovita({ coachId }) {
  if (!coachId) return 0
  const { data, error } = await supabase.from('segnalazioni').select('id, coach_id, aggiornata')
    .eq('coach_id', coachId).limit(300)
  if (error) return 0
  return novitaPer(data, { coachId, visita: ultimaVisita() }).length
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

// ── Il pulsante RISPONDI dell'email ─────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Dall'indirizzo del pulsante RISPONDI («?rispondi=…&chiave=…») la
 * segnalazione e il suo codice; null se l'indirizzo non è quello.
 */
export function parametriRisposta(cerca) {
  try {
    const p = new URLSearchParams(cerca || '')
    const id = p.get('rispondi'), codice = p.get('chiave')
    return id && codice && UUID.test(id) && UUID.test(codice) ? { id, codice } : null
  } catch { return null }
}

/** La segnalazione, letta con il codice dell'email (e da qui segnata come letta). */
export async function leggiDaRispondere({ id, codice }) {
  const { data, error } = await supabase.rpc('segnalazione_da_rispondere', { quale: id, codice })
  return { segnalazione: data || null, errore: error }
}

/** A che punto è, e la risposta. Torna { fatto, errore }. */
export async function rispondi({ id, codice }, { stato, risposta }) {
  const { data, error } = await supabase.rpc('segnalazione_rispondi', {
    quale: id, codice, nuovo_stato: stato, testo_risposta: (risposta || '').trim().slice(0, RISPOSTA_MASSIMA),
  })
  return { fatto: data === true, errore: error }
}

/** «✋ Anche io», o toglierlo. Torna il nuovo elenco di chi lo vuole. */
export async function ancheIo(id, coachId, voglio) {
  const { data, error } = await supabase.rpc('segnalazione_anche_io', { segnalazione: id, chi: coachId, voglio })
  return { elenco: Array.isArray(data) ? data : null, errore: error }
}

/**
 * L'indirizzo per vedere una foto. Il nome del file è lungo e casuale, e lo
 * spazio è leggibile senza entrare: serve alla pagina RISPONDI, che si apre
 * dall'email anche senza accesso.
 */
export function indirizzoFotoSegnalazione(percorso) {
  if (!percorso) return null
  try { return supabase.storage.from('segnalazioni').getPublicUrl(percorso).data?.publicUrl || null } catch { return null }
}
