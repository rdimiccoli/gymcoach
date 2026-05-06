import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o password errati')
    setLoading(false)
  }

  const handleReset = async () => {
    if (!resetEmail.trim()) return
    setResetLoading(true)
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    })
    setResetLoading(false)
    setResetSent(true)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background gym image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.18,
      }} />

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(10,10,10,0.3) 0%, rgba(10,10,10,0.95) 60%)'
      }} />

      {/* Content */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '40px 28px 50px' }}>

        {/* Logo */}
        <div style={{ marginBottom: '48px' }}>
          <img src="/logo_OAD.png" alt="OAD" style={{ height: '40px', mixBlendMode: 'screen', marginBottom: '10px', display: 'block' }} />
          <div style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: '64px', fontWeight: '900',
            letterSpacing: '4px',
            color: '#fff',
            lineHeight: 1,
            marginBottom: '8px',
          }}>GYM<span style={{ color: '#D95C1A' }}>COACH</span></div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', fontWeight: '400', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Gestione schede · Carichi · Progressi
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '12px' }}>
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              style={inp} required
            />
          </div>
          <div style={{ marginBottom: '6px', position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...inp, paddingRight: '48px' }} required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: showPassword ? '#D95C1A' : 'rgba(255,255,255,0.3)',
                fontSize: '18px', lineHeight: 1, padding: '4px',
              }}
            >
              {showPassword ? '👁' : '👁‍🗨'}
            </button>
          </div>

          {error && (
            <div style={{ color: '#E85C1A', fontSize: '13px', marginBottom: '12px', paddingLeft: '4px' }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={btn}>
            {loading ? 'Accesso...' : 'ACCEDI'}
          </button>
        </form>

        {/* Forgot password */}
        {!showReset ? (
          <div style={{ textAlign: 'center', marginTop: '18px' }}>
            <span
              onClick={() => { setShowReset(true); setResetEmail(email) }}
              style={{ color: 'rgba(217,92,26,0.7)', fontSize: '12px', letterSpacing: '1px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
              PASSWORD DIMENTICATA?
            </span>
          </div>
        ) : resetSent ? (
          <div style={{ marginTop: '18px', background: 'rgba(217,92,26,0.08)', border: '1px solid rgba(217,92,26,0.25)', borderRadius: '4px', padding: '14px', textAlign: 'center' }}>
            <div style={{ color: '#D95C1A', fontSize: '13px', fontWeight: '700', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', marginBottom: '4px' }}>✓ EMAIL INVIATA</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Controlla la tua casella e segui il link per reimpostare la password.</div>
            <span onClick={() => { setShowReset(false); setResetSent(false) }} style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', cursor: 'pointer', marginTop: '8px', display: 'inline-block' }}>← Torna al login</span>
          </div>
        ) : (
          <div style={{ marginTop: '18px' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '8px', letterSpacing: '0.5px' }}>Inserisci la tua email per ricevere il link di reset:</div>
            <input
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              placeholder="Email" type="email"
              style={{ ...inp, marginBottom: '8px' }}
            />
            <button onClick={handleReset} disabled={resetLoading || !resetEmail.trim()} style={{ ...btn, background: 'transparent', border: '1px solid rgba(217,92,26,0.5)', color: '#D95C1A' }}>
              {resetLoading ? 'INVIO...' : 'INVIA LINK DI RESET'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <span onClick={() => setShowReset(false)} style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', cursor: 'pointer' }}>← Torna al login</span>
            </div>
          </div>
        )}

        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', textAlign: 'center', marginTop: '24px', letterSpacing: '1px' }}>
          RISERVATO AI COACH
        </div>
      </div>
    </div>
  )
}

const inp = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  padding: '16px 18px',
  color: '#fff',
  fontSize: '15px',
  outline: 'none',
  letterSpacing: '0.3px',
}

const btn = {
  width: '100%',
  background: '#D95C1A',
  border: 'none',
  borderRadius: '4px',
  padding: '17px',
  color: '#fff',
  fontSize: '15px',
  fontWeight: '700',
  letterSpacing: '3px',
  fontFamily: 'Barlow Condensed, sans-serif',
  marginTop: '8px',
}
