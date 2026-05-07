import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function CyclesList({ navigate, goHome, session }) {
  const [turns, setTurns] = useState([])
  const [cyclesByTurn, setCyclesByTurn] = useState({})
  const [loading, setLoading] = useState(true)
  const [cloneModal, setCloneModal] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [renameModal, setRenameModal] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteModal, setDeleteModal] = useState(null)
  const [completedAlerts, setCompletedAlerts] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time')
    setTurns(t || [])
    if (t?.length) {
      const cycleMap = {}, alerts = []
      await Promise.all(t.map(async turn => {
        const { data: c } = await supabase.from('cycles').select('*').eq('turn_id', turn.id).order('created_at', { ascending: false })
        cycleMap[turn.id] = c || []
        const { data: clients } = await supabase.from('clients').select('*').eq('turn_id', turn.id).eq('is_active', true)
        const active = c?.find(x => x.is_active)
        if (active && clients?.length > 0 && clients.every(cl => cl.current_week >= 6)) alerts.push(turn.id)
      }))
      setCyclesByTurn(cycleMap)
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
    // Non disattiviamo più le schede precedenti — più schede attive per turno sono permesse
    navigate('cycle-form', { turnId, cloneFromId })
  }

  async function completeCycle(cycle) {
    await supabase.from('cycles').update({ is_active: false }).eq('id', cycle.id)
    setCompleteModal(null)
    await loadData()
  }

  async function renameCycle(cycle) {
    if (!renameValue.trim()) return
    await supabase.from('cycles').update({ name: renameValue.trim() }).eq('id', cycle.id)
    setRenameModal(null)
    await loadData()
  }

  async function deleteCycle(cycle, turnId) {
    // Delete related data
    const { data: exList } = await supabase.from('cycle_exercises').select('id').eq('cycle_id', cycle.id)
    if (exList?.length) {
      const exIds = exList.map(e => e.id)
      await supabase.from('client_loads').delete().in('cycle_exercise_id', exIds)
      await supabase.from('cycle_exercises').delete().eq('cycle_id', cycle.id)
    }
    await supabase.from('cycles').delete().eq('id', cycle.id)

    // Reactivate most recent remaining cycle for this turn
    const { data: remaining } = await supabase.from('cycles').select('*')
      .eq('turn_id', turnId).order('created_at', { ascending: false })
    if (remaining?.length > 0) {
      await supabase.from('cycles').update({ is_active: true }).eq('id', remaining[0].id)
    }
    setDeleteModal(null)
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
                  borderRadius: '6px', padding: '12px 14px', marginBottom: '7px',
                }}>
                  {/* Header row — info + open button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cycle.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '2px' }}>
                        {cycle.start_date ? new Date(cycle.start_date).toLocaleDateString('it-IT') : 'Data non impostata'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {cycle.is_active ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
                          <span style={{ color: '#22c55e', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>ATTIVA</span>
                        </div>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>COMPLETATA</span>
                      )}
                      {/* OPEN BUTTON — only this is tappable for navigation */}
                      <button onClick={() => navigate('cycle-form', { turnId: turn.id, cycleId: cycle.id, readOnly: !cycle.is_active })}
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 12px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>
                        APRI →
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => navigate('cycle-share', { cycleId: cycle.id, cycleName: cycle.name })}
                      style={actionBtn}>📤 CONDIVIDI</button>
                    <button onClick={() => { setRenameModal(cycle); setRenameValue(cycle.name) }}
                      style={actionBtn}>✏️ RINOMINA</button>
                    {cycle.is_active && (
                      <button onClick={() => setCompleteModal(cycle)}
                        style={{ ...actionBtn, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', color: '#eab308' }}>✓ COMPLETA</button>
                    )}
                    <button onClick={() => setDeleteModal({ cycle, turnId: turn.id })}
                      style={{ ...actionBtn, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.7)' }}>🗑 ELIMINA</button>
                  </div>
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
            Aggiungi prima un turno dalla tab Turni.
          </div>
        )}
        <div style={{ height: '20px' }} />
      </div>

      {cloneModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>NUOVA SCHEDA</div>
            <div style={sheetSub}>Vuoi partire da zero o clonare la scheda precedente?</div>
            <button onClick={() => startNewCycle(cloneModal.turnId, cloneModal.prevCycle.id)} style={sheetBtnOrange}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#D95C1A', letterSpacing: '1px', marginBottom: '2px' }}>📋 CLONA SCHEDA PRECEDENTE</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{cloneModal.prevCycle.name}</div>
            </button>
            <button onClick={() => startNewCycle(cloneModal.turnId, null)} style={sheetBtnGrey}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', letterSpacing: '1px' }}>✏️ INIZIA DA ZERO</div>
            </button>
            <button onClick={() => setCloneModal(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      {completeModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>COMPLETA SCHEDA</div>
            <div style={sheetSub}>Sei sicura di voler completare "{completeModal.name}"?</div>
            <button onClick={() => completeCycle(completeModal)} style={sheetBtnYellow}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#eab308', letterSpacing: '1px' }}>✓ SÌ, COMPLETA</div>
            </button>
            <button onClick={() => setCompleteModal(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      {renameModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>RINOMINA SCHEDA</div>
            <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
              placeholder="Nome scheda" autoFocus
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '14px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }} />
            <button onClick={() => renameCycle(renameModal)} disabled={!renameValue.trim()}
              style={{ ...sheetBtnOrange, opacity: !renameValue.trim() ? 0.3 : 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#D95C1A', letterSpacing: '1px' }}>✓ SALVA NOME</div>
            </button>
            <button onClick={() => setRenameModal(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      {deleteModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>ELIMINA SCHEDA</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '6px' }}>Sei sicura di voler eliminare</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>{deleteModal.cycle.name}?</div>
            <div style={{ color: 'rgba(239,68,68,0.7)', fontSize: '11px', marginBottom: '20px' }}>
              ⚠ Verranno eliminati tutti gli esercizi e i carichi associati.{'\n'}La scheda precedente verrà riattivata automaticamente.
            </div>
            <button onClick={() => deleteCycle(deleteModal.cycle, deleteModal.turnId)}
              style={{ ...sheetBtnGrey, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'rgba(239,68,68,0.9)', letterSpacing: '1px' }}>🗑 SÌ, ELIMINA</div>
            </button>
            <button onClick={() => setDeleteModal(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      <BottomNav active="cycles" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px', WebkitOverflowScrolling: 'touch' }
const sectionLabel = { color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }
const orangeSmall = { background: '#D95C1A', border: 'none', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', padding: '7px 14px', borderRadius: '3px', cursor: 'pointer' }
const actionBtn = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '7px 12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }
const overlay = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }
const sheet = { background: '#141414', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px 16px 0 0', padding: '24px 16px 36px', width: '100%' }
const sheetTitle = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '6px' }
const sheetSub = { color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '20px' }
const sheetBtnOrange = { width: '100%', background: 'rgba(217,92,26,0.08)', border: '1px solid rgba(217,92,26,0.35)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer' }
const sheetBtnGrey = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer' }
const sheetBtnYellow = { width: '100%', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer' }
const cancelBtn = { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', width: '100%', padding: '8px', fontSize: '13px', cursor: 'pointer' }
