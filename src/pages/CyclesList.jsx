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

  return (
    <div style={page}>
      <TopBar title="SCHEDE" subtitle="Storico e gestione" />
      <div style={scroll}>
        {loading && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', textAlign: 'center', padding: '32px' }}>Caricamento...</div>}

        {turns.map(turn => (
          <div key={turn.id} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={sectionLabel}>{turn.name}</div>
              <button onClick={() => newCycle(turn.id)} style={orangeSmall}>+ NUOVA SCHEDA</button>
            </div>

            {(cyclesByTurn[turn.id] || []).map(cycle => (
              <div key={cycle.id}
                onClick={() => navigate('cycle-form', { turnId: turn.id, cycleId: cycle.id, readOnly: !cycle.is_active })}
                style={{
                  background: cycle.is_active ? 'rgba(217,92,26,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${cycle.is_active ? 'rgba(217,92,26,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderLeft: cycle.is_active ? '2px solid #D95C1A' : '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', padding: '13px 16px', marginBottom: '7px', cursor: 'pointer'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>{cycle.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '2px' }}>
                      {cycle.start_date ? new Date(cycle.start_date).toLocaleDateString('it-IT') : 'Data non impostata'}
                    </div>
                  </div>
                  {cycle.is_active ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                      <span style={{ color: '#22c55e', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1.5px' }}>IN CORSO</span>
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1.5px' }}>COMPLETATA</div>
                  )}
                </div>
              </div>
            ))}

            {!(cyclesByTurn[turn.id]?.length) && (
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', textAlign: 'center', padding: '16px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                Nessuna scheda ancora
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

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px' }
const sectionLabel = { color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }
const orangeSmall = { background: '#D95C1A', border: 'none', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', padding: '7px 14px', borderRadius: '3px' }
