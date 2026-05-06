import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'

export default function CycleForm({ navigate, goBack, params }) {
  const { turnId, cycleId, readOnly } = params
  const [step, setStep] = useState('info')
  const [cycleName, setCycleName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [day, setDay] = useState(1)
  const [exList, setExList] = useState({ 1: [], 2: [], 3: [] })
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [activeSuperset, setActiveSuperset] = useState(null) // label of superset being extended
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
          repsA: e.reps_a, repsB: e.reps_b, repsC: e.reps_c,
          supersetGroup: e.superset_group || null
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

  // Generate unique superset label (SS-A, SS-B, ...)
  function generateSupersetLabel() {
    const existing = new Set(exList[day].map(e => e.supersetGroup).filter(Boolean))
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (const l of letters) {
      if (!existing.has(`SS-${l}`)) return `SS-${l}`
    }
    return `SS-${Date.now()}`
  }

  async function addExercise(ex) {
    const supersetGroup = activeSuperset || null
    const newEx = {
      exerciseId: ex.id, name: ex.name,
      repsA: '3x8', repsB: '3x10', repsC: '3x12',
      supersetGroup
    }
    if (currentCycleId) {
      const { data } = await supabase.from('cycle_exercises').insert({
        cycle_id: currentCycleId, exercise_id: ex.id, day,
        reps_a: newEx.repsA, reps_b: newEx.repsB, reps_c: newEx.repsC,
        sort_order: exList[day].length,
        superset_group: supersetGroup
      }).select().single()
      newEx.id = data.id
    }
    setExList(prev => ({ ...prev, [day]: [...prev[day], newEx] }))
    setShowSearch(false)
    setSearch('')
    // keep activeSuperset so user can keep adding to same group
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

  function startNewSuperset() {
    const label = generateSupersetLabel()
    setActiveSuperset(label)
    setShowSearch(true)
  }

  function addToExistingSuperset(label) {
    setActiveSuperset(label)
    setShowSearch(true)
  }

  function stopSuperset() {
    setActiveSuperset(null)
  }

  // Group exercises for display
  function getGroups() {
    const groups = []
    const seen = {}
    exList[day].forEach((ex, idx) => {
      const sg = ex.supersetGroup
      if (!sg) {
        groups.push({ type: 'single', exercises: [{ ...ex, idx }] })
      } else {
        if (!seen[sg]) {
          seen[sg] = { type: 'superset', label: sg, exercises: [] }
          groups.push(seen[sg])
        }
        seen[sg].exercises.push({ ...ex, idx })
      }
    })
    return groups
  }

  const filtered = allExercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a' }}>
      <div style={{ color: '#D95C1A', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', letterSpacing: '2px' }}>CARICAMENTO...</div>
    </div>
  )

  // STEP 1: Info
  if (step === 'info') return (
    <div style={page}>
      <TopBar title="NUOVO CICLO" subtitle="Informazioni base" onBack={goBack} />
      <div style={scroll}>
        <div style={fieldLabel}>NOME CICLO</div>
        <input value={cycleName} onChange={e => setCycleName(e.target.value)}
          placeholder="es. 3° Ciclo Pari 2026" style={inp} />
        <div style={{ ...fieldLabel, marginTop: '16px' }}>DATA DI INIZIO</div>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
        <button onClick={createCycle} disabled={!cycleName.trim() || saving}
          style={{ ...bigBtn, marginTop: '28px', opacity: !cycleName.trim() ? 0.3 : 1 }}>
          {saving ? 'CREAZIONE...' : 'AVANTI → INSERISCI ESERCIZI'}
        </button>
      </div>
    </div>
  )

  // STEP 2: Exercises
  const groups = getGroups()

  return (
    <div style={{ ...page, position: 'relative' }}>
      <TopBar title={cycleName.toUpperCase()} subtitle={readOnly ? 'Sola lettura' : 'Gestione esercizi'} onBack={goBack} />

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[1,2,3].map(d => (
          <button key={d} onClick={() => { setDay(d); setActiveSuperset(null) }} style={{
            flex: 1, padding: '9px', borderRadius: '4px', border: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px',
            background: day === d ? '#D95C1A' : 'rgba(255,255,255,0.05)',
            color: day === d ? '#fff' : 'rgba(255,255,255,0.3)'
          }}>GIORNO {d}</button>
        ))}
      </div>

      <div style={scroll}>

        {groups.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px', textAlign: 'center', padding: '32px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px', marginBottom: '12px' }}>
            Nessun esercizio per il Giorno {day}
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: '10px' }}>

            {/* Superset header */}
            {group.type === 'superset' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ color: '#D95C1A', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>⚡ SUPERSERIE {group.label}</div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(217,92,26,0.3)' }} />
              </div>
            )}

            {group.exercises.map((ex) => (
              <div key={ex.idx} style={{
                background: group.type === 'superset' ? 'rgba(217,92,26,0.06)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${group.type === 'superset' ? 'rgba(217,92,26,0.2)' : 'rgba(255,255,255,0.07)'}`,
                borderLeft: group.type === 'superset' ? '2px solid #D95C1A' : undefined,
                borderRadius: '6px', padding: '12px 14px', marginBottom: '6px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: readOnly ? 0 : '10px' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                    {ex.name}
                  </div>
                  {!readOnly && (
                    <button onClick={() => removeExercise(day, ex.idx)} style={{ background: 'none', border: 'none', color: 'rgba(232,92,26,0.5)', fontSize: '16px', padding: '0 4px' }}>✕</button>
                  )}
                </div>
                {!readOnly && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {[['repsA','Sett.1-2'],['repsB','Sett.3-4'],['repsC','Sett.5-6']].map(([field, label]) => (
                      <div key={field}>
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', letterSpacing: '1px', marginBottom: '3px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</div>
                        <input value={ex[field]} onChange={e => updateReps(day, ex.idx, field, e.target.value)} style={repsInp} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Button to add more to this superset */}
            {!readOnly && group.type === 'superset' && (
              <button onClick={() => addToExistingSuperset(group.label)} style={{
                width: '100%', background: 'rgba(217,92,26,0.1)',
                border: '1px dashed rgba(217,92,26,0.4)',
                color: '#D95C1A', borderRadius: '6px', padding: '9px',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px',
                fontWeight: '700', letterSpacing: '1.5px', marginBottom: '4px'
              }}>
                ⚡ + AGGIUNGI A QUESTA SUPERSERIE
              </button>
            )}
          </div>
        ))}

        {/* Add buttons */}
        {!readOnly && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => { setActiveSuperset(null); setShowSearch(true) }}
              style={{ ...bigBtn, flex: 1, fontSize: '12px', padding: '12px', letterSpacing: '1px' }}>
              + ESERCIZIO
            </button>
            <button onClick={startNewSuperset}
              style={{ ...bigBtn, flex: 1, fontSize: '12px', padding: '12px', letterSpacing: '1px', background: 'rgba(217,92,26,0.15)', border: '1px solid rgba(217,92,26,0.4)', color: '#D95C1A' }}>
              ⚡ NUOVA SUPERSERIE
            </button>
          </div>
        )}

        {!readOnly && exList[day].length > 0 && (
          <button onClick={goBack} style={{ ...bigBtn, marginTop: '10px' }}>✓ SALVA E TORNA</button>
        )}
        <div style={{ height: '24px' }} />
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {activeSuperset && (
              <div style={{ color: '#D95C1A', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', marginBottom: '8px' }}>
                ⚡ Stai aggiungendo alla superserie {activeSuperset}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cerca esercizio..." style={{ ...inp, flex: 1 }} />
              <button onClick={() => { setShowSearch(false); setSearch(''); stopSuperset() }}
                style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', fontSize: '13px', whiteSpace: 'nowrap' }}>Annulla</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
            {search.length > 1 && filtered.length === 0 && (
              <button onClick={() => addNewExercise(search)} style={{ ...bigBtn, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(217,92,26,0.4)', color: '#D95C1A', marginBottom: '8px' }}>
                + AGGIUNGI "{search.toUpperCase()}" AL DATABASE
              </button>
            )}
            {filtered.map(ex => (
              <div key={ex.id} onClick={() => addExercise(ex)} style={{
                padding: '14px 16px', background: 'rgba(255,255,255,0.04)',
                borderRadius: '6px', marginBottom: '6px',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '600',
                color: '#fff', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.5px'
              }}>
                {ex.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px' }
const fieldLabel = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '14px 16px', color: '#fff', fontSize: '14px', outline: 'none' }
const repsInp = { width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '7px 6px', color: '#fff', fontSize: '12px', outline: 'none', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '600' }
const bigBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px' }
