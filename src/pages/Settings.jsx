import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk, notifyError } from '../lib/notify'
import { biometriaDisponibile, bloccoAttivo, attivaBlocco, disattivaBlocco, MINUTI_RIBLOCCO } from '../lib/biometria'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function Settings({ navigate, goHome, session }) {
  const [coach, setCoach] = useState(null)
  const [stats, setStats] = useState({ turns: 0, clients: 0 })
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

  // Sblocco biometrico (per dispositivo, non per account)
  const [bioDisponibile, setBioDisponibile] = useState(false)
  const [bioAttivo, setBioAttivo] = useState(() => bloccoAttivo(session.user.id))
  const [bioInCorso, setBioInCorso] = useState(false)

  useEffect(() => { loadData() }, [])
  useEffect(() => { biometriaDisponibile().then(setBioDisponibile) }, [])

  async function cambiaHomeType(nuovo) {
    if (!coach || coach.home_type === nuovo) return
    const precedente = coach.home_type
    setCoach(c => ({ ...c, home_type: nuovo })) // ottimistico: il tocco deve rispondere subito
    const { error } = await run(
      supabase.from('coaches').update({ home_type: nuovo }).eq('id', session.user.id),
      'Schermata iniziale non salvata.'
    )
    if (error) setCoach(c => ({ ...c, home_type: precedente }))
  }

  async function toggleBiometria() {
    if (bioAttivo) {
      disattivaBlocco()
      setBioAttivo(false)
      notifyOk('Sblocco biometrico disattivato su questo dispositivo')
      return
    }
    setBioInCorso(true)
    const esito = await attivaBlocco(session.user.id, session.user.email, coach?.name)
    setBioInCorso(false)
    if (!esito.ok) { notifyError(esito.errore); return }
    setBioAttivo(true)
    notifyOk('Sblocco biometrico attivato su questo dispositivo')
  }

  async function loadData() {
    const [{ data: c }, { data: t }] = await Promise.all([
      run(supabase.from('coaches').select('*').eq('id', session.user.id).maybeSingle(),
        'Impossibile caricare il profilo coach.'),
      run(supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time'),
        'Impossibile caricare i turni.'),
    ])
    if (c) { setCoach(c); setCoachName(c.name) }

    const allC = []
    if (t?.length) {
      // Qui c'era un for sequenziale: una query per turno, una dopo l'altra.
      // Ora è una sola per tutti i turni.
      const nomiTurni = Object.fromEntries(t.map(turn => [turn.id, turn.name]))
      const { data: clients } = await run(
        supabase.from('clients').select('*').in('turn_id', t.map(x => x.id)).eq('is_active', true),
        'Impossibile caricare gli atleti.'
      )
      ;(clients || []).forEach(cl => allC.push({ ...cl, turnName: nomiTurni[cl.turn_id] || '' }))
    }
    // Sort alphabetically by surname
    allC.sort((a, b) => (a.surname || '').localeCompare(b.surname || ''))
    setStats({ turns: t?.length || 0, clients: allC.length })
  }

  async function saveCoachName() {
    if (!coachName.trim()) return
    setSaving(true)
    const { error } = await run(
      supabase.from('coaches').update({ name: coachName.trim() }).eq('id', session.user.id),
      'Nome non salvato.'
    )
    setSaving(false)
    if (error) return
    setCoach(c => ({ ...c, name: coachName.trim() }))
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
            <button onClick={() => navigate('athletes')}
              style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '4px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>ATLETI ATTIVI</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{stats.clients}</div>
              <div style={{ color: '#D95C1A', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px', letterSpacing: '1px' }}>VEDI LISTA →</div>
            </button>
          </div>
        </div>

        {/* Schermata iniziale */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '14px 16px', marginBottom: '10px' }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: '1px', marginBottom: '3px' }}>
            ⬡ SCHERMATA INIZIALE
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginBottom: '11px', lineHeight: 1.4 }}>
            Da cosa vuoi partire quando apri l'app.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'phases', etichetta: 'FASI', sotto: 'Scegli prima la fase' },
              { id: 'turns', etichetta: 'TURNI', sotto: 'Vai dritta ai turni' },
            ].map(opt => {
              const attiva = (coach?.home_type ?? 'phases') === opt.id
              return (
                <button key={opt.id} onClick={() => cambiaHomeType(opt.id)} style={{
                  flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: '4px', cursor: 'pointer',
                  background: attiva ? 'rgba(217,92,26,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${attiva ? 'rgba(217,92,26,0.45)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '1px', color: attiva ? '#D95C1A' : 'rgba(255,255,255,0.45)' }}>
                    {attiva ? '● ' : ''}{opt.etichetta}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginTop: '2px' }}>{opt.sotto}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sblocco biometrico */}
        {bioDisponibile && (
          <div style={{
            background: bioAttivo ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${bioAttivo ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px', padding: '14px 16px', marginBottom: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: '1px' }}>
                  👆 SBLOCCO BIOMETRICO
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '3px', lineHeight: 1.4 }}>
                  {bioAttivo
                    ? `Attivo su questo dispositivo. L'app si riblocca dopo ${MINUTI_RIBLOCCO} minuti in secondo piano.`
                    : 'Chiedi impronta, volto o PIN all\'apertura. Senza, chi prende in mano il dispositivo entra direttamente.'}
                </div>
              </div>
              <button onClick={toggleBiometria} disabled={bioInCorso} style={{
                flexShrink: 0,
                background: bioAttivo ? 'rgba(239,68,68,0.12)' : '#D95C1A',
                border: bioAttivo ? '1px solid rgba(239,68,68,0.35)' : 'none',
                borderRadius: '4px', padding: '9px 14px',
                color: bioAttivo ? 'rgba(239,68,68,0.9)' : '#fff',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px',
                fontWeight: '700', letterSpacing: '1px',
                opacity: bioInCorso ? 0.5 : 1, cursor: 'pointer',
              }}>
                {bioInCorso ? '...' : bioAttivo ? 'DISATTIVA' : 'ATTIVA'}
              </button>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', marginTop: '8px', lineHeight: 1.35 }}>
              L'impostazione vale solo su questo dispositivo: va attivata su ogni telefono o computer che usi.
            </div>
          </div>
        )}

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
const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '13px 14px', color: '#fff', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }
const bigBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px', cursor: 'pointer' }
const eyeBtn = { position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '18px', lineHeight: 1, padding: '4px' }
