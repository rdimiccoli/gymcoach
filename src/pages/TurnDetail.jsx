import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk, notifyError } from '../lib/notify'
import { salvaCarichi } from '../lib/coda'
import { comePulsante } from '../lib/stile'
import { tocco, conferma, festa } from '../lib/aptico'
import { repsPerSettimana, raggruppaEsercizi, secondiDaTesto, settimanaDaCalendario } from '../lib/schede'
// Arriva solo quando si apre un circuito, non a ogni avvio dell'app.
const TimerCircuito = lazy(() => import('../components/TimerCircuito'))
import { ScheletroElenco } from '../components/Scheletro'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'




export default function TurnDetail({ navigate, goBack, goHome, params, session }) {
  // `phase` è sparito con le fasi: nessuno lo passa più.
  const { turn, cycle } = params
  const [day, setDay] = useState(1)
  const [exercises, setExercises] = useState([])
  const [clients, setClients] = useState([])
  // loads[clientId_exId_week] = kg
  const [loads, setLoads] = useState({})
  // notes[clientId_exId] = testo. Il vincolo unico nel database è su
  // (client_id, cycle_exercise_id) senza la settimana: la nota vale per
  // l'atleta su quell'esercizio per tutta la scheda, non per una settimana.
  const [notes, setNotes] = useState({})
  // record[clientId_exerciseId] = massimo di sempre su quell_esercizio
  const [record, setRecord] = useState({})
  const [expanded, setExpanded] = useState({})
  const [editModal, setEditModal] = useState(null)
  const [timer, setTimer] = useState(null)
  const [loading, setLoading] = useState(true)
  const timerCarichi = useRef({})
  const carichiPendenti = useRef({})

  useEffect(() => { if (cycle) loadData(); else setLoading(false) }, [day, cycle])

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
  const settimana = settimanaDaCalendario(cycle) || 1

  // Uscendo dalla schermata le modifiche ancora in attesa partono comunque.
  useEffect(() => () => { Object.keys(carichiPendenti.current).forEach(scriviCarico) }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: exData }, { data: cl }] = await Promise.all([
      run(supabase.from('cycle_exercises').select('*, exercises(name)')
        .eq('cycle_id', cycle.id).eq('day', day).order('sort_order'),
        'Impossibile caricare gli esercizi del giorno.'),
      run(supabase.from('clients').select('*')
        .eq('turn_id', turn.id).eq('is_active', true).order('surname'),
        'Impossibile caricare gli atleti del turno.'),
    ])
    setExercises(exData || [])
    setClients(cl || [])

    if (exData?.length && cl?.length) {
      const exIds = exData.map(e => e.id)
      const clIds = cl.map(c => c.id)
      // Load ALL weeks for each client/exercise
      const [{ data: loadData }, { data: noteData }] = await Promise.all([
        run(supabase.from('client_loads').select('*')
          .in('client_id', clIds).in('cycle_exercise_id', exIds),
          'Impossibile caricare lo storico dei carichi.'),
        run(supabase.from('client_notes').select('client_id, cycle_exercise_id, note')
          .in('client_id', clIds).in('cycle_exercise_id', exIds),
          'Impossibile caricare le note.'),
      ])
      const loadMap = {}
      loadData?.forEach(l => {
        loadMap[`${l.client_id}_${l.cycle_exercise_id}_${l.week}`] = l.kg
      })
      setLoads(loadMap)

      // ── Record personali ──────────────────────────────────────────────
      // Il massimo di sempre non si ricava da loadMap: quello copre solo
      // questa scheda. Lo stesso esercizio in schede diverse ha righe
      // cycle_exercises diverse, quindi si passa da exercise_id.
      const idEsercizi = [...new Set(exData.map(e => e.exercise_id).filter(Boolean))]
      if (idEsercizi.length) {
        const { data: storico } = await run(
          supabase.from('client_loads')
            .select('kg, client_id, cycle_exercises!inner(exercise_id)')
            .in('client_id', clIds)
            .in('cycle_exercises.exercise_id', idEsercizi),
          'Impossibile calcolare i record personali.'
        )
        const massimi = {}
        storico?.forEach(r => {
          const chiave = `${r.client_id}_${r.cycle_exercises?.exercise_id}`
          if (r.kg != null && (massimi[chiave] === undefined || r.kg > massimi[chiave])) massimi[chiave] = r.kg
        })
        setRecord(massimi)
      }

      const noteMap = {}
      noteData?.forEach(n => { noteMap[`${n.client_id}_${n.cycle_exercise_id}`] = n.note })
      setNotes(noteMap)
    }
    setLoading(false)
  }

  async function saveLoads(clientId, clientWeek, loadUpdates) {
    // Un solo upsert per tutto il gruppo: prima era una richiesta per esercizio,
    // in fila, e nessuna delle due controllava l'esito.
    const righe = loadUpdates.map(({ cycleExId, kg }) => ({
      client_id: clientId, cycle_exercise_id: cycleExId, kg, week: clientWeek
    }))
    // Passa dalla coda: se manca il segnale il carico non si perde, resta sul
    // telefono e parte da solo. Fallisce solo se è il server a rifiutare.
    const { differito, errore } = await salvaCarichi(session.user.id, righe)
    if (errore) {
      notifyError('Carichi rifiutati dal server. Riprova.')
      // La modale resta aperta con i valori digitati: si può ritentare senza
      // riscrivere tutto.
      return
    }

    setLoads(prev => {
      const next = { ...prev }
      loadUpdates.forEach(({ cycleExId, kg }) => { next[`${clientId}_${cycleExId}_${clientWeek}`] = kg })
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
    loadUpdates.forEach(({ cycleExId, kg }) => {
      const ex = exercises.find(e => e.id === cycleExId)
      const cliente = clients.find(c => c.id === clientId)
      if (ex && cliente) controllaRecord(cliente, ex, kg)
    })
    conferma()
    notifyOk(differito ? 'Carichi salvati sul telefono, partiranno appena torna la rete' : 'Carichi salvati')
    setEditModal(null)
  }

  // Modifica di un carico dalla lista, senza aprire nulla. Lo stato locale si
  // aggiorna subito — il tocco deve rispondere all'istante — e la scrittura
  // parte dopo una pausa, così tenere premuto +5 volte non fa cinque richieste.
  function modificaCarico(client, ex, delta) {
    tocco() // conferma il tocco senza obbligare a guardare lo schermo
    const chiave = `${client.id}_${ex.id}_${settimana}`
    const attuale = parseFloat(loads[chiave])
    const base = Number.isFinite(attuale) ? attuale : 0
    const nuovo = Math.max(0, parseFloat((base + delta).toFixed(2)))

    setLoads(prev => ({ ...prev, [chiave]: nuovo }))
    carichiPendenti.current[chiave] = {
      client_id: client.id, cycle_exercise_id: ex.id, kg: nuovo, week: settimana,
      __client: client, __ex: ex,
    }
    clearTimeout(timerCarichi.current[chiave])
    timerCarichi.current[chiave] = setTimeout(() => scriviCarico(chiave), 900)
  }

  /**
   * Se il carico appena messo supera il massimo di sempre su quell'esercizio,
   * lo si dice. I dati c'erano già: mancava solo il confronto.
   *
   * Il record si aggiorna subito in memoria, altrimenti toccando + due volte
   * l'app griderebbe «record» due volte per la stessa serie.
   */
  function controllaRecord(client, ex, kg) {
    if (kg == null || !ex?.exercise_id) return
    const chiave = `${client.id}_${ex.exercise_id}`
    const massimo = record[chiave]
    // Il primo carico in assoluto non è un record: è solo il primo.
    if (massimo === undefined || kg <= massimo) return
    setRecord(prev => ({ ...prev, [chiave]: kg }))
    festa()
    notifyOk(`🏆 Record di ${client.name}: ${kg} kg su ${ex?.exercises?.name ?? 'questo esercizio'} (prima ${massimo})`)
  }

  async function scriviCarico(chiave) {
    const riga = carichiPendenti.current[chiave]
    if (!riga) return
    delete carichiPendenti.current[chiave]
    // eslint-disable-next-line no-unused-vars
    const { __client, __ex, ...daSpedire } = riga
    clearTimeout(timerCarichi.current[chiave])
    const { errore } = await salvaCarichi(session.user.id, [daSpedire])
    if (!errore) controllaRecord(riga.__client, riga.__ex, riga.kg)
    if (errore) notifyError('Carico non salvato: il server lo ha rifiutato.')
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
    const prevKg = prevWeek !== null ? loads[`${client.id}_${ex.id}_${prevWeek}`] : undefined
    const prevReps = prevWeek !== null ? repsPerSettimana(ex, prevWeek) : undefined
    return { currentKg, prevKg, prevReps }
  }

  const groups = raggruppaEsercizi(exercises)

  if (!cycle) return (
    <div style={page}>
      <TopBar title={turn.name} subtitle="Nessuna scheda attiva" onBack={goBack} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--testo-debole)', fontSize: '14px' }}>Nessuna scheda attiva.<br /><span style={{ fontSize: '13px' }}>Vai in Schede per crearne una.</span></div>
      </div>
      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )

  return (
    <div style={page}>
      <TopBar title={turn.name} subtitle={cycle.name} onBack={goBack} />
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid var(--sup-alta)' }}>
        {[1,2,3].map(d => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, padding: '9px', borderRadius: '4px', border: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '1px',
            background: day === d ? 'var(--accento)' : 'var(--sup)',
            color: day === d ? '#fff' : 'var(--testo-debole)'
          }}>GIORNO {d}</button>
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
          SETTIMANA <span style={{ color: 'var(--accento)', fontSize: '17px', fontWeight: '900' }}>{settimana}</span> DI 6
        </span>
        <span style={{ display: 'flex', gap: '3px', flex: 1 }} aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <span key={n} style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: n <= settimana ? 'var(--accento)' : 'var(--sup-alta)',
            }} />
          ))}
        </span>
      </div>

      <div style={scroll}>
        {loading && <ScheletroElenco righe={4} />}
        {!loading && exercises.length === 0 && (
          <div style={{ color: 'var(--bordo-forte)', fontSize: '14px', textAlign: 'center', padding: '32px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }}>
            Nessun esercizio per il Giorno {day}.
          </div>
        )}

        {groups.map((group, gi) => {
          const groupKey = group.type === 'superset' ? group.label : group.exercises[0].id
          const isExpanded = expanded[groupKey]
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
                  padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                }}>
                <button
                  type="button"
                  onClick={() => setExpanded(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
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

                <div style={{ color: 'var(--testo-fioco)', fontSize: '16px' }}>{isExpanded ? '∨' : '›'}</div>
              </div>

              {isExpanded && (
                <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${group.type === 'superset' ? 'var(--acc-riempimento)' : 'var(--sup-alta)'}`, borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                  {clients.map(client => {
                    return (
                      <div key={client.id} style={{ borderTop: '1px solid var(--sup)', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Clickable name → athlete profile */}
                            <button type="button" onClick={() => navigate('athlete-profile', { client })}
                              style={{ ...comePulsante, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {client.name} {client.surname}
                              <span style={{ color: 'var(--testo-fioco)', fontSize: '13px' }}>›</span>
                            </button>
                            {/* Reps bigger + side by side */}
                            {group.type === 'circuit'
                              ? <div style={{ color: 'var(--circuito)', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', marginTop: '3px' }}>🔄 Circuito · {group.exercises[0]?.reps_c} giri</div>
                              // La settimana non si ripete più sotto ogni nome:
                              // è la stessa per tutte, e sta scritta una volta
                              // sola in cima alla schermata.
                              : group.exercises.length === 1 && (
                                <div style={{ marginTop: '4px' }}>
                                  <span style={{ color: '#fff', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>{repsPerSettimana(group.exercises[0], settimana)}</span>
                                </div>
                              )
                            }
                          </div>
                          <button onClick={() => setEditModal({ client, group })} style={{
                            background: 'var(--acc-riempimento)', border: '1px solid var(--acc-bordo)',
                            borderRadius: '3px', padding: '6px 12px', flexShrink: 0,
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
                            const { currentKg, prevKg } = getLoadInfo(client, ex)
                            // Un carico di 0 kg (corpo libero, macchina assistita) è
                            // un dato vero: prima veniva scartato come se mancasse.
                            const diff = (currentKg !== undefined && prevKg !== undefined) ? parseFloat((currentKg - prevKg).toFixed(2)) : null
                            return (
                              <div key={ex.id} style={{ background: 'var(--sup)', borderRadius: '5px', padding: '5px 6px 5px 9px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {group.exercises.length > 1 && (
                                    <div style={{ color: 'var(--testo-medio)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {ex?.exercises?.name?.toUpperCase() ?? ''}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                                    <span style={{ color: 'var(--testo-debole)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                      × {repsPerSettimana(ex, settimana)}
                                    </span>
                                    {currentKg !== undefined && record[`${client.id}_${ex.exercise_id}`] !== undefined
                                      && currentKg >= record[`${client.id}_${ex.exercise_id}`] && currentKg > 0 && (
                                      <span title="Massimo di sempre su questo esercizio"
                                        style={{ color: 'var(--attenzione)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>
                                        🏆 RECORD
                                      </span>
                                    )}
                                    {prevKg !== undefined && (
                                      <span style={{ color: 'var(--testo-fioco)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                        prec. {prevKg}
                                      </span>
                                    )}
                                    {diff !== null && diff !== 0 && (
                                      <span style={{ fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', color: diff > 0 ? 'var(--ok)' : 'var(--errore)' }}>
                                        {diff > 0 ? `↑+${diff}` : `↓${diff}`}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button onClick={() => modificaCarico(client, ex, -1)} style={tastoCarico}>−</button>
                                <button type="button" onClick={() => setEditModal({ client, group })}
                                  style={{ ...comePulsante, minWidth: '52px', textAlign: 'center', cursor: 'pointer', padding: '2px 0' }}>
                                  <span style={{ color: currentKg !== undefined ? '#fff' : 'var(--testo-fioco)', fontSize: '18px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800' }}>
                                    {currentKg !== undefined ? currentKg : '—'}
                                  </span>
                                  <span style={{ color: 'var(--testo-debole)', fontSize: '12px', marginLeft: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>kg</span>
                                </button>
                                <button onClick={() => modificaCarico(client, ex, 1)}
                                  style={{ ...tastoCarico, background: 'var(--acc-riempimento)', borderColor: 'var(--acc-bordo-forte)', color: 'var(--accento)' }}>+</button>
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
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ height: '20px' }} />
      </div>

      {timer && <Suspense fallback={null}><TimerCircuito group={timer} onClose={() => setTimer(null)} /></Suspense>}

      {editModal && (
        <LoadModal
          client={editModal.client}
          group={editModal.group}
          loads={loads}
          notes={notes}
          settimana={settimana}
          onSave={(updates) => saveLoads(editModal.client.id, settimana, updates)}
          onClose={() => setEditModal(null)}
        />
      )}

      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )
}

function LoadModal({ client, group, loads, notes, settimana, onSave, onClose }) {
  const week = settimana

  const [kgMap, setKgMap] = useState(() => {
    const m = {}
    group.exercises.forEach(ex => {
      m[ex.id] = parseFloat(loads[`${client.id}_${ex.id}_${week}`]) || 0
    })
    return m
  })

  const [noteMap, setNoteMap] = useState(() => {
    const m = {}
    group.exercises.forEach(ex => { m[ex.id] = notes?.[`${client.id}_${ex.id}`] ?? '' })
    return m
  })

  // Get previous week's load for reference
  function getPrevLoad(ex) {
    for (let w = week - 1; w >= 1; w--) {
      const kg = loads[`${client.id}_${ex.id}_${w}`]
      if (kg !== undefined) return { kg, reps: repsPerSettimana(ex, w) }
    }
    return null
  }

  const change = (exId, delta) => {
    setKgMap(prev => {
      // prev[exId] può essere la stringa '' o '.' quando il coach svuota il campo
      // per riscriverlo: sommarci un numero dava concatenazione e poi crash.
      const attuale = parseFloat(prev[exId])
      const base = Number.isFinite(attuale) ? attuale : 0
      return { ...prev, [exId]: Math.max(0, parseFloat((base + delta).toFixed(2))) }
    })
  }

  const handleManualInput = (exId, val) => {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) setKgMap(prev => ({ ...prev, [exId]: n }))
    else if (val === '' || val === '.') setKgMap(prev => ({ ...prev, [exId]: val }))
  }

  const handleSave = () => {
    onSave(group.exercises.map(ex => ({
      cycleExId: ex.id,
      kg: parseFloat(kgMap[ex.id]) || 0,
      nota: noteMap[ex.id] ?? '',
    })))
  }

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px', zIndex: 50, maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '2px' }}>
        {client?.name?.toUpperCase()} {client?.surname?.toUpperCase()}
      </div>
      <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginBottom: (group.type === 'superset' || group.type === 'circuit') ? '4px' : '16px' }}>
        {group.type === 'circuit'
          ? <span style={{ color: 'var(--circuito)' }}>🔄 Circuito · {group.exercises[0]?.reps_c} giri</span>
          : <span>Settimana {week} · {repsPerSettimana(group.exercises[0], week)}</span>
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

            {/* Previous load reference */}
            {prev ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--acc-fondo)', border: '1px solid var(--acc-riempimento-forte)', borderRadius: '3px', padding: '3px 8px', marginBottom: '12px' }}>
                <span style={{ color: 'var(--testo-debole)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif' }}>prec.</span>
                <span style={{ color: 'var(--accento)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{prev.kg}kg</span>
                <span style={{ color: 'var(--testo-fioco)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif' }}>× {prev.reps}</span>
              </div>
            ) : (
              <div style={{ height: '4px' }} />
            )}

            {/* KG input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number" value={val}
                onChange={e => handleManualInput(ex.id, e.target.value)}
                style={{ flex: 1, background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '4px', padding: '12px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', textAlign: 'center', outline: 'none' }}
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

      <button onClick={handleSave} style={{ background: 'var(--accento)', border: 'none', color: '#fff', width: '100%', padding: '15px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '2px' }}>
        SALVA CARICHI ✓
      </button>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '10px', fontSize: '14px', marginTop: '4px' }}>
        Annulla
      </button>
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '10px 16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
// 38px: sotto questa misura il pollice sbaglia, e qui si tocca tutto il giorno.
const tastoCarico = { width: '38px', height: '38px', flexShrink: 0, background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '5px', color: 'var(--testo-forte)', fontSize: '20px', fontWeight: '700', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation', cursor: 'pointer' }
