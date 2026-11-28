/**
 * Il registro degli errori.
 *
 * Fino a novembre 2026 un errore sul telefono di un coach lo vedeva solo
 * lui, per quattro secondi, e poi spariva. Per sistemarlo bisognava che se
 * lo ricordasse, che lo raccontasse, e che dal racconto si capisse dove
 * guardare: «ieri sera mi è uscito un messaggio rosso, non so cosa diceva».
 *
 * Adesso l'app lo scrive da sola nella tabella `errori_app`: cosa, quando,
 * in quale schermata, su che telefono e con quale versione dell'app. Si
 * legge dalle Impostazioni («Registro degli errori») e si copia per
 * WhatsApp in un tocco.
 *
 * Cosa finisce nel registro:
 *  - ogni avviso rosso che il coach vede a schermo (con il codice
 *    dell'errore del database, quando c'è);
 *  - gli errori del programma che nessuno ha gestito;
 *  - la schermata «Qualcosa è andato storto».
 *
 * Le regole che lo tengono pulito:
 *  - lo stesso errore nella stessa schermata si scrive una volta sola per
 *    apertura dell'app, non a ogni ripetizione;
 *  - al massimo MASSIMO_AL_GIORNO righe al giorno per telefono: un errore
 *    che si ripete a raffica non riempie il database;
 *  - senza rete non si prova nemmeno: l'errore sarebbe perso comunque, e
 *    la rete che manca in palestra non è un errore dell'app;
 *  - se la tabella non c'è (migrazione non ancora lanciata) si smette di
 *    provare fino alla prossima apertura;
 *  - un errore mentre si scrive un errore non si scrive: niente giri
 *    infiniti.
 *
 * Non si scrive mai niente dei clienti: solo il testo dell'errore, il nome
 * del profilo coach e la schermata.
 */
import { supabase } from '../supabaseClient'
import { osservaErrori } from './notify'

export const MASSIMO_AL_GIORNO = 20
const CHIAVE_GIORNO = 'gymcoach.errori-oggi'

/* global __VERSIONE__ */
/** Quale versione dell'app gira su questo telefono: data della pubblicazione e codice. */
export const VERSIONE = typeof __VERSIONE__ !== 'undefined' ? __VERSIONE__ : 'locale'

// Lunghezze massime: le stesse del vincolo `errori_app_corti` nel database.
const LUNGHEZZE = { tipo: 20, messaggio: 300, dettaglio: 2000, pagina: 40, coach: 40, versione: 40, dispositivo: 120 }

let contesto = { pagina: null, coach: null }
const giaScritti = new Set()
let tabellaAssente = false
let dentro = false

/** App dice in che schermata si è e chi è il coach: finisce in ogni riga. */
export function impostaContesto(parte) {
  contesto = { ...contesto, ...parte }
}

/**
 * Rumore che non dice niente: avvisi interni del browser, errori delle
 * estensioni installate sul computer, richieste annullate apposta.
 */
export function daIgnorare(messaggio = '', dettaglio = '') {
  const m = String(messaggio)
  const d = String(dettaglio || '')
  if (!m.trim()) return true
  if (/ResizeObserver loop/i.test(m)) return true
  // «Script error.» arriva da script di altri siti: senza dettagli, inservibile.
  if (/^Script error\.?$/i.test(m.trim())) return true
  if (/AbortError|aborted/i.test(m)) return true
  if (/(chrome|moz|safari)-extension:\/\//i.test(m + d)) return true
  return false
}

/**
 * «iPad · Safari 17.2 · app · 1080×810»: abbastanza per capire su quale
 * telefono succede, senza niente che identifichi la persona.
 */
export function descriviDispositivo({ ua = '', tocchi = 0, larghezza, altezza, installata = false } = {}) {
  let cosa = 'Computer'
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && tocchi > 1)) cosa = 'iPad'
  else if (/iPhone|iPod/.test(ua)) cosa = 'iPhone'
  else if (/Android/.test(ua)) cosa = /Mobile/.test(ua) ? 'Android' : 'Tablet Android'
  else if (/Windows/.test(ua)) cosa = 'Windows'
  else if (/Macintosh/.test(ua)) cosa = 'Mac'
  else if (/Linux/.test(ua)) cosa = 'Linux'

  const versione = re => (ua.match(re) || [])[1]
  let browser = ''
  if (versione(/EdgA?\/([\d.]+)/)) browser = `Edge ${versione(/EdgA?\/(\d+)/)}`
  else if (versione(/SamsungBrowser\/([\d.]+)/)) browser = `Samsung ${versione(/SamsungBrowser\/(\d+)/)}`
  else if (versione(/(?:CriOS|Chrome)\/([\d.]+)/)) browser = `Chrome ${versione(/(?:CriOS|Chrome)\/(\d+)/)}`
  else if (versione(/(?:FxiOS|Firefox)\/([\d.]+)/)) browser = `Firefox ${versione(/(?:FxiOS|Firefox)\/(\d+)/)}`
  else if (versione(/Version\/([\d.]+).*Safari/)) browser = `Safari ${versione(/Version\/(\d+(?:\.\d+)?)/)}`

  const pezzi = [cosa, browser, installata ? 'app' : 'browser']
  if (larghezza && altezza) pezzi.push(`${larghezza}×${altezza}`)
  return pezzi.filter(Boolean).join(' · ')
}

