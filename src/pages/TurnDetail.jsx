import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const REPS_FOR_WEEK = (ex, week) => {
  if (week <= 2) return ex.reps_a
  if (week <= 4) return ex.reps_b
  return ex.reps_c
}

function groupExercises(exercises) {
  const groups = []
  const seen = {}
  exercises.forEach(ex => {
    const sg = ex.superset_group
    if (!sg) {
      groups.push({ type: 'single', exercises: [ex] })
    } else {
      if (!seen[sg]) {
        seen[sg] = { type: 'superset', label: sg, exercises: [] }
        groups.push(seen[sg])
      }
      seen[sg].exercises.push(ex)
    }
  })
  return groups
}

export default function TurnDetail({ navigate, goBack, goHome, params }) {
  const { turn, cycle } = params
  const [day, setDay] = useState(1)
  const [exercises, setExercises] = useState([])
  const [clients, setClients] = useState([])
  const [loads, setLoads] = useState({})
  const [prevLoads, setPrevLoads] = useState({})
  const [notes, setNotes] = useState({})
  const [expanded, setExpanded] = useState({})
  const [editModal, setEditModal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (cycle) { loadData() } else { setLoading(false) } }, [day, cycle])

  async function loadData() {
    setLoading(true)
    const { data: exData } = await supabase
      .from('cycle_exercises').select('*, exercises(name)')
      .eq('cycle_id', cycle.id).eq('day', day).order('sort_order')
    setExercises(exData || [])

    const { data: cl } = await supabase
      .from('clients').select('*')
      .eq('turn_id', turn.id).eq('is_active', true).order('surname')
    setClients(cl || [])

    if (exData?.length && cl?.length) {
      const exIds = exData.map(e => e.id)
      const clIds = cl.map(c => c.id)

      const { data: loadData } = await supabase.from('client_loads').select('*')
        .in('client_id', clIds).in('cycle_exercise_id', exIds)
      const loadMap = {}
      loadData?.forEach(l => { loadMap[`${l.client_id}_${l.cycle_exercise_id}`] = l.kg })
      setLoads(loadMap)

      const { data: noteData } = await supabase.from('client_notes').select('*')
        .in('client_id', clIds).in('cycle_exercise_id', exIds)
      const noteMap = {}
      noteData?.forEach(n => { noteMap[`${n.client_id}_${n.cycle_exercise_id}`] = n.note })
      setNotes(noteMap)

      const { data: prevCycles } = await supabase.from('cycles').select('id')
        .eq('turn_id', turn.id).eq('is_active', false)
        .order('created_at', { ascending: false }).limit(1)
      if (prevCycles?.[0]) {
        const { data: prevEx } = await supabase.from('cycle_exercises').select('id, exercise_id')
          .eq('cycle_id', prevCycles[0].id).eq('day', day)
        if (prevEx?.length) {
          const { data: prevLoad } = await supabase.from('client_loads').select('*')
            .in('client_id', clIds).in('cycle_exercise_id', prevEx.map(e => e.id))
          const prevMap = {}
          prevLoad?.forEach(l => {
            const ex = prevEx.find(e => e.id === l.cycle_exercise_id)
            if (ex) prevMap[`${l.client_id}_${ex.exercise_id}`] = l.kg
          })
          setPrevLoads(prevMap)
        }
      }
    }
    setLoading(false)
  }

  async function saveLoads(clientId, loadUpdates) {
    const newLoads = { ...loads }
    for (const { cycleExId, kg } of loadUpdates) {
      newLoads[`${clientId}_${cycleExId}`] = kg
      await supabase.from('client_loads').upsert(
        { client_id: clientId, cycle_exercise_id: cycleExId, kg },
        { onConflict: 'client_id,cycle_exercise_id' }
      )
    }
    setLoads(newLoads)
    setEditModal(null)
  }

  async function advanceWeek(client) {
    if (client.current_week >= 6) return
    const newWeek = client.current_week + 1
    await supabase.from('clients').update({ current_week: newWeek }).eq('id', client.id)
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, current_week: newWeek } : c))
  }

  const groups = groupExercises(exercises)

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
      <TopBar title={turn.name} subtitle={cycle.name} onBack={goBack} />
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
                  background: group.type === 'superset' ? 'rgba(217,92,26,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${group.type === 'superset' ? 'rgba(217,92,26,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  borderLeft: group.type === 'superset' ? '2px solid #D95C1A' : undefined,
                  borderRadius: isExpanded ? '6px 6px 0 0' : '6px',
                  padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                }}>
                <div style={{ flex: 1 }}>
                  {group.type === 'superset' && (
                    <div style={{ color: '#D95C1A', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px' }}>⚡ SUPERSERIE</div>
                  )}
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                    {group.exercises.map(e => e.exercises.name).join(' + ')}
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px', marginLeft: '8px' }}>{isExpanded ? '∨' : '›'}</div>
              </div>

              {isExpanded && (
                <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${group.type === 'superset' ? 'rgba(217,92,26,0.15)' : 'rgba(255,255,255,0.06)'}`, borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                  {clients.map(client => {
                    const isLate = client.current_week < 3
                    return (
                      <div key={client.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', background: isLate ? 'rgba(232,160,48,0.05)' : 'transparent' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div>
                            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                              {client.name} {client.surname}
                              {isLate && <span style={{ color: '#E8A030', fontSize: '9px', marginLeft: '8px', fontWeight: '700', letterSpacing: '1px' }}>⚠ SETT.{client.current_week}</span>}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
                              Sett.<span style={{ color: '#D95C1A' }}> {client.current_week}</span> · {REPS_FOR_WEEK(group.exercises[0], client.current_week)}
                            </div>
                          </div>
                          <button onClick={() => setEditModal({ client, group })} style={{
                            background: 'rgba(217,92,26,0.15)', border: '1px solid rgba(217,92,26,0.3)',
                            borderRadius: '3px', padding: '6px 12px',
                            color: '#D95C1A', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px'
                          }}>CARICHI</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {group.exercises.map(ex => {
                            const kg = loads[`${client.id}_${ex.id}`]
                            const prev = prevLoads[`${client.id}_${ex.exercise_id}`]
                            const diff = (kg > 0 && prev !== undefined) ? parseFloat((kg - prev).toFixed(2)) : null
                            return (
                              <div key={ex.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '3px', padding: '4px 9px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif' }}>{ex.exercises.name.split(' ')[0].toUpperCase()}</span>
                                  <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{kg > 0 ? `${kg}kg` : '—'}</span>
                                  {diff !== null && (
                                    <span style={{ fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'rgba(255,255,255,0.2)' }}>
                                      {diff > 0 ? `↑+${diff}` : diff < 0 ? `↓${diff}` : '='}
                                    </span>
                                  )}
                                </div>
                                {prev !== undefined && (
                                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                    prec. {prev}kg
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
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
          prevLoads={prevLoads}
          onSave={(updates) => saveLoads(editModal.client.id, updates)}
          onClose={() => setEditModal(null)}
        />
      )}

      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )
}

function LoadModal({ client, group, loads, prevLoads, onSave, onClose }) {
  const [kgMap, setKgMap] = useState(() => {
    const m = {}
    group.exercises.forEach(ex => { m[ex.id] = parseFloat(loads[`${client.id}_${ex.id}`]) || 0 })
    return m
  })

  const change = (exId, delta) => {
    setKgMap(prev => ({ ...prev, [exId]: Math.max(0, parseFloat((prev[exId] + delta).toFixed(2))) }))
  }

  const handleManualInput = (exId, val) => {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) setKgMap(prev => ({ ...prev, [exId]: n }))
    else if (val === '' || val === '.') setKgMap(prev => ({ ...prev, [exId]: val }))
  }

  const handleSave = () => {
    const updates = group.exercises.map(ex => ({
      cycleExId: ex.id,
      kg: parseFloat(kgMap[ex.id]) || 0
    }))
    onSave(updates)
  }

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#141414', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px', zIndex: 50, maxHeight: '85vh', overflowY: 'auto' }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '2px' }}>
        {client.name.toUpperCase()} {client.surname.toUpperCase()}
      </div>
      {group.type === 'superset' && (
        <div style={{ color: '#D95C1A', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '16px' }}>⚡ SUPERSERIE</div>
      )}
      {group.type === 'single' && <div style={{ height: '14px' }} />}

      {group.exercises.map(ex => {
        const prev = prevLoads[`${client.id}_${ex.exercise_id}`]
        const val = kgMap[ex.id]
        return (
          <div key={ex.id} style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px', marginBottom: '2px' }}>{ex.exercises.name.toUpperCase()}</div>
            {prev !== undefined && <div style={{ color: '#D95C1A', fontSize: '10px', marginBottom: '12px' }}>💡 Scheda precedente: {prev} kg</div>}
            {prev === undefined && <div style={{ height: '8px' }} />}

            {/* Manual input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <input
                type="number"
                value={val}
                onChange={e => handleManualInput(ex.id, e.target.value)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px', padding: '12px', color: '#fff',
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900',
                  textAlign: 'center', outline: 'none'
                }}
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
const scroll = { flex: 1, overflowY: 'auto', padding: '10px 16px' }
