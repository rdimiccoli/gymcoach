/**
 * La copia dei dati sul telefono: aprire un turno anche senza rete.
 *
 * Fino a novembre 2026 i pesi segnati senza rete non andavano persi (vedi
 * coda.js), ma per segnarli bisognava che la schermata del turno si fosse
 * già aperta: se il wifi della palestra cadeva PRIMA, la Home restava vuota e
 * il turno non si apriva.
 *
 * Adesso ogni lettura dal database che va a buon fine lascia una copia qui,
 * sul telefono (IndexedDB). Quando la rete manca, la stessa lettura risponde
 * con la copia: la Home, il turno, le persone e i pesi si vedono come
 * l'ultima volta che c'era rete, e in cima si dice di quando sono.
 *
 * Funziona sotto a tutto, al livello delle richieste: le schermate non sanno
 * niente di questa copia, e leggono come hanno sempre letto.
 *
 * Le regole:
 *  - si copiano solo le LETTURE (GET) andate bene, fatte da chi è entrato:
 *    una lettura senza accesso risponde «niente» per via dei permessi, e
 *    quel «niente» non deve prendere il posto dei dati veri;
 *  - la copia si usa solo se la rete manca davvero (il telefono dice di
 *    essere senza rete, o la richiesta non è partita): con la rete lenta si
 *    aspetta la risposta vera, per non mostrare pesi vecchi a chi lavora
 *    insieme a un collega su un altro tablet;
 *  - le scritture non passano mai di qui: i pesi senza rete li tiene la coda;
 *  - una copia vale GIORNI_VALIDI giorni, poi si butta; uscendo
 *    dall'account si buttano tutte.
 */

export const GIORNI_VALIDI = 14
/**
 * Un'intestazione per dire «questa lettura non copiarla»: la mettono le
 * copie di sicurezza (vedi copie.js), che leggono tutto il database e
 * riempirebbero il telefono per niente. Si toglie prima di partire, quindi
 * al database non arriva mai.
 */
export const SENZA_COPIA = 'x-gymcoach-senza-copia'
const MASSIME_COPIE = 400
const MASSIMO_BYTE = 2_000_000
const DATABASE = 'gymcoach-copie'
const SCAFFALE = 'risposte'

// ── Dove si tengono le copie ────────────────────────────────────────────────
// IndexedDB e non localStorage: una giornata di turni pesa qualche
// megabyte, e localStorage si ferma a cinque per tutta l'app (coda dei pesi
// compresa). Se IndexedDB non c'è (modalità privata su un Safari vecchio)
// semplicemente non si copia niente, e l'app va come prima.

let aperto = null

function apri() {
  if (aperto) return aperto
  aperto = new Promise(risolvi => {
    try {
      if (typeof indexedDB === 'undefined') return risolvi(null)
      const richiesta = indexedDB.open(DATABASE, 1)
      richiesta.onupgradeneeded = () => {
        const db = richiesta.result
        if (!db.objectStoreNames.contains(SCAFFALE)) db.createObjectStore(SCAFFALE, { keyPath: 'chiave' })
      }
      richiesta.onsuccess = () => risolvi(richiesta.result)
      richiesta.onerror = () => risolvi(null)
      richiesta.onblocked = () => risolvi(null)
    } catch { risolvi(null) }
  })
  return aperto
}

function operazione(modo, fa) {
  return apri().then(db => new Promise(risolvi => {
    if (!db) return risolvi(null)
    try {
      const giro = db.transaction(SCAFFALE, modo)
      const scaffale = giro.objectStore(SCAFFALE)
      const r = fa(scaffale)
      giro.oncomplete = () => risolvi(r?.result ?? null)
      giro.onerror = () => risolvi(null)
      giro.onabort = () => risolvi(null)
    } catch { risolvi(null) }
  }))
}

/** Il magazzino vero, su IndexedDB. Nei test se ne passa uno finto in memoria. */
export const magazzinoTelefono = {
  prendi: chiave => operazione('readonly', s => s.get(chiave)),
  metti: voce => operazione('readwrite', s => s.put(voce)),
  tutte: () => operazione('readonly', s => s.getAll()),
  togli: chiave => operazione('readwrite', s => s.delete(chiave)),
  svuota: () => operazione('readwrite', s => s.clear()),
}

let magazzino = magazzinoTelefono
/** Solo per i test. */
export function usaMagazzino(m) { magazzino = m }

// ── Lo stato «senza rete», per la striscia in cima alle schermate ──────────

let stato = { senzaRete: false, copiaDel: null }
const ascoltatori = new Set()

