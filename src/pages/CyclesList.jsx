import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function CyclesList({ navigate, goHome, session }) {
  const [turns, setTurns] = useState([])
  const [cyclesByTurn, setCyclesByTurn] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time')
    setTurns(t || [])
    if (t?.length) {
      const map = {}
      await Promise.all(t.map(async turn => {
        const { data: c } = await supabase.from('cycles').select('*').eq('turn_id', turn.id).order('created_at', { ascending: false })
        map[turn.id] = c || []
      }))
      setCyclesByTurn(map)
    }
    setLoading(false)
  }

  async function newCycle(turnId) {
    await supabase.from('cycles').update({ is_active: false }).eq('turn_id', turnId).eq('is_active', true)
    navigate('cycle-form', { turnId })
  }

  async function deleteCycle(cycle, e) {
    e.stopPropagation()
    const msg = cycle.is_active
      ? 'Questo è il ciclo ATTIVO. Eliminarlo rimuoverà anche tutti i carichi registrati. Continuare?'
      : 'Eliminare questo ciclo e tutti i suoi dati storici?'
    if (!window.confirm(msg)) return

    // Get exercise IDs for this cycle
    const { data: exData } = await supabase.from('cycle_exercises').select('id').eq('cycle_id', cycle.id)
    const exIds = exData?.map(e => e.id) || []

    // Delete loads, notes, exercises, then cycle
    if (exIds.length) {
      await supabase.from('client_loads').delete().in('cycle_exercise_id', exIds)
      await supabase.from('client_notes').delete().in('cycle_exercise_id', exIds)
      await supabase.from('cycle_exercises').delete().eq('cycle_id', cycle.id)
    }
    await supabase.from('cycles').delete().eq('id', cycle.id)
    await loadData()
  }

  return (
    <div style={page}>
      <TopBar title="CICLI" subtitle="Storico e gestione" />
      <div style={scroll}>
        {loading && (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', textAlign: 'center', padding: '32px' }}>
            Caricamento...
          </div>
        )}

        {/* Explanation banner */}
        {!loading && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '12px 14px', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.5px', marginBottom: '4px' }}>COME FUNZIONA</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', lineHeight: 1.5 }}>
              Ogni ciclo è un programma completo da 6 settimane con i suoi esercizi. Le 3 fasi in home (sett. 1-2 / 3-4 / 5-6) sono le parti dello stesso ciclo. Crea un nuovo ciclo ogni volta che cambia il programma.
            </div>
          </div>
        )}

        {turns.map(turn => (
          <div key={turn.id} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={sectionLabel}>{turn.name}</div>
              <button onClick={() => newCycle(turn.id)} style={orangeSmall}>+ NUOVO CICLO</button>
            </div>

            {(cyclesByTurn[turn.id] || []).map(cycle => (
              <div key={cycle.id} style={{
                background: cycle.is_active ? 'rgba(217,92,26,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${cycle.is_active ? 'rgba(217,92,26,0.25)' : 'rgba(255,255,255,0.06)'}`,
                borderLeft: cycle.is_active ? '2px solid #D95C1A' : '2px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', padding: '13px 14px', marginBottom: '7px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                {/* Left: info - clickable */}
                <div onClick={() => navigate('cycle-form', { turnId: turn.id, cycleId: cycle.id, readOnly: !cycle.is_active })}
                  style={{ flex: 1, cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                    {cycle.name}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '2px' }}>
                    {cycle.start_date ? new Date(cycle.start_date).toLocaleDateString('it-IT') : 'Data non impostata'}
                  </div>
                </div>

                {/* Right: badge + delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <div style={{
                    background: cycle.is_active ? '#D95C1A' : 'rgba(255,255,255,0.06)',
                    color: cycle.is_active ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700',
                    letterSpacing: '1.5px', padding: '4px 10px', borderRadius: '3px'
                  }}>
                    {cycle.is_active ? 'IN CORSO' : 'COMPLETATO'}
                  </div>
                  <button onClick={(e) => deleteCycle(cycle, e)} style={{
                    background: 'none', border: 'none',
                    color: 'rgba(232,92,26,0.4)', fontSize: '16px', padding: '4px 6px',
                    cursor: 'pointer'
                  }}>✕</button>
                </div>
              </div>
            ))}

            {!(cyclesByTurn[turn.id]?.length) && (
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', textAlign: 'center', padding: '16px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                Nessun ciclo ancora — creane uno con il tasto qui sopra
              </div>
            )}
          </div>
        ))}

        {!loading && turns.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', textAlign: 'center', padding: '40px 16px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }}>
            Aggiungi prima un turno dal Setup.
          </div>
        )}
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px' }
const sectionLabel = { color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }
const orangeSmall = { background: '#D95C1A', border: 'none', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', padding: '7px 14px', borderRadius: '3px' }
