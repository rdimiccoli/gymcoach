import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const WEEK_LABEL = w => w <= 2 ? 'Sett. 1–2' : w <= 4 ? 'Sett. 3–4' : 'Sett. 5–6'

export default function AthleteProfile({ navigate, goBack, goHome, params }) {
  const { client } = params
  const [history, setHistory] = useState([]) // [{ exerciseName, entries: [{ cycleName, date, week, kg }] }]
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    // Get all loads for this client
    const { data: loads } = await supabase
      .from('client_loads')
      .select('kg, week, cycle_exercise_id')
      .eq('client_id', client.id)
      .gt('kg', 0)

    if (!loads?.length) { setLoading(false); return }

    // Get all cycle_exercises involved
    const exIds = [...new Set(loads.map(l => l.cycle_exercise_id))]
    const { data: cycleExercises } = await supabase
      .from('cycle_exercises')
      .select('id, cycle_id, exercises(name)')
      .in('id', exIds)

    // Get all cycles involved
    const cycleIds = [...new Set(cycleExercises.map(e => e.cycle_id))]
    const { data: cycles } = await supabase
      .from('cycles')
      .select('id, name, start_date')
      .in('id', cycleIds)

    // Build lookup maps
    const exMap = {}
    cycleExercises.forEach(e => { exMap[e.id] = { name: e.exercises.name, cycleId: e.cycle_id } })
    const cycleMap = {}
    cycles.forEach(c => { cycleMap[c.id] = c })

    // Group by exercise name
    const byExercise = {}
    loads.forEach(load => {
      const ex = exMap[load.cycle_exercise_id]
      if (!ex) return
      const cycle = cycleMap[ex.cycleId]
      if (!cycle) return
      if (!byExercise[ex.name]) byExercise[ex.name] = []
      byExercise[ex.name].push({
        cycleName: cycle.name,
        date: cycle.start_date,
        week: load.week,
        kg: load.kg,
        // sort key: date + week
        sortKey: `${cycle.start_date || '0000'}_${String(load.week).padStart(2,'0')}`
      })
    })

    // Sort each exercise's entries by date desc
    const result = Object.entries(byExercise)
      .map(([name, entries]) => ({
        name,
        entries: entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey)),
        best: Math.max(...entries.map(e => e.kg))
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    setHistory(result)
    // Auto-expand first exercise
    if (result.length > 0) setExpanded({ [result[0].name]: true })
    setLoading(false)
  }

  return (
    <div style={page}>
      <TopBar
        title={`${client.surname} ${client.name}`.toUpperCase()}
        subtitle="Storico carichi"
        onBack={goBack}
      />

      <div style={scroll}>
        {loading && (
          <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '40px', fontSize: '13px' }}>
            Caricamento storico...
          </div>
        )}

        {!loading && history.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.15)', textAlign: 'center', padding: '40px', fontSize: '13px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '8px' }}>
            Nessun carico registrato ancora per questo atleta.
          </div>
        )}

        {!loading && history.length > 0 && (
          <>
            {/* Summary bar */}
            <div style={{ background: 'rgba(217,92,26,0.08)', border: '1px solid rgba(217,92,26,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '20px' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif' }}>ESERCIZI TRACCIATI</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '900', color: '#fff' }}>{history.length}</div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif' }}>SESSIONI TOTALI</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '900', color: '#fff' }}>
                  {history.reduce((sum, ex) => sum + ex.entries.length, 0)}
                </div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif' }}>SETTIMANA ATT.</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '900', color: '#D95C1A' }}>{client.current_week}</div>
              </div>
            </div>

            {/* Exercise list */}
            {history.map(ex => {
              const isOpen = expanded[ex.name]
              const latest = ex.entries[0]
              const prev = ex.entries[1]
              const trend = prev ? parseFloat((latest.kg - prev.kg).toFixed(2)) : null
              return (
                <div key={ex.name} style={{ marginBottom: '8px' }}>
                  {/* Header — always visible */}
                  <div
                    onClick={() => setExpanded(e => ({ ...e, [ex.name]: !e[ex.name] }))}
                    style={{
                      background: isOpen ? 'rgba(217,92,26,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isOpen ? 'rgba(217,92,26,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: isOpen ? '6px 6px 0 0' : '6px',
                      padding: '12px 14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      cursor: 'pointer',
                    }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                        {ex.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                        {/* Latest load */}
                        <span style={{ color: '#D95C1A', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>
                          {latest.kg}kg
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                          {WEEK_LABEL(latest.week)}
                        </span>
                        {/* Trend */}
                        {trend !== null && (
                          <span style={{ fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', color: trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : 'rgba(255,255,255,0.2)' }}>
                            {trend > 0 ? `↑ +${trend}kg` : trend < 0 ? `↓ ${trend}kg` : '='}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px' }}>BEST</div>
                        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>{ex.best}kg</div>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px' }}>{isOpen ? '∨' : '›'}</div>
                    </div>
                  </div>

                  {/* History entries */}
                  {isOpen && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(217,92,26,0.15)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                      {ex.entries.map((entry, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px',
                          borderBottom: i < ex.entries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          background: i === 0 ? 'rgba(217,92,26,0.05)' : 'transparent'
                        }}>
                          <div>
                            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '600', color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)', letterSpacing: '0.3px' }}>
                              {entry.cycleName}
                              {i === 0 && <span style={{ marginLeft: '6px', color: '#D95C1A', fontSize: '9px', fontWeight: '700', letterSpacing: '1px' }}>ULTIMO</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                {WEEK_LABEL(entry.week)}
                              </span>
                              {entry.date && (
                                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                  {new Date(entry.date).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: i === 0 ? '#D95C1A' : 'rgba(255,255,255,0.4)' }}>
                              {entry.kg}<span style={{ fontSize: '12px', fontWeight: '400' }}>kg</span>
                            </div>
                            {/* Delta vs previous entry */}
                            {i < ex.entries.length - 1 && (() => {
                              const delta = parseFloat((entry.kg - ex.entries[i+1].kg).toFixed(2))
                              return delta !== 0 ? (
                                <div style={{ color: delta > 0 ? '#22c55e' : '#ef4444', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700' }}>
                                  {delta > 0 ? `+${delta}` : delta}kg
                                </div>
                              ) : null
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
        <div style={{ height: '24px' }} />
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
