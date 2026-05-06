import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o password errati')
    setLoading(false)
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
          <div style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: '64px', fontWeight: '900',
            letterSpacing: '4px',
            color: '#fff',
            lineHeight: 1,
            marginBottom: '6px'
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
          <div style={{ marginBottom: '6px' }}>
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              style={inp} required
            />
          </div>

          {error && (
            <div style={{ color: '#E85C1A', fontSize: '13px', marginBottom: '12px', paddingLeft: '4px' }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={btn}>
            {loading ? 'Accesso...' : 'ACCEDI'}
          </button>
        </form>

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
