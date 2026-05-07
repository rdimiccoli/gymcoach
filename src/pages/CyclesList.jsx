import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function CyclesList({ navigate, goHome, session }) {
  const [turns, setTurns] = useState([])
  const [cyclesByTurn, setCyclesByTurn] = useState({})
  const [clientsByTurn, setClientsByTurn] = useState({})
  const [loading, setLoading] = useState(true)
  const [cloneModal, setCloneModal] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [completedAlerts, setCompletedAlerts] = useState([]) // turn ids where all clients at week 6

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time')
    setTurns(t || [])
    if (t?.length) {
      const cycleMap = {}, clientMap = {}, alerts = []
      await Promise.all(t.map(async turn => {
        const { data: c } = await supabase.from('cycles').select('*').eq('turn_id', turn.id).order('created_at', { ascending: false })
        cycleMap[turn.id] = c || []

        // Check if all active clients are at week 6
        const { data: clients } = await supabase.from('clients').select('*').eq('turn_id', turn.id).eq('is_active', true)
        clientMap[turn.id] = clients || []
        const active = c?.find(x => x.is_active)
        if (active && clients?.length > 0 && clients.every(cl => cl.current_week >= 6)) {
          alerts.push(turn.id)
        }
      }))
      setCyclesByTurn(cycleMap)
      setClientsByTurn(clientMap)
      setCompletedAlerts(alerts)
    }
    setLoading(false)
  }

  function handleNewCycle(turn) {
    const existing = cyclesByTurn[turn.id] || []
    const active = existing.find(c => c.is_active)
    if (active) setCloneModal({ turnId: turn.id, prevCycle: active })
    else if (existing.length > 0) setCloneModal({ turnId: turn.id, prevCycle: existing[0] })
    else startNewCycle(turn.id, null)
  }

  async function startNewCycle(turnId, cloneFromId) {
    setCloneModal(null)
    await supabase.from('cycles').update({ is_active: false }).eq('turn_id', turnId).eq('is_active', true)
    navigate('cycle-form', { turnId, cloneFromId })
  }

  async function completeCycle(cycle) {
    await supabase.from('cycles').update({ is_active: false }).eq('id', cycle.id)
    setCompleteModal(null)
    await loadData()
  }

  return (
    <div style={page}>
      <TopBar title="SCHEDE" subtitle="Storico e gestione" />
      <div style={scroll}>
        {loading && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', textAlign: 'center', padding: '32px' }}>Caricamento...</div>}

        {turns.map(turn => {
          const isAlert = completedAlerts.includes(turn.id)
          const activeCycle = (cyclesByTurn[turn.id] || []).find(c => c.is_active)
          return (
            <div key={turn.id} style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={sectionLabel}>{turn.name}</div>
                <button onClick={() => handleNewCycle(turn)} style={orangeSmall}>+ NUOVA SCHEDA</button>
              </div>

              {/* Alert: all clients completed */}
              {isAlert && activeCycle && (
                <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: '6px', padding: '10px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#eab308', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>⚠ TUTTI ALLA SETTIMANA 6</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '2px' }}>È ora di completare questa scheda?</div>
                  </div>
                  <button onClick={() => setCompleteModal(activeCycle)} style={{ background: '#eab308', border: 'none', borderRadius: '3px', padding: '6px 12px', color: '#000', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: '800', letterSpacing: '1px' }}>
                    COMPLETA
                  </button>
                </div>
              )}

              {(cyclesByTurn[turn.id] || []).map(cycle => (
                <div key={cycle.id} style={{
                  background: cycle.is_active ? 'rgba(217,92,26,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${cycle.is_active ? 'rgba(217,92,26,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderLeft: cycle.is_active ? '2px solid #D95C1A' : '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', padding: '13px 16px', marginBottom: '7px', touchAction: 'pan-y',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cycle.is_active ? '10px' : 0 }}
                    onClick={() => navigate('cycle-form', { turnId: turn.id, cycleId: cycle.id, readOnly: !cycle.is_active })}>
                    <div style={{ flex: 1, cursor: 'pointer' }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>{cycle.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '2px' }}>
                        {cycle.start_date ? new Date(cycle.start_date).toLocaleDateString('it-IT') : 'Data non impostata'}
                      </div>
                    </div>
                    {cycle.is_active ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
                        <span style={{ color: '#22c55e', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1.5px' }}>IN CORSO</span>
                      </div>
                    ) : (
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1.5px' }}>COMPLETATA</div>
                    )}
                  </div>

                  {/* Active cycle action buttons */}
                  {cycle.is_active && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => navigate('cycle-share', { cycleId: cycle.id, cycleName: cycle.name })}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>
                        📤 CONDIVIDI
                      </button>
                      <button onClick={() => setCompleteModal(cycle)}
                        style={{ flex: 1, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '4px', padding: '8px', color: '#eab308', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>
                        ✓ COMPLETA SCHEDA
                      </button>
                    </div>
                  )}
                  {!cycle.is_active && (
                    <div style={{ marginTop: '8px' }}>
                      <button onClick={() => navigate('cycle-share', { cycleId: cycle.id, cycleName: cycle.name })}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '6px 14px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' }}>
                        📤 CONDIVIDI
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {!(cyclesByTurn[turn.id]?.length) && (
                <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', textAlign: 'center', padding: '16px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                  Nessuna scheda ancora
                </div>
              )}
            </div>
          )
        })}

        {!loading && turns.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', textAlign: 'center', padding: '40px 16px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }}>
            Aggiungi prima un turno dal Setup.
          </div>
        )}
        <div style={{ height: '20px' }} />
      </div>

      {/* Clone modal */}
      {cloneModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>NUOVA SCHEDA</div>
            <div style={sheetSub}>Vuoi partire da zero o clonare la scheda precedente?</div>
            <button onClick={() => startNewCycle(cloneModal.turnId, cloneModal.prevCycle.id)} style={sheetBtn('#D95C1A')}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#D95C1A', letterSpacing: '1px', marginBottom: '2px' }}>📋 CLONA SCHEDA PRECEDENTE</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{cloneModal.prevCycle.name}</div>
            </button>
            <button onClick={() => startNewCycle(cloneModal.turnId, null)} style={sheetBtn('rgba(255,255,255,0.1)')}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', letterSpacing: '1px' }}>✏️ INIZIA DA ZERO</div>
            </button>
            <button onClick={() => setCloneModal(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      {/* Complete modal */}
      {completeModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>COMPLETA SCHEDA</div>
            <div style={sheetSub}>Sei sicura di voler completare "{completeModal.name}"? Non sarà più modificabile.</div>
            <button onClick={() => completeCycle(completeModal)} style={sheetBtn('#eab308')}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#eab308', letterSpacing: '1px' }}>✓ SÌ, COMPLETA</div>
            </button>
            <button onClick={() => setCompleteModal(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
const sectionLabel = { color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }
const orangeSmall = { background: '#D95C1A', border: 'none', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', padding: '7px 14px', borderRadius: '3px', cursor: 'pointer' }
const overlay = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }
const sheet = { background: '#141414', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px 16px 0 0', padding: '24px 16px 36px', width: '100%' }
const sheetTitle = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '6px' }
const sheetSub = { color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '20px' }
const sheetBtn = (borderColor) => ({ width: '100%', background: `rgba(${borderColor === '#D95C1A' ? '217,92,26' : borderColor === '#eab308' ? '234,179,8' : '255,255,255'},0.08)`, border: `1px solid ${borderColor === 'rgba(255,255,255,0.1)' ? 'rgba(255,255,255,0.1)' : borderColor}`, borderRadius: '6px', padding: '14px 16px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer' })
const cancelBtn = { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', width: '100%', padding: '8px', fontSize: '13px', cursor: 'pointer' }
