import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

// Group type helpers
const isSS = g => g?.startsWith('SS-')
const isCIR = g => g?.startsWith('CIR-')
const getType = g => !g ? 'single' : isSS(g) ? 'superset' : isCIR(g) ? 'circuit' : 'single'

export default function CycleForm({ navigate, goBack, goHome, params }) {
  const { turnId, cycleId, cloneFromId, readOnly } = params
  const [step, setStep] = useState('info')
  const [cycleName, setCycleName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [day, setDay] = useState(1)
  const [exList, setExList] = useState({ 1: [], 2: [], 3: [] })
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [activeGroup, setActiveGroup] = useState(null) // { label, type }
  const [currentCycleId, setCurrentCycleId] = useState(cycleId || null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!cycleId)
  const [cloneInfo, setCloneInfo] = useState(null) // preview of source cycle

  // Circuit config modal
  const [circuitModal, setCircuitModal] = useState(null) // { exIdx }

  // Drag state
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const rowRefs = useRef({})

  useEffect(() => {
    loadExercises()
    if (cycleId) loadExistingCycle()
    if (cloneFromId) loadClonePreview()
  }, [])

  async function loadExercises() {
    const { data } = await supabase.from('exercises').select('*').order('name')
    setAllExercises(data || [])
  }

  async function loadClonePreview() {
    const { data } = await supabase.from('cycles').select('name').eq('id', cloneFromId).single()
    setCloneInfo(data)
  }

  async function loadExistingCycle() {
    const { data: cycle } = await supabase.from('cycles').select('*').eq('id', cycleId).single()
    if (cycle) { setCycleName(cycle.name); setStartDate(cycle.start_date || new Date().toISOString().split('T')[0]) }
    const { data: exData } = await supabase.from('cycle_exercises').select('*, exercises(name)').eq('cycle_id', cycleId).order('sort_order')
    if (exData) {
      const map = { 1: [], 2: [], 3: [] }
      exData.forEach(e => {
        map[e.day].push({
          id: e.id, exerciseId: e.exercise_id, name: e.exercises.name,
          repsA: e.reps_a, repsB: e.reps_b, repsC: e.reps_c,
          supersetGroup: e.superset_group || null
        })
      })
      setExList(map)
    }
    setLoading(false)
    setStep('exercises')
  }

  async function cloneExercises(newCycleId, sourceCycleId) {
    const { data: srcEx } = await supabase.from('cycle_exercises').select('*, exercises(name)')
      .eq('cycle_id', sourceCycleId).order('sort_order')
    if (!srcEx?.length) return
    const map = { 1: [], 2: [], 3: [] }
    const inserts = srcEx.map((e, i) => ({
      cycle_id: newCycleId, exercise_id: e.exercise_id, day: e.day,
      reps_a: e.reps_a, reps_b: e.reps_b, reps_c: e.reps_c,
      sort_order: e.sort_order ?? i, superset_group: e.superset_group || null
    }))
    const { data: inserted } = await supabase.from('cycle_exercises').insert(inserts).select('*, exercises(name)')
    inserted?.forEach(e => {
      map[e.day].push({
        id: e.id, exerciseId: e.exercise_id, name: e.exercises.name,
        repsA: e.reps_a, repsB: e.reps_b, repsC: e.reps_c,
        supersetGroup: e.superset_group || null
      })
    })
    setExList(map)
  }

  async function createCycle() {
    if (!cycleName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('cycles').insert({
      turn_id: turnId, name: cycleName, start_date: startDate, is_active: true
    }).select().single()
    setCurrentCycleId(data.id)
    if (cloneFromId) await cloneExercises(data.id, cloneFromId)
    setSaving(false)
    setStep('exercises')
  }

  function generateLabel(prefix) {
    const existing = new Set(
      Object.values(exList).flat().map(e => e.supersetGroup).filter(Boolean)
    )
    for (const l of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      if (!existing.has(`${prefix}-${l}`)) return `${prefix}-${l}`
    }
    return `${prefix}-${Date.now()}`
  }

  async function addExercise(ex) {
    const supersetGroup = activeGroup?.label || null
    const isCircuit = activeGroup?.type === 'circuit'
    const newEx = {
      exerciseId: ex.id, name: ex.name,
      repsA: isCircuit ? '30s' : '3x8',
      repsB: isCircuit ? '15s' : '3x10',
      repsC: isCircuit ? '3' : '3x12',
      supersetGroup
    }
    if (currentCycleId) {
      const { data } = await supabase.from('cycle_exercises').insert({
        cycle_id: currentCycleId, exercise_id: ex.id, day,
        reps_a: newEx.repsA, reps_b: newEx.repsB, reps_c: newEx.repsC,
        sort_order: exList[day].length, superset_group: supersetGroup
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

  async function updateReps(d, idx, field, val) {
    const ex = exList[d][idx]
    const updated = { ...ex, [field]: val }
    setExList(prev => ({ ...prev, [d]: prev[d].map((e, i) => i === idx ? updated : e) }))
    if (ex.id) await supabase.from('cycle_exercises').update({ reps_a: updated.repsA, reps_b: updated.repsB, reps_c: updated.repsC }).eq('id', ex.id)
  }

  async function removeExercise(d, idx) {
    const ex = exList[d][idx]
    if (ex.id) await supabase.from('cycle_exercises').delete().eq('id', ex.id)
    setExList(prev => ({ ...prev, [d]: prev[d].filter((_, i) => i !== idx) }))
  }

  // Drag & Drop
  const getIndexFromY = useCallback((y) => {
    const list = exList[day]
    for (let i = 0; i < list.length; i++) {
      const el = rowRefs.current[i]
      if (!el) continue
      if (y < el.getBoundingClientRect().bottom) return i
    }
    return list.length - 1
  }, [exList, day])

  function onDragStart(e, idx) {
    e.stopPropagation()
    setDraggingIdx(idx); setDragOverIdx(idx)
  }
  function onDragMove(e) {
    e.preventDefault()
    setDragOverIdx(getIndexFromY(e.touches[0].clientY))
  }
  async function onDragEnd() {
    if (draggingIdx === null || dragOverIdx === null || draggingIdx === dragOverIdx) {
      setDraggingIdx(null); setDragOverIdx(null); return
    }
    const newList = [...exList[day]]
    const [moved] = newList.splice(draggingIdx, 1)
    newList.splice(dragOverIdx, 0, moved)
    setExList(prev => ({ ...prev, [day]: newList }))
    await Promise.all(newList.map((ex, i) => ex.id ? supabase.from('cycle_exercises').update({ sort_order: i }).eq('id', ex.id) : null))
    setDraggingIdx(null); setDragOverIdx(null)
  }

  function getGroups() {
    const groups = [], seen = {}
    exList[day].forEach((ex, idx) => {
      const sg = ex.supersetGroup
      const type = getType(sg)
      if (type === 'single') {
        groups.push({ type: 'single', exercises: [{ ...ex, idx }] })
      } else {
        if (!seen[sg]) { seen[sg] = { type, label: sg, exercises: [] }; groups.push(seen[sg]) }
        seen[sg].exercises.push({ ...ex, idx })
      }
    })
    return groups
  }

  const filtered = allExercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  // ── CIRCUIT LABEL for display ─────────────────────────────────────────────
  const CircuitHeader = ({ group }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <div style={{ color: '#3b82f6', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>
        🔄 CIRCUITO {group.label.replace('CIR-', '')}
      </div>
      <div style={{ flex: 1, height: '1px', background: 'rgba(59,130,246,0.3)' }} />
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a' }}>
      <div style={{ color: '#D95C1A', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', letterSpacing: '2px' }}>CARICAMENTO...</div>
    </div>
  )

  // ── STEP INFO ─────────────────────────────────────────────────────────────
  if (step === 'info') return (
    <div style={page}>
      <TopBar title="NUOVA SCHEDA" subtitle="Informazioni base" onBack={goBack} />
      <div style={scroll}>
        {cloneInfo && (
          <div style={{ background: 'rgba(217,92,26,0.08)', border: '1px solid rgba(217,92,26,0.25)', borderRadius: '6px', padding: '12px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📋</span>
            <div>
              <div style={{ color: '#D95C1A', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>CLONANDO DA</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '1px' }}>{cloneInfo.name}</div>
            </div>
          </div>
        )}
        <div style={fieldLabel}>NOME SCHEDA</div>
        <input value={cycleName} onChange={e => setCycleName(e.target.value)} placeholder="es. 4a Scheda Maggio 2026" style={inp} />
        <div style={{ ...fieldLabel, marginTop: '16px' }}>DATA DI INIZIO</div>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
        <button onClick={createCycle} disabled={!cycleName.trim() || saving}
          style={{ ...bigBtn, marginTop: '28px', opacity: !cycleName.trim() ? 0.3 : 1 }}>
          {saving ? (cloneFromId ? 'CLONO...' : 'CREAZIONE...') : (cloneFromId ? '📋 CLONA E INIZIA' : 'AVANTI → INSERISCI ESERCIZI')}
        </button>
      </div>
      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── STEP EXERCISES ────────────────────────────────────────────────────────
  const groups = getGroups()

  return (
    <div style={{ ...page, position: 'relative' }}>
      <TopBar title={cycleName.toUpperCase()} subtitle={readOnly ? 'Sola lettura' : 'Gestione esercizi'} onBack={goBack} />

      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[1,2,3].map(d => (
          <button key={d} onClick={() => { setDay(d); setActiveGroup(null) }} style={{
            flex: 1, padding: '9px', borderRadius: '4px', border: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px',
            background: day === d ? '#D95C1A' : 'rgba(255,255,255,0.05)',
            color: day === d ? '#fff' : 'rgba(255,255,255,0.3)'
          }}>GIORNO {d}</button>
        ))}
      </div>

      {!readOnly && exList[day].length > 1 && (
        <div style={{ padding: '5px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', textAlign: 'center' }}>
            ⠿ TIENI PREMUTO E TRASCINA PER RIORDINARE
          </div>
        </div>
      )}

      <div style={scroll}>
        {groups.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px', textAlign: 'center', padding: '32px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px', marginBottom: '12px' }}>
            Nessun esercizio per il Giorno {day}
          </div>
        )}

        {groups.map((group, gi) => {
          const isCircuit = group.type === 'circuit'
          const isSuperSet = group.type === 'superset'
          const borderColor = isCircuit ? 'rgba(59,130,246,0.2)' : isSuperSet ? 'rgba(217,92,26,0.2)' : 'rgba(255,255,255,0.07)'
          const bgColor = isCircuit ? 'rgba(59,130,246,0.06)' : isSuperSet ? 'rgba(217,92,26,0.06)' : 'rgba(255,255,255,0.04)'
          const accentColor = isCircuit ? '#3b82f6' : '#D95C1A'

          return (
            <div key={gi} style={{ marginBottom: '10px' }}>
              {isSuperSet && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ color: '#D95C1A', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>⚡ SUPERSERIE {group.label.replace('SS-','')}</div>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(217,92,26,0.3)' }} />
                </div>
              )}
              {isCircuit && <CircuitHeader group={group} />}

              {group.exercises.map((ex) => {
                const isDragging = draggingIdx === ex.idx
                const isOver = dragOverIdx === ex.idx && draggingIdx !== ex.idx
                return (
                  <div key={ex.idx} ref={el => rowRefs.current[ex.idx] = el}
                    style={{
                      background: isDragging ? `rgba(${isCircuit ? '59,130,246' : '217,92,26'},0.15)` : bgColor,
                      border: isOver ? `2px dashed ${accentColor}` : `1px solid ${borderColor}`,
                      borderLeft: !isOver && group.type !== 'single' ? `2px solid ${accentColor}` : undefined,
                      borderRadius: '6px', padding: '12px 14px', marginBottom: '6px',
                      opacity: isDragging ? 0.5 : 1, transition: 'border 0.1s', touchAction: 'none',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: readOnly ? 0 : '10px' }}>
                      {!readOnly && (
                        <div onTouchStart={e => onDragStart(e, ex.idx)} onTouchMove={onDragMove} onTouchEnd={onDragEnd}
                          style={{ fontSize: '20px', color: 'rgba(255,255,255,0.2)', cursor: 'grab', padding: '0 2px', userSelect: 'none', flexShrink: 0 }}>⠿</div>
                      )}
                      <div style={{ flex: 1, fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>{ex.name}</div>
                      {!readOnly && (
                        <button onClick={() => removeExercise(day, ex.idx)} style={{ background: 'none', border: 'none', color: 'rgba(232,92,26,0.5)', fontSize: '16px', padding: '0 4px' }}>✕</button>
                      )}
                    </div>

                    {!readOnly && (
                      isCircuit ? (
                        // Circuit exercise: durata / riposo / giri
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                          {[['repsA','DURATA'],['repsB','RIPOSO'],['repsC','GIRI']].map(([field, label]) => (
                            <div key={field}>
                              <div style={{ color: 'rgba(59,130,246,0.7)', fontSize: '9px', letterSpacing: '1px', marginBottom: '3px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</div>
                              <input value={ex[field]} onChange={e => updateReps(day, ex.idx, field, e.target.value)} style={{ ...repsInp, borderColor: 'rgba(59,130,246,0.2)' }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Normal / superset: sett 1-2 / 3-4 / 5-6
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                          {[['repsA','SETT.1-2'],['repsB','SETT.3-4'],['repsC','SETT.5-6']].map(([field, label]) => (
                            <div key={field}>
                              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', letterSpacing: '1px', marginBottom: '3px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif' }}>{label}</div>
                              <input value={ex[field]} onChange={e => updateReps(day, ex.idx, field, e.target.value)} style={repsInp} />
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )
              })}

              {/* Add to existing group */}
              {!readOnly && group.type !== 'single' && (
                <button onClick={() => { setActiveGroup({ label: group.label, type: group.type }); setShowSearch(true) }}
                  style={{
                    width: '100%', borderRadius: '6px', padding: '9px', marginBottom: '4px',
                    fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700', letterSpacing: '1.5px',
                    background: isCircuit ? 'rgba(59,130,246,0.08)' : 'rgba(217,92,26,0.08)',
                    border: `1px dashed ${isCircuit ? 'rgba(59,130,246,0.35)' : 'rgba(217,92,26,0.35)'}`,
                    color: accentColor,
                  }}>
                  {isCircuit ? '🔄' : '⚡'} + AGGIUNGI A {group.label.replace('SS-','').replace('CIR-','')}
                </button>
              )}
            </div>
          )
        })}

        {!readOnly && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px', marginTop: '8px' }}>
            <button onClick={() => { setActiveGroup(null); setShowSearch(true) }}
              style={{ ...bigBtn, fontSize: '11px', padding: '11px 6px', letterSpacing: '0.5px' }}>
              + ESERCIZIO
            </button>
            <button onClick={() => { setActiveGroup({ label: generateLabel('SS'), type: 'superset' }); setShowSearch(true) }}
              style={{ ...bigBtn, fontSize: '11px', padding: '11px 6px', letterSpacing: '0.5px', background: 'rgba(217,92,26,0.12)', border: '1px solid rgba(217,92,26,0.35)', color: '#D95C1A' }}>
              ⚡ SUPERSERIE
            </button>
            <button onClick={() => { setActiveGroup({ label: generateLabel('CIR'), type: 'circuit' }); setShowSearch(true) }}
              style={{ ...bigBtn, fontSize: '11px', padding: '11px 6px', letterSpacing: '0.5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.35)', color: '#3b82f6' }}>
              🔄 CIRCUITO
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
            {activeGroup && (
              <div style={{ color: activeGroup.type === 'circuit' ? '#3b82f6' : '#D95C1A', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', marginBottom: '8px', fontWeight: '700' }}>
                {activeGroup.type === 'circuit' ? '🔄 CIRCUITO' : '⚡ SUPERSERIE'} {activeGroup.label.replace('SS-','').replace('CIR-','')}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cerca esercizio..." style={{ ...inp, flex: 1 }} />
              <button onClick={() => { setShowSearch(false); setSearch(''); setActiveGroup(null) }}
                style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', fontSize: '13px', whiteSpace: 'nowrap' }}>Annulla</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
            {search.length > 1 && filtered.length === 0 && (
              <button onClick={() => addNewExercise(search)} style={{ ...bigBtn, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(217,92,26,0.4)', color: '#D95C1A', marginBottom: '8px' }}>
                + AGGIUNGI "{search.toUpperCase()}"
              </button>
            )}
            {filtered.map(ex => (
              <div key={ex.id} onClick={() => addExercise(ex)} style={{
                padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', marginBottom: '6px',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '600', color: '#fff',
                cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.5px'
              }}>{ex.name}</div>
            ))}
          </div>
        </div>
      )}

      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px' }
const fieldLabel = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '14px 16px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
const repsInp = { width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '7px 6px', color: '#fff', fontSize: '12px', outline: 'none', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '600' }
const bigBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px', cursor: 'pointer' }
