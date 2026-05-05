import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function Settings({ navigate, goHome, session }) {
  const [coach, setCoach] = useState(null)
  const [turns, setTurns] = useState([])
  const [selectedTurn, setSelectedTurn] = useState(null)
  const [clients, setClients] = useState([])
  const [view, setView] = useState('main') // main | turn | addTurn | addClient | editCoach
  const [loading, setLoading] = useState(true)

  // Forms
  const [turnName, setTurnName] = useState('')
  const [turnTime, setTurnTime] = useState('')
  const [turnType, setTurnType] = useState('Misto')
  const [clientName, setClientName] = useState('')
  const [clientSurname, setClientSurname] = useState('')
  const [coachName, setCoachName] = useState('')
  const [homeType, setHomeType] = useState('turns')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: c } = await supabase.from('coaches').select('*').eq('id', session.user.id).single()
    if (c) { setCoach(c); setCoachName(c.name); setHomeType(c.home_type || 'turns') }
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
    await supabase.from('turns').insert({ coach_id: session.user.id, name: `${turnTime} — ${turnType}`, time: turnTime, type: turnType })
    await loadData()
    setTurnName(''); setTurnTime(''); setTurnType('Misto')
    setSaving(false)
    setView('main')
  }

  async function saveClient() {
    if (!clientName.trim() || !clientSurname.trim()) return
    setSaving(true)
    await supabase.from('clients').insert({ turn_id: selectedTurn.id, name: clientName, surname: clientSurname, current_week: 1 })
    await loadClients(selectedTurn)
    setClientName(''); setClientSurname('')
    setSaving(false)
    setView('turn')
  }

  async function saveCoachProfile() {
    setSaving(true)
    await supabase.from('coaches').update({ name: coachName, home_type: homeType }).eq('id', session.user.id)
    await loadData()
    setSaving(false)
    setView('main')
  }

  async function deleteTurn(id) {
    if (!window.confirm('Eliminare questo turno e tutti i suoi dati?')) return
    await supabase.from('turns').delete().eq('id', id)
    await loadData()
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // TURN DETAIL
  if (view === 'turn') return (
    <div style={page}>
      <TopBar title={selectedTurn?.name} subtitle="Gestione clienti" onBack={() => setView('main')} />
      <div style={scroll}>
        <button onClick={() => setView('addClient')} style={orangeBtn}>+ Aggiungi cliente</button>
        <div style={sectionLabel}>Clienti ({clients.filter(c => c.is_active).length} attivi)</div>
        {clients.map(client => (
          <div key={client.id} style={{ background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '11px', padding: '11px 13px', marginBottom: '7px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: client.is_active ? '#fff' : '#444', fontSize: '13px', fontWeight: '600' }}>{client.surname} {client.name}</div>
              <div style={{ color: '#444', fontSize: '10px', marginTop: '2px' }}>Sett. {client.current_week}/6</div>
            </div>
            <button onClick={async () => {
              await supabase.from('clients').update({ is_active: !client.is_active }).eq('id', client.id)
              await loadClients(selectedTurn)
            }} style={{ background: '#2a2a2a', border: 'none', color: '#888', fontSize: '10px', padding: '5px 10px', borderRadius: '8px' }}>
              {client.is_active ? 'Archivia' : 'Riattiva'}
            </button>
          </div>
        ))}
        {clients.length === 0 && <div style={emptyText}>Nessun cliente ancora.</div>}
      </div>
    </div>
  )

  // ADD CLIENT
  if (view === 'addClient') return (
    <div style={page}>
      <TopBar title="Nuovo cliente" subtitle={selectedTurn?.name} onBack={() => setView('turn')} />
      <div style={scroll}>
        <div style={fieldLabel}>Nome</div>
        <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="es. Mario" style={inp} />
        <div style={{ ...fieldLabel, marginTop: '12px' }}>Cognome</div>
        <input value={clientSurname} onChange={e => setClientSurname(e.target.value)} placeholder="es. Rossi" style={inp} />
        <button onClick={saveClient} disabled={saving || !clientName.trim() || !clientSurname.trim()}
          style={{ ...orangeBtn, marginTop: '20px', opacity: !clientName.trim() || !clientSurname.trim() ? 0.4 : 1 }}>
          {saving ? 'Salvataggio...' : '✓ Salva cliente'}
        </button>
      </div>
    </div>
  )

  // ADD TURN
  if (view === 'addTurn') return (
    <div style={page}>
      <TopBar title="Nuovo turno" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={fieldLabel}>Orario</div>
        <input value={turnTime} onChange={e => setTurnTime(e.target.value)} placeholder="es. 13:30" style={inp} />
        <div style={{ ...fieldLabel, marginTop: '12px' }}>Tipo</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          {['Maschile','Femminile','Misto'].map(t => (
            <button key={t} onClick={() => setTurnType(t)} style={{
              flex: 1, padding: '10px 6px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '600',
              background: turnType === t ? '#D95C1A' : '#1e1e1e', color: turnType === t ? '#fff' : '#555'
            }}>{t}</button>
          ))}
        </div>
        <button onClick={saveTurn} disabled={saving || !turnTime.trim()}
          style={{ ...orangeBtn, marginTop: '20px', opacity: !turnTime.trim() ? 0.4 : 1 }}>
          {saving ? 'Salvataggio...' : '✓ Salva turno'}
        </button>
      </div>
    </div>
  )

  // EDIT COACH
  if (view === 'editCoach') return (
    <div style={page}>
      <TopBar title="Il mio profilo" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={fieldLabel}>Nome visualizzato</div>
        <input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="Il tuo nome" style={inp} />

        <div style={{ ...fieldLabel, marginTop: '16px' }}>Tipo di home</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => setHomeType('turns')} style={{ ...optBtn, border: homeType === 'turns' ? '1.5px solid #D95C1A' : '0.5px solid #2a2a2a' }}>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>Vista Turni</div>
            <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>Apri l'app e vedi subito i tuoi turni</div>
          </button>
          <button onClick={() => setHomeType('phases')} style={{ ...optBtn, border: homeType === 'phases' ? '1.5px solid #D95C1A' : '0.5px solid #2a2a2a' }}>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>Vista Fasi</div>
            <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>Scegli prima la fase del ciclo (1-2 / 3-4 / 5-6)</div>
          </button>
        </div>

        <button onClick={saveCoachProfile} disabled={saving}
          style={{ ...orangeBtn, marginTop: '20px' }}>
          {saving ? 'Salvataggio...' : '✓ Salva profilo'}
        </button>
      </div>
    </div>
  )

  // MAIN SETTINGS
  return (
    <div style={page}>
      <TopBar title="Impostazioni" />
      <div style={scroll}>
        {/* Coach profile */}
        <div style={sectionLabel}>Il mio profilo</div>
        <div onClick={() => setView('editCoach')} style={{ ...row, cursor: 'pointer' }}>
          <div>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{coach?.name || 'Coach'}</div>
            <div style={{ color: '#555', fontSize: '11px', marginTop: '1px' }}>{session.user.email}</div>
          </div>
          <div style={{ color: '#444', fontSize: '18px' }}>›</div>
        </div>

        {/* Turns */}
        <div style={{ ...sectionLabel, marginTop: '20px' }}>I miei turni</div>
        <button onClick={() => setView('addTurn')} style={orangeBtn}>+ Aggiungi turno</button>
        {loading && <div style={{ color: '#444', fontSize: '12px', padding: '12px', textAlign: 'center' }}>Caricamento...</div>}
        {turns.map(turn => (
          <div key={turn.id} style={{ ...row, marginBottom: '7px' }}>
            <div onClick={() => loadClients(turn)} style={{ flex: 1, cursor: 'pointer' }}>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{turn.name}</div>
              <div style={{ color: '#555', fontSize: '11px', marginTop: '1px' }}>Tocca per gestire clienti</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div onClick={() => loadClients(turn)} style={{ color: '#444', fontSize: '18px', cursor: 'pointer' }}>›</div>
              <button onClick={() => deleteTurn(turn.id)} style={{ background: 'none', border: 'none', color: '#E85C1A', fontSize: '14px' }}>✕</button>
            </div>
          </div>
        ))}
        {!loading && turns.length === 0 && <div style={emptyText}>Nessun turno ancora.</div>}

        {/* Sign out */}
        <div style={{ marginTop: '32px' }}>
          <button onClick={signOut} style={{ width: '100%', background: '#1e1e1e', border: '0.5px solid #2a2a2a', color: '#E85C1A', padding: '13px', borderRadius: '11px', fontSize: '14px', fontWeight: '600' }}>
            Esci dall'account
          </button>
        </div>
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '14px 16px' }
const sectionLabel = { color: '#555', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }
const orangeBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '12px', borderRadius: '11px', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }
const fieldLabel = { color: '#555', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }
const inp = { width: '100%', background: '#1e1e1e', border: '0.5px solid #333', borderRadius: '11px', padding: '13px 14px', color: '#fff', fontSize: '14px', outline: 'none' }
const row = { background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '11px', padding: '11px 13px', marginBottom: '7px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const emptyText = { color: '#333', fontSize: '12px', textAlign: 'center', padding: '16px', background: '#1a1a1a', borderRadius: '11px' }
const optBtn = { width: '100%', background: '#1e1e1e', borderRadius: '11px', padding: '12px 13px', textAlign: 'left', cursor: 'pointer' }
