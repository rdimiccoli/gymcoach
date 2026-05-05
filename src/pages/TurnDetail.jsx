import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'

const REPS_FOR_WEEK = (ex, week) => {
  if (week <= 2) return ex.reps_a
  if (week <= 4) return ex.reps_b
  return ex.reps_c
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
  const [editModal, setEditModal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (cycle) loadData() else setLoading(false) }, [day, cycle])

  async function loadData() {
    setLoading(true)
    // Load exercises for this day
    const { data: exData } = await supabase
      .from('cycle_exercises')
      .select('*, exercises(name)')
      .eq('cycle_id', cycle.id)
      .eq('day', day)
      .order('sort_order')
    setExercises(exData || [])

    // Load active clients
    const { data: cl } = await supabase
      .from('clients')
      .select('*')
      .eq('turn_id', turn.id)
      .eq('is_active', true)
      .order('surname')
    setClients(cl || [])

    if (exData?.length && cl?.length) {
      // Load current loads
      const exIds = exData.map(e => e.id)
      const clIds = cl.map(c => c.id)
      const { data: loadData } = await supabase
        .from('client_loads')
        .select('*')
        .in('client_id', clIds)
        .in('cycle_exercise_id', exIds)
      const loadMap = {}
      loadData?.forEach(l => { loadMap[`${l.client_id}_${l.cycle_exercise_id}`] = l.kg })
      setLoads(loadMap)

      // Load notes
      const { data: noteData } = await supabase
        .from('client_notes')
        .select('*')
        .in('client_id', clIds)
        .in('cycle_exercise_id', exIds)
      const noteMap = {}
      noteData?.forEach(n => { noteMap[`${n.client_id}_${n.cycle_exercise_id}`] = n.note })
      setNotes(noteMap)

      // Load prev cycle loads for suggestion
      const { data: prevCycles } = await supabase
        .from('cycles')
        .select('id')
        .eq('turn_id', turn.id)
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(1)

      if (prevCycles?.[0]) {
        const { data: prevEx } = await supabase
          .from('cycle_exercises')
          .select('id, exercise_id')
          .eq('cycle_id', prevCycles[0].id)
          .eq('day', day)
        if (prevEx?.length) {
          const prevExIds = prevEx.map(e => e.id)
          const { data: prevLoad } = await supabase
            .from('client_loads')
            .select('*')
            .in('client_id', clIds)
            .in('cycle_exercise_id', prevExIds)
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

  async function saveLoad(clientId, exId, exerciseId, kg) {
    const key = `${clientId}_${exId}`
    setLoads(prev => ({ ...prev, [key]: kg }))
    await supabase.from('client_loads').upsert(
      { client_id: clientId, cycle_exercise_id: exId, kg },
      { onConflict: 'client_id,cycle_exercise_id' }
    )
    setEditModal(null)
  }

  async function advanceWeek(client) {
    if (client.current_week >= 6) return
    const newWeek = client.current_week + 1
    await supabase.from('clients').update({ current_week: newWeek }).eq('id', client.id)
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, current_week: newWeek } : c))
  }

  const toggleExpand = (exId) => setExpanded(prev => ({ ...prev, [exId]: !prev[exId] }))

  if (!cycle) return (
    <div style={page}>
      <TopBar title={turn.name} subtitle="Nessun ciclo attivo" onBack={goBack} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div>
          <div style={{ color: '#555', fontSize: '14px', marginBottom: '12px' }}>Nessun ciclo attivo per questo turno.</div>
          <div style={{ color: '#444', fontSize: '12px' }}>Vai in Cicli per crearne uno nuovo.</div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={page}>
      <TopBar title={turn.name} subtitle={cycle.name} onBack={goBack} />

      {/* Day selector */}
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
            Nessun esercizio per il Giorno {day}.<br />
            <span style={{ fontSize: '11px', color: '#333' }}>Aggiungili dal pannello Cicli.</span>
          </div>
        )}

        {exercises.map(ex => (
          <div key={ex.id} style={{ background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '12px', marginBottom: '8px', overflow: 'hidden' }}>
            {/* Exercise header */}
            <div onClick={() => toggleExpand(ex.id)} style={{ padding: '11px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', flex: 1, paddingRight: '8px' }}>{ex.exercises.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#D95C1A', color: '#fff', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                  {REPS_FOR_WEEK(ex, 3)}
                </div>
                <div style={{ color: '#444', fontSize: '16px' }}>{expanded[ex.id] ? '∨' : '›'}</div>
              </div>
            </div>

            {/* Clients list */}
            {expanded[ex.id] && clients.map(client => {
              const loadKey = `${client.id}_${ex.id}`
              const prevKey = `${client.id}_${ex.exercise_id}`
              const kg = loads[loadKey] ?? 0
              const prev = prevLoads[prevKey]
              const reps = REPS_FOR_WEEK(ex, client.current_week)
              const note = notes[loadKey]
              const isLate = client.current_week < 3  // simplified late detection

              return (
                <div key={client.id}>
                  <div style={{ borderTop: '0.5px solid #252525', padding: '9px 13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isLate ? '#1c1a17' : 'transparent' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#ccc', fontSize: '12px' }}>
                        {client.name} {client.surname}
                        {isLate && <span style={{ color: '#E8A030', fontSize: '10px', marginLeft: '6px' }}>⚠ sett.{client.current_week}</span>}
                      </div>
                      <div style={{ color: '#555', fontSize: '10px', marginTop: '1px' }}>
                        Sett.<span style={{ color: '#D95C1A' }}> {client.current_week}</span> · {reps}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{kg > 0 ? `${kg}kg` : '—'}</div>
                      <button onClick={() => setEditModal({ client, ex, kg, prev })} style={{
                        background: '#2a2a2a', border: 'none', borderRadius: '50%',
                        width: '28px', height: '28px', color: '#888', fontSize: '13px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>✎</button>
                    </div>
                  </div>
                  {note && (
                    <div style={{ background: '#1a1a1a', padding: '5px 13px 7px', borderTop: '0.5px solid #222' }}>
                      <div style={{ color: '#555', fontSize: '10px', fontStyle: 'italic' }}>📝 {note}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Advance week section */}
        {!loading && clients.length > 0 && (
          <div style={{ marginTop: '16px', background: '#1a1a1a', borderRadius: '12px', padding: '14px' }}>
            <div style={{ color: '#555', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Avanza settimana clienti presenti</div>
            {clients.map(client => (
              <div key={client.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', marginBottom: '8px', borderBottom: '0.5px solid #222' }}>
                <div>
                  <div style={{ color: '#ccc', fontSize: '12px' }}>{client.name} {client.surname}</div>
                  <div style={{ color: '#444', fontSize: '10px' }}>Sett. {client.current_week}/6</div>
                </div>
                <button
                  onClick={() => advanceWeek(client)}
                  disabled={client.current_week >= 6}
                  style={{
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

      {/* Edit Modal */}
      {editModal && (
        <LoadModal
          client={editModal.client}
          ex={editModal.ex}
          initialKg={editModal.kg}
          prevKg={editModal.prev}
          onSave={(kg) => saveLoad(editModal.client.id, editModal.ex.id, editModal.ex.exercise_id, kg)}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}

function LoadModal({ client, ex, initialKg, prevKg, onSave, onClose }) {
  const [kg, setKg] = useState(parseFloat(initialKg) || 0)

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#181818', borderTop: '0.5px solid #333', borderRadius: '20px 20px 0 0', padding: '20px 16px 32px', zIndex: 50 }}>
      <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700', marginBottom: '2px' }}>{client.name} {client.surname}</div>
      <div style={{ color: '#555', fontSize: '12px', marginBottom: '4px' }}>{ex.exercises.name}</div>
      {prevKg !== undefined && <div style={{ color: '#D95C1A', fontSize: '11px', marginBottom: '16px' }}>💡 Ciclo precedente: {prevKg} kg</div>}
      {prevKg === undefined && <div style={{ height: '16px' }} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <button onClick={() => setKg(k => Math.max(0, parseFloat((k - 2.5).toFixed(2))))} style={circBtn}>−</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: '34px', fontWeight: '700' }}>{kg}</div>
          <div style={{ color: '#444', fontSize: '12px' }}>kg</div>
        </div>
        <button onClick={() => setKg(k => parseFloat((k + 2.5).toFixed(2)))} style={circBtn}>+</button>
      </div>
      <button onClick={() => onSave(kg)} style={{ background: '#D95C1A', border: 'none', color: '#fff', width: '100%', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: '700' }}>
        Salva carico ✓
      </button>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#444', width: '100%', padding: '10px', fontSize: '13px', marginTop: '4px' }}>
        Annulla
      </button>
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '10px 16px' }
const circBtn = { background: '#2a2a2a', border: '0.5px solid #333', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
