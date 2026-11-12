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
 * delle date è anche l'ordine delle versioni). Due rilasci nello stesso
 * giorno: «AAAA-MM-GG-2», «-3»… (vengono dopo la data semplice). Una voce
 * già pubblicata non si allunga: chi l'ha vista non la rivedrebbe. Le
 * correzioni invisibili non servono: il tutorial è per le cose da imparare.
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
    id: '2026-11-12',
    data: '12 novembre',
    schede: [
      {
        icona: '🔍',
        titolo: 'IL CARICO DI PRIMA SI LEGGE MEGLIO',
        testo: 'Accanto a ogni carico, quello della volta prima ora è grande e in un riquadro: «PREC. 52.5 kg». Se viene dalla scheda prima, il riquadro è arancione: «SCHEDA PREC.».',
        dove: ['APRI UN TURNO', 'TOCCA UN ESERCIZIO', 'PREC.'],
      },
    ],
  },
  {
    id: '2026-11-11',
    data: '11 novembre',
    schede: [
      {
        icona: '🔙',
        titolo: 'IL CARICO DELLA SCHEDA PRIMA',
        testo: 'In una scheda nuova, accanto a ogni esercizio trovi il carico che il cliente faceva nella scheda prima: «scheda prec. 52.5». Il + e il − partono da lì. Niente più da cercare a mano.',
        dove: ['HOME', 'APRI UN TURNO', 'SCHEDA PREC.'],
        nota: 'Anche l\'immagine da mandare al cliente riporta quel carico. Nei dettagli, «USA ↵» lo scrive con un tocco.',
      },
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
const MASSIMO = 8

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
  // Mai viste niente, ma l'app la usava già: le più recenti, fino al
  // massimo (l'elenco va dalla più nuova, quindi le vecchie restano fuori).
  const nuove = ultimaVista ? elenco.filter(n => n.id > ultimaVista) : elenco
  return schermateDi(nuove, capacita)
}

/** Le schermate dell'ultimo aggiornamento, per rivederle dalle impostazioni. */
export function ultimeNovita(capacita = {}, elenco = NOVITA) {
  // Tutte quelle dello stesso giorno dell'ultima: due rilasci in un giorno
  // sono, per chi usa l'app, lo stesso aggiornamento.
  const giorno = elenco[0]?.id.slice(0, 10)
  return schermateDi(elenco.filter(n => n.id.slice(0, 10) === giorno), capacita)
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