function cambiaStato(nuovo) {
  if (nuovo.senzaRete === stato.senzaRete && nuovo.copiaDel === stato.copiaDel) return
  stato = nuovo
  ascoltatori.forEach(fn => fn(stato))
}

/** { senzaRete, copiaDel }: `copiaDel` è quando è stata salvata la copia più vecchia in vista. */
export function statoRete() { return stato }

export function ascoltaRete(fn) {
  ascoltatori.add(fn)
  fn(stato)
  return () => ascoltatori.delete(fn)
}

function usataCopia(quando) {
  const piuVecchia = stato.copiaDel ? Math.min(stato.copiaDel, quando) : quando
  cambiaStato({ senzaRete: true, copiaDel: piuVecchia })
}

function reteTornata() {
  if (stato.senzaRete) cambiaStato({ senzaRete: false, copiaDel: null })
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => cambiaStato({ senzaRete: true, copiaDel: stato.copiaDel }))
  window.addEventListener('online', reteTornata)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) stato = { senzaRete: true, copiaDel: null }
}

// ── Le regole ───────────────────────────────────────────────────────────────

const senzaRete = () => typeof navigator !== 'undefined' && navigator.onLine === false

function metodoDi(input, init) {
  return String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase()
}

function indirizzoDi(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input?.url || ''
}

function intestazione(init, nome) {
  const h = init?.headers
  if (!h) return null
  if (typeof h.get === 'function') return h.get(nome)
  const trovata = Object.keys(h).find(k => k.toLowerCase() === nome.toLowerCase())
  return trovata ? h[trovata] : null
}

/**
 * Di quale lettura è una richiesta: l'indirizzo senza il dominio, più le
 * intestazioni che cambiano la risposta (una riga sola o un elenco, i conti).
 */
export function chiaveDi(indirizzo, init) {
  let percorso = indirizzo
  try { const u = new URL(indirizzo); percorso = u.pathname + u.search } catch { /* già relativo */ }
  const forma = intestazione(init, 'Accept') || ''
  const preferenze = intestazione(init, 'Prefer') || ''
  return `${forma}|${preferenze}|${percorso}`
}

/** Va copiata? Solo le letture del database, e solo di chi è entrato. */
export function daCopiare(indirizzo, metodo, init, chiavePubblica) {
  if (metodo !== 'GET' || !indirizzo.includes('/rest/v1/')) return false
  const accesso = intestazione(init, 'Authorization') || ''
  if (!accesso.startsWith('Bearer ')) return false
  return accesso.slice(7) !== chiavePubblica
}

function rispostaDallaCopia(voce) {
  const intestazioni = { 'content-type': voce.tipo || 'application/json; charset=utf-8', 'x-gymcoach-copia': String(voce.quando) }
  if (voce.intervallo) intestazioni['content-range'] = voce.intervallo
  // Lo stesso stato della risposta vera: 200, o 206 per una pagina di righe.
  return new Response(voce.corpo, { status: voce.stato || 200, headers: intestazioni })
}

async function copiaValida(chiave, adesso = Date.now()) {
  const voce = await magazzino.prendi(chiave)
  if (!voce || adesso - voce.quando > GIORNI_VALIDI * 86_400_000) return null
  return voce
}

function senzaIntestazione(init, nome) {
  const intestazioni = new Headers(init?.headers || {})
  intestazioni.delete(nome)
  return { ...init, headers: intestazioni }
}

/**
 * La risposta per una lettura fatta SENZA accesso mentre il telefono un
 * accesso ce l'ha: vuol dire che il rinnovo non è riuscito. Mandarla al
 * database darebbe un elenco vuoto (per i permessi), e la Home vuota farebbe
 * pensare che i turni siano spariti. Meglio un errore detto chiaro.
 */
function accessoNonRinnovato() {
  return new Response(JSON.stringify({ code: 'PGRST301', message: 'Accesso da rinnovare: riprova fra poco.' }),
    { status: 401, headers: { 'content-type': 'application/json' } })
}

/**
 * Il `fetch` da dare a Supabase: uguale a quello vero, più la copia.
 * `chiavePubblica`: la chiave anonima dell'app, per riconoscere le letture
 * fatte senza accesso. `accessoPresente`: dice se sul telefono c'è un accesso
 * salvato (vedi accessoNonRinnovato).
 */
