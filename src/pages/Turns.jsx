import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function Turns({ navigate, goHome, session }) {
  const [turns, setTurns] = useState([])
  const [clients, setClients] = useState([])
  const [selectedTurn, setSelectedTurn] = useState(null)
  const [view, setView] = useState('main')
  const [loading, setLoading] = useState(true)

  const [turnTime, setTurnTime] = useState('')
  const [turnType, setTurnType] = useState('Misto')
  const [clientName, setClientName] = useState('')
  const [clientSurname, setClientSurname] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit client modal
  const [editClient, setEditClient] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSurname, setEditSurname] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteTurnConfirm, setDeleteTurnConfirm] = useState(null)
  const [renameTurnModal, setRenameTurnModal] = useState(null)
  const [renameTurnValue, setRenameTurnValue] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time')
    setTurns(t || [])
    setLoading(false)
  }

  async function loadClients(turn) {
    setSelectedTurn(turn)
    const { data } = await supabase.from('clients').select('*').eq('turn_id', turn.id).order('surname')
    setClients(data || [])
    setView('turn')
  }

  async function saveTurn() {
    if (!turnTime.trim()) return
    setSaving(true)
    await supabase.from('turns').insert({
      coach_id: session.user.id,
      name: `${turnTime} — ${turnType}`,
      time: turnTime, type: turnType
    })
    await loadData()
    setTurnTime(''); setTurnType('Misto')
    setSaving(false)
    setView('main')
  }

  async function saveClient() {
    if (!clientName.trim() || !clientSurname.trim()) return
    setSaving(true)
    await supabase.from('clients').insert({
      turn_id: selectedTurn.id, name: clientName, surname: clientSurname, current_week: 1
    })
    await loadClients(selectedTurn)
    setClientName(''); setClientSurname('')
    setSaving(false)
  }

  async function deleteTurn(id) {
    setDeleteTurnConfirm(id)
  }

  async function saveRenameTurn() {
    if (!renameTurnValue.trim()) return
    const newName = renameTurnValue.trim()
    await supabase.from('turns').update({ name: newName }).eq('id', renameTurnModal.id)
    setTurns(prev => prev.map(t => t.id === renameTurnModal.id ? { ...t, name: newName } : t))
    setRenameTurnModal(null)
  }

  async function executeDeleteTurn() {
    await supabase.from('turns').delete().eq('id', deleteTurnConfirm)
    setDeleteTurnConfirm(null)
    await loadData()
  }

  async function toggleClient(client) {
    await supabase.from('clients').update({ is_active: !client.is_active }).eq('id', client.id)
    await loadClients(selectedTurn)
  }

  // Edit client
  function openEditClient(client) {
    setEditClient(client)
    setEditName(client.name)
    setEditSurname(client.surname)
  }

  async function saveEditClient() {
    if (!editName.trim() || !editSurname.trim()) return
    setSaving(true)
    await supabase.from('clients').update({ name: editName.trim(), surname: editSurname.trim() }).eq('id', editClient.id)
    setClients(prev => prev.map(c => c.id === editClient.id ? { ...c, name: editName.trim(), surname: editSurname.trim() } : c))
    setSaving(false)
    setEditClient(null)
  }

  // Delete client (with all loads)
  async function confirmDeleteClient(client) {
    setDeleteConfirm(client)
  }

  async function executeDeleteClient() {
    const client = deleteConfirm
    setDeleteConfirm(null)
    // Delete loads first (foreign key)
    await supabase.from('client_loads').delete().eq('client_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)
    setClients(prev => prev.filter(c => c.id !== client.id))
  }

  // ── TURN CLIENTS VIEW ──────────────────────────────────────────────────────
  if (view === 'turn') return (
    <div style={page}>
      <TopBar title={selectedTurn?.name} subtitle="Gestione clienti" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={sectionLabel}>AGGIUNGI CLIENTE</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome" style={{ ...inp, flex: 1 }} />
          <input value={clientSurname} onChange={e => setClientSurname(e.target.value)} placeholder="Cognome" style={{ ...inp, flex: 1 }} />
          <button onClick={saveClient} disabled={!clientName.trim() || !clientSurname.trim() || saving}
            style={{ background: '#D95C1A', border: 'none', borderRadius: '4px', padding: '0 14px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', fontSize: '20px', opacity: !clientName.trim() || !clientSurname.trim() ? 0.3 : 1 }}>
            +
          </button>
        </div>

        <div style={sectionLabel}>CLIENTI ({clients.filter(c => c.is_active).length} ATTIVI)</div>
        {clients.map(client => (
          <div key={client.id} style={{ ...row, opacity: client.is_active ? 1 : 0.45, marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                {client.surname} {client.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '1px' }}>Settimana {client.current_week}/6</div>
            </div>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={() => openEditClient(client)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '14px', padding: '6px 10px', borderRadius: '3px' }}>
                ✏️
              </button>
              <button onClick={() => toggleClient(client)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', padding: '6px 10px', borderRadius: '3px' }}>
                {client.is_active ? 'ARCHIVIA' : 'RIATTIVA'}
              </button>
              <button onClick={() => confirmDeleteClient(client)}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgba(239,68,68,0.7)', fontSize: '14px', padding: '6px 10px', borderRadius: '3px' }}>
                🗑
              </button>
            </div>
          </div>
        ))}
        {clients.length === 0 && <div style={emptyText}>Nessun cliente ancora.</div>}
        <div style={{ height: '20px' }} />
      </div>

      {/* Edit client modal */}
      {editClient && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>MODIFICA CLIENTE</div>
            <div style={{ ...fieldLabel, marginTop: '4px' }}>NOME</div>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome" style={{ ...inp, marginBottom: '12px' }} />
            <div style={fieldLabel}>COGNOME</div>
            <input value={editSurname} onChange={e => setEditSurname(e.target.value)} placeholder="Cognome" style={{ ...inp, marginBottom: '20px' }} />
            <button onClick={saveEditClient} disabled={saving || !editName.trim() || !editSurname.trim()}
              style={{ ...bigBtn, marginBottom: '10px', opacity: !editName.trim() || !editSurname.trim() ? 0.3 : 1 }}>
              {saving ? 'SALVATAGGIO...' : '✓ SALVA MODIFICHE'}
            </button>
            <button onClick={() => setEditClient(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>ELIMINA CLIENTE</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '6px' }}>
              Sei sicura di voler eliminare
            </div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', marginBottom: '6px' }}>
              {deleteConfirm.surname} {deleteConfirm.name}?
            </div>
            <div style={{ color: 'rgba(239,68,68,0.7)', fontSize: '11px', marginBottom: '20px' }}>
              ⚠ Verranno eliminati anche tutti i suoi carichi storici.
            </div>
            <button onClick={executeDeleteClient}
              style={{ ...bigBtn, background: 'rgba(239,68,68,0.9)', marginBottom: '10px' }}>
              🗑 SÌ, ELIMINA
            </button>
            <button onClick={() => setDeleteConfirm(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      <BottomNav active="turns" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── ADD TURN VIEW ──────────────────────────────────────────────────────────
  if (view === 'addTurn') return (
    <div style={page}>
      <TopBar title="NUOVO TURNO" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={fieldLabel}>ORARIO</div>
        <input value={turnTime} onChange={e => setTurnTime(e.target.value)} placeholder="es. 13:30" style={inp} />
        <div style={{ ...fieldLabel, marginTop: '16px' }}>TIPO</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          {['Maschile','Femminile','Misto'].map(t => (
            <button key={t} onClick={() => setTurnType(t)} style={{
              flex: 1, padding: '11px 6px', borderRadius: '4px', border: 'none',
              fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px',
              background: turnType === t ? '#D95C1A' : 'rgba(255,255,255,0.06)',
              color: turnType === t ? '#fff' : 'rgba(255,255,255,0.3)'
            }}>{t.toUpperCase()}</button>
          ))}
        </div>
        <button onClick={saveTurn} disabled={saving || !turnTime.trim()}
          style={{ ...bigBtn, marginTop: '24px', opacity: !turnTime.trim() ? 0.3 : 1 }}>
          {saving ? 'SALVATAGGIO...' : '✓ SALVA TURNO'}
        </button>
      </div>
      <BottomNav active="turns" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── MAIN TURNS VIEW ────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <TopBar title="TURNI" />
      <div style={scroll}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={sectionLabel}>I MIEI TURNI</div>
          <button onClick={() => setView('addTurn')} style={{ background: '#D95C1A', border: 'none', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700', letterSpacing: '1px', padding: '6px 14px', borderRadius: '3px' }}>+ AGGIUNGI</button>
        </div>
        {loading && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', padding: '12px', textAlign: 'center' }}>Caricamento...</div>}
        {turns.map(turn => (
          <div key={turn.id} style={{ ...row, marginBottom: '7px' }}>
            <div onClick={() => loadClients(turn)} style={{ flex: 1, cursor: 'pointer', paddingLeft: '4px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>{turn.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '1px' }}>Tocca per gestire clienti</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div onClick={() => loadClients(turn)} style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px', cursor: 'pointer' }}>›</div>
              <button onClick={() => { setRenameTurnModal(turn); setRenameTurnValue(turn.name) }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '4px 8px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>✏️</button>
              <button onClick={() => deleteTurn(turn.id)} style={{ background: 'none', border: 'none', color: 'rgba(232,92,26,0.5)', fontSize: '16px', padding: '4px' }}>✕</button>
            </div>
          </div>
        ))}
        {!loading && turns.length === 0 && <div style={emptyText}>Nessun turno ancora.</div>}
        <div style={{ height: '20px' }} />
      </div>
      {renameTurnModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>RINOMINA TURNO</div>
            <input value={renameTurnValue} onChange={e => setRenameTurnValue(e.target.value)} autoFocus
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '14px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }} />
            <button onClick={saveRenameTurn} disabled={!renameTurnValue.trim()}
              style={{ ...bigBtn, marginBottom: '10px', opacity: !renameTurnValue.trim() ? 0.3 : 1 }}>✓ SALVA</button>
            <button onClick={() => setRenameTurnModal(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}

      {deleteTurnConfirm && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>ELIMINA TURNO</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '6px' }}>Sei sicura di voler eliminare questo turno?</div>
            <div style={{ color: 'rgba(239,68,68,0.8)', fontSize: '11px', marginBottom: '20px' }}>⚠ Verranno eliminati tutti i clienti, schede e carichi associati.</div>
            <button onClick={executeDeleteTurn}
              style={{ ...bigBtn, background: 'rgba(239,68,68,0.9)', marginBottom: '10px' }}>🗑 SÌ, ELIMINA</button>
            <button onClick={() => setDeleteTurnConfirm(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}
      <BottomNav active="turns" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
const sectionLabel = { color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }
const fieldLabel = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '13px 14px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
const bigBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px', cursor: 'pointer' }
const row = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const emptyText = { color: 'rgba(255,255,255,0.15)', fontSize: '12px', textAlign: 'center', padding: '20px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }
const sheet = { background: '#141414', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px 16px 0 0', padding: '24px 16px 36px', width: '100%' }
const sheetTitle = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '16px' }
const cancelBtn = { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', width: '100%', padding: '10px', fontSize: '13px', cursor: 'pointer' }
