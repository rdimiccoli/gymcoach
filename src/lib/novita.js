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
 * nuovo (la data, AAAA-MM-GG: l'ordine delle date è anche l'ordine delle
 * versioni). Due rilasci nello stesso giorno: «AAAA-MM-GG-2», «-3»… (vengono
 * dopo la data semplice, e «-10» dopo «-9»: vedi confronta). Una voce
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
    id: '2026-11-28-2',
    data: '28 novembre',
    schede: [
      {
        icona: '💡',
        titolo: 'IL PESO PROPOSTO',
        testo: 'Dove oggi non c\'è ancora un peso, al posto del trattino compare quello che probabilmente farà, con il punto di domanda: «55?». Un tocco e si segna. Se è diverso, + e − partono da lì.',
        dove: ['APRI UN TURNO', 'TOCCA UN ESERCIZIO', '55?'],
        nota: 'È solo una proposta: finché non la tocchi non si salva niente. Per rifare lo stesso peso c\'è sempre PREC. ↵',
      },
      {
        icona: '📡',
        titolo: 'IL TURNO SI APRE ANCHE SENZA RETE',
        testo: 'Se il wifi cade, la Home e i turni si aprono lo stesso, con i dati dell\'ultima volta che c\'era rete. In cima compare «SENZA RETE» con l\'ora dei dati.',
        dove: ['HOME', 'APRI UN TURNO'],
        nota: 'I pesi che segni restano sul telefono e partono da soli appena torna la rete.',
      },
      {
        icona: '📊',
        titolo: 'IL CRUSCOTTO',
        testo: 'Quante persone si sono allenate questa settimana e nelle ultime dieci, coach per coach, gli ospiti e chi non si vede da tre settimane.',
        dove: ['IMPOST.', 'CRUSCOTTO'],
        serve: 'andamento',
      },
      {
        icona: '💾',
        titolo: 'LE COPIE DI SICUREZZA',
        testo: 'Una volta a settimana l\'app fa da sola una copia di tutti i dati. E quando vuoi puoi scaricarne una sul telefono o sul computer.',
        dove: ['IMPOST.', 'COPIE DI SICUREZZA'],
        nota: 'Dall\'app nessuno può cancellare le copie.',
        serve: 'copie',
      },
      {
        icona: '🩺',
        titolo: 'IL REGISTRO DEGLI ERRORI',
        testo: 'Se qualcosa va storto, l\'app lo annota da sola: quando, in quale schermata e su che telefono. Non devi ricordarti il messaggio: basta copiare il registro e mandarlo su WhatsApp.',
        dove: ['IMPOST.', 'REGISTRO DEGLI ERRORI', 'COPIA PER WHATSAPP'],
        serve: 'registroErrori',
      },
    ],
  },
  {
    id: '2026-11-28',
    data: '28 novembre',
    schede: [
      {
        icona: '📱',
        titolo: 'DUE COLONNE SU TUTTI GLI iPad',
        testo: 'La seduta a due colonne ora si apre anche sugli iPad più piccoli, come l\'iPad di 9ª generazione e l\'iPad Pro da 9,7 pollici. Prima funzionava solo sugli schermi più larghi.',
        dove: ['iPad IN ORIZZONTALE', 'APRI UN TURNO'],
        nota: 'Con l\'iPad in verticale resta una colonna sola, con il menu in basso.',
      },
    ],
  },
  {
    id: '2026-11-27',
    data: '27 novembre',
    schede: [
      {
        icona: '➕',
        titolo: 'IL + SALE DEL PESO GIUSTO',
        testo: 'Dove si usano i dischi il + sale di 2,5 kg, con i manubri di 2: l\'app lo capisce da sola dai pesi già segnati. Sul tasto c\'è scritto «+2,5». Da 50 a 55: due tocchi invece di cinque.',
        dove: ['APRI UN TURNO', 'TOCCA UN ESERCIZIO', '+2,5'],
        nota: 'Per il mezzo chilo ci sono sempre i DETTAGLI.',
      },
      {
        icona: '↵',
        titolo: 'TOCCA «PREC.» PER RIFARE LO STESSO PESO',
        testo: 'Se il cliente rifà il peso della volta prima, tocca il riquadro PREC.: il peso si scrive da solo e si salva. Quando è uguale compare ✓.',
        dove: ['APRI UN TURNO', 'TOCCA UN ESERCIZIO', 'PREC. ↵'],
      },
      {
        icona: '🔆',
        titolo: 'SI LEGGE E SI TOCCA MEGLIO',
        testo: 'Le scritte grigie sono più chiare e i tasti più grandi. E in IMPOSTAZIONI puoi ingrandire tutto: normale, grande o molto grande.',
        dove: ['IMPOST.', 'GRANDEZZA DEL TESTO'],
        nota: 'La grandezza vale solo sul telefono dove la scegli. In TURNI «Elimina il turno» ora sta dentro MODIFICA, lontano dal dito.',
      },
      {
        icona: '🏠',
        titolo: 'GLI AVVISI IN HOME',
        testo: 'La card del turno dice quando la scheda è all\'ultima settimana e quando è finita. E il turno dell\'ora in corso si accende di arancione.',
        dove: ['HOME'],
        nota: 'Se una scheda finita resta aperta, i pesi nuovi si salvano a parte: quelli dell\'ultima settimana non si toccano.',
      },
      {
        icona: '👀',
        titolo: 'CHI NON SI VEDE DA TRE SETTIMANE',
        testo: 'In Home, sotto i turni: chi non ha più un peso segnato da tre settimane, con il giorno dell\'ultima volta. Tocca il nome per aprire il suo profilo.',
        dove: ['HOME', 'IN FONDO'],
        serve: 'ultimiAllenamenti',
      },
      {
        icona: '📱',
        titolo: 'SUL TABLET, DUE COLONNE',
        testo: 'Con il tablet in orizzontale la seduta usa tutto lo schermo: a sinistra gli esercizi del giorno, a destra le persone con i loro pesi. Un tocco per passare all\'esercizio dopo.',
        dove: ['TABLET IN ORIZZONTALE', 'APRI UN TURNO'],
      },
      {
        icona: '🏷️',
        titolo: 'NOMI IN ORDINE, E UNA NOTA',
        testo: 'I nomi si vedono tutti allo stesso modo, anche quelli scritti in maiuscolo. E accanto al nome puoi mettere una nota corta: «nuova», «over», «arriva tardi».',
        dove: ['TURNI', 'APRI UN TURNO', 'MATITA ACCANTO AL NOME', 'NOTA'],
        serve: 'notaPersona',
      },
      {
        icona: '🧹',
        titolo: 'METTERE IN ORDINE',
        testo: 'Una pagina che trova chi è attivo ma non ha mai fatto un allenamento, le persone iscritte due volte e gli esercizi scritti in due modi. Si sistema uno alla volta, sempre con conferma.',
        dove: ['IMPOST.', 'METTERE IN ORDINE'],
        nota: 'Non si cancella niente: chi si archivia si riattiva da ATLETI.',
      },
    ],
  },
  {
    id: '2026-11-24',
    data: '24 novembre',
    schede: [
      {
        icona: '🔢',
        titolo: 'LA VOLTA PRIMA, CON LE RIPETIZIONI',
        testo: 'Accanto al carico della volta prima ora vedi anche le ripetizioni di quella settimana: «PREC. 4x6 · 20 kg». Così sai se quei 20 kg erano per 4x6 o per 4x4.',
        dove: ['APRI UN TURNO', 'TOCCA UN ESERCIZIO', 'PREC.'],
        nota: 'Le ripetizioni di questa settimana restano scritte sotto il nome, grandi.',
      },
    ],
  },
  {
    id: '2026-11-20',
    data: '20 novembre',
    schede: [
      {
        icona: '👋',
        titolo: 'OSPITE PUÒ ESSERE CHIUNQUE',
        testo: 'Con «+ OSPITE» aggiungi al turno chi viene da un altro turno: anche se non è Silver, anche se è di un altro coach. Scrivi il nome per trovarlo: si allena sulla sua scheda e i carichi restano suoi.',
        dove: ['APRI UN TURNO', 'IN FONDO', '+ OSPITE'],
        nota: 'I Silver compaiono per primi, con l\'alone argento. Accanto a ogni nome vedi il turno e il coach da cui viene: «09:00 · Manu».',
        serve: 'silver',
      },
    ],
  },
  {
    id: '2026-11-16-2',
    data: '16 novembre',
    schede: [
      {
        icona: '🔀',
        titolo: 'PASSA DA UNA SCHEDA ALL\'ALTRA',
        testo: 'Se il turno ha più schede attive, in cima alla seduta trovi i loro nomi: un tocco e passi all\'altra, senza tornare in Home. Il giorno che stavi guardando resta lo stesso.',
        dove: ['HOME', 'APRI UN TURNO', 'IN ALTO: SCHEDE DEL TURNO'],
      },
    ],
  },
  {
    id: '2026-11-16',
    data: '16 novembre',
    schede: [
      {
        icona: '📅',
        titolo: 'CHI FA QUALI GIORNI',
        testo: 'Per ogni persona scegli quali giorni della scheda fa: Alessia G1 e G2, Greta G2 e G3. In seduta accanto al nome vedi «G1 · G2», e chi quel giorno non è previsto va in fondo, in grigio.',
        dove: ['SCHEDE', '⋮', 'GIORNI DI OGNUNO'],
        nota: 'Chi non ha niente di segnato fa tutti i giorni, come prima. Clonando una scheda le scelte si copiano.',
        serve: 'giorniPersona',
      },
    ],
  },
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
export function novitaDaMostrare({ ultimaVista = null, introDaFare = false, capacita = {}, elenco = NOVITA, sospese = [] } = {}) {
  if (introDaFare || !elenco.length) return []
  // Mai viste niente, ma l'app la usava già: le più recenti, fino al
  // massimo (l'elenco va dalla più nuova, quindi le vecchie restano fuori).
  const nuove = ultimaVista ? elenco.filter(n => confronta(n.id, ultimaVista) > 0) : elenco
  // Più quelle rimaste in sospeso: annunciate in un aggiornamento quando il
  // database non le sapeva ancora fare, e diventate possibili dopo (vedi
  // segnaNovitaViste). Prima si perdevano per sempre.
  const giaDentro = new Set(nuove.map(n => n.id))
  const recuperate = elenco
    .filter(n => !giaDentro.has(n.id))
    .flatMap(n => n.schede.filter((s, i) => sospese.includes(`${n.id}#${i}`)))
  return [...schermateDi(nuove, capacita), ...recuperate.filter(s => !s.serve || capacita[s.serve])].slice(0, MASSIMO)
}

/**
 * Confronta due id di rilascio: prima la data, poi il numero dopo la data.
 * Come testo «2026-11-16-10» verrebbe prima di «2026-11-16-2», e il decimo
 * rilascio di un giorno sembrerebbe già visto.
 */
export function confronta(a, b) {
  const [, dataA = '', nA = '1'] = String(a).match(/^(\d{4}-\d{2}-\d{2})(?:-(\d+))?/) || []
  const [, dataB = '', nB = '1'] = String(b).match(/^(\d{4}-\d{2}-\d{2})(?:-(\d+))?/) || []
  if (dataA !== dataB) return dataA < dataB ? -1 : 1
  return Number(nA) - Number(nB)
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
const CHIAVE_SOSPESE = 'gymcoach.novita-sospese'

export function leggiUltimaVista() {
  try { return localStorage.getItem(CHIAVE) } catch { return null }
}

export function leggiSospese() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_SOSPESE) || '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

/**
 * Le schermate da tenere in sospeso: quelle fra le non viste che il database
 * non sa ancora fare (la query su Supabase si lancia dopo l'aggiornamento).
 * Restano in elenco finché non diventano possibili; quelle mostrate escono.
 */
export function sospeseDopo({ ultimaVista = null, capacita = {}, elenco = NOVITA, sospese = [] } = {}) {
  const nuove = ultimaVista ? elenco.filter(n => confronta(n.id, ultimaVista) > 0) : elenco
  const fuori = nuove.flatMap(n => n.schede.map((s, i) => (s.serve && !capacita[s.serve] ? `${n.id}#${i}` : null))).filter(Boolean)
  const ancora = sospese.filter(id => {
    const [vid, i] = id.split('#')
    const s = elenco.find(n => n.id === vid)?.schede[Number(i)]
    return s?.serve && !capacita[s.serve]
  })
  return [...new Set([...ancora, ...fuori])]
}

/**
 * Segna tutto come visto. Con `capacita` ricorda anche le schermate saltate
 * perché il database non era pronto, per mostrarle quando lo sarà; senza
 * (telefono nuovo, con la presentazione iniziale) non ricorda niente.
 */
export function segnaNovitaViste(elenco = NOVITA, capacita = null) {
  try {
    if (capacita) {
      const sospese = sospeseDopo({ ultimaVista: leggiUltimaVista(), capacita, elenco, sospese: leggiSospese() })
      localStorage.setItem(CHIAVE_SOSPESE, JSON.stringify(sospese))
    }
    if (elenco[0]) localStorage.setItem(CHIAVE, elenco[0].id)
  } catch { /* modalità privata */ }
}
