import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function CyclesList({ navigate, goBack, goHome, session }) {
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

  async function deactivateAndCreate(turnId) {
    // Deactivate current active cycle
    await supabase.from('cycles').update({ is_active: false }).eq('turn_id', turnId).eq('is_active', true)
    navigate('cycle-form', { turnId, onDone: loadData })
  }

  return (
    <div style={page}>
      <TopBar title="Cicli" subtitle="Storico e gestione" />
      <div style={scroll}>
        {loading && <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '32px' }}>Caricamento...</div>}

        {turns.map(turn => (
          <div key={turn.id} style={{ marginBottom: '20px' }}>
            <div style={sectionLabel}>{turn.name}</div>

            {/* New cycle button */}
            <button onClick={() => deactivateAndCreate(turn.id)} style={newBtn}>
              + Nuovo ciclo
            </button>

            {/* Cycles list */}
            {(cyclesByTurn[turn.id] || []).map(cycle => (
              <div key={cycle.id}
                onClick={() => navigate('cycle-form', { turnId: turn.id, cycleId: cycle.id, readOnly: !cycle.is_active })}
                style={{ background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '12px 14px', marginBottom: '7px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '3px' }}>{cycle.name}</div>
                    <div style={{ color: '#555', fontSize: '11px' }}>
                      {cycle.start_date ? `Iniziato il ${new Date(cycle.start_date).toLocaleDateString('it-IT')}` : 'Data non impostata'}
                    </div>
                  </div>
                  <div style={{ background: cycle.is_active ? '#D95C1A' : '#2a2a2a', color: cycle.is_active ? '#fff' : '#555', fontSize: '10px', padding: '3px 9px', borderRadius: '20px', flexShrink: 0 }}>
                    {cycle.is_active ? 'In corso' : 'Completato'}
                  </div>
                </div>
              </div>
            ))}

            {!(cyclesByTurn[turn.id]?.length) && (
              <div style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px', background: '#1a1a1a', borderRadius: '11px' }}>
                Nessun ciclo ancora
              </div>
            )}
          </div>
        ))}

        {!loading && turns.length === 0 && (
          <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '32px' }}>
            Aggiungi prima un turno dalle Impostazioni.
          </div>
        )}
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '14px 16px' }
const sectionLabel = { color: '#555', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }
const newBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '11px', borderRadius: '11px', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }
