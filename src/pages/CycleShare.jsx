import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const isCIR = g => g?.startsWith('CIR-')

function groupExercises(exercises) {
  const groups = [], seen = {}
  exercises.forEach(ex => {
    const sg = ex.superset_group
    if (!sg) {
      groups.push({ type: 'single', exercises: [ex] })
    } else {
      const type = isCIR(sg) ? 'circuit' : 'superset'
      if (!seen[sg]) { seen[sg] = { type, label: sg, exercises: [] }; groups.push(seen[sg]) }
      seen[sg].exercises.push(ex)
    }
  })
  return groups
}

const WEEK_RANGES = [
  { label: 'SETT. 1–2', repsField: 'reps_a', weeks: [1, 2] },
  { label: 'SETT. 3–4', repsField: 'reps_b', weeks: [3, 4] },
  { label: 'SETT. 5–6', repsField: 'reps_c', weeks: [5, 6] },
]

export default function CycleShare({ navigate, goBack, goHome, params }) {
  const { cycleId } = params
  const [days, setDays] = useState({ 1: [], 2: [], 3: [] })
  const [cycle, setCycle] = useState(null)
  const [clients, setClients] = useState([])
  const [loads, setLoads] = useState({}) // key: clientId_exId_week → kg
  const [loading, setLoading] = useState(true)

  // Selection state
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedWeekRange, setSelectedWeekRange] = useState(0) // index 0,1,2
  const [copied, setCopied] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: c } = await supabase.from('cycles').select('*').eq('id', cycleId).single()
    setCycle(c)

    const { data: ex } = await supabase.from('cycle_exercises')
      .select('*, exercises(name)').eq('cycle_id', cycleId).order('sort_order')
    if (ex) {
      const map = { 1: [], 2: [], 3: [] }
      ex.forEach(e => map[e.day].push(e))
      setDays(map)

      // Load clients of this turn
      const { data: cl } = await supabase.from('clients').select('*')
        .eq('turn_id', c.turn_id).eq('is_active', true).order('surname')
      setClients(cl || [])

      // Load all loads for all clients for this cycle
      if (cl?.length && ex?.length) {
        const exIds = ex.map(e => e.id)
        const clIds = cl.map(c => c.id)
        const { data: loadData } = await supabase.from('client_loads').select('*')
          .in('client_id', clIds).in('cycle_exercise_id', exIds)
        const loadMap = {}
        loadData?.forEach(l => {
          loadMap[`${l.client_id}_${l.cycle_exercise_id}_${l.week}`] = l.kg
        })
        setLoads(loadMap)
      }
    }
    setLoading(false)
  }

  function getRepsForRange(ex, rangeIdx) {
    return [ex.reps_a, ex.reps_b, ex.reps_c][rangeIdx]
  }

  function getLoadForRange(clientId, exId, rangeIdx) {
    const weeks = WEEK_RANGES[rangeIdx].weeks
    // Get the most recent load within those weeks
    for (let w = weeks[1]; w >= weeks[0]; w--) {
      const kg = loads[`${clientId}_${exId}_${w}`]
      if (kg > 0) return kg
    }
    return null
  }

  function generateText() {
    if (!selectedClient || !cycle) return ''
    const client = clients.find(c => c.id === selectedClient)
    const weekRange = WEEK_RANGES[selectedWeekRange]

    let text = `🏋️ *${cycle.name.toUpperCase()}*\n`
    text += `👤 ${client.name} ${client.surname}\n`
    text += `📅 ${weekRange.label}\n`
    text += `━━━━━━━━━━━━━━━━━━━\n\n`

    for (let d = 1; d <= 3; d++) {
      const groups = groupExercises(days[d])
      if (!groups.length) continue
      text += `📌 *GIORNO ${d}*\n`
      groups.forEach(group => {
        if (group.type === 'circuit') {
          text += `\n🔄 CIRCUITO\n`
          group.exercises.forEach(ex => {
            text += `  • ${ex?.exercises?.name}\n`
            text += `    ⏱ ${ex.reps_a}  💤 ${ex.reps_b}  🔁 ${ex.reps_c} giri\n`
          })
        } else if (group.type === 'superset') {
          text += `\n⚡ SUPERSERIE\n`
          group.exercises.forEach(ex => {
            const reps = getRepsForRange(ex, selectedWeekRange)
            const kg = getLoadForRange(selectedClient, ex.id, selectedWeekRange)
            text += `  • ${ex?.exercises?.name}  ${reps}`
            if (kg) text += `  ➜ *${kg}kg*`
            text += `\n`
          })
        } else {
          const ex = group.exercises[0]
          const reps = getRepsForRange(ex, selectedWeekRange)
          const kg = getLoadForRange(selectedClient, ex.id, selectedWeekRange)
          text += `• ${ex?.exercises?.name}  ${reps}`
          if (kg) text += `  ➜ *${kg}kg*`
          text += `\n`
        }
      })
      text += '\n'
    }
    return text
  }

  async function shareText() {
    const text = generateText()
    if (!text) return
    if (navigator.share) {
      await navigator.share({ title: cycle?.name, text })
    } else {
      copyText()
    }
  }

  async function copyText() {
    const text = generateText()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Preview for selected day
  const [previewDay, setPreviewDay] = useState(1)
  const previewGroups = groupExercises(days[previewDay])

  return (
    <div style={page}>
      <TopBar title="CONDIVIDI SCHEDA" subtitle="Seleziona cliente e settimana" onBack={goBack} />

      <div style={scroll}>
        {loading && <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '32px' }}>Caricamento...</div>}

        {!loading && (
          <>
            {/* Step 1 — Select client */}
            <div style={stepLabel}>1 · SELEZIONA CLIENTE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
              {clients.map(client => (
                <button key={client.id} onClick={() => setSelectedClient(client.id)}
                  style={{
                    padding: '12px 16px', borderRadius: '6px', border: `1px solid ${selectedClient === client.id ? 'rgba(217,92,26,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: selectedClient === client.id ? 'rgba(217,92,26,0.12)' : 'rgba(255,255,255,0.03)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                  }}>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                    {client.surname} {client.name}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif' }}>Sett. {client.current_week}</span>
                  {selectedClient === client.id && <span style={{ color: '#D95C1A', fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>

            {/* Step 2 — Select week range */}
            <div style={stepLabel}>2 · SELEZIONA SETTIMANE</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {WEEK_RANGES.map((wr, i) => (
                <button key={i} onClick={() => setSelectedWeekRange(i)} style={{
                  flex: 1, padding: '11px 6px', borderRadius: '4px',
                  border: `1px solid ${selectedWeekRange === i ? 'rgba(217,92,26,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: selectedWeekRange === i ? 'rgba(217,92,26,0.15)' : 'rgba(255,255,255,0.03)',
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px',
                  color: selectedWeekRange === i ? '#D95C1A' : 'rgba(255,255,255,0.4)', cursor: 'pointer'
                }}>{wr.label}</button>
              ))}
            </div>

            {/* Step 3 — Preview */}
            {selectedClient && (
              <>
                <div style={stepLabel}>3 · ANTEPRIMA</div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                  {/* Client + week header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '900', color: '#fff' }}>
                        {clients.find(c => c.id === selectedClient)?.surname} {clients.find(c => c.id === selectedClient)?.name}
                      </div>
                      <div style={{ color: '#D95C1A', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{WEEK_RANGES[selectedWeekRange].label}</div>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>{cycle?.name}</div>
                  </div>

                  {/* Day tabs */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                    {[1,2,3].map(d => (
                      <button key={d} onClick={() => setPreviewDay(d)} style={{
                        flex: 1, padding: '7px', borderRadius: '4px', border: 'none',
                        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700',
                        background: previewDay === d ? '#D95C1A' : 'rgba(255,255,255,0.06)',
                        color: previewDay === d ? '#fff' : 'rgba(255,255,255,0.3)'
                      }}>G{d}</button>
                    ))}
                  </div>

                  {/* Exercises preview */}
                  {previewGroups.map((group, gi) => {
                    const isCircuit = group.type === 'circuit'
                    const isSuperSet = group.type === 'superset'
                    const accent = isCircuit ? '#3b82f6' : '#D95C1A'
                    return (
                      <div key={gi} style={{ marginBottom: '8px' }}>
                        {(isCircuit || isSuperSet) && (
                          <div style={{ color: accent, fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1.5px', marginBottom: '4px' }}>
                            {isCircuit ? '🔄 CIRCUITO' : '⚡ SUPERSERIE'}
                          </div>
                        )}
                        {group.exercises.map((ex, ei) => {
                          const reps = isCircuit ? `${ex.reps_a} · ${ex.reps_b} · ${ex.reps_c}g` : getRepsForRange(ex, selectedWeekRange)
                          const kg = isCircuit ? null : getLoadForRange(selectedClient, ex.id, selectedWeekRange)
                          return (
                            <div key={ei} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '8px 10px', marginBottom: '4px', borderRadius: '4px',
                              background: isCircuit ? 'rgba(59,130,246,0.06)' : isSuperSet ? 'rgba(217,92,26,0.06)' : 'rgba(255,255,255,0.03)',
                              borderLeft: (isCircuit || isSuperSet) ? `2px solid ${accent}` : undefined,
                            }}>
                              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '600', color: '#fff' }}>{ex?.exercises?.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif' }}>{reps}</span>
                                {kg && (
                                  <span style={{ background: 'rgba(217,92,26,0.2)', border: '1px solid rgba(217,92,26,0.4)', borderRadius: '3px', padding: '2px 8px', color: '#D95C1A', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>
                                    {kg}kg
                                  </span>
                                )}
                                {!kg && !isCircuit && (
                                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif' }}>— kg</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                  {previewGroups.length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', textAlign: 'center', padding: '12px' }}>Nessun esercizio per il Giorno {previewDay}</div>
                  )}
                </div>

                {/* Send buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={shareText} style={{ flex: 2, background: '#D95C1A', border: 'none', borderRadius: '4px', padding: '14px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px' }}>
                    📤 INVIA SU WHATSAPP
                  </button>
                  <button onClick={copyText} style={{ flex: 1, background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '14px', color: copied ? '#22c55e' : 'rgba(255,255,255,0.5)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700' }}>
                    {copied ? '✓ OK!' : '📋 COPIA'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        <div style={{ height: '24px' }} />
      </div>
      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const stepLabel = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '10px', textTransform: 'uppercase' }
