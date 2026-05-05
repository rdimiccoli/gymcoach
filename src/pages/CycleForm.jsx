import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'

export default function CycleForm({ navigate, goBack, params }) {
  const { turnId, cycleId, readOnly } = params
  const [step, setStep] = useState('info') // info | exercises
  const [cycleName, setCycleName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [day, setDay] = useState(1)
  const [exList, setExList] = useState({ 1: [], 2: [], 3: [] })
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [currentCycleId, setCurrentCycleId] = useState(cycleId || null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!cycleId)

  useEffect(() => {
    loadExercises()
    if (cycleId) loadExistingCycle()
  }, [])

  async function loadExercises() {
    const { data } = await supabase.from('exercises').select('*').order('name')
    setAllExercises(data || [])
  }

  async function loadExistingCycle() {
    const { data: cycle } = await supabase.from('cycles').select('*').eq('id', cycleId).single()
    if (cycle) {
      setCycleName(cycle.name)
      setStartDate(cycle.start_date || new Date().toISOString().split('T')[0])
    }
    const { data: exData } = await supabase
      .from('cycle_exercises')
      .select('*, exercises(name)')
      .eq('cycle_id', cycleId)
      .order('sort_order')
    if (exData) {
      const map = { 1: [], 2: [], 3: [] }
      exData.forEach(e => {
        map[e.day] = [...(map[e.day] || []), {
          id: e.id, exerciseId: e.exercise_id, name: e.exercises.name,
          repsA: e.reps_a, repsB: e.reps_b, repsC: e.reps_c
        }]
      })
      setExList(map)
    }
    setLoading(false)
    setStep('exercises')
  }

  async function createCycle() {
    if (!cycleName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('cycles')
      .insert({ turn_id: turnId, name: cycleName, start_date: startDate, is_active: true })
      .select().single()
    setCurrentCycleId(data.id)
    setSaving(false)
    setStep('exercises')
  }

  async function addExercise(ex) {
    if (exList[day].find(e => e.exerciseId === ex.id)) return
    const newEx = { exerciseId: ex.id, name: ex.name, repsA: '3x8', repsB: '3x10', repsC: '3x12' }

    if (currentCycleId) {
      const { data } = await supabase.from('cycle_exercises').insert({
        cycle_id: currentCycleId, exercise_id: ex.id, day,
        reps_a: newEx.repsA, reps_b: newEx.repsB, reps_c: newEx.repsC,
        sort_order: exList[day].length
      }).select().single()
      newEx.id = data.id
    }
    setExList(prev => ({ ...prev, [day]: [...prev[day], newEx] }))
    setShowSearch(false)
    setSearch('')
  }

  async function addNewExercise(name) {
    const { data } = await supabase.from('exercises').insert({ name }).select().single()
    await addExercise(data)
  }

  async function updateReps(day, idx, field, val) {
    const ex = exList[day][idx]
    const updated = { ...ex, [field]: val }
    setExList(prev => ({ ...prev, [day]: prev[day].map((e, i) => i === idx ? updated : e) }))
    if (ex.id) {
      await supabase.from('cycle_exercises').update({
        reps_a: updated.repsA, reps_b: updated.repsB, reps_c: updated.repsC
      }).eq('id', ex.id)
    }
  }

  async function removeExercise(day, idx) {
    const ex = exList[day][idx]
    if (ex.id) await supabase.from('cycle_exercises').delete().eq('id', ex.id)
    setExList(prev => ({ ...prev, [day]: prev[day].filter((_, i) => i !== idx) }))
  }

  const filtered = allExercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) &&
    !exList[day].find(ex => ex.exerciseId === e.id)
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111' }}>
      <div style={{ color: '#D95C1A', fontSize: '18px' }}>Caricamento...</div>
    </div>
  )

  // STEP 1: Info ciclo
  if (step === 'info') return (
    <div style={page}>
      <TopBar title="Nuovo ciclo" subtitle="Informazioni base" onBack={goBack} />
      <div style={scroll}>
        <div style={fieldLabel}>Nome del ciclo</div>
        <input value={cycleName} onChange={e => setCycleName(e.target.value)}
          placeholder="es. 3° Ciclo Pari 2026"
          style={inp} />

        <div style={{ ...fieldLabel, marginTop: '14px' }}>Data di inizio</div>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />

        <button onClick={createCycle} disabled={!cycleName.trim() || saving}
          style={{ ...bigBtn, marginTop: '24px', opacity: !cycleName.trim() ? 0.4 : 1 }}>
          {saving ? 'Creazione...' : 'Avanti → Inserisci esercizi'}
        </button>
      </div>
    </div>
  )

  // STEP 2: Exercises
  return (
    <div style={{ ...page, position: 'relative' }}>
      <TopBar title={cycleName} subtitle={readOnly ? 'Sola lettura' : 'Modifica esercizi'} onBack={goBack} />

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0 }}>
        {[1,2,3].map(d => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '600',
            background: day === d ? '#D95C1A' : '#1e1e1e', color: day === d ? '#fff' : '#555'
          }}>Giorno {d}</button>
        ))}
      </div>

      <div style={scroll}>
        {exList[day].length === 0 && (
          <div style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '24px', background: '#1a1a1a', borderRadius: '11px', marginBottom: '10px' }}>
            Nessun esercizio per il Giorno {day}
          </div>
        )}

        {exList[day].map((ex, idx) => (
          <div key={idx} style={{ background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '12px 13px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', flex: 1 }}>{ex.name}</div>
              {!readOnly && (
                <button onClick={() => removeExercise(day, idx)} style={{ background: 'none', border: 'none', color: '#E85C1A', fontSize: '16px', padding: '0 4px' }}>✕</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {[['repsA','Sett.1-2'],['repsB','Sett.3-4'],['repsC','Sett.5-6']].map(([field, label]) => (
                <div key={field}>
                  <div style={{ color: '#444', fontSize: '9px', marginBottom: '3px', textAlign: 'center' }}>{label}</div>
                  <input
                    value={ex[field]} readOnly={readOnly}
                    onChange={e => updateReps(day, idx, field, e.target.value)}
                    style={{ ...repsInp, background: readOnly ? '#1a1a1a' : '#2a2a2a' }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {!readOnly && (
          <button onClick={() => setShowSearch(true)} style={{ ...bigBtn, background: '#1e1e1e', border: '0.5px solid #2a2a2a', color: '#D95C1A' }}>
            + Aggiungi esercizio
          </button>
        )}

        {!readOnly && exList[day].length > 0 && (
          <button onClick={goBack} style={{ ...bigBtn, marginTop: '8px' }}>
            ✓ Salva e torna
          </button>
        )}
        <div style={{ height: '20px' }} />
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div style={{ position: 'absolute', inset: 0, background: '#111', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #2a2a2a', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca esercizio..." style={{ ...inp, flex: 1 }} />
            <button onClick={() => { setShowSearch(false); setSearch('') }} style={{ color: '#888', background: 'none', border: 'none', fontSize: '14px' }}>Annulla</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
            {search.length > 1 && filtered.length === 0 && (
              <button onClick={() => addNewExercise(search)} style={{ ...bigBtn, background: '#1e1e1e', border: '0.5px solid #D95C1A', color: '#D95C1A' }}>
                + Aggiungi "{search}" al database
              </button>
            )}
            {filtered.map(ex => (
              <div key={ex.id} onClick={() => addExercise(ex)}
                style={{ padding: '12px 14px', background: '#1e1e1e', borderRadius: '10px', marginBottom: '6px', color: '#fff', fontSize: '13px', cursor: 'pointer', border: '0.5px solid #2a2a2a' }}>
                {ex.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '14px 16px' }
const fieldLabel = { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }
const inp = { width: '100%', background: '#1e1e1e', border: '0.5px solid #333', borderRadius: '11px', padding: '13px 14px', color: '#fff', fontSize: '14px', outline: 'none' }
const repsInp = { width: '100%', border: '0.5px solid #333', borderRadius: '8px', padding: '7px 6px', color: '#fff', fontSize: '12px', outline: 'none', textAlign: 'center' }
const bigBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '13px', borderRadius: '11px', fontSize: '14px', fontWeight: '700' }
