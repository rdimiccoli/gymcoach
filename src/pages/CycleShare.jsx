import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const isCIR = g => g?.startsWith('CIR-')
const isSS = g => g?.startsWith('SS-')

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

export default function CycleShare({ navigate, goBack, goHome, params }) {
  const { cycleId, cycleName } = params
  const [days, setDays] = useState({ 1: [], 2: [], 3: [] })
  const [cycle, setCycle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState(1)
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
    }
    setLoading(false)
  }

  function generateText() {
    let text = `🏋️ SCHEDA: ${cycle?.name?.toUpperCase()}\n`
    text += `📅 ${cycle?.start_date ? new Date(cycle.start_date).toLocaleDateString('it-IT') : ''}\n\n`
    for (let d = 1; d <= 3; d++) {
      const groups = groupExercises(days[d])
      if (!groups.length) continue
      text += `━━━ GIORNO ${d} ━━━\n`
      groups.forEach(group => {
        if (group.type === 'circuit') {
          text += `\n🔄 CIRCUITO\n`
          group.exercises.forEach(ex => {
            text += `  • ${ex.exercises.name}  ⏱ ${ex.reps_a}  💤 ${ex.reps_b}  🔁 ${ex.reps_c} giri\n`
          })
        } else if (group.type === 'superset') {
          text += `\n⚡ SUPERSERIE\n`
          group.exercises.forEach(ex => {
            text += `  • ${ex.exercises.name}  ${ex.reps_a} / ${ex.reps_b} / ${ex.reps_c}\n`
          })
        } else {
          const ex = group.exercises[0]
          text += `• ${ex.exercises.name}  ${ex.reps_a} / ${ex.reps_b} / ${ex.reps_c}\n`
        }
      })
      text += '\n'
    }
    return text
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(generateText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = generateText()
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  async function shareText() {
    const text = generateText()
    if (navigator.share) {
      await navigator.share({ title: cycle?.name, text })
    } else {
      copyText()
    }
  }

  const groups = groupExercises(days[day])

  return (
    <div style={page}>
      <TopBar title="ANTEPRIMA SCHEDA" subtitle="Vista cliente" onBack={goBack} />

      {/* Share buttons */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={shareText} style={{ flex: 1, background: '#D95C1A', border: 'none', borderRadius: '4px', padding: '11px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
          📤 INVIA AL CLIENTE
        </button>
        <button onClick={copyText} style={{ flex: 1, background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '11px', color: copied ? '#22c55e' : 'rgba(255,255,255,0.5)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
          {copied ? '✓ COPIATO!' : '📋 COPIA TESTO'}
        </button>
      </div>

      {/* Day selector */}
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
        {/* Cycle header */}
        <div style={{ background: 'rgba(217,92,26,0.08)', border: '1px solid rgba(217,92,26,0.2)', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px' }}>{cycle?.name}</div>
          {cycle?.start_date && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>Dal {new Date(cycle.start_date).toLocaleDateString('it-IT')}</div>}
        </div>

        {loading && <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '32px' }}>Caricamento...</div>}

        {groups.map((group, gi) => {
          const isCircuit = group.type === 'circuit'
          const isSuperSet = group.type === 'superset'
          const accent = isCircuit ? '#3b82f6' : '#D95C1A'
          return (
            <div key={gi} style={{ marginBottom: '10px' }}>
              {(isCircuit || isSuperSet) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ color: accent, fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {isCircuit ? '🔄 CIRCUITO' : '⚡ SUPERSERIE'}
                  </div>
                  <div style={{ flex: 1, height: '1px', background: `${accent}44` }} />
                </div>
              )}
              {group.exercises.map((ex, ei) => (
                <div key={ei} style={{
                  background: isCircuit ? 'rgba(59,130,246,0.05)' : isSuperSet ? 'rgba(217,92,26,0.05)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isCircuit ? 'rgba(59,130,246,0.2)' : isSuperSet ? 'rgba(217,92,26,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderLeft: (isCircuit || isSuperSet) ? `2px solid ${accent}` : undefined,
                  borderRadius: '6px', padding: '12px 14px', marginBottom: '6px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                    {ex.exercises.name}
                  </div>
                  {isCircuit ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: 'rgba(59,130,246,0.7)', fontSize: '8px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px' }}>DURATA</div>
                          <div style={{ color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{ex.reps_a}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: 'rgba(59,130,246,0.7)', fontSize: '8px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px' }}>RIPOSO</div>
                          <div style={{ color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{ex.reps_b}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: 'rgba(59,130,246,0.7)', fontSize: '8px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px' }}>GIRI</div>
                          <div style={{ color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{ex.reps_c}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[['S.1-2', ex.reps_a], ['S.3-4', ex.reps_b], ['S.5-6', ex.reps_c]].map(([label, val]) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '8px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px' }}>{label}</div>
                          <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {!loading && groups.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px', textAlign: 'center', padding: '32px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }}>
            Nessun esercizio per il Giorno {day}
          </div>
        )}
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