export function fetchConCopia(fetchVero, { chiavePubblica, accessoPresente } = {}) {
  return async function (input, init) {
    const indirizzo = indirizzoDi(input)
    const metodo = metodoDi(input, init)
    if (metodo !== 'GET' || !indirizzo.includes('/rest/v1/')) return fetchVero(input, init)
    // Letture delle copie di sicurezza: dritte al database, senza copia.
    if (intestazione(init, SENZA_COPIA)) return fetchVero(input, senzaIntestazione(init, SENZA_COPIA))

    const chiave = chiaveDi(indirizzo, init)

    // Senza accesso, ma con un accesso salvato: il rinnovo non è riuscito.
    if (!daCopiare(indirizzo, metodo, init, chiavePubblica) && accessoPresente?.()) {
      const voce = await copiaValida(chiave)
      if (voce) { usataCopia(voce.quando); return rispostaDallaCopia(voce) }
      return accessoNonRinnovato()
    }
    // Il telefono sa già di essere senza rete: niente attese, la copia subito.
    if (senzaRete()) {
      const voce = await copiaValida(chiave)
      if (voce) { usataCopia(voce.quando); return rispostaDallaCopia(voce) }
      return fetchVero(input, init)
    }

    let risposta
    try {
      risposta = await fetchVero(input, init)
    } catch (errore) {
      // Richiesta annullata apposta: non è la rete che manca.
      if (errore?.name === 'AbortError') throw errore
      const voce = await copiaValida(chiave)
      if (voce) { usataCopia(voce.quando); return rispostaDallaCopia(voce) }
      throw errore
    }

    reteTornata()
    // 200, o 206 quando il database manda una pagina di righe: tutte e due
    // sono risposte complete per quella lettura.
    if ((risposta.status === 200 || risposta.status === 206) && daCopiare(indirizzo, metodo, init, chiavePubblica)) {
      const tipo = risposta.headers.get('content-type')
      const intervallo = risposta.headers.get('content-range')
      const stato = risposta.status
      // Si salva dopo aver risposto: la schermata non aspetta la copia.
      risposta.clone().text().then(corpo => {
        if (corpo.length > MASSIMO_BYTE) return
        return magazzino.metti({ chiave, corpo, tipo, intervallo, stato, quando: Date.now() })
      }).catch(() => {})
    }
    return risposta
  }
}

// ── Pulizie ─────────────────────────────────────────────────────────────────

/** Butta le copie scadute e, se sono troppe, le più vecchie. All'avvio. */
export async function pulisciCopie(adesso = Date.now()) {
  const tutte = (await magazzino.tutte()) || []
  const scadute = tutte.filter(v => adesso - v.quando > GIORNI_VALIDI * 86_400_000)
  const restano = tutte.filter(v => adesso - v.quando <= GIORNI_VALIDI * 86_400_000)
    .sort((a, b) => a.quando - b.quando)
  const troppe = restano.slice(0, Math.max(0, restano.length - MASSIME_COPIE))
  for (const v of [...scadute, ...troppe]) await magazzino.togli(v.chiave)
  return scadute.length + troppe.length
}

/** Uscendo dall'account: sul telefono non resta niente. */
export function dimenticaCopie() {
  cambiaStato({ senzaRete: senzaRete(), copiaDel: null })
  return magazzino.svuota()
}

// ── La sessione senza rete ──────────────────────────────────────────────────

/**
 * L'accesso salvato sul telefono, anche se è scaduto.
 *
 * L'accesso a Supabase dura un'ora e si rinnova da solo. Senza rete il
 * rinnovo non riesce: la libreria lo ritenta per circa 25 secondi, poi dice
 * «nessun accesso» — ma lo tiene salvato, perché non è un'uscita. Senza
 * questo, aprire l'app senza rete dopo un'ora mostrava la schermata della
 * password. Se l'accesso è stato tolto davvero (uscita, password cambiata),
 * la libreria lo cancella dal telefono e qui non si trova niente.
 */
export function accessoSalvato(chiaveAccesso) {
  try {
    const grezzo = localStorage.getItem(chiaveAccesso)
    const s = grezzo ? JSON.parse(grezzo) : null
    return s?.access_token && s?.refresh_token && s?.expires_at && s?.user?.id ? s : null
  } catch { return null }
}

/**
 * Senza rete `getSession` risponde subito con l'accesso salvato, invece di
 * far aspettare 25 secondi di tentativi ogni lettura e ogni scrittura (ogni
 * richiesta a Supabase passa da lì). Con la rete fa esattamente come prima.
 */
export function sessioneAncheSenzaRete(auth, chiaveAccesso) {
  const vera = auth.getSession.bind(auth)
  auth.getSession = async () => {
    if (senzaRete()) {
      const salvato = accessoSalvato(chiaveAccesso)
      if (salvato) return { data: { session: salvato }, error: null }
    }
    return vera()
  }
}
