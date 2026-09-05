import { comePulsante } from '../lib/stile.js'
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk } from '../lib/notify'
import { capacita } from '../lib/capacita'
import { ScheletroElenco } from '../components/Scheletro'
import PulsanteFlottante from '../components/PulsanteFlottante'
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
  // Condivisione. Se un coach è malato, fino ad oggi i suoi turni non li
  // apriva nessuno: le atlete si allenavano e i carichi non venivano segnati.
  const [condivisioneAttiva, setCondivisioneAttiva] = useState(false)
  const [colleghi, setColleghi] = useState([])
  const [condivisoCon, setCondivisoCon] = useState(new Set())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: t } = await run(
      // Il filtro sul coach lo fa la policy del database: qui escluderebbe
      // anche i turni condivisi da un collega.
      supabase.from('turns').select('*').order('time'),
      'Impossibile caricare i turni.'
    )
    setTurns(t || [])
    setLoading(false)
  }

  async function loadClients(turn) {
    setSelectedTurn(turn)
    const { data } = await run(
      supabase.from('clients').select('*').eq('turn_id', turn.id).order('surname'),
      'Impossibile caricare i clienti del turno.'
    )
    setClients(data || [])
    setView('turn')
  }

  async function saveTurn() {
    if (!turnTime.trim()) return
    setSaving(true)
    const { error } = await run(
      supabase.from('turns').insert({
        coach_id: session.user.id,
        name: `${turnTime} — ${turnType}`,
        time: turnTime, type: turnType
      }),
      'Turno non creato. Controlla la connessione e riprova.'
    )
    setSaving(false)
    if (error) return
    await loadData()
    setTurnTime(''); setTurnType('Misto')
    setView('main')
  }

  async function saveClient() {
    if (!clientName.trim() || !clientSurname.trim()) return
    setSaving(true)
    const { error } = await run(
      supabase.from('clients').insert({
        turn_id: selectedTurn.id, name: clientName.trim(), surname: clientSurname.trim()
      }),
      'Cliente non aggiunto. Controlla la connessione e riprova.'
    )
    setSaving(false)
    if (error) return
    await loadClients(selectedTurn)
    setClientName(''); setClientSurname('')
  }

  async function deleteTurn(id) {
    setDeleteTurnConfirm(id)
  }

  async function saveRenameTurn() {
    if (!renameTurnValue.trim()) return
    const newName = renameTurnValue.trim()
    const { error } = await run(
      supabase.from('turns').update({ name: newName }).eq('id', renameTurnModal.id),
      'Nome del turno non salvato.'
    )
    if (error) return
    setTurns(prev => prev.map(t => t.id === renameTurnModal.id ? { ...t, name: newName } : t))
    setRenameTurnModal(null)
  }

  useEffect(() => { capacita().then(c => setCondivisioneAttiva(c.condivisione)) }, [])

  /**
   * Apre la gestione del turno e, se la condivisione è disponibile, carica
   * insieme i colleghi e chi ha già accesso.
   *
   * `colleghi()` è una funzione del database, non una select: la tabella dei
   * coach resta chiusa, e di lì esce solo il nome. L'email di un collega non
   * arriva mai al browser.
   */
  async function apriGestioneTurno(turn) {
    setRenameTurnModal(turn)
    setRenameTurnValue(turn.name)
    setCondivisoCon(new Set())
    if (!condivisioneAttiva) return

    const [{ data: elenco }, { data: giaCondiviso }] = await Promise.all([
      // Senza run(): se la funzione `colleghi()` non è stata ancora creata sul
      // database, la sezione semplicemente non compare. Un avviso rosso a chi
      // ha aperto la matita solo per rinominare un turno sarebbe rumore.
      supabase.rpc('colleghi'),
      run(supabase.from('turn_coaches').select('coach_id').eq('turn_id', turn.id),
        'Impossibile sapere con chi è già condiviso.'),
    ])
    setColleghi(elenco || [])
    setCondivisoCon(new Set((giaCondiviso || []).map(r => r.coach_id)))
  }

  /**
   * Dà o toglie l'accesso, subito, senza un pulsante «salva».
   * Lo stato locale si muove prima della risposta del server e torna indietro
   * se la scrittura fallisce: toccare un nome e non vedere niente per mezzo
   * secondo fa toccare due volte.
   */
  async function alternaCondivisione(turnId, coachId) {
    const aveva = condivisoCon.has(coachId)
    setCondivisoCon(prev => {
      const next = new Set(prev)
      if (aveva) next.delete(coachId); else next.add(coachId)
      return next
    })
    const { error } = aveva
      ? await run(supabase.from('turn_coaches').delete().eq('turn_id', turnId).eq('coach_id', coachId),
          'Accesso non revocato.')
      : await run(supabase.from('turn_coaches').insert({ turn_id: turnId, coach_id: coachId }),
          'Accesso non concesso.')
    if (error) {
      setCondivisoCon(prev => {
        const next = new Set(prev)
        if (aveva) next.add(coachId); else next.delete(coachId)
        return next
      })
    }
  }

  async function executeDeleteTurn() {
    const turnId = deleteTurnConfirm
    setSaving(true)
    // Le foreign key sono ON DELETE CASCADE fino in fondo (clients e cycles →
    // turns, cycle_exercises → cycles, client_loads e client_notes → clients e
    // cycle_exercises): questa singola riga porta via tutto, in una transazione
    // sola. Mancava solo il controllo dell'errore.
    const { error } = await run(
      supabase.from('turns').delete().eq('id', turnId),
      'Impossibile eliminare il turno.'
    )
    setSaving(false)
    setDeleteTurnConfirm(null)
    if (!error) notifyOk('Turno eliminato')
    await loadData()
  }

  async function toggleClient(client) {
    const { error } = await run(
      supabase.from('clients').update({ is_active: !client.is_active }).eq('id', client.id),
      `Impossibile ${client.is_active ? 'archiviare' : 'riattivare'} ${client.surname} ${client.name}.`
    )
    if (error) return
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
    const { error } = await run(
      supabase.from('clients').update({ name: editName.trim(), surname: editSurname.trim() }).eq('id', editClient.id),
      'Modifiche al cliente non salvate.'
    )
    setSaving(false)
    if (error) return
    setClients(prev => prev.map(c => c.id === editClient.id ? { ...c, name: editName.trim(), surname: editSurname.trim() } : c))
    setEditClient(null)
  }

  // Delete client (with all loads)
  async function confirmDeleteClient(client) {
    setDeleteConfirm(client)
  }

  async function executeDeleteClient() {
    const client = deleteConfirm
    setDeleteConfirm(null)
    // client_loads e client_notes hanno ON DELETE CASCADE su clients: la
    // cancellazione manuale che c'era prima era ridondante.
    const { error } = await run(
      supabase.from('clients').delete().eq('id', client.id),
      `Impossibile eliminare ${client.surname} ${client.name}.`
    )
    if (error) return
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
            style={{ background: 'var(--accento)', border: 'none', borderRadius: '4px', padding: '0 14px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', fontSize: '20px', opacity: !clientName.trim() || !clientSurname.trim() ? 0.3 : 1 }}>
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
              {!client.is_active && <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', marginTop: '1px' }}>Non attiva</div>}
            </div>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={() => openEditClient(client)}
                style={{ background: 'var(--sup-alta)', border: '1px solid var(--bordo)', color: 'var(--testo-chiaro)', fontSize: '14px', padding: '6px 10px', borderRadius: '3px' }}>
                ✏️
              </button>
              <button onClick={() => toggleClient(client)}
                style={{ background: 'var(--sup-alta)', border: '1px solid var(--sup-alta)', color: 'var(--testo-medio)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', padding: '6px 10px', borderRadius: '3px' }}>
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
            <div style={{ color: 'var(--testo-medio)', fontSize: '14px', marginBottom: '6px' }}>
              Confermi di voler eliminare
            </div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', marginBottom: '6px' }}>
              {deleteConfirm.surname} {deleteConfirm.name}?
            </div>
            <div style={{ color: 'rgba(239,68,68,0.7)', fontSize: '13px', marginBottom: '20px' }}>
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
              fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px',
              background: turnType === t ? 'var(--accento)' : 'var(--sup-alta)',
              color: turnType === t ? '#fff' : 'var(--testo-debole)'
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
        <div style={sectionLabel}>I MIEI TURNI</div>
        {loading && <ScheletroElenco righe={4} />}
        {turns.map(turn => {
          // Un turno di un collega arriva qui solo se me l'ha passato lui.
          // Va detto: rinominarlo o eliminarlo non è affar mio, e infatti il
          // database me lo rifiuterebbe — meglio non offrire il pulsante.
          const mio = turn.coach_id === session?.user?.id
          return (
          <div key={turn.id} style={{ ...row, marginBottom: '7px' }}>
            <button type="button" onClick={() => loadClients(turn)} style={{ ...comePulsante,  flex: 1, cursor: 'pointer', paddingLeft: '4px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                {turn.name}
                {!mio && <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '800', letterSpacing: '1px', color: 'var(--accento)', verticalAlign: 'middle' }}>DI UN COLLEGA</span>}
              </div>
              <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', marginTop: '1px' }}>Tocca per gestire clienti</div>
            </button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button type="button" onClick={() => loadClients(turn)} style={{ ...comePulsante,  color: 'var(--testo-fioco)', fontSize: '18px', cursor: 'pointer' }}>›</button>
              {mio && <button onClick={() => apriGestioneTurno(turn)} style={{ background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '3px', padding: '4px 8px', color: 'var(--testo-medio)', fontSize: '14px' }}>✏️</button>}
              {mio && <button onClick={() => deleteTurn(turn.id)} style={{ background: 'none', border: 'none', color: 'var(--acc-bordo-marcato)', fontSize: '16px', padding: '4px' }}>✕</button>}
            </div>
          </div>
        )})}
        {!loading && turns.length === 0 && <div style={emptyText}>Nessun turno ancora.</div>}
        {/* spazio perché l'ultima riga non finisca sotto il pulsante flottante */}
        <div style={{ height: '76px' }} />
      </div>
      {renameTurnModal && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>{condivisioneAttiva ? 'GESTISCI TURNO' : 'RINOMINA TURNO'}</div>
            <input value={renameTurnValue} onChange={e => setRenameTurnValue(e.target.value)} autoFocus
              style={{ width: '100%', background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '4px', padding: '14px', color: '#fff', fontSize: '16px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }} />

            {condivisioneAttiva && colleghi.length > 0 && (
              <div style={{ borderTop: '1px solid var(--bordo)', paddingTop: '16px', marginBottom: '18px' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800', color: '#fff', letterSpacing: '1.5px', marginBottom: '5px' }}>
                  CHI PUÒ APRIRLO OLTRE A TE
                </div>
                <div style={{ color: 'var(--testo-medio)', fontSize: '13px', lineHeight: 1.45, marginBottom: '12px' }}>
                  Serve quando sei assente. Chi aggiungi vede atlete, schede e carichi di
                  questo turno, ma non può rinominarlo né eliminarlo.
                </div>
                <div style={{ maxHeight: '34vh', overflowY: 'auto' }}>
                  {colleghi.map(c => {
                    const dentro = condivisoCon.has(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => alternaCondivisione(renameTurnModal.id, c.id)}
                        style={{
                          ...comePulsante,
                          display: 'flex', alignItems: 'center', gap: '11px', width: '100%',
                          padding: '12px', marginBottom: '6px', borderRadius: '8px',
                          background: dentro ? 'var(--acc-riempimento)' : 'var(--sup)',
                          border: `1px solid ${dentro ? 'var(--acc-bordo-forte)' : 'transparent'}`,
                          textAlign: 'left', cursor: 'pointer',
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: dentro ? 'var(--accento)' : 'transparent',
                          border: dentro ? 'none' : '1px solid var(--bordo-forte)',
                          color: '#fff', fontSize: '14px', lineHeight: 1,
                        }}>{dentro ? '✓' : ''}</span>
                        <span style={{
                          flex: 1, minWidth: 0,
                          fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px',
                          fontWeight: '700', letterSpacing: '0.5px',
                          color: dentro ? 'var(--accento)' : 'var(--testo-forte)',
                        }}>{c.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <button onClick={saveRenameTurn} disabled={!renameTurnValue.trim()}
              style={{ ...bigBtn, marginBottom: '10px', opacity: !renameTurnValue.trim() ? 0.3 : 1 }}>✓ SALVA</button>
            <button onClick={() => setRenameTurnModal(null)} style={cancelBtn}>
              {condivisioneAttiva ? 'Chiudi' : 'Annulla'}
            </button>
          </div>
        </div>
      )}

      {deleteTurnConfirm && (
        <div style={overlay}>
          <div style={sheet}>
            <div style={sheetTitle}>ELIMINA TURNO</div>
            <div style={{ color: 'var(--testo-medio)', fontSize: '14px', marginBottom: '6px' }}>Confermi di voler eliminare questo turno?</div>
            <div style={{ color: 'rgba(239,68,68,0.8)', fontSize: '13px', marginBottom: '20px' }}>⚠ Verranno eliminati tutti i clienti, schede e carichi associati.</div>
            <button onClick={executeDeleteTurn}
              style={{ ...bigBtn, background: 'rgba(239,68,68,0.9)', marginBottom: '10px' }}>🗑 SÌ, ELIMINA</button>
            <button onClick={() => setDeleteTurnConfirm(null)} style={cancelBtn}>Annulla</button>
          </div>
        </div>
      )}
      <PulsanteFlottante etichetta="NUOVO TURNO" onClick={() => setView('addTurn')} />
      <BottomNav active="turns" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
const sectionLabel = { color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }
const fieldLabel = { color: 'var(--testo-debole)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px', padding: '13px 14px', color: '#fff', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }
const bigBtn = { width: '100%', background: 'var(--accento)', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px', cursor: 'pointer' }
const row = { background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '6px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const emptyText = { color: 'var(--bordo-forte)', fontSize: '13px', textAlign: 'center', padding: '20px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }
const sheet = { background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '24px 16px 36px', width: '100%' }
const sheetTitle = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '16px' }
const cancelBtn = { background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '10px', fontSize: '14px', cursor: 'pointer' }
