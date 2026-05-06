import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'

const REPS_FOR_WEEK = (ex, week) => {
  if (week <= 2) return ex.reps_a
  if (week <= 4) return ex.reps_b
  return ex.reps_c
}

// Group exercises: solo exercises are alone, supersets are grouped by superset_group
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

export default function TurnDetail({ navigate, goBack, params }) {
  const { turn, cycle } = params
  const [day, setDay] = useState(1)
  const [exercises, setExercises] = useState([])
  const [clients, setClients] = useState([])
  const [loads, setLoads] = useState({})
  const [prevLoads, setPrevLoads] = useState({})
  const [notes, setNotes] = useState({})
  const [expanded, setExpanded] = useState({})
  const [editModal, setEditModal] = useState(null) // { client, exercises: [], loads: {} }
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (cycle) { loadData() } else { setLoading(false) } }, [day, cycle])

  async function loadData() {
    setLoading(true)
    const { data: exData } = await supabase
      .from('cycle_exercises')
      .select('*, exercises(name)')
      .eq('cycle_id', cycle.id)
      .eq('day', day)
      .order('sort_order')
    setExercises(exData || [])

    const { data: cl } = await supabase
      .from('clients')
      .select('*')
      .eq('turn_id', turn.id)
      .eq('is_active', true)
      .order('surname')
    setClients(cl || [])

    if (exData?.length && cl?.length) {
      const exIds = exData.map(e => e.id)
      const clIds = cl.map(c => c.id)

      const { data: loadData } = await supabase
        .from('client_loads').select('*')
        .in('client_id', clIds).in('cycle_exercise_id', exIds)
      const loadMap = {}
      loadData?.forEach(l => { loadMap[`${l.client_id}_${l.cycle_exercise_id}`] = l.kg })
      setLoads(loadMap)

      const { data: noteData } = await supabase
        .from('client_notes').select('*')
        .in('client_id', clIds).in('cycle_exercise_id', exIds)
      const noteMap = {}
      noteData?.forEach(n => { noteMap[`${n.client_id}_${n.cycle_exercise_id}`] = n.note })
      setNotes(noteMap)

      // Prev cycle loads
      const { data: prevCycles } = await supabase
        .from('cycles').select('id').eq('turn_id', turn.id).eq('is_active', false)
        .order('created_at', { ascending: false }).limit(1)
      if (prevCycles?.[0]) {
        const { data: prevEx } = await supabase
          .from('cycle_exercises').select('id, exercise_id')
          .eq('cycle_id', prevCycles[0].id).eq('day', day)
        if (prevEx?.length) {
          const { data: prevLoad } = await supabase
            .from('client_loads').select('*')
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
    // loadUpdates: [{ cycleExId, kg }]
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
      <TopBar title={turn.name} subtitle="Nessun ciclo attivo" onBack={goBack} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div style={{ color: '#555', fontSize: '14px' }}>Nessun ciclo attivo.<br /><span style={{ color: '#333', fontSize: '12px' }}>Vai in Cicli per crearne uno.</span></div>
      </div>
    </div>
  )

  return (
    <div style={page}>
      <TopBar title={turn.name} subtitle={cycle.name} onBack={goBack} />
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0 }}>
        {[1,2,3].map(d => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '600',
            background: day === d ? '#D95C1A' : '#1e1e1e', color: day === d ? '#fff' : '#555'
          }}>Giorno {d}</button>
        ))}
      </div>

      <div style={scroll}>
        {loading && <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '32px' }}>Caricamento...</div>}
        {!loading && exercises.length === 0 && (
          <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '32px', background: '#1a1a1a', borderRadius: '12px' }}>
            Nessun esercizio per il Giorno {day}.
          </div>
        )}

        {groups.map((group, gi) => {
          const groupKey = group.type === 'superset' ? group.label : group.exercises[0].id
          const isExpanded = expanded[groupKey]

          return (
            <div key={gi} style={{ marginBottom: '8px' }}>
              {/* Group header */}
              <div onClick={() => setExpanded(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                style={{ background: group.type === 'superset' ? '#261e1a' : '#1e1e1e', border: `0.5px solid ${group.type === 'superset' ? '#4a2e1a' : '#2a2a2a'}`, borderRadius: isExpanded ? '12px 12px 0 0' : '12px', padding: '11px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  {group.type === 'superset' && (
                    <div style={{ color: '#D95C1A', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>⚡ Superserie</div>
                  )}
                  <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
                    {group.exercises.map(e => e.exercises.name).join(' + ')}
                  </div>
                </div>
                <div style={{ color: '#444', fontSize: '16px', marginLeft: '8px' }}>{isExpanded ? '∨' : '›'}</div>
              </div>

              {/* Clients */}
              {isExpanded && (
                <div style={{ background: '#1a1a1a', border: `0.5px solid ${group.type === 'superset' ? '#4a2e1a' : '#2a2a2a'}`, borderTop: 'none', borderRadius: '0 0 12px 12px' }}>
                  {clients.map(client => {
                    const isLate = client.current_week < 3
                    return (
                      <div key={client.id} style={{ borderTop: '0.5px solid #252525', padding: '10px 13px', background: isLate ? '#1c1a17' : 'transparent' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ color: '#ccc', fontSize: '12px', fontWeight: '600' }}>
                              {client.name} {client.surname}
                              {isLate && <span style={{ color: '#E8A030', fontSize: '10px', marginLeft: '6px' }}>⚠ sett.{client.current_week}</span>}
                            </div>
                            <div style={{ color: '#555', fontSize: '10px', marginTop: '1px' }}>
                              Sett.<span style={{ color: '#D95C1A' }}> {client.current_week}</span>
                            </div>
                          </div>
                          <button onClick={() => setEditModal({ client, group })} style={{
                            background: '#2a2a2a', border: 'none', borderRadius: '8px',
                            padding: '5px 12px', color: '#D95C1A', fontSize: '11px', fontWeight: '600'
                          }}>✎ Carichi</button>
                        </div>

                        {/* Show current loads inline */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '7px' }}>
                          {group.exercises.map(ex => {
                            const kg = loads[`${client.id}_${ex.id}`]
                            return (
                              <div key={ex.id} style={{ background: '#252525', borderRadius: '6px', padding: '3px 8px' }}>
                                <span style={{ color: '#555', fontSize: '9px' }}>{ex.exercises.name.split(' ')[0]}: </span>
                                <span style={{ color: '#fff', fontSize: '11px', fontWeight: '600' }}>{kg > 0 ? `${kg}kg` : '—'}</span>
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
        {!loading && clients.length > 0 && (
          <div style={{ marginTop: '16px', background: '#1a1a1a', borderRadius: '12px', padding: '14px' }}>
            <div style={{ color: '#555', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Avanza settimana</div>
            {clients.map(client => (
              <div key={client.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', marginBottom: '8px', borderBottom: '0.5px solid #222' }}>
                <div>
                  <div style={{ color: '#ccc', fontSize: '12px' }}>{client.name} {client.surname}</div>
                  <div style={{ color: '#444', fontSize: '10px' }}>Sett. {client.current_week}/6</div>
                </div>
                <button onClick={() => advanceWeek(client)} disabled={client.current_week >= 6} style={{
                  background: client.current_week >= 6 ? '#1e1e1e' : '#D95C1A',
                  border: 'none', borderRadius: '8px', padding: '5px 12px',
                  color: client.current_week >= 6 ? '#333' : '#fff', fontSize: '11px', fontWeight: '600'
                }}>
                  {client.current_week >= 6 ? 'Completo' : '+ Avanza'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ height: '20px' }} />
      </div>

      {/* Superset / single edit modal */}
      {editModal && (
        <SupersetModal
          client={editModal.client}
          group={editModal.group}
          loads={loads}
          prevLoads={prevLoads}
          onSave={(updates) => saveLoads(editModal.client.id, updates)}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}

function SupersetModal({ client, group, loads, prevLoads, onSave, onClose }) {
  const [kgMap, setKgMap] = useState(() => {
    const m = {}
    group.exercises.forEach(ex => { m[ex.id] = parseFloat(loads[`${client.id}_${ex.id}`]) || 0 })
    return m
  })

  const change = (exId, delta) => {
    setKgMap(prev => ({ ...prev, [exId]: Math.max(0, parseFloat((prev[exId] + delta).toFixed(2))) }))
  }

  const handleSave = () => {
    const updates = group.exercises.map(ex => ({ cycleExId: ex.id, kg: kgMap[ex.id] }))
    onSave(updates)
  }

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#181818', borderTop: '0.5px solid #333', borderRadius: '20px 20px 0 0', padding: '18px 16px 32px', zIndex: 50, maxHeight: '80vh', overflowY: 'auto' }}>
      <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '2px' }}>{client.name} {client.surname}</div>
      {group.type === 'superset' && <div style={{ color: '#D95C1A', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>⚡ Superserie</div>}
      {group.type === 'single' && <div style={{ height: '12px' }} />}

      {group.exercises.map(ex => {
        const prev = prevLoads[`${client.id}_${ex.exercise_id}`]
        return (
          <div key={ex.id} style={{ marginBottom: '16px', background: '#222', borderRadius: '12px', padding: '12px 14px' }}>
            <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '2px' }}>{ex.exercises.name}</div>
            {prev !== undefined && <div style={{ color: '#D95C1A', fontSize: '10px', marginBottom: '10px' }}>💡 Ciclo prec.: {prev} kg</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button onClick={() => change(ex.id, -2.5)} style={circBtn}>−</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ color: '#fff', fontSize: '28px', fontWeight: '700' }}>{kgMap[ex.id]}</div>
                <div style={{ color: '#444', fontSize: '11px' }}>kg</div>
              </div>
              <button onClick={() => change(ex.id, +2.5)} style={circBtn}>+</button>
            </div>
          </div>
        )
      })}

      <button onClick={handleSave} style={{ background: '#D95C1A', border: 'none', color: '#fff', width: '100%', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: '700', marginTop: '4px' }}>
        Salva carichi ✓
      </button>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#444', width: '100%', padding: '10px', fontSize: '13px', marginTop: '4px' }}>
        Annulla
      </button>
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '10px 16px' }
const circBtn = { background: '#2a2a2a', border: '0.5px solid #333', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
