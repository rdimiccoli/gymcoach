import { useState, useEffect, useRef, useCallback, lazy, Suspense, Fragment } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk, notifyError } from '../lib/notify'
import { salvaCarichi } from '../lib/coda'
import { comePulsante } from '../lib/stile'
import { tocco, conferma, festa } from '../lib/aptico'
import { repsPerSettimana, raggruppaEsercizi, secondiDaTesto, settimanaDaCalendario, settimanaVera } from '../lib/schede'
import { capacita } from '../lib/capacita'
import { conOrdineDelTurno, spostaAccanto } from '../lib/ordineDb'
import { useScivola } from '../lib/movimento'
import AvvisoRosso from '../components/AvvisoRosso'
import { giorniDi, elencoGiorni, etichettaGiorno } from '../lib/giorni'
import { settimaneDi, ogniDi } from '../lib/settimane'
import { personeDellaScheda } from '../lib/assegnazioni'
import { caricaAssegnazioni } from '../lib/assegnazioniDb'
import { tutteLeRighe } from '../lib/tutteLeRighe'
import { storicoEsercizi } from '../lib/storicoDb'
import { passiDalloStorico, scriviPasso } from '../lib/passoPeso'
import { useSchermoLargo } from '../lib/schermo'
import { mappaGiorni, dividiPerGiorno, etichettaGiorni } from '../lib/giorniPersona'
import { caricaGiorniPersona } from '../lib/giorniPersonaDb'
// Arriva solo quando si apre un circuito, non a ogni avvio dell'app.
const TimerCircuito = lazy(() => import('../components/TimerCircuito'))
import { ScheletroElenco } from '../components/Scheletro'
import OspitiDelGiorno from '../components/OspitiDelGiorno'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { nomeCompleto, bello } from '../lib/nomi'
import NotaPersona from '../components/NotaPersona'




/**
 * `incorporato`: la schermata sta dentro il pannello di destra di un'altra
 * pagina invece di essere la pagina. In quel caso non disegna la propria
 * barra del titolo né il proprio menu — ce li ha già la pagina che la
 * contiene — e il giorno glielo detta lei, perché è una scelta del turno e
 * non della singola persona.
 */