function questoDispositivo() {
  try {
    return descriviDispositivo({
      ua: navigator.userAgent,
      tocchi: navigator.maxTouchPoints || 0,
      larghezza: window.innerWidth,
      altezza: window.innerHeight,
      installata: window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
    })
  } catch { return '' }
}

const taglia = (testo, n) => (testo == null || testo === '' ? null : String(testo).slice(0, n))

/** La riga come va nella tabella, con ogni testo dentro la sua lunghezza. */
export function preparaRiga({ tipo, messaggio, dettaglio }, { pagina, coach, versione, dispositivo } = {}) {
  return {
    tipo: taglia(tipo, LUNGHEZZE.tipo) || 'errore',
    messaggio: taglia(messaggio, LUNGHEZZE.messaggio) || '(senza testo)',
    dettaglio: taglia(dettaglio, LUNGHEZZE.dettaglio),
    pagina: taglia(pagina, LUNGHEZZE.pagina),
    coach: taglia(coach, LUNGHEZZE.coach),
    versione: taglia(versione, LUNGHEZZE.versione),
    dispositivo: taglia(dispositivo, LUNGHEZZE.dispositivo),
  }
}

/** Quante righe ha già scritto oggi questo telefono, e se può scriverne un'altra. */
export function contaOggi(memoria, oggi) {
  try {
    const dati = JSON.parse(memoria.getItem(CHIAVE_GIORNO) || 'null')
    return dati?.giorno === oggi ? Number(dati.quanti) || 0 : 0
  } catch { return 0 }
}

function segnaOggi(memoria, oggi, quanti) {
  try { memoria.setItem(CHIAVE_GIORNO, JSON.stringify({ giorno: oggi, quanti })) } catch { /* modalità privata */ }
}

const giornoDiOggi = () => new Date().toLocaleDateString('sv-SE') // 2026-11-28, ora locale

/**
 * Scrive un errore nel registro. Non lancia mai e non fa mai comparire
 * niente a schermo: se non riesce, pazienza.
 * `tipo`: 'avviso' (quello rosso a schermo), 'errore', 'promessa', 'schermata'.
 */
export async function registraErrore(tipo, messaggio, dettaglio) {
  if (dentro || tabellaAssente) return false
  if (daIgnorare(messaggio, dettaglio)) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false

  const firma = `${tipo}|${messaggio}|${contesto.pagina || ''}`
  if (giaScritti.has(firma)) return false

  let memoria = null
  try { memoria = window.localStorage } catch { /* modalità privata */ }
  const oggi = giornoDiOggi()
  const giaOggi = memoria ? contaOggi(memoria, oggi) : 0
  if (giaOggi >= MASSIMO_AL_GIORNO) return false

  giaScritti.add(firma)
  if (memoria) segnaOggi(memoria, oggi, giaOggi + 1)

  dentro = true
  try {
    const riga = preparaRiga({ tipo, messaggio, dettaglio }, {
      ...contesto, versione: VERSIONE, dispositivo: questoDispositivo(),
    })
    const { error } = await supabase.from('errori_app').insert(riga)
    if (error && ['42P01', 'PGRST205'].includes(error.code)) tabellaAssente = true
    return !error
  } catch {
    return false
  } finally {
    dentro = false
  }
}

