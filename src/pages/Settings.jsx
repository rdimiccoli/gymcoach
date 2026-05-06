import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function Settings({ navigate, goHome, session }) {
  const [coach, setCoach] = useState(null)
  const [turns, setTurns] = useState([])
  const [clients, setClients] = useState([])
  const [selectedTurn, setSelectedTurn] = useState(null)
  const [view, setView] = useState('main')
  const [stats, setStats] = useState({ turns: 0, clients: 0 })
  const [loading, setLoading] = useState(true)

  const [coachName, setCoachName] = useState('')
  const [turnTime, setTurnTime] = useState('')
  const [turnType, setTurnType] = useState('Misto')
  const [clientName, setClientName] = useState('')
  const [clientSurname, setClientSurname] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: c } = await supabase.from('coaches').select('*').eq('id', session.user.id).single()
    if (c) { setCoach(c); setCoachName(c.name) }
    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time')
    setTurns(t || [])
    let totalClients = 0
    if (t?.length) {
      for (const turn of t) {
        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('turn_id', turn.id).eq('is_active', true)
        totalClients += count || 0
      }
    }
    setStats({ turns: t?.length || 0, clients: totalClients })
    setLoading(false)
  }

  async function loadClients(turn) {
    setSelectedTurn(turn)
    const { data } = await supabase.from('clients').select('*').eq('turn_id', turn.id).order('surname')
    setClients(data || [])
    setView('turn')
  }

  async function saveCoachName() {
    if (!coachName.trim()) return
    setSaving(true)
    await supabase.from('coaches').update({ name: coachName }).eq('id', session.user.id)
    setCoach(c => ({ ...c, name: coachName }))
    setSaving(false)
    setView('main')
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
    if (!window.confirm('Eliminare questo turno e tutti i suoi dati?')) return
    await supabase.from('turns').delete().eq('id', id)
    await loadData()
  }

  async function toggleClient(client) {
    await supabase.from('clients').update({ is_active: !client.is_active }).eq('id', client.id)
    await loadClients(selectedTurn)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // TURN CLIENTS VIEW
  if (view === 'turn') return (
    <div style={page}>
      <TopBar title={selectedTurn?.name} subtitle="Gestione clienti" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={sectionLabel}>AGGIUNGI CLIENTE</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome" style={{ ...inp, flex: 1 }} />
          <input value={clientSurname} onChange={e => setClientSurname(e.target.value)} placeholder="Cognome" style={{ ...inp, flex: 1 }} />
          <button onClick={saveClient} disabled={!clientName.trim() || !clientSurname.trim() || saving}
            style={{ background: '#D95C1A', border: 'none', borderRadius: '4px', padding: '0 14px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', fontSize: '18px', opacity: !clientName.trim() || !clientSurname.trim() ? 0.3 : 1 }}>
            +
          </button>
        </div>

        <div style={sectionLabel}>CLIENTI ({clients.filter(c => c.is_active).length} ATTIVI)</div>
        {clients.map(client => (
          <div key={client.id} style={{ ...row, opacity: client.is_active ? 1 : 0.4 }}>
            <div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>{client.surname} {client.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '1px' }}>Settimana {client.current_week}/6</div>
            </div>
            <button onClick={() => toggleClient(client)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', padding: '6px 12px', borderRadius: '3px' }}>
              {client.is_active ? 'ARCHIVIA' : 'RIATTIVA'}
            </button>
          </div>
        ))}
        {clients.length === 0 && <div style={emptyText}>Nessun cliente ancora.</div>}
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ADD TURN VIEW
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
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // EDIT NAME VIEW
  if (view === 'editName') return (
    <div style={page}>
      <TopBar title="IL MIO PROFILO" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={fieldLabel}>NOME VISUALIZZATO</div>
        <input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="Il tuo nome" style={inp} />
        <button onClick={saveCoachName} disabled={saving || !coachName.trim()}
          style={{ ...bigBtn, marginTop: '20px' }}>
          {saving ? 'SALVATAGGIO...' : '✓ SALVA'}
        </button>
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // MAIN SETTINGS
  return (
    <div style={page}>
      <TopBar title="SETUP" />
      <div style={scroll}>

        {/* Profile card */}
        <div style={{ background: 'rgba(217,92,26,0.08)', border: '1px solid rgba(217,92,26,0.2)', borderRadius: '6px', padding: '18px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '900', color: '#fff', letterSpacing: '1px' }}>{coach?.name?.toUpperCase()}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>{session.user.email}</div>
            </div>
            <button onClick={() => setView('editName')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', padding: '7px 12px', borderRadius: '3px' }}>
              MODIFICA
            </button>
          </div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '10px 12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>TURNI</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff' }}>{stats.turns}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '10px 12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>ATLETI ATTIVI</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff' }}>{stats.clients}</div>
            </div>
          </div>
        </div>

        {/* Turns */}
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
              <button onClick={() => deleteTurn(turn.id)} style={{ background: 'none', border: 'none', color: 'rgba(232,92,26,0.5)', fontSize: '16px', padding: '4px' }}>✕</button>
            </div>
          </div>
        ))}

        {!loading && turns.length === 0 && <div style={emptyText}>Nessun turno ancora.</div>}

        {/* Logout */}
        <button onClick={signOut} style={{ ...bigBtn, background: 'transparent', border: '1px solid rgba(232,92,26,0.3)', color: 'rgba(232,92,26,0.7)', marginTop: '28px' }}>
          ESCI DALL'ACCOUNT
        </button>
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px' }
const sectionLabel = { color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }
const fieldLabel = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '13px 14px', color: '#fff', fontSize: '14px', outline: 'none' }
const bigBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px' }
const row = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const emptyText = { color: 'rgba(255,255,255,0.15)', fontSize: '12px', textAlign: 'center', padding: '20px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }
