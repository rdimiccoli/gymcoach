import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function Settings({ navigate, goHome, session }) {
  const [coach, setCoach] = useState(null)
  const [stats, setStats] = useState({ turns: 0, clients: 0 })
  const [allClients, setAllClients] = useState([])
  const [turns, setTurns] = useState([])
  const [view, setView] = useState('main')
  const [coachName, setCoachName] = useState('')
  const [saving, setSaving] = useState(false)

  // Password change
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: c } = await supabase.from('coaches').select('*').eq('id', session.user.id).single()
    if (c) { setCoach(c); setCoachName(c.name) }
    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time')
    setTurns(t || [])
    let totalClients = 0
    const allC = []
    if (t?.length) {
      for (const turn of t) {
        const { data: clients } = await supabase.from('clients').select('*').eq('turn_id', turn.id).eq('is_active', true).order('surname')
        if (clients?.length) {
          clients.forEach(cl => allC.push({ ...cl, turnName: turn.name }))
          totalClients += clients.length
        }
      }
    }
    // Sort alphabetically by surname
    allC.sort((a, b) => a.surname.localeCompare(b.surname))
    setAllClients(allC)
    setStats({ turns: t?.length || 0, clients: totalClients })
  }

  async function saveCoachName() {
    if (!coachName.trim()) return
    setSaving(true)
    await supabase.from('coaches').update({ name: coachName }).eq('id', session.user.id)
    setCoach(c => ({ ...c, name: coachName }))
    setSaving(false)
    setView('main')
  }

  async function savePassword() {
    setPwdError('')
    if (newPwd.length < 6) { setPwdError('La password deve essere di almeno 6 caratteri.'); return }
    if (newPwd !== confirmPwd) { setPwdError('Le due password non coincidono.'); return }
    setSaving(true)
    // Re-authenticate first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email, password: currentPwd
    })
    if (signInError) { setPwdError('Password attuale errata.'); setSaving(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    if (error) { setPwdError('Errore nel salvataggio. Riprova.'); setSaving(false); return }
    setSaving(false)
    setPwdSuccess(true)
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    setTimeout(() => { setPwdSuccess(false); setView('main') }, 2000)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // ── EDIT NAME ─────────────────────────────────────────────────────────────
  if (view === 'editName') return (
    <div style={page}>
      <TopBar title="MODIFICA NOME" onBack={() => setView('main')} />
      <div style={scroll}>
        <div style={fieldLabel}>NOME VISUALIZZATO</div>
        <input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="Il tuo nome" style={inp} />
        <button onClick={saveCoachName} disabled={saving || !coachName.trim()} style={{ ...bigBtn, marginTop: '20px' }}>
          {saving ? 'SALVATAGGIO...' : '✓ SALVA'}
        </button>
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── CHANGE PASSWORD ───────────────────────────────────────────────────────
  if (view === 'changePassword') return (
    <div style={page}>
      <TopBar title="MODIFICA PASSWORD" onBack={() => { setView('main'); setPwdError(''); setPwdSuccess(false) }} />
      <div style={scroll}>
        {pwdSuccess ? (
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ color: '#22c55e', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '700', letterSpacing: '1px' }}>PASSWORD AGGIORNATA!</div>
          </div>
        ) : (
          <>
            <div style={fieldLabel}>PASSWORD ATTUALE</div>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input type={showPwd ? 'text' : 'password'} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
                placeholder="Password attuale" style={{ ...inp, paddingRight: '48px' }} />
              <button type="button" onClick={() => setShowPwd(v => !v)} style={eyeBtn}>{showPwd ? '👁' : '👁‍🗨'}</button>
            </div>

            <div style={fieldLabel}>NUOVA PASSWORD</div>
            <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder="Minimo 6 caratteri" style={{ ...inp, marginBottom: '16px' }} />

            <div style={fieldLabel}>CONFERMA NUOVA PASSWORD</div>
            <input type={showPwd ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Ripeti la nuova password" style={{ ...inp, marginBottom: '8px' }} />

            {pwdError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px', paddingLeft: '2px' }}>{pwdError}</div>}

            <button onClick={savePassword} disabled={saving || !currentPwd || !newPwd || !confirmPwd}
              style={{ ...bigBtn, marginTop: '16px', opacity: !currentPwd || !newPwd || !confirmPwd ? 0.3 : 1 }}>
              {saving ? 'SALVATAGGIO...' : '✓ AGGIORNA PASSWORD'}
            </button>
          </>
        )}
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── ATHLETES LIST ─────────────────────────────────────────────────────────
  if (view === 'athletes') return (
    <div style={page}>
      <TopBar title="ATLETI ATTIVI" subtitle={`${stats.clients} atleti`} onBack={() => setView('main')} />
      <div style={scroll}>
        {allClients.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '40px', fontSize: '13px' }}>Nessun atleta attivo.</div>
        )}
        {allClients.map((client, i) => (
          <div key={client.id}
            onClick={() => navigate('athlete-profile', { client })}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px', padding: '12px 16px', marginBottom: '7px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
            }}>
            <div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                {client.surname} {client.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>{client.turnName}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: 'rgba(217,92,26,0.15)', borderRadius: '3px', padding: '4px 10px' }}>
                <div style={{ color: '#D95C1A', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>SETT. {client.current_week}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px' }}>›</div>
            </div>
          </div>
        ))}
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )

  // ── MAIN SETTINGS ─────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <TopBar title="IMPOSTAZIONI" />
      <div style={scroll}>

        {/* Profile card */}
        <div style={{ background: 'rgba(217,92,26,0.08)', border: '1px solid rgba(217,92,26,0.2)', borderRadius: '6px', padding: '18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '900', color: '#fff', letterSpacing: '1px' }}>{coach?.name?.toUpperCase()}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>{session.user.email}</div>
            </div>
            <button onClick={() => setView('editName')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', padding: '7px 12px', borderRadius: '3px' }}>
              MODIFICA
            </button>
          </div>

          {/* Stats — clickable */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button onClick={() => navigate('turns')}
              style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>TURNI</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{stats.turns}</div>
              <div style={{ color: '#D95C1A', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px', letterSpacing: '1px' }}>VEDI TURNI →</div>
            </button>
            <button onClick={() => setView('athletes')}
              style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>ATLETI ATTIVI</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{stats.clients}</div>
              <div style={{ color: '#D95C1A', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px', letterSpacing: '1px' }}>VEDI LISTA →</div>
            </button>
          </div>
        </div>

        {/* Change password */}
        <button onClick={() => setView('changePassword')}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: '1px' }}>🔒 MODIFICA PASSWORD</div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px' }}>›</div>
        </button>

        {/* Logout */}
        <button onClick={signOut} style={{ ...bigBtn, background: 'transparent', border: '1px solid rgba(232,92,26,0.3)', color: 'rgba(232,92,26,0.7)', marginTop: '8px' }}>
          ESCI DALL'ACCOUNT
        </button>
        <div style={{ height: '20px' }} />
      </div>
      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const fieldLabel = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '13px 14px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
const bigBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px', cursor: 'pointer' }
const eyeBtn = { position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '18px', lineHeight: 1, padding: '4px' }