export default function TurnDetail({ navigate, goBack, goHome, params, incorporato = false }) {
  // `soloAtleti`: id delle persone da mostrare, invece di tutto il turno.
  // Serve in due casi — gli ospiti Silver venuti da un altro turno (e allora
  // `cycle` è la LORO scheda, `turn` è il turno che li ospita) e la singola
  // persona aperta dall'elenco, quando il coach apre i turni per atleta.
  const { turn, soloAtleti, sottotitolo } = params
  // Il giorno può arrivare da chi ci manda qui: sceglierlo sull'elenco del
  // turno e ritrovare il Giorno 1 aprendo una persona sarebbe un tocco perso.
  const [day, setDay] = useState(params.giorno || 1)
  // Incorporata, il giorno lo sceglie il turno: seguirlo invece di tenerne
  // uno proprio, o toccare GIORNO 2 nell'elenco non cambierebbe il pannello.
  useEffect(() => { if (incorporato && params.giorno) setDay(params.giorno) }, [incorporato, params.giorno])
  // Le schede attive del turno, per passare dall'una all'altra senza tornare
  // in Home: alle 13:30 Manu ha tre programmi, e prima per cambiarne uno
  // doveva uscire, aprire l'altro, uscire, aprire il terzo. Solo nella
  // schermata vera del turno — non per un ospite né dentro il pannello della
  // vista per atleta, che hanno già la loro scheda.
  const [schedeTurno, setSchedeTurno] = useState([])
  const [schedaScelta, setSchedaScelta] = useState(null)
  const cycle = (!incorporato && schedaScelta) || params.cycle
  const cambiaScheda = useCallback(s => {
    if (!s || s.id === cycle?.id) return
    setSchedaScelta(s)
    // Il giorno resta quello che si stava guardando, se la scheda ce l'ha.
    setDay(d => (d <= giorniDi(s) ? d : 1))
  }, [cycle?.id])
  const [exercises, setExercises] = useState([])
  const [clients, setClients] = useState([])
  // Tutte le persone del turno, non solo quelle che seguono questa scheda:
  // servono intere per spostarne una, perché i numeri d'ordine valgono per
  // il turno e la prima volta non ce l'ha nessuno.
  const [tuttiDelTurno, setTuttiDelTurno] = useState([])
  // Le animazioni (index.css, «IL MOVIMENTO»). Ognuna è un contatore per
  // carico: cambiando, cambia la `key` dell'elemento animato e l'animazione
  // riparte. Solo per quello che il coach ha toccato in questa seduta —
  // aprendo la schermata non deve saltare niente.
  const [saltelli, setSaltelli] = useState({})     // il numero cambiato con + / −
  const [salvati, setSalvati] = useState({})       // il server ha detto sì
  const [recordAppena, setRecordAppena] = useState({}) // record battuto adesso
  // Vedi controllaRecord: gli avvisi di record in attesa che il coach
  // finisca di toccare, chi ha già avuto il suo, e il record sempre
  // aggiornato (le scritture partono da timer, e lo stato letto lì potrebbe
  // essere vecchio).
  const avvisoInAttesa = useRef({})
  const giaAvvisati = useRef(new Set())
  const recordRef = useRef({})
  // Ogni peso salvato di una persona su un esercizio, cella per cella
  // («riga della scheda + settimana»). Il record è il massimo di queste: così
  // un peso sbagliato e poi corretto non lascia un record finto in memoria.
  const celleRecord = useRef({})
  // Di quanto sale il + per ogni esercizio: 2,5, 2 o 1 kg, capito dai pesi
  // già segnati (vedi passoPeso.js). { idEsercizio: passo }
  const [passi, setPassi] = useState({})
  useEffect(() => () => Object.values(avvisoInAttesa.current).forEach(a => clearTimeout(a.timer)), [])
  const elencoRef = useRef(null)
  const ricordaPosti = useScivola(elencoRef)
  const [ordineAttivo, setOrdineAttivo] = useState(false)
  useEffect(() => { capacita().then(c => setOrdineAttivo(c.ordinePersone)) }, [])
  // loads[clientId_exId_week] = kg
  const [loads, setLoads] = useState({})
  // notes[clientId_exId] = testo. Il vincolo unico nel database è su
  // (client_id, cycle_exercise_id) senza la settimana: la nota vale per
  // l'atleta su quell'esercizio per tutta la scheda, non per una settimana.
  const [notes, setNotes] = useState({})
  // record[clientId_exerciseId] = massimo di sempre su quell_esercizio
  const [record, setRecord] = useState({})
  // precedenti[clientId_exerciseId] = { kg, settimana, scheda }: l'ultimo
  // carico nelle schede prima di questa (vedi carichiPrecedenti.js). Serve
  // alla prima settimana di una scheda nuova, che di suo non ha un «prec.».
  const [precedenti, setPrecedenti] = useState({})
  // giorniPersone[clientId] = [1, 3]: i giorni che fa (vedi giorniPersona.js).
  // Chi non c'è fa tutti i giorni.
  const [giorniPersone, setGiorniPersone] = useState({})
  const [expanded, setExpanded] = useState({})
  // Tablet sdraiato: due colonne (vedi renderGruppo). Non dentro il pannello
  // di un'altra schermata, né per gli ospiti: lì la colonna è già stretta.
  const schermoLargo = useSchermoLargo()
  const affiancato = schermoLargo && !incorporato && !soloAtleti?.length
  const [scelto, setScelto] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [timer, setTimer] = useState(null)
  const [loading, setLoading] = useState(true)
  // Di quale scheda e giorno sono i dati sullo schermo. Toccando in fretta due
  // linguette, la risposta della prima può arrivare dopo quella della
  // seconda: senza questo controllo lo schermo mostrava gli esercizi di una
  // scheda con la settimana dell'altra, e un peso segnato in quel momento
  // finiva sulla scheda sbagliata. Ogni lettura ha il suo numero; vale solo
  // l'ultima, e finché non arriva l'elenco non si mostra.
  const richiesta = useRef(0)
  const [caricatoPer, setCaricatoPer] = useState(null)
  const chiaveDati = cycle ? `${cycle.id}_${day}` : null
  const inCaricamento = loading || caricatoPer !== chiaveDati
  const timerCarichi = useRef({})
  const carichiPendenti = useRef({})

  useEffect(() => { if (cycle) loadData(); else setLoading(false) }, [day, cycle])
  useEffect(() => {
    if (incorporato || soloAtleti?.length || !turn?.id) return
    // Stesso ordine delle card in Home: la più recente prima.
    supabase.from('cycles').select('*').eq('turn_id', turn.id).eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSchedeTurno(data || []))
  }, [turn?.id, incorporato, soloAtleti?.length])

  /**
   * La settimana è della SCHEDA, non della singola atleta.
   *
   * Prima ogni atleta aveva il suo contatore, che il coach faceva avanzare a
   * mano. Il risultato era che sei persone dello stesso turno — che si erano
   * allenate insieme, lo stesso giorno, sulla stessa seduta — risultavano a
   * sei settimane diverse. Il numero non descriveva niente di vero, e infatti
   * l'app doveva avvisare «2 indietro» per segnalare che non tornava.
   *
   * Ora viene dalla data d'inizio della scheda: una sola, uguale per tutte,
   * che non si può sbagliare con un tocco accidentale. Se il gruppo resta
   * davvero indietro si sposta la data d'inizio, e si ricalcola tutto.
   */
  // Quante settimane dura questa scheda: sei, se nessuno ha scelto altro.
  const totale = settimaneDi(cycle)
  // Scheda finita ma ancora aperta: i pesi vanno in una settimana in più
  // invece di scrivere sopra l'ultima (vedi settimanaVera).
  const vera = settimanaVera(cycle)
  const finita = vera !== null && vera > totale
  const settimana = finita ? vera : (settimanaDaCalendario(cycle) || 1)
  // Ogni quante settimane cambiano le ripetizioni (null: le tre fasi di sempre).
  const passo = ogniDi(cycle)

  // Uscendo dalla schermata le modifiche ancora in attesa partono comunque.
  useEffect(() => () => { Object.keys(carichiPendenti.current).forEach(scriviCarico) }, [])

  async function loadData() {
    const mia = ++richiesta.current
    const chiave = `${cycle.id}_${day}`
    const vecchia = () => mia !== richiesta.current
    setLoading(true)
    const perOspiti = soloAtleti?.length > 0
    const [{ data: exData }, { data: tutti }, assegnazioni] = await Promise.all([
      run(supabase.from('cycle_exercises').select('*, exercises(name)')
        .eq('cycle_id', cycle.id).eq('day', day).order('sort_order'),
        'Impossibile caricare gli esercizi del giorno.'),
      perOspiti
        // Vengono da un altro turno: si prendono per nome, non per turno.
        // A parità di cognome decide il nome: due Rossi non si scambiano di
        // posto a ogni apertura della schermata.
        ? run(await conOrdineDelTurno(supabase.from('clients').select('*').in('id', soloAtleti)),
            'Impossibile caricare le persone.')
        : run(await conOrdineDelTurno(supabase.from('clients').select('*')
            .eq('turn_id', turn.id).eq('is_active', true)),
            'Impossibile caricare gli atleti del turno.'),
      // Le persone sono già scelte una per una: il filtro per scheda non serve.
      perOspiti
        ? {}
        : capacita().then(c => c.assegnazioni ? caricaAssegnazioni([cycle.id]) : {}),
    ])
    if (vecchia()) return
    // Una scheda assegnata solo ad alcuni mostra solo loro; senza
    // assegnazioni, tutto il turno — come prima.
    const cl = personeDellaScheda(cycle, tutti || [], assegnazioni)
    setExercises(exData || [])
    setClients(cl)
    setTuttiDelTurno(tutti || [])
    caricaGiorniPersona([cycle.id]).then(perScheda => {
      if (!vecchia()) setGiorniPersone(mappaGiorni(perScheda[cycle.id], giorniDi(cycle)))
    })

    if (exData?.length && cl?.length) {
      const exIds = exData.map(e => e.id)
      const clIds = cl.map(c => c.id)
      // Tutte le settimane di questa scheda, a pagine: un turno grande supera
      // le mille righe che Supabase manda in una volta (vedi tutteLeRighe.js).
      const [{ data: loadData }, { data: noteData }] = await Promise.all([
        tutteLeRighe(() => supabase.from('client_loads').select('*')
          .in('client_id', clIds).in('cycle_exercise_id', exIds)
          .order('client_id').order('cycle_exercise_id').order('week'),
          'Impossibile caricare lo storico dei carichi.'),
        run(supabase.from('client_notes').select('client_id, cycle_exercise_id, note')
          .in('client_id', clIds).in('cycle_exercise_id', exIds),
          'Impossibile caricare le note.'),
      ])
      if (vecchia()) return
      const loadMap = {}
      loadData?.forEach(l => {
        loadMap[`${l.client_id}_${l.cycle_exercise_id}_${l.week}`] = l.kg
      })
      setLoads(loadMap)

      // ── Record personali e carichi delle schede prima ─────────────────
      // Né il massimo di sempre né il carico della scheda prima si ricavano
      // da loadMap: quello copre solo questa scheda. Lo stesso esercizio in
      // schede diverse ha righe cycle_exercises diverse, quindi si passa da
      // exercise_id. Una lettura sola per tutte e due le cose.
      const idEsercizi = [...new Set(exData.map(e => e.exercise_id).filter(Boolean))]
      const { righe: storico, precedenti: dallaSchedaPrima } = await storicoEsercizi(clIds, idEsercizi, cycle)
      if (vecchia()) return
      const massimi = {}
      const celle = {}
      storico?.forEach(r => {
        const kg = r.kg == null || r.kg === '' ? NaN : Number(r.kg)
        if (!Number.isFinite(kg)) return
        const persona = `${r.client_id}_${r.cycle_exercises?.exercise_id}`
        ;(celle[persona] ||= {})[`${r.cycle_exercise_id}_${r.week}`] = kg
        if (massimi[persona] === undefined || kg > massimi[persona]) massimi[persona] = kg
      })
      celleRecord.current = celle
      setPassi(passiDalloStorico(storico))
      setRecord(massimi)
      recordRef.current = massimi
      setPrecedenti(dallaSchedaPrima)

      const noteMap = {}
      noteData?.forEach(n => { noteMap[`${n.client_id}_${n.cycle_exercise_id}`] = n.note })
      setNotes(noteMap)
    }
    if (vecchia()) return
    setCaricatoPer(chiave)
    setLoading(false)
  }

  async function saveLoads(clientId, clientWeek, loadUpdates) {
    // Un solo upsert per tutto il gruppo: prima era una richiesta per esercizio,
    // in fila, e nessuna delle due controllava l'esito.
    // Solo i carichi scritti davvero. Un campo lasciato vuoto non è «0 kg»:
    // prima lo diventava, e aprire DETTAGLI solo per scrivere una nota
    // registrava uno zero fasullo — che poi compariva nello storico come un
    // crollo del carico.
    const conCarico = loadUpdates.filter(u => u.kg != null)
    const righe = conCarico.map(({ cycleExId, kg }) => ({
      client_id: clientId, cycle_exercise_id: cycleExId, kg, week: clientWeek
    }))
    // Passa dalla coda: se manca il segnale il carico non si perde, resta sul
    // telefono e parte da solo. Fallisce solo se è il server a rifiutare.
    const { differito, errore } = righe.length ? await salvaCarichi(righe) : { differito: false, errore: null }
    if (errore) {
      notifyError('Carichi rifiutati dal server. Riprova.')
      // La modale resta aperta con i valori digitati: si può ritentare senza
      // riscrivere tutto.
      return
    }

    setLoads(prev => {
      const next = { ...prev }
      conCarico.forEach(({ cycleExId, kg }) => { next[`${clientId}_${cycleExId}_${clientWeek}`] = kg })
      return next
    })

    // Note: una svuotata va CANCELLATA, non salvata come stringa vuota,
    // altrimenti la tabella si riempie di righe che sembrano note e non lo sono.
    const daSalvare = loadUpdates
      .filter(a => a.nota?.trim())
      .map(a => ({ client_id: clientId, cycle_exercise_id: a.cycleExId, note: a.nota.trim() }))
    const daTogliere = loadUpdates
      .filter(a => !a.nota?.trim() && notes[`${clientId}_${a.cycleExId}`] !== undefined)
      .map(a => a.cycleExId)

    let erroreNote = null
    if (daSalvare.length) {
      const r = await run(
        supabase.from('client_notes').upsert(daSalvare, { onConflict: 'client_id,cycle_exercise_id' }),
        'Carichi salvati, ma le note NON sono state salvate.'
      )
      erroreNote = r.error
    }
    if (!erroreNote && daTogliere.length) {
      const r = await run(
        supabase.from('client_notes').delete().eq('client_id', clientId).in('cycle_exercise_id', daTogliere),
        'Carichi salvati, ma le note NON sono state cancellate.'
      )
      erroreNote = r.error
    }
    // I carichi sono già al sicuro. Se sono le note a non passare la modale
    // resta aperta, così il testo digitato non va perso.
    if (erroreNote) return

    setNotes(prev => {
      const next = { ...prev }
      loadUpdates.forEach(({ cycleExId, nota }) => {
        const chiave = `${clientId}_${cycleExId}`
        if (nota?.trim()) next[chiave] = nota.trim()
        else delete next[chiave]
      })
      return next
    })
    conCarico.forEach(({ cycleExId, kg }) => {
      const ex = exercises.find(e => e.id === cycleExId)
      const cliente = clients.find(c => c.id === clientId)
      if (ex && cliente) controllaRecord(cliente, ex, kg, true, clientWeek)
    })
    conferma()
    notifyOk(!righe.length ? 'Salvato' : differito ? 'Carichi salvati sul telefono, partiranno appena torna la rete' : 'Carichi salvati')
    setEditModal(null)
  }

  // Modifica di un carico dalla lista, senza aprire nulla. Lo stato locale si
  // aggiorna subito — il tocco deve rispondere all'istante — e la scrittura
  // parte dopo una pausa, così tenere premuto +5 volte non fa cinque richieste.
  function modificaCarico(client, ex, delta) {
    const chiave = `${client.id}_${ex.id}_${settimana}`
    const attuale = parseFloat(loads[chiave])
    // Settimana nuova, ancora vuota: si parte dal carico della volta prima,
    // che è scritto lì accanto («prec. 27.5»). Partire da zero voleva dire
    // che + dava 1 kg, e per arrivare a 28 bisognava aprire DETTAGLI.
    const precedente = parseFloat(getLoadInfo(client, ex).prevKg)
    const base = Number.isFinite(attuale) ? attuale : Number.isFinite(precedente) ? precedente : 0
    impostaCarico(client, ex, Math.max(0, parseFloat((base + delta).toFixed(2))))
  }

  /**
   * Il riquadro «PREC.» si tocca: il peso della volta prima diventa quello di
   * oggi. Capita 17 volte su 100 che un cliente rifaccia lo stesso peso, e
   * prima servivano due tocchi (+ e poi −) e due salvataggi.
   */
  function usaPrecedente(client, ex, kg) {
    const valore = parseFloat(kg)
    if (!Number.isFinite(valore)) return
    if (parseFloat(loads[`${client.id}_${ex.id}_${settimana}`]) === valore) { tocco(); return }
    impostaCarico(client, ex, valore)
  }

  function impostaCarico(client, ex, nuovo) {
    tocco() // conferma il tocco senza obbligare a guardare lo schermo
    rimandaAvviso(client, ex)
    const chiave = `${client.id}_${ex.id}_${settimana}`

    setLoads(prev => ({ ...prev, [chiave]: nuovo }))
    setSaltelli(prev => ({ ...prev, [chiave]: (prev[chiave] || 0) + 1 }))
    carichiPendenti.current[chiave] = {
      client_id: client.id, cycle_exercise_id: ex.id, kg: nuovo, week: settimana,
      __client: client, __ex: ex,
    }
    clearTimeout(timerCarichi.current[chiave])
    timerCarichi.current[chiave] = setTimeout(() => scriviCarico(chiave), 900)
  }

  /**
   * Se il carico appena salvato supera il massimo di sempre su quell'esercizio,
   * lo si dice: subito con «🏆 RECORD» sulla riga, e con l'avviso in alto
   * «🏆 Record di Maria: 52.5 kg…», che sparisce da solo.
   *
   * Dall'11 al 24/11/2026 al posto dell'avviso c'era una festa a tutto
   * schermo, con coriandoli e frasi. I coach l'hanno bocciata: faceva perdere
   * tempo in sala. Si è tornati all'avviso di prima, tenendo le regole che
   * evitano di ripeterlo a ogni tocco:
   *  - l'avviso aspetta che il coach abbia finito di toccare (ATTESA_AVVISO
   *    dopo l'ultimo salvataggio; un nuovo tocco lo rimanda) e dice il peso
   *    finale;
   *  - uno solo per persona ed esercizio in tutta la seduta;
   *  - si confronta con il massimo di PRIMA di oggi, e da zero non si
   *    avvisa: 0 kg è corpo libero o un carico mai segnato davvero.
   * `subito`: dai DETTAGLI, dove il peso si scrive tutto in una volta.
   */
  function controllaRecord(client, ex, kg, subito = false, week = settimana) {
    if (kg == null || !ex?.exercise_id) return
    const chiave = `${client.id}_${ex.exercise_id}`
    // Il massimo di sempre SENZA questa cella: è il record da battere. Se
    // questa cella prima aveva un peso sbagliato (55 al posto di 50) e ora lo
    // si corregge, il 55 non conta più.
    const celle = (celleRecord.current[chiave] ||= {})
    const cella = `${ex.id}_${week}`
    const altri = Object.entries(celle).filter(([c]) => c !== cella).map(([, v]) => v)
    const massimo = altri.length ? Math.max(...altri) : undefined
    celle[cella] = kg
    const nuovoMassimo = Math.max(...Object.values(celle))
    recordRef.current = { ...recordRef.current, [chiave]: nuovoMassimo }
    setRecord(prev => ({ ...prev, [chiave]: nuovoMassimo }))
    // Il primo carico in assoluto non è un record: è solo il primo.
    if (massimo !== undefined && kg > massimo) {
      setRecordAppena(prev => ({ ...prev, [chiave]: (prev[chiave] || 0) + 1 }))
    }
    if (giaAvvisati.current.has(chiave)) return
    const inAttesa = avvisoInAttesa.current[chiave]
    const prima = inAttesa ? inAttesa.prima : massimo
    clearTimeout(inAttesa?.timer)
    delete avvisoInAttesa.current[chiave]
    if (prima === undefined || !(prima > 0) || kg <= prima) return
    const timer = setTimeout(() => {
      delete avvisoInAttesa.current[chiave]
      giaAvvisati.current.add(chiave)
      festa() // la vibrazione del record
      notifyOk(`🏆 Record di ${bello(client.name)}: ${kg} kg su ${ex?.exercises?.name ?? 'questo esercizio'} (prima ${prima})`)
    }, subito ? 0 : ATTESA_AVVISO)
    avvisoInAttesa.current[chiave] = { timer, prima }
  }

  /** Un nuovo tocco sullo stesso esercizio rimanda l'avviso in attesa. */
  function rimandaAvviso(client, ex) {
    const inAttesa = avvisoInAttesa.current[`${client.id}_${ex?.exercise_id}`]
    if (inAttesa) clearTimeout(inAttesa.timer)
  }

  async function scriviCarico(chiave) {
    const riga = carichiPendenti.current[chiave]
    if (!riga) return
    delete carichiPendenti.current[chiave]
    // eslint-disable-next-line no-unused-vars
    const { __client, __ex, ...daSpedire } = riga
    clearTimeout(timerCarichi.current[chiave])
    const { errore, differito } = await salvaCarichi([daSpedire])
    if (!errore && !differito) setSalvati(prev => ({ ...prev, [chiave]: (prev[chiave] || 0) + 1 }))
    if (!errore) controllaRecord(riga.__client, riga.__ex, riga.kg, false, riga.week)
    if (errore) notifyError('Carico non salvato: il server lo ha rifiutato.')
  }

  /**
   * Sposta una persona di un posto nell'elenco che si ha davanti.
   *
   * Il «vicino» è quello che si vede sopra o sotto in QUESTA schermata: se
   * la scheda è assegnata solo ad alcuni, i nomi in mezzo che non compaiono
   * restano dove sono, altrimenti premendo la freccia non succederebbe
   * niente di visibile.
   */
  async function spostaPersona(client, verso, elenco = clients) {
    // `elenco`: quello che si vede — chi è previsto oggi. Chi oggi non c'è sta
    // in fondo, e scambiarsi con lui non si vedrebbe.
    const i = elenco.findIndex(c => c.id === client.id)
    const vicino = elenco[i + verso]
    if (!vicino) return
    const dopo = await spostaAccanto(tuttiDelTurno, client.id, vicino.id)
    if (dopo === tuttiDelTurno) return
    setTuttiDelTurno(dopo)
    const posto = new Map(dopo.map((p, n) => [p.id, n]))
    ricordaPosti()
    setClients(prec => [...prec].sort((a, b) => posto.get(a.id) - posto.get(b.id)))
  }

  // Get current kg and previous kg+reps for a client/exercise
  function getLoadInfo(client, ex) {
    const week = settimana
    const currentKg = loads[`${client.id}_${ex.id}_${week}`]
    // Find most recent previous week with a load
    let prevWeek = null
    for (let w = week - 1; w >= 1; w--) {
      if (loads[`${client.id}_${ex.id}_${w}`] !== undefined) { prevWeek = w; break }
    }
    if (prevWeek === null) {
      // In questa scheda non c'è ancora niente prima di questa settimana —
      // la prima settimana di una scheda nuova: vale l'ultimo carico della
      // scheda prima, sullo stesso esercizio.
      const prima = precedenti[`${client.id}_${ex.exercise_id}`]
      if (prima) return { currentKg, prevKg: prima.kg, prevReps: prima.reps, daPrima: prima }
    }
    const prevKg = prevWeek !== null ? loads[`${client.id}_${ex.id}_${prevWeek}`] : undefined
    const prevReps = prevWeek !== null ? repsPerSettimana(ex, prevWeek, totale, passo) : undefined
    return { currentKg, prevKg, prevReps }
  }

  const groups = raggruppaEsercizi(exercises)
  const chiaveGruppo = group => (group.type === 'superset' ? group.label : group.exercises[0].id)
  // Il gruppo aperto a destra sul tablet: quello scelto, o il primo.
  const sceltoKey = groups.some(g => chiaveGruppo(g) === scelto) ? scelto : (groups[0] ? chiaveGruppo(groups[0]) : null)
  // Prima chi fa questo giorno, poi — in grigio, sotto «Oggi non previsti» —
  // chi di solito fa altri giorni. Non sparisce: se viene lo stesso, c'è.
  const { previsti, altri } = dividiPerGiorno(clients, day, c => giorniPersone[c.id])
  const inOrdine = [...previsti, ...altri]

  // Incorporata su una persona sola, il pannello parla già di lei: ripeterne
  // il nome sotto ognuno dei sei esercizi è la stessa riga scritta sei volte.
  // Si dice una volta in cima, e lì resta anche scorrendo.
  const unaPersona = incorporato && soloAtleti?.length === 1 && clients.length === 1 ? clients[0] : null

  // Un turno senza scheda può comunque ospitare un Silver: la persona porta
  // la sua, non usa quella del turno.
  if (!cycle) return (
    <div style={incorporato ? pannello : page}>
      {!incorporato && <TopBar title={turn.name} subtitle="Nessuna scheda attiva" onBack={goBack} />}
      <div style={scroll}>
        <div style={{ color: 'var(--testo-debole)', fontSize: '14px', textAlign: 'center', padding: '32px 16px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }}>
          Nessuna scheda attiva.<br /><span style={{ fontSize: '13px' }}>Vai in Schede per crearne una.</span>
        </div>
        {!incorporato && <OspitiDelGiorno turn={turn} navigate={navigate} />}
      </div>
      {!incorporato && <BottomNav active="home" navigate={navigate} goHome={goHome} />}
    </div>
  )

  // Un gruppo di esercizi (singolo, superserie o circuito) con le sue persone.
  // `parte`: 'tutto' sul telefono; sul tablet 'testa' a sinistra e 'corpo' a destra.
  const renderGruppo = (group, gi, parte = 'tutto') => {
          const groupKey = group.type === 'superset' ? group.label : group.exercises[0].id
          // Aperta una persona sola, i gruppi partono già aperti: sono i SUOI
          // esercizi, e richiuderli uno per uno per poterli aprire sarebbe un
          // tocco a vuoto. Con tutto il turno restano chiusi, altrimenti
          // servirebbe mezzo metro di scorrimento per arrivare in fondo.
          // Sul tablet a due colonne: a sinistra solo i titoli («testa»), a
          // destra il gruppo scelto già aperto («corpo»). Sul telefono «tutto»:
          // titolo e, se aperto, il contenuto sotto.
          const isExpanded = parte === 'corpo' || (parte === 'tutto' && (expanded[groupKey] ?? (soloAtleti?.length === 1)))
          const selezionato = parte === 'testa' && groupKey === sceltoKey
          return (
            <div key={gi} style={{ marginBottom: '8px' }}>
              {/* Il contenitore resta un <div>: dentro c'è il pulsante TIMER, e
                  un button dentro un altro button è HTML non valido. A essere
                  cliccabile è il blocco del titolo, che è un button vero e
                  quindi raggiungibile da tastiera. Il TIMER gli sta accanto. */}
              <div
                style={{
                  background: group.type === 'circuit' ? 'rgba(59,130,246,0.06)' : group.type === 'superset' ? 'var(--acc-fondo)' : 'var(--sup)',
                  border: `1px solid ${group.type === 'circuit' ? 'rgba(59,130,246,0.25)' : group.type === 'superset' ? 'var(--acc-bordo-tenue)' : 'var(--sup-alta)'}`,
                  borderLeft: group.type === 'circuit' ? '2px solid var(--circuito)' : group.type === 'superset' ? '2px solid var(--accento)' : undefined,
                  borderRadius: isExpanded ? '6px 6px 0 0' : '6px',
                  boxShadow: selezionato ? '0 0 0 2px var(--accento)' : undefined,
                  padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                }}>
                <button
                  type="button"
                  onClick={() => {
                    if (parte === 'testa') setScelto(groupKey)
                    else if (parte === 'tutto') setExpanded(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
                  }}
                  aria-pressed={parte === 'testa' ? selezionato : undefined}
                  style={{ ...comePulsante, flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer' }}>
                  {group.type === 'superset' && (
                    <div style={{ color: 'var(--accento)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>⚡ SUPERSERIE</div>
                  )}
                  {group.type === 'circuit' && (
                    <div style={{ color: 'var(--circuito)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>🔄 CIRCUITO {group.label.replace('CIR-','')}</div>
                  )}
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                    {group.exercises.map(e => e?.exercises?.name).join(' + ')}
                  </div>
                </button>

                {/* Durata, riposo e giri sono già nel database: finora venivano
                    solo stampati e cronometrati a mano. Il pulsante compare solo
                    se la durata è interpretabile. */}
                {group.type === 'circuit' && secondiDaTesto(group.exercises[0]?.reps_a) && (
                  <button type="button" onClick={() => setTimer(group)} style={{
                    flexShrink: 0,
                    background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.45)',
                    borderRadius: '3px', padding: '6px 10px', color: 'var(--circuito)',
                    fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700', letterSpacing: '1px',
                    touchAction: 'manipulation', cursor: 'pointer',
                  }}>▶ TIMER</button>
                )}

                {parte !== 'corpo' && <div style={{ color: selezionato ? 'var(--accento)' : 'var(--testo-fioco)', fontSize: '16px' }}>{isExpanded ? '∨' : '›'}</div>}
              </div>

              {isExpanded && (
                <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${group.type === 'superset' ? 'var(--acc-riempimento)' : 'var(--sup-alta)'}`, borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                  {inOrdine.map((client, indiceCliente) => {
                    const nonPrevisto = indiceCliente >= previsti.length
                    return (
                      <Fragment key={client.id}>
                      {indiceCliente === previsti.length && (
                        <div style={separatoreNonPrevisti}>OGGI NON PREVISTI · {altri.length}</div>
                      )}
                      <div data-scivola={`${groupKey}:${client.id}`} style={{ position: 'relative', borderTop: '1px solid var(--sup)', padding: '10px 14px', opacity: nonPrevisto ? 0.45 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Con una persona sola il nome sta già in cima al
                                pannello: qui sarebbe la sesta ripetizione. */}
                            {!unaPersona && (<>
                            {/* Il nome si tocca e porta alla scheda della persona.
                                Prima si leggeva «Vincenzo Esposito». L'elenco è
                                ordinato per cognome — come ovunque nell'app — ma
                                scritto così l'occhio leggeva V, A, P, R, F e
                                sembrava messo a caso. Scritto «Esposito Vincenzo»
                                l'ordine si vede, ed è lo stesso modo in cui i nomi
                                compaiono in TURNI, ATLETI e in tutte le altre
                                schermate. */}
                            <button type="button" onClick={() => navigate('athlete-profile', { client })}
                              style={{ ...comePulsante, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {nomeCompleto(client)}
                              <span style={{ color: 'var(--testo-fioco)', fontSize: '13px' }}>›</span>
                            </button>
                            <NotaPersona nota={client.nota} />
                            {etichettaGiorni(giorniPersone[client.id]) && (
                              <span title="I giorni che fa di questa scheda" style={distintivoGiorni}>{etichettaGiorni(giorniPersone[client.id])}</span>
                            )}
                            </>)}
                            {/* Reps bigger + side by side */}
                            {group.type === 'circuit'
                              ? <div style={{ color: 'var(--circuito)', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', marginTop: '3px' }}>🔄 Circuito · {group.exercises[0]?.reps_c} giri</div>
                              // La settimana non si ripete più sotto ogni nome:
                              // è la stessa per tutte, e sta scritta una volta
                              // sola in cima alla schermata.
                              : group.exercises.length === 1 && (
                                <div style={{ marginTop: '4px' }}>
                                  <span style={{ color: '#fff', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>{repsPerSettimana(group.exercises[0], settimana, totale, passo)}</span>
                                </div>
                              )
                            }
                          </div>
                          {/* Le frecce stanno accanto al nome, dove il coach
                              guarda quando si accorge che due persone che
                              lavorano in coppia sono lontane. Lontane dai
                              tasti dei chili, che stanno sotto: spostando un
                              nome non si rischia di toccare un carico. */}
                          {ordineAttivo && !soloAtleti?.length && !nonPrevisto && previsti.length > 1 && (
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginRight: '6px' }}>
                              <button onClick={() => spostaPersona(client, -1, previsti)}
                                disabled={indiceCliente === 0}
                                aria-label={`Sposta ${client.surname} più su`}
                                style={{ ...frecciaOrdine, opacity: indiceCliente === 0 ? 0.25 : 1 }}>↑</button>
                              <button onClick={() => spostaPersona(client, +1, previsti)}
                                disabled={indiceCliente === previsti.length - 1}
                                aria-label={`Sposta ${client.surname} più giù`}
                                style={{ ...frecciaOrdine, opacity: indiceCliente === previsti.length - 1 ? 0.25 : 1 }}>↓</button>
                            </div>
                          )}
                          <button onClick={() => setEditModal({ client, group })} style={{
                            background: 'var(--acc-riempimento)', border: '1px solid var(--acc-bordo)',
                            borderRadius: '4px', padding: '0 14px', minHeight: '40px', flexShrink: 0,
                            color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px'
                          }}>DETTAGLI</button>
                        </div>

                        {/* Carichi in linea. Prima ogni singolo peso costava sei
                            tocchi e due cambi di schermata: espandi → trova
                            l'atleta → CARICHI → modifica → salva → chiudi. Con
                            decine di atlete, girando la sala col telefono in
                            mano, era il collo di bottiglia della sessione.
                            Il numero resta toccabile per aprire i dettagli
                            (mezzi chili e nota). */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {group.exercises.map(ex => {
                            const { currentKg, prevKg, prevReps, daPrima } = getLoadInfo(client, ex)
                            // Un carico di 0 kg (corpo libero, macchina assistita) è
                            // un dato vero: prima veniva scartato come se mancasse.
                            const diff = (currentKg !== undefined && prevKg !== undefined) ? parseFloat((currentKg - prevKg).toFixed(2)) : null
                            return (
                              <div key={ex.id} style={{ position: 'relative', background: 'var(--sup)', borderRadius: '5px', padding: '5px 6px 5px 9px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                                {salvati[`${client.id}_${ex.id}_${settimana}`] > 0 && (
                                  <span key={salvati[`${client.id}_${ex.id}_${settimana}`]} className="lampo-salvato" aria-hidden="true" />
                                )}
                                <div style={{ flex: '1 1 130px', minWidth: 0 }}>
                                  {group.exercises.length > 1 && (
                                    <div style={{ color: 'var(--testo-medio)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {ex?.exercises?.name?.toUpperCase() ?? ''}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                                    {/* Le ripetizioni di questa settimana. Con un
                                        esercizio solo sono già scritte sotto il
                                        nome, grandi: qui sarebbero un doppione, e
                                        accanto a «PREC.» si confondevano con quelle
                                        della volta prima. Nelle superserie invece
                                        ognuno ha le sue, e restano. */}
                                    {group.exercises.length > 1 && (
                                      <span style={{ color: 'var(--testo-chiaro)', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '600' }}>
                                        × {repsPerSettimana(ex, settimana, totale, passo)}
                                      </span>
                                    )}
                                    {currentKg !== undefined && record[`${client.id}_${ex.exercise_id}`] !== undefined
                                      && currentKg >= record[`${client.id}_${ex.exercise_id}`] && currentKg > 0 && (
                                      <span title="Massimo di sempre su questo esercizio"
                                        key={recordAppena[`${client.id}_${ex.exercise_id}`] || 0}
                                        className={recordAppena[`${client.id}_${ex.exercise_id}`] ? 'record-entra' : undefined}
                                        style={{ color: 'var(--attenzione)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>
                                        🏆 RECORD
                                      </span>
                                    )}
                                    {prevKg !== undefined && (
                                      // Il carico della volta prima è il numero da cui il
                                      // coach riparte: prima era scritto a 12 pixel in un
                                      // grigio quasi trasparente, e chi ci vede meno non lo
                                      // leggeva. Ora sta in un riquadro, con il numero
                                      // grande e bianco. Arancione se viene dalla scheda prima.
                                      // Dal 24/11/2026 con le ripetizioni di quella volta
                                      // («PREC. 4x6 · 20 kg»): 20 kg per 4x6 non è 20 kg
                                      // per 4x4, e il coach decide il carico guardando
                                      // tutte e due.
                                      // Dal 27/11/2026 si tocca: il peso della volta prima
                                      // diventa quello di oggi (vedi usaPrecedente).
                                      <button type="button" onClick={() => usaPrecedente(client, ex, prevKg)}
                                        title={daPrima ? `Ultimo carico nella scheda «${daPrima.scheda}», settimana ${daPrima.settimana}` : undefined}
                                        aria-label={`Rifai il peso della volta prima: ${prevReps ? `${prevReps}, ` : ''}${prevKg} chili`}
                                        style={{
                                          ...comePulsante, cursor: 'pointer', minHeight: '34px',
                                          display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                                          background: daPrima ? 'var(--acc-fondo-forte)' : 'var(--sup-alta)',
                                          border: `1px solid ${daPrima ? 'var(--acc-bordo-forte)' : 'var(--bordo-forte)'}`,
                                          borderRadius: '5px', padding: '4px 8px 4px', fontFamily: 'Barlow Condensed, sans-serif',
                                        }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px', color: daPrima ? 'var(--accento)' : 'var(--testo-chiaro)' }}>
                                          {daPrima ? 'SCHEDA PREC.' : 'PREC.'}
                                        </span>
                                        {prevReps && (<>
                                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>{prevReps}</span>
                                          <span aria-hidden="true" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--testo-medio)' }}>·</span>
                                        </>)}
                                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>{prevKg}</span>
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--testo-chiaro)' }}>kg</span>
                                        <span aria-hidden="true" style={{ fontSize: '15px', fontWeight: '800', color: currentKg !== undefined && parseFloat(currentKg) === parseFloat(prevKg) ? 'var(--ok)' : 'var(--accento)', marginLeft: '2px' }}>
                                          {currentKg !== undefined && parseFloat(currentKg) === parseFloat(prevKg) ? '✓' : '↵'}
                                        </span>
                                      </button>
                                    )}
                                    {diff !== null && diff !== 0 && (
                                      <span style={{ fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800', color: diff > 0 ? 'var(--ok)' : 'var(--errore)' }}>
                                        {diff > 0 ? `↑+${diff}` : `↓${diff}`}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* I tre tasti stanno insieme: se il testo è grande e lo spazio non basta,
                                    scendono tutti e tre sotto il riquadro PREC., non uno alla volta. */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                                <button onClick={() => modificaCarico(client, ex, -(passi[ex.exercise_id] || 1))}
                                    aria-label={`Meno ${scriviPasso(passi[ex.exercise_id] || 1)} chili`}
                                    style={{ ...tastoCarico, ...((passi[ex.exercise_id] || 1) !== 1 && tastoConNumero) }}>
                                    {(passi[ex.exercise_id] || 1) !== 1 ? `−${scriviPasso(passi[ex.exercise_id])}` : '−'}
                                  </button>
                                  <button type="button" onClick={() => setEditModal({ client, group })}
                                    style={{ ...comePulsante, minWidth: '52px', textAlign: 'center', cursor: 'pointer', padding: '2px 0' }}>
                                    <span key={saltelli[`${client.id}_${ex.id}_${settimana}`] || 0}
                                      className={saltelli[`${client.id}_${ex.id}_${settimana}`] ? 'salto' : undefined}
                                      style={{ color: currentKg !== undefined ? '#fff' : 'var(--testo-fioco)', fontSize: '18px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800' }}>
                                      {currentKg !== undefined ? currentKg : '—'}
                                    </span>
                                    <span style={{ color: 'var(--testo-debole)', fontSize: '12px', marginLeft: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>kg</span>
                                  </button>
                                  <button onClick={() => modificaCarico(client, ex, passi[ex.exercise_id] || 1)}
                                    aria-label={`Più ${scriviPasso(passi[ex.exercise_id] || 1)} chili`}
                                    style={{ ...tastoCarico, ...((passi[ex.exercise_id] || 1) !== 1 && tastoConNumero), background: 'var(--acc-riempimento)', borderColor: 'var(--acc-bordo-forte)', color: 'var(--accento)' }}>
                                    {(passi[ex.exercise_id] || 1) !== 1 ? `+${scriviPasso(passi[ex.exercise_id])}` : '+'}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Note, visibili senza dover aprire la modale: se una
                            coach ha annotato "sente la spalla" serve che si veda
                            mentre guarda la scheda, non solo se va a cercarla. */}
                        {group.exercises
                          .filter(ex => notes[`${client.id}_${ex.id}`])
                          .map(ex => (
                            <div key={`nota-${ex.id}`} style={{
                              display: 'flex', gap: '6px', marginTop: '6px',
                              background: 'rgba(234,179,8,0.07)',
                              border: '1px solid rgba(234,179,8,0.2)',
                              borderRadius: '4px', padding: '6px 9px',
                            }}>
                              <span style={{ fontSize: '13px', flexShrink: 0 }}>📝</span>
                              <div style={{ minWidth: 0 }}>
                                {group.exercises.length > 1 && (
                                  <span style={{ color: 'rgba(234,179,8,0.75)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px', marginRight: '5px' }}>
                                    {ex?.exercises?.name?.split(' ')[0]?.toUpperCase() ?? ''}
                                  </span>
                                )}
                                <span style={{ color: 'var(--testo-chiaro)', fontSize: '13px', lineHeight: 1.35 }}>
                                  {notes[`${client.id}_${ex.id}`]}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                      </Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          )
        }

  return (
    <div style={incorporato ? pannello : affiancato ? { ...page, maxWidth: 'var(--colonna-larga)' } : page}>
      {!incorporato && <TopBar title={turn.name} subtitle={sottotitolo || cycle.name} onBack={goBack} />}
      {/* I giorni e la settimana stanno già in cima all'elenco di sinistra:
          ripeterli qui accanto sarebbe la stessa cosa scritta due volte. */}
      {unaPersona && (
        <button type="button" onClick={() => navigate('athlete-profile', { client: unaPersona })}
          style={testataPersona}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '0.5px' }}>
              {nomeCompleto(unaPersona)}
              {etichettaGiorni(giorniPersone[unaPersona.id]) && (
                <span style={distintivoGiorni}>{etichettaGiorni(giorniPersone[unaPersona.id])}</span>
              )}
            </span>
            <span style={{ display: 'block', color: 'var(--testo-medio)', fontSize: '13px', marginTop: '2px' }}>
              {cycle.name} · settimana {settimana} di {totale}
            </span>
          </span>
          <span style={{ color: 'var(--testo-fioco)', fontSize: '18px', flexShrink: 0 }}>›</span>
        </button>
      )}

      {!incorporato && (<>
      {/* Le schede del turno sopra i giorni: un tocco e si passa all'altra.
          Linguette di solo testo su una fascia scura, con quella aperta
          sottolineata in arancione — diverse a colpo d'occhio dai pulsanti
          pieni dei giorni, che stanno sotto. Con una scheda sola non c'è. */}
      {schedeTurno.length > 1 && (
        <div style={{ background: '#050505', borderBottom: '1px solid var(--sup-alta)', flexShrink: 0 }}>
          <div role="tablist" aria-label="Schede del turno" style={{ display: 'flex', overflowX: 'auto', padding: '0 8px' }}>
            {schedeTurno.map(s => {
              const attiva = s.id === cycle.id
              return (
                <button key={s.id} type="button" role="tab" aria-selected={attiva} onClick={() => cambiaScheda(s)} style={{
                  flex: schedeTurno.length <= 3 ? '1 1 0' : '0 0 auto', minWidth: 0,
                  padding: '13px 10px 11px', background: 'none', border: 'none',
                  borderBottom: `3px solid ${attiva ? 'var(--accento)' : 'transparent'}`,
                  color: attiva ? '#fff' : 'var(--testo-medio)',
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: attiva ? '800' : '600', letterSpacing: '0.3px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer',
                }}>{s.name}</button>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid var(--sup-alta)' }}>
        {elencoGiorni(cycle).map(d => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, minHeight: '44px', padding: '9px', borderRadius: '4px', border: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', letterSpacing: '1px',
            background: day === d ? 'var(--accento)' : 'var(--sup)',
            color: day === d ? '#fff' : 'var(--testo-debole)'
          }}>{etichettaGiorno(d, giorniDi(cycle))}</button>
        ))}
      </div>

      {/* Tutto quello che resta del pannello «avanza settimana»: un numero, in
          chiaro, uguale per tutte. Non si tocca e non si può sbagliare. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 16px', flexShrink: 0,
        borderBottom: '1px solid var(--sup-alta)', background: 'var(--sup)',
      }}>
        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1.5px', color: 'var(--testo-medio)', whiteSpace: 'nowrap' }}>
          SETTIMANA <span style={{ color: 'var(--accento)', fontSize: '17px', fontWeight: '900' }}>{settimana}</span> {finita ? '· EXTRA' : `DI ${totale}`}
        </span>
        <span style={{ display: 'flex', gap: '3px', flex: 1 }} aria-hidden="true">
          {Array.from({ length: totale }, (_, i) => i + 1).map(n => (
            <span key={n} style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: n <= settimana ? 'var(--accento)' : 'var(--sup-alta)',
            }} />
          ))}
        </span>
      </div>
      {finita && (
        <div role="status" style={{
          margin: '10px 16px 0', padding: '10px 12px', borderRadius: '6px', flexShrink: 0,
          background: 'rgba(234,179,8,0.10)', border: '1px solid rgba(234,179,8,0.45)',
          color: 'var(--attenzione)', fontSize: '14px', lineHeight: 1.4,
        }}>
          <strong style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', letterSpacing: '1px' }}>⚠ SCHEDA FINITA</strong>
          <span style={{ color: 'var(--testo-forte)' }}> · La settimana {totale} era l'ultima. I pesi di oggi si salvano a parte, come settimana {settimana}: quelli della {totale} restano com'erano. Quando puoi, completala in SCHEDE e preparane una nuova.</span>
        </div>
      )}
      </>)}

      <div style={scroll} ref={elencoRef}>
        {inCaricamento && <ScheletroElenco righe={4} />}
        {!inCaricamento && exercises.length === 0 && (
          <div style={{ color: 'var(--bordo-forte)', fontSize: '14px', textAlign: 'center', padding: '32px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }}>
            Nessun esercizio per il Giorno {day}.
          </div>
        )}

        {!inCaricamento && !affiancato && groups.map((group, gi) => renderGruppo(group, gi))}

        {/* Sul tablet sdraiato la seduta usava solo la colonna in mezzo: un
            terzo dello schermo restava nero, e gli esercizi si aprivano uno
            alla volta. Ora a sinistra ci sono gli esercizi del giorno, a
            destra le persone con i loro pesi: si passa dall'uno all'altro
            con un tocco, senza aprire e chiudere. */}
        {!inCaricamento && affiancato && groups.length > 0 && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: 0 }}>
              {groups.map((group, gi) => renderGruppo(group, gi, 'testa'))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {groups.map((group, gi) => chiaveGruppo(group) === sceltoKey ? renderGruppo(group, gi, 'corpo') : null)}
            </div>
          </div>
        )}

        {/* Dentro la scheda di una singola persona non si aggiungono ospiti:
            si è già dentro a qualcuno. */}
        {!soloAtleti && <OspitiDelGiorno turn={turn} navigate={navigate} />}
        <div style={{ height: '20px' }} />
      </div>

      {timer && <Suspense fallback={null}><TimerCircuito group={timer} onClose={() => setTimer(null)} /></Suspense>}

      {editModal && (
        <LoadModal
          client={editModal.client}
          group={editModal.group}
          loads={loads}
          precedenti={precedenti}
          notes={notes}
          settimana={settimana}
          totale={totale}
          passo={passo}
          onSave={(updates) => saveLoads(editModal.client.id, settimana, updates)}
          onClose={() => setEditModal(null)}
        />
      )}

      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )
}

function LoadModal({ client, group, loads, precedenti = {}, notes, settimana, totale, passo, onSave, onClose }) {
  const week = settimana

  const [kgMap, setKgMap] = useState(() => {
    const m = {}
    group.exercises.forEach(ex => {
      // Vuoto, non zero, se questa settimana non c'è ancora un carico: lo
      // zero è un dato (corpo libero), il vuoto vuol dire «non segnato».
      const v = parseFloat(loads[`${client.id}_${ex.id}_${week}`])
      m[ex.id] = Number.isFinite(v) ? v : ''
    })
    return m
  })

  const [noteMap, setNoteMap] = useState(() => {
    const m = {}
    group.exercises.forEach(ex => { m[ex.id] = notes?.[`${client.id}_${ex.id}`] ?? '' })
    return m
  })

  // Il carico della volta prima: in questa scheda, o — alla prima
  // settimana di una scheda nuova — l'ultimo della scheda prima.
  function getPrevLoad(ex) {
    for (let w = week - 1; w >= 1; w--) {
      const kg = loads[`${client.id}_${ex.id}_${w}`]
      if (kg !== undefined) return { kg, reps: repsPerSettimana(ex, w, totale, passo) }
    }
    const prima = precedenti[`${client.id}_${ex.exercise_id}`]
    return prima ? { kg: prima.kg, reps: prima.reps ?? null, scheda: prima.scheda } : null
  }

  const change = (exId, delta) => {
    // Campo vuoto: si parte dal carico della volta prima, come nella lista.
    const ex = group.exercises.find(e => e.id === exId)
    const precedente = parseFloat(ex ? getPrevLoad(ex)?.kg : NaN)
    setKgMap(prev => {
      // prev[exId] può essere la stringa '' o '.' quando il coach svuota il campo
      // per riscriverlo: sommarci un numero dava concatenazione e poi crash.
      const attuale = parseFloat(prev[exId])
      const base = Number.isFinite(attuale) ? attuale : Number.isFinite(precedente) ? precedente : 0
      return { ...prev, [exId]: Math.max(0, parseFloat((base + delta).toFixed(2))) }
    })
  }

  const handleManualInput = (exId, val) => {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) setKgMap(prev => ({ ...prev, [exId]: n }))
    else if (val === '' || val === '.') setKgMap(prev => ({ ...prev, [exId]: val }))
  }

  // Una nota che c'era e che è stata svuotata, al salvataggio viene
  // cancellata. Prima succedeva senza dirlo: qui si chiede conferma, con il
  // testo che sta per sparire sotto gli occhi.
  const [noteDaCancellare, setNoteDaCancellare] = useState(null)

  const handleSave = (confermato = false) => {
    const svuotate = group.exercises.filter(ex =>
      (notes?.[`${client.id}_${ex.id}`] ?? '').trim() && !String(noteMap[ex.id] ?? '').trim())
    if (svuotate.length && !confermato) {
      setNoteDaCancellare(svuotate.map(ex =>
        `la nota${group.exercises.length > 1 ? ` su ${ex?.exercises?.name ?? 'questo esercizio'}` : ''}: «${notes[`${client.id}_${ex.id}`].trim()}»`))
      return
    }
    onSave(group.exercises.map(ex => ({
      cycleExId: ex.id,
      // null = campo vuoto: non si salva nessun carico per questo esercizio.
      kg: Number.isFinite(parseFloat(kgMap[ex.id])) ? parseFloat(kgMap[ex.id]) : null,
      nota: noteMap[ex.id] ?? '',
    })))
  }

  return (
    <div className="foglio-entra" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px', zIndex: 50, maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '2px' }}>
        {/* Cognome prima, come nell'elenco da cui si arriva qui: toccare
            «Esposito Vincenzo» e ritrovarsi «VINCENZO ESPOSITO» in testa fa
            dubitare di aver aperto la persona giusta. */}
        {client?.surname?.toUpperCase()} {client?.name?.toUpperCase()}
      </div>
      <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginBottom: (group.type === 'superset' || group.type === 'circuit') ? '4px' : '16px' }}>
        {group.type === 'circuit'
          ? <span style={{ color: 'var(--circuito)' }}>🔄 Circuito · {group.exercises[0]?.reps_c} giri</span>
          : <span>Settimana {week} · {repsPerSettimana(group.exercises[0], week, totale, passo)}</span>
        }
      </div>
      {group.type === 'superset' && (
        <div style={{ color: 'var(--accento)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '16px' }}>⚡ SUPERSERIE</div>
      )}
      {group.type === 'circuit' && (
        <div style={{ color: 'var(--circuito)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '16px' }}>🔄 CIRCUITO — inserisci i carichi usati</div>
      )}

      {group.exercises.map(ex => {
        const prev = getPrevLoad(ex)
        const val = kgMap[ex.id]
        return (
          <div key={ex.id} style={{ marginBottom: '14px', background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: 'var(--testo-forte)', letterSpacing: '0.5px', marginBottom: '4px' }}>
              {ex?.exercises?.name?.toUpperCase() ?? ''}
            </div>

            {/* Il carico della volta prima. Toccandolo si scrive nel campo:
                per rifare lo stesso peso basta un tocco, invece di + e −. */}
            {prev ? (
              <button type="button" onClick={() => setKgMap(m => ({ ...m, [ex.id]: Number(prev.kg) }))}
                aria-label={`Usa il carico precedente, ${prev.kg} chili`}
                style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap', background: 'var(--acc-fondo-forte)', border: '1px solid var(--acc-bordo-forte)', borderRadius: '5px', padding: '6px 10px', marginBottom: '12px', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ color: 'var(--testo-chiaro)', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>{prev.scheda !== undefined ? 'SCHEDA PREC.' : 'PREC.'}</span>
                <span style={{ color: '#fff', fontSize: '20px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800' }}>{prev.kg} kg</span>
                {prev.reps
                  ? <span style={{ color: 'var(--testo-chiaro)', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif' }}>× {prev.reps}</span>
                  : prev.scheda && <span style={{ color: 'var(--testo-chiaro)', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif' }}>· {prev.scheda}</span>}
                <span style={{ color: 'var(--accento)', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800', letterSpacing: '1px', marginLeft: '4px' }}>USA ↵</span>
              </button>
            ) : (
              <div style={{ height: '4px' }} />
            )}

            {/* KG input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number" value={val} inputMode="decimal"
                placeholder={prev ? String(prev.kg) : '—'}
                onChange={e => handleManualInput(ex.id, e.target.value)}
                style={{ flex: 1, minWidth: 0, background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '4px', padding: '12px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', textAlign: 'center', outline: 'none' }}
              />
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', color: 'var(--testo-debole)', fontWeight: '700' }}>KG</div>
            </div>

            {/* +/- buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
              {[[-1,'−1'],[-0.5,'−0.5'],[0.5,'+0.5'],[1,'+1']].map(([delta, label]) => (
                <button key={label} onClick={() => change(ex.id, delta)} style={{
                  background: delta > 0 ? 'var(--acc-riempimento)' : 'var(--sup-alta)',
                  border: `1px solid ${delta > 0 ? 'var(--acc-bordo)' : 'var(--bordo)'}`,
                  borderRadius: '4px', padding: '9px 4px',
                  color: delta > 0 ? 'var(--accento)' : 'var(--testo-chiaro)',
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700'
                }}>{label}</button>
              ))}
            </div>

            {/* Nota per questo atleta su questo esercizio. Vale per tutta la
                scheda, non per la singola settimana: il vincolo nel database è
                su (client_id, cycle_exercise_id). */}
            <textarea
              value={noteMap[ex.id] ?? ''}
              onChange={e => setNoteMap(prev => ({ ...prev, [ex.id]: e.target.value }))}
              placeholder="Nota (es. sente la spalla destra, ridurre il ROM)"
              rows={2}
              style={{
                width: '100%', marginTop: '10px', boxSizing: 'border-box',
                background: 'var(--sup)',
                border: `1px solid ${noteMap[ex.id]?.trim() ? 'rgba(234,179,8,0.35)' : 'var(--bordo)'}`,
                borderRadius: '4px', padding: '10px 12px',
                color: '#fff', fontSize: '16px', lineHeight: 1.4,
                outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>
        )
      })}

      {noteDaCancellare ? (<>
        <AvvisoRosso perdite={noteDaCancellare} />
        <button onClick={() => handleSave(true)} style={{ background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', width: '100%', padding: '15px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800', letterSpacing: '1.5px' }}>
          SÌ, SALVA E CANCELLA {noteDaCancellare.length === 1 ? 'LA NOTA' : 'LE NOTE'}
        </button>
        <button onClick={() => setNoteDaCancellare(null)} style={{ background: 'transparent', border: 'none', color: 'var(--testo-medio)', width: '100%', padding: '10px', fontSize: '14px', marginTop: '4px' }}>
          Torna indietro (la nota resta)
        </button>
      </>) : (
      <button onClick={() => handleSave()} style={{ background: 'var(--accento)', border: 'none', color: '#fff', width: '100%', padding: '15px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '2px' }}>
        SALVA CARICHI ✓
      </button>
      )}
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '10px', fontSize: '14px', marginTop: '4px' }}>
        Annulla
      </button>
    </div>
  )
}

const page = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
// Incorporata: riempie il riquadro che le danno, senza decidere da sé quanto
// è alta o larga. `relative` resta, perché il pannello dei carichi si
// posiziona rispetto a lei.
const testataPersona = {
  ...comePulsante,
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
  padding: '12px 16px', flexShrink: 0, textAlign: 'left', cursor: 'pointer',
  background: 'var(--acc-fondo)', borderBottom: '1px solid var(--acc-riempimento)',
}

// Le frecce dell'ordine, accanto al nome. Più piccole di quelle di TURNI
// perché qui la riga è già piena, ma abbastanza da prenderle col pollice.
const frecciaOrdine = { background: 'var(--sup-alta)', border: '1px solid var(--bordo)', color: '#fff', fontSize: '17px', lineHeight: 1, width: '44px', height: '40px', borderRadius: '3px', cursor: 'pointer', padding: 0 }
const pannello = { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '10px 16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
// 38px: sotto questa misura il pollice sbaglia, e qui si tocca tutto il giorno.
// Con il passo scritto sopra («+2,5») il tasto si allarga un poco e il testo
// si stringe, perché ci stia senza andare a capo.
const tastoConNumero = { width: 'auto', minWidth: '48px', padding: '0 4px', fontSize: '15px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800' }
const tastoCarico = { width: '44px', height: '44px', flexShrink: 0, background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '5px', color: 'var(--testo-forte)', fontSize: '20px', fontWeight: '700', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', cursor: 'pointer' }

// Quanto aspetta l'avviso del record dopo l'ultimo salvataggio (che a sua
// volta parte quasi un secondo dopo l'ultimo tocco): il tempo di finire di
// segnare.
const ATTESA_AVVISO = 1500

// «G1 · G3» accanto al nome: i giorni che la persona fa di questa scheda.
const distintivoGiorni = {
  display: 'inline-block', marginLeft: '8px', verticalAlign: 'middle',
  background: 'var(--acc-fondo-forte)', border: '1px solid var(--acc-bordo-forte)', borderRadius: '4px',
  padding: '1px 6px', color: 'var(--accento)',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px',
}

// La riga che separa chi oggi è previsto da chi no.
const separatoreNonPrevisti = {
  borderTop: '1px solid var(--sup-alta)', padding: '8px 14px 6px',
  background: 'rgba(255,255,255,0.03)', color: 'var(--testo-medio)',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1.5px',
}