/** Il testo di un errore qualsiasi, anche quando non è un Error vero. */
function testoDi(cosa) {
  if (!cosa) return ''
  if (typeof cosa === 'string') return cosa
  if (cosa.message) return `${cosa.name && cosa.name !== 'Error' ? `${cosa.name}: ` : ''}${cosa.message}`
  try { return JSON.stringify(cosa).slice(0, 300) } catch { return String(cosa) }
}

let avviato = false

/** Da chiamare una volta, all'avvio: da qui in poi gli errori si scrivono da soli. */
export function avviaRegistro() {
  if (avviato || typeof window === 'undefined') return
  avviato = true

  // Gli avvisi rossi a schermo, con il dettaglio del database quando c'è.
  osservaErrori((testo, dettaglio) => { registraErrore('avviso', testo, dettaglio) })

  window.addEventListener('error', evento => {
    const dove = evento.filename ? `${evento.filename}:${evento.lineno}:${evento.colno}` : ''
    registraErrore('errore', testoDi(evento.error) || evento.message, [evento.error?.stack, dove].filter(Boolean).join('\n'))
  })
  window.addEventListener('unhandledrejection', evento => {
    registraErrore('promessa', testoDi(evento.reason), evento.reason?.stack || null)
  })
}

// ── Leggere il registro ─────────────────────────────────────────────────────

/** I nomi delle schermate come li chiamano i coach. */
export const NOMI_PAGINE = {
  home: 'Home', turn: 'Seduta', 'turn-atleti': 'Turno', cycles: 'Schede', 'cycle-form': 'Scheda',
  'cycle-share': 'Condividi scheda', settings: 'Impostazioni', turns: 'Turni', athletes: 'Atleti',
  'athlete-profile': 'Profilo atleta', pulizia: 'Mettere in ordine', errori: 'Registro errori',
  cruscotto: 'Cruscotto',
}

const dueCifre = n => String(n).padStart(2, '0')

/** «oggi 18:05», «ieri 09:12», «25/11 17:40». */
export function quandoCorto(iso, adesso = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const ora = `${dueCifre(d.getHours())}:${dueCifre(d.getMinutes())}`
  const giorno = x => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  const ieri = new Date(adesso); ieri.setDate(ieri.getDate() - 1)
  if (giorno(d) === giorno(adesso)) return `oggi ${ora}`
  if (giorno(d) === giorno(ieri)) return `ieri ${ora}`
  return `${dueCifre(d.getDate())}/${dueCifre(d.getMonth() + 1)} ${ora}`
}

/** Il registro come testo da incollare su WhatsApp: i più recenti in cima. */
export function testoPerWhatsapp(righe, adesso = new Date(), quanti = 30) {
  if (!righe?.length) return ''
  const elenco = righe.slice(0, quanti).map(r => {
    const dove = [NOMI_PAGINE[r.pagina] || r.pagina, r.coach].filter(Boolean).join(' · ')
    const sotto = [r.dispositivo, r.versione && `versione ${r.versione}`].filter(Boolean).join(' · ')
    return [`• ${quandoCorto(r.quando, adesso)}${dove ? ` · ${dove}` : ''}`, `  ${r.messaggio}`,
      r.dettaglio ? `  ${r.dettaglio.split('\n')[0].slice(0, 200)}` : null, sotto ? `  ${sotto}` : null]
      .filter(Boolean).join('\n')
  })
  const titolo = `GymCoach · registro errori (${righe.length > quanti ? `ultimi ${quanti} di ${righe.length}` : righe.length})`
  return [titolo, '', ...elenco].join('\n')
}

export const GIORNI_REGISTRO = 30

/** Gli errori degli ultimi GIORNI_REGISTRO giorni, i più recenti in cima. */
export async function leggiErrori(adesso = new Date()) {
  const da = new Date(adesso.getTime() - GIORNI_REGISTRO * 86_400_000).toISOString()
  const { data, error } = await supabase.from('errori_app')
    .select('id, quando, tipo, messaggio, dettaglio, pagina, coach, versione, dispositivo')
    .gte('quando', da).order('quando', { ascending: false }).limit(200)
  return { righe: data || [], error }
}

/** Solo per i test: si riparte come appena aperta l'app. */
export function dimenticaRegistro() {
  giaScritti.clear()
  tabellaAssente = false
  dentro = false
  contesto = { pagina: null, coach: null }
}
