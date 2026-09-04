import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk, notifyError } from '../lib/notify'
import { ScheletroElenco } from '../components/Scheletro'
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
  const [allCycles, setAllCycles] = useState([]) // all cycles across all turns

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: t } = await run(
      supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time'),
      'Impossibile caricare i turni.'
    )
    setTurns(t || [])
    if (t?.length) {
      const turnIds = t.map(x => x.id)
      // Come in Home: erano 2 query per turno, ora 2 in tutto.
      const [{ data: tutteLeSchede }, { data: tuttiIClienti }] = await Promise.all([
        run(supabase.from('cycles').select('*').in('turn_id', turnIds)
          .order('created_at', { ascending: false }),
          'Impossibile caricare le schede.'),
        run(supabase.from('clients').select('id, turn_id, current_week').in('turn_id', turnIds)
          .eq('is_active', true),
          'Impossibile caricare gli atleti.'),
      ])

      const cycleMap = {}, clientiPerTurno = {}
      turnIds.forEach(id => { cycleMap[id] = []; clientiPerTurno[id] = [] })
      ;(tutteLeSchede || []).forEach(c => { if (cycleMap[c.turn_id]) cycleMap[c.turn_id].push(c) })
      ;(tuttiIClienti || []).forEach(c => { if (clientiPerTurno[c.turn_id]) clientiPerTurno[c.turn_id].push(c) })

      const alerts = turnIds.filter(id => {
        const attiva = cycleMap[id].find(x => x.is_active)
        const atleti = clientiPerTurno[id]
        return attiva && atleti.length > 0 && atleti.every(cl => cl.current_week >= 6)
      })

      setCyclesByTurn(cycleMap)
      setCompletedAlerts(alerts)
      // Flatten all cycles for clone picker
      const flat = []
      Object.entries(cycleMap).forEach(([turnId, cycles]) => {
        const turn = t.find(x => String(x.id) === String(turnId))
        ;(cycles || []).forEach(c => {
          if (c && c.id) flat.push({ ...c, turnName: turn?.name || '' })
        })
      })
      setAllCycles(flat)
    }
    setLoading(false)
  }

  function handleNewCycle(turn) {
    setCloneModal({ turnId: turn.id })
  }

  async function startNewCycle(turnId, cloneFromId) {
    setCloneModal(null)
    // Non disattiviamo più le schede precedenti — più schede attive per turno sono permesse
    navigate('cycle-form', { turnId, cloneFromId })
  }

  /**
   * Scarica la scheda nello stesso formato che il database esporta, quindi
   * reimportabile e leggibile in qualsiasi foglio di calcolo.
   * Al momento è anche l'unico backup: i dati vivono solo su Supabase.
   */
  async function esportaCsv(cycle) {
    const { data } = await run(
      supabase.from('cycle_exercises').select('*, exercises(name)')
        .eq('cycle_id', cycle.id).order('day').order('sort_order'),
      'Impossibile leggere gli esercizi della scheda.'
    )
    if (!data?.length) { notifyError('La scheda non ha esercizi da esportare.'); return }

    // Il parser arriva ora, non all'avvio dell'app.
    const { csvDaEsercizi } = await import('../lib/csv')
    const nomeFile = `${(cycle.name || 'scheda').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}.csv`
    // Il BOM serve a Excel per riconoscere l'UTF-8: senza, gli accenti si rompono.
    const blob = new Blob(['﻿' + csvDaEsercizi(data)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = nomeFile
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notifyOk(`${data.length} esercizi esportati`)
  }

  async function completeCycle(cycle) {
    const { error } = await run(
      supabase.from('cycles').update({ is_active: false }).eq('id', cycle.id),
      `Impossibile completare la scheda "${cycle.name}".`
    )
    setCompleteModal(null)
    if (error) return
    await loadData()
  }

  async function renameCycle(cycle) {
    if (!renameValue.trim()) return
    const { error } = await run(
      supabase.from('cycles').update({ name: renameValue.trim() }).eq('id', cycle.id),
      'Nome della scheda non salvato.'
    )
    setRenameModal(null)
    if (error) return
    await loadData()
  }

  async function deleteCycle(cycle, turnId) {
    setDeleteModal(null)

    // cycle_exercises ha ON DELETE CASCADE su cycles, e client_loads su
    // cycle_exercises: basta cancellare la scheda e il database porta via
    // esercizi e carichi in una transazione sola.
    const { error } = await run(
      supabase.from('cycles').delete().eq('id', cycle.id),
      `Impossibile eliminare la scheda "${cycle.name}".`
    )
    if (error) { await loadData(); return }

    // Riattivazione automatica solo se serve davvero: prima veniva riattivata
    // sempre la scheda più recente rimasta, anche una che il coach aveva chiuso
    // apposta con COMPLETA, e anche quando quella eliminata non era l'attiva.
    if (cycle.is_active) {
      const { data: rimaste } = await run(
        supabase.from('cycles').select('id, is_active').eq('turn_id', turnId).order('created_at', { ascending: false }),
        'Impossibile leggere le schede rimaste.'
      )
      const restaGiaUnaAttiva = (rimaste || []).some(c => c.is_active)
      if (!restaGiaUnaAttiva && rimaste?.length) {
        await run(
          supabase.from('cycles').update({ is_active: true }).eq('id', rimaste[0].id),
          'Scheda eliminata, ma non è stato possibile riattivare la precedente.'
        )
      }
    }
    notifyOk('Scheda eliminata')
    await loadData()
  }

  return (
    <div style={page}>
      <TopBar title="SCHEDE" subtitle="Storico e gestione" />
      <div style={scroll}>
        {loading && <ScheletroElenco righe={4} />}

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
                    <div style={{ color: 'var(--attenzione)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>⚠ TUTTI ALLA SETTIMANA 6</div>
                    <div style={{ color: 'var(--testo-debole)', fontSize: '12px', marginTop: '2px' }}>È ora di completare questa scheda?</div>
                  </div>
                  <button onClick={() => setCompleteModal(activeCycle)} style={{ background: 'var(--attenzione)', border: 'none', borderRadius: '3px', padding: '6px 12px', color: '#000', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '800', letterSpacing: '1px' }}>
                    COMPLETA
                  </button>
                </div>
              )}

              {(cyclesByTurn[turn.id] || []).map(cycle => (
                <div key={cycle.id} style={{
                  background: cycle.is_active ? 'var(--acc-fondo)' : 'var(--sup)',
                  border: `1px solid ${cycle.is_active ? 'var(--acc-bordo-tenue)' : 'var(--sup-alta)'}`,
                  borderLeft: cycle.is_active ? '2px solid var(--accento)' : '2px solid var(--bordo)',
                  borderRadius: '6px', padding: '12px 14px', marginBottom: '7px',
                }}>
                  {/* Header row — info + open button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cycle?.name || '(senza nome)'}</div>
                      <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', marginTop: '2px' }}>
                        {cycle.start_date ? new Date(cycle.start_date).toLocaleDateString('it-IT') : 'Data non impostata'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {cycle.is_active ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 5px var(--ok)' }} />
                          <span style={{ color: 'var(--ok)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>ATTIVA</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--testo-fioco)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>COMPLETATA</span>
                      )}
                      {/* OPEN BUTTON — only this is tappable for navigation */}
                      <button onClick={() => navigate('cycle-form', { turnId: turn.id, cycleId: cycle.id, readOnly: !cycle.is_active })}
                        style={{ background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px', padding: '6px 12px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px' }}>
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
                    <button onClick={() => esportaCsv(cycle)} style={actionBtn}>⬇ CSV</button>
                    {cycle.is_active && (
                      <button onClick={() => setCompleteModal(cycle)}
                        style={{ ...actionBtn, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', color: 'var(--attenzione)' }}>✓ COMPLETA</button>
                    )}
                    <button onClick={() => setDeleteModal({ cycle, turnId: turn.id })}
                      style={{ ...actionBtn, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.7)' }}>🗑 ELIMINA</button>
                  </div>
                </div>
              ))}

              {!(cyclesByTurn[turn.id]?.length) && (
                <div style={{ color: 'var(--bordo-forte)', fontSize: '13px', textAlign: 'center', padding: '16px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }}>
                  Nessuna scheda ancora
                </div>
              )}
            </div>
          )
        })}

        {!loading && turns.length === 0 && (
          <div style={{ color: 'var(--testo-fioco)', fontSize: '14px', textAlign: 'center', padding: '40px 16px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }}>
            Aggiungi prima un turno dalla tab Turni.
          </div>
        )}
        <div style={{ height: '20px' }} />
      </div>



      {cloneModal && (
        <div style={overlay}>
          <div style={{ ...sheet, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={sheetTitle}>NUOVA SCHEDA</div>
            <div style={sheetSub}>Inizia da zero oppure clona una scheda esistente.</div>
            <button onClick={() => startNewCycle(cloneModal.turnId, null)} style={{ ...sheetBtnGrey, flexShrink: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '1px' }}>✏️ INIZIA DA ZERO</div>
            </button>
            {allCycles.length > 0 && (
              <>
                <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', flexShrink: 0 }}>📋 CLONA DA UNA SCHEDA ESISTENTE</div>
                <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
                  {allCycles.map(cycle => (
                    <button key={cycle.id} onClick={() => startNewCycle(cloneModal.turnId, cycle.id)}
                      style={{ width: '100%', background: 'var(--acc-velo)', border: '1px solid var(--acc-riempimento-forte)', borderRadius: '6px', padding: '12px 14px', marginBottom: '7px', textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>{cycle?.name || '(senza nome)'}</div>
                          <div style={{ color: 'var(--testo-debole)', fontSize: '12px', marginTop: '2px' }}>{cycle?.turnName || ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {cycle.is_active && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 4px var(--ok)' }} />}
                          <div style={{ color: 'var(--accento)', fontSize: '14px' }}>›</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button onClick={() => setCloneModal(null)} style={{ ...cancelBtn, flexShrink: 0 }}>Annulla</button>
          </div>
        </div>
      )}

      {completeModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>COMPLETA SCHEDA</div>
            <div style={sheetSub}>Confermi di voler completare "{completeModal.name}"?</div>
            <button onClick={() => completeCycle(completeModal)} style={sheetBtnYellow}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--attenzione)', letterSpacing: '1px' }}>✓ SÌ, COMPLETA</div>
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
              style={{ width: '100%', background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '4px', padding: '14px', color: '#fff', fontSize: '16px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }} />
            <button onClick={() => renameCycle(renameModal)} disabled={!renameValue.trim()}
              style={{ ...sheetBtnOrange, opacity: !renameValue.trim() ? 0.3 : 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accento)', letterSpacing: '1px' }}>✓ SALVA NOME</div>
            </button>
            <button onClick={() => setRenameModal(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      {deleteModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>ELIMINA SCHEDA</div>
            <div style={{ color: 'var(--testo-medio)', fontSize: '14px', marginBottom: '6px' }}>Confermi di voler eliminare</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>{deleteModal.cycle.name}?</div>
            <div style={{ color: 'rgba(239,68,68,0.7)', fontSize: '13px', marginBottom: '20px' }}>
              ⚠ Verranno eliminati tutti gli esercizi e i carichi associati.{deleteModal.cycle.is_active ? ' Se non resta nessun\'altra scheda attiva, la più recente verrà riattivata.' : ''}
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

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px', WebkitOverflowScrolling: 'touch' }
const sectionLabel = { color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }
const orangeSmall = { background: 'var(--accento)', border: 'none', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px', padding: '7px 14px', borderRadius: '3px', cursor: 'pointer' }
const actionBtn = { background: 'var(--sup)', border: '1px solid var(--bordo)', borderRadius: '4px', padding: '7px 12px', color: 'var(--testo-chiaro)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }
const sheet = { background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '24px 16px 36px', width: '100%' }
const sheetTitle = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '6px' }
const sheetSub = { color: 'var(--testo-debole)', fontSize: '13px', marginBottom: '20px' }
const sheetBtnOrange = { width: '100%', background: 'var(--acc-fondo)', border: '1px solid var(--acc-bordo)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer' }
const sheetBtnGrey = { width: '100%', background: 'var(--sup)', border: '1px solid var(--bordo)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer' }
const sheetBtnYellow = { width: '100%', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px', textAlign: 'left', cursor: 'pointer' }
const cancelBtn = { background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '8px', fontSize: '14px', cursor: 'pointer' }
