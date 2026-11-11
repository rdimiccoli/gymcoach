/**
 * Le novità dell'app, da mostrare una volta dopo ogni aggiornamento.
 *
 * Quando un aggiornamento arriva su un telefono, chi lo usa non sa cosa è
 * cambiato: il pulsante nuovo c'è, ma nessuno glielo ha detto. Qui c'è
 * l'elenco, dal più recente; all'apertura l'app mostra, una schermata alla
 * volta, quelle che su questo telefono non sono ancora state viste.
 *
 * ── PER CHI MODIFICA L'APP ─────────────────────────────────────────────────
 * Ogni modifica che il coach vede → una voce nuova IN CIMA, con un `id`
 * nuovo (la data, AAAA-MM-GG: si confrontano come testo, quindi l'ordine
 * delle date è anche l'ordine delle versioni). Le correzioni invisibili non
 * servono: il tutorial è per le cose da imparare.
 *
 * Ogni schermata:
 *   icona   — un'emoji grande
 *   titolo  — corto, in maiuscolo
 *   testo   — una o due frasi semplici: cosa fa, non come è fatta
 *   dove    — la strada per trovarla, un passo per riquadro
 *   nota    — facoltativa: la cosa rassicurante («non si perde niente»)
 *   serve   — facoltativo: il nome di una capacità (vedi capacita.js).
 *             Se il database non ce l'ha ancora, la schermata non compare:
 *             non si annuncia un pulsante che non c'è.
 */

export const NOVITA = [
  {
    id: '2026-11-11',
    data: '11 novembre',
    schede: [
      {
        icona: '⇄',
        titolo: 'SCAMBIA I GIORNI',
        testo: 'Tutti gli esercizi del Giorno 1 passano al Giorno 2, e quelli del Giorno 2 al Giorno 1. Con qualsiasi coppia di giorni.',
        dove: ['SCHEDE', 'APRI →', 'IN FONDO ALLA PAGINA', '⇄ SCAMBIA I GIORNI'],
        nota: 'Prima ti mostra cosa va dove e chiede conferma. I carichi dei clienti non si perdono.',
      },
      {
        icona: '⇅',
        titolo: 'I TURNI NELL\'ORDINE CHE VUOI',
        testo: 'In Home puoi mettere i turni nell\'ordine che preferisci, non più per forza per orario: tocca le frecce ▲ ▼, oppure tieni premuto ≡ e trascina. Lo stesso ordine vale anche in TURNI e SCHEDE.',
        dove: ['HOME', '⋮ IN ALTO', 'RIORDINA I TURNI', '▲ ▼ OPPURE ≡'],
        nota: 'Mentre riordini le card non si aprono: nessun tocco sbagliato.',
        serve: 'ordineTurni',
      },
      {
        icona: '🔁',
        titolo: 'LE RIPETIZIONI CAMBIANO QUANDO VUOI TU',
        testo: 'Non più per forza ogni due settimane: scegli ogni quante cambiano. Ogni settimana, ogni due, ogni tre… Le caselle delle ripetizioni si adeguano da sole.',
        dove: ['SCHEDE', '⋮', 'MODIFICA', 'LE RIPETIZIONI CAMBIANO OGNI'],
        nota: 'Si sceglie anche quando crei una scheda nuova.',
        serve: 'progressioni',
      },
      {
        icona: '📷',
        titolo: 'LA SCHEDA COME IMMAGINE',
        testo: 'La scheda del cliente diventa un\'immagine ordinata, con logo, giorni e carichi. La mandi su WhatsApp e lui la ritrova in galleria.',
        dove: ['SCHEDE', '⋮', 'CONDIVIDI', '📷 INVIA COME IMMAGINE'],
      },
      {
        icona: '📈',
        titolo: 'I PROGRESSI DEL CLIENTE',
        testo: 'Per ogni esercizio: da dove è partito, dove è arrivato, quante volte ha battuto il suo record. Con il grafico.',
        dove: ['ATLETI', 'TOCCA UN NOME'],
        nota: 'Ci arrivi anche durante l\'allenamento, toccando il nome del cliente.',
      },
    ],
  },
]

/** Al massimo tante schermate in una volta: oltre, nessuno le legge. */
const MASSIMO = 6

/**
 * Le schermate da mostrare adesso.
 *
 * `ultimaVista`: l'id dell'ultima novità vista su questo telefono, o null.
 * `introDaFare`: vero se su questo telefono non si è mai entrati — e allora
 *   c'è già la presentazione iniziale: le novità di oggi, per chi parte
 *   oggi, non sono novità.
 * `capacita`: quello che il database sa fare (vedi `serve`).
 */
export function novitaDaMostrare({ ultimaVista = null, introDaFare = false, capacita = {}, elenco = NOVITA } = {}) {
  if (introDaFare || !elenco.length) return []
  // Mai viste niente, ma l'app la usava già: si mostra solo l'ultima, non
  // tutta la storia.
  const nuove = ultimaVista ? elenco.filter(n => n.id > ultimaVista) : elenco.slice(0, 1)
  return schermateDi(nuove, capacita)
}

/** Le schermate dell'ultimo aggiornamento, per rivederle dalle impostazioni. */
export function ultimeNovita(capacita = {}, elenco = NOVITA) {
  return schermateDi(elenco.slice(0, 1), capacita)
}

function schermateDi(versioni, capacita) {
  return versioni
    .flatMap(n => n.schede)
    .filter(s => !s.serve || capacita[s.serve])
    .slice(0, MASSIMO)
}

// ── Il segno «già viste», su questo telefono ───────────────────────────────

const CHIAVE = 'gymcoach.novita-viste'

export function leggiUltimaVista() {
  try { return localStorage.getItem(CHIAVE) } catch { return null }
}

export function segnaNovitaViste(elenco = NOVITA) {
  try { if (elenco[0]) localStorage.setItem(CHIAVE, elenco[0].id) } catch { /* modalità privata */ }
}
