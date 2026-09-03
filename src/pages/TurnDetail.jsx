import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk, notifyError } from '../lib/notify'
import { salvaCarichi } from '../lib/coda'
import { repsPerSettimana, raggruppaEsercizi } from '../lib/schede'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'




export default function TurnDetail({ navigate, goBack, goHome, params, session }) {
  // `phase` arrivava da Home ma non veniva mai letto: le tre card FASE 1/2/3
  // portavano tutte alla stessa identica schermata.
  const { turn, cycle, phase } = params
  const [day, setDay] = useState(1)
  const [exercises, setExercises] = useState([])
  const [clients, setClients] = useState([])
  // loads[clientId_exId_week] = kg
  const [loads, setLoads] = useState({})
  // notes[clientId_exId] = testo. Il vincolo unico nel database è su
  // (client_id, cycle_exercise_id) senza la settimana: la nota vale per
  // l'atleta su quell'esercizio per tutta la scheda, non per una settimana.
  const [notes, setNotes] = useState({})
  const [expanded, setExpanded] = useState({})
  const [editModal, setEditModal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (cycle) loadData(); else setLoading(false) }, [day, cycle])

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
    notifyOk(differito ? 'Carichi salvati sul telefono, partiranno appena torna la rete' : 'Carichi salvati')
    setEditModal(null)
  }

  async function advanceWeek(client) {
    if (client.current_week >= 6) return
    const newWeek = client.current_week + 1
    const { error } = await run(
      supabase.from('clients').update({ current_week: newWeek }).eq('id', client.id),
      `Impossibile avanzare la settimana di ${client.name} ${client.surname}.`
    )
    if (error) return
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, current_week: newWeek } : c))
  }

  // Get current kg and previous kg+reps for a client/exercise
  function getLoadInfo(client, ex) {
    const week = client.current_week
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
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>Nessuna scheda attiva.<br /><span style={{ fontSize: '12px' }}>Vai in Schede per crearne una.</span></div>
      </div>
      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )

  return (
    <div style={page}>
      <TopBar title={turn.name} subtitle={phase ? `${cycle.name} · ${phase.label}` : cycle.name} onBack={goBack} />
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[1,2,3].map(d => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, padding: '9px', borderRadius: '4px', border: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px',
            background: day === d ? '#D95C1A' : 'rgba(255,255,255,0.05)',
            color: day === d ? '#fff' : 'rgba(255,255,255,0.3)'
          }}>GIORNO {d}</button>
        ))}
      </div>

      <div style={scroll}>
        {loading && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', textAlign: 'center', padding: '32px' }}>Caricamento...</div>}
        {!loading && exercises.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px', textAlign: 'center', padding: '32px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }}>
            Nessun esercizio per il Giorno {day}.
          </div>
        )}

        {groups.map((group, gi) => {
          const groupKey = group.type === 'superset' ? group.label : group.exercises[0].id
          const isExpanded = expanded[groupKey]
          return (
            <div key={gi} style={{ marginBottom: '8px' }}>
              <div onClick={() => setExpanded(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                style={{
                  background: group.type === 'circuit' ? 'rgba(59,130,246,0.06)' : group.type === 'superset' ? 'rgba(217,92,26,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${group.type === 'circuit' ? 'rgba(59,130,246,0.25)' : group.type === 'superset' ? 'rgba(217,92,26,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  borderLeft: group.type === 'circuit' ? '2px solid #3b82f6' : group.type === 'superset' ? '2px solid #D95C1A' : undefined,
                  borderRadius: isExpanded ? '6px 6px 0 0' : '6px',
                  padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                }}>
                <div style={{ flex: 1 }}>
                  {group.type === 'superset' && (
                    <div style={{ color: '#D95C1A', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>⚡ SUPERSERIE</div>
                  )}
                  {group.type === 'circuit' && (
                    <div style={{ color: '#3b82f6', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>🔄 CIRCUITO {group.label.replace('CIR-','')}</div>
                  )}
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                    {group.exercises.map(e => e?.exercises?.name).join(' + ')}
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px', marginLeft: '8px' }}>{isExpanded ? '∨' : '›'}</div>
              </div>

              {isExpanded && (
                <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${group.type === 'superset' ? 'rgba(217,92,26,0.15)' : 'rgba(255,255,255,0.06)'}`, borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                  {clients.map(client => {
                    // "In ritardo" = indietro rispetto alla fase che il coach ha
                    // scelto in home. Prima era fisso a `< 3`, quindi marcava con
                    // ⚠ tutti gli atleti in settimana 1 o 2, cioè quelli
                    // semplicemente all'inizio del ciclo.
                    const isLate = phase ? client.current_week < phase.weekRange[0] : false
                    return (
                      <div key={client.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', background: isLate ? 'rgba(232,160,48,0.05)' : 'transparent' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Clickable name → athlete profile */}
                            <div onClick={() => navigate('athlete-profile', { client })}
                              style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {client.name} {client.surname}
                              {isLate && <span style={{ color: '#E8A030', fontSize: '9px', fontWeight: '700', letterSpacing: '1px' }}>⚠ SETT.{client.current_week}</span>}
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>›</span>
                            </div>
                            {/* Reps bigger + side by side */}
                            {group.type === 'circuit'
                              ? <div style={{ color: '#3b82f6', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', marginTop: '3px' }}>🔄 Circuito · {group.exercises[0]?.reps_c} giri</div>
                              : <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>SETT.</span>
                                    <span style={{ color: '#D95C1A', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '900' }}>{client.current_week}</span>
                                  </div>
                                  {/* In una superserie ogni esercizio ha le sue ripetizioni:
                                      mostrarne una sola qui sarebbe falso, stanno nei badge sotto. */}
                                  {group.exercises.length === 1 && <>
                                    <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
                                    <span style={{ color: '#fff', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>{repsPerSettimana(group.exercises[0], client.current_week)}</span>
                                  </>}
                                </div>
                            }
                          </div>
                          <button onClick={() => setEditModal({ client, group })} style={{
                            background: 'rgba(217,92,26,0.15)', border: '1px solid rgba(217,92,26,0.3)',
                            borderRadius: '3px', padding: '6px 12px', flexShrink: 0,
                            color: '#D95C1A', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px'
                          }}>CARICHI</button>
                        </div>

                        {/* Load badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {group.exercises.map(ex => {
                            const { currentKg, prevKg, prevReps } = getLoadInfo(client, ex)
                            // Un carico di 0 kg (corpo libero, macchina assistita) è
                            // un dato vero: prima veniva scartato come se mancasse.
                            const diff = (currentKg !== undefined && prevKg !== undefined) ? parseFloat((currentKg - prevKg).toFixed(2)) : null
                            return (
                              <div key={ex.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '5px 9px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px' }}>
                                    {ex?.exercises?.name?.split(' ')[0]?.toUpperCase() ?? ''}
                                  </span>
                                  <span style={{ color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>
                                    {currentKg !== undefined ? `${currentKg}kg` : '—'}
                                  </span>
                                  {currentKg !== undefined && (
                                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                      × {repsPerSettimana(ex, client.current_week)}
                                    </span>
                                  )}
                                  {diff !== null && (
                                    <span style={{ fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'rgba(255,255,255,0.2)' }}>
                                      {diff > 0 ? `↑+${diff}` : diff < 0 ? `↓${diff}` : '='}
                                    </span>
                                  )}
                                </div>
                                {/* Previous load */}
                                {prevKg !== undefined && (
                                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '2px' }}>
                                    prec. {prevKg}kg × {prevReps}
                                  </div>
                                )}
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
                              <span style={{ fontSize: '11px', flexShrink: 0 }}>📝</span>
                              <div style={{ minWidth: 0 }}>
                                {group.exercises.length > 1 && (
                                  <span style={{ color: 'rgba(234,179,8,0.75)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px', marginRight: '5px' }}>
                                    {ex?.exercises?.name?.split(' ')[0]?.toUpperCase() ?? ''}
                                  </span>
                                )}
                                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', lineHeight: 1.35 }}>
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

        {/* Advance week */}
        {!loading && clients.length > 0 && exercises.length > 0 && (
          <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px' }}>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px' }}>AVANZA SETTIMANA</div>
            {clients.map(client => (
              <div key={client.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.5px' }}>{client.name} {client.surname}</div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>Sett. {client.current_week}/6</div>
                </div>
                <button onClick={() => advanceWeek(client)} disabled={client.current_week >= 6} style={{
                  background: client.current_week >= 6 ? 'rgba(255,255,255,0.04)' : '#D95C1A',
                  border: 'none', borderRadius: '3px', padding: '6px 14px',
                  color: client.current_week >= 6 ? 'rgba(255,255,255,0.15)' : '#fff',
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px'
                }}>
                  {client.current_week >= 6 ? 'COMPLETO' : '+ AVANZA'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ height: '20px' }} />
      </div>

      {editModal && (
        <LoadModal
          client={editModal.client}
          group={editModal.group}
          loads={loads}
          notes={notes}
          onSave={(updates) => saveLoads(editModal.client.id, editModal.client.current_week, updates)}
          onClose={() => setEditModal(null)}
        />
      )}

      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )
}

function LoadModal({ client, group, loads, notes, onSave, onClose }) {
  const week = client.current_week

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
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#141414', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px', zIndex: 50, maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '2px' }}>
        {client?.name?.toUpperCase()} {client?.surname?.toUpperCase()}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginBottom: (group.type === 'superset' || group.type === 'circuit') ? '4px' : '16px' }}>
        {group.type === 'circuit'
          ? <span style={{ color: '#3b82f6' }}>🔄 Circuito · {group.exercises[0]?.reps_c} giri</span>
          : <span>Settimana {week} · {repsPerSettimana(group.exercises[0], week)}</span>
        }
      </div>
      {group.type === 'superset' && (
        <div style={{ color: '#D95C1A', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '16px' }}>⚡ SUPERSERIE</div>
      )}
      {group.type === 'circuit' && (
        <div style={{ color: '#3b82f6', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '16px' }}>🔄 CIRCUITO — inserisci i carichi usati</div>
      )}

      {group.exercises.map(ex => {
        const prev = getPrevLoad(ex)
        const val = kgMap[ex.id]
        return (
          <div key={ex.id} style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px', marginBottom: '4px' }}>
              {ex?.exercises?.name?.toUpperCase() ?? ''}
            </div>

            {/* Previous load reference */}
            {prev ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(217,92,26,0.08)', border: '1px solid rgba(217,92,26,0.2)', borderRadius: '3px', padding: '3px 8px', marginBottom: '12px' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>prec.</span>
                <span style={{ color: '#D95C1A', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{prev.kg}kg</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>× {prev.reps}</span>
              </div>
            ) : (
              <div style={{ height: '4px' }} />
            )}

            {/* KG input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number" value={val}
                onChange={e => handleManualInput(ex.id, e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '12px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', textAlign: 'center', outline: 'none' }}
              />
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', color: 'rgba(255,255,255,0.3)', fontWeight: '700' }}>KG</div>
            </div>

            {/* +/- buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
              {[[-1,'−1'],[-0.5,'−0.5'],[0.5,'+0.5'],[1,'+1']].map(([delta, label]) => (
                <button key={label} onClick={() => change(ex.id, delta)} style={{
                  background: delta > 0 ? 'rgba(217,92,26,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${delta > 0 ? 'rgba(217,92,26,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '4px', padding: '9px 4px',
                  color: delta > 0 ? '#D95C1A' : 'rgba(255,255,255,0.5)',
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700'
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
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${noteMap[ex.id]?.trim() ? 'rgba(234,179,8,0.35)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '4px', padding: '10px 12px',
                color: '#fff', fontSize: '16px', lineHeight: 1.4,
                outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>
        )
      })}

      <button onClick={handleSave} style={{ background: '#D95C1A', border: 'none', color: '#fff', width: '100%', padding: '15px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '2px' }}>
        SALVA CARICHI ✓
      </button>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', width: '100%', padding: '10px', fontSize: '13px', marginTop: '4px' }}>
        Annulla
      </button>
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '10px 16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
