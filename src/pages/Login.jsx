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
      minHeight: '100vh', background: '#111', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px'
    }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', fontWeight: '800', color: '#D95C1A', letterSpacing: '2px', marginBottom: '6px' }}>GYMCOACH</div>
        <div style={{ color: '#444', fontSize: '13px' }}>Accedi con le tue credenziali</div>
      </div>

      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '340px' }}>
        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          style={inp} required
        />
        <input
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ ...inp, marginTop: '10px' }} required
        />
        {error && <div style={{ color: '#E85C1A', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>{error}</div>}
        <button type="submit" disabled={loading} style={btn}>
          {loading ? 'Accesso in corso...' : 'Accedi →'}
        </button>
      </form>
    </div>
  )
}

const inp = {
  width: '100%', background: '#1e1e1e', border: '0.5px solid #333',
  borderRadius: '12px', padding: '15px 16px', color: '#fff', fontSize: '15px', outline: 'none'
}
const btn = {
  width: '100%', background: '#D95C1A', border: 'none', borderRadius: '12px',
  padding: '15px', color: '#fff', fontSize: '16px', fontWeight: '700', marginTop: '16px'
}
