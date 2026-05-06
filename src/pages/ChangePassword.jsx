import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ChangePassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setError('')
    if (password.length < 6) { setError('La password deve essere di almeno 6 caratteri.'); return }
    if (password !== confirm) { setError('Le due password non coincidono.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError('Errore durante il salvataggio. Riprova.'); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => onDone(), 2000)
  }

  return (
    <div style={{
      minHeight: '100dvh', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px',
    }}>
      <img src="/logo_OAD.png" alt="OAD" style={{ height: '40px', mixBlendMode: 'screen', marginBottom: '12px' }} />
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: '900', color: '#fff', letterSpacing: '2px', marginBottom: '6px' }}>
        GYM<span style={{ color: '#D95C1A' }}>COACH</span>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '36px', textTransform: 'uppercase' }}>
        Nuova password
      </div>

      {success ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
          <div style={{ color: '#D95C1A', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '700', letterSpacing: '1px' }}>PASSWORD AGGIORNATA</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '6px' }}>Accesso in corso...</div>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <div style={label}>NUOVA PASSWORD</div>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Minimo 6 caratteri"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...inp, paddingRight: '48px' }}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} style={eyeBtn}>
              {showPassword ? '👁' : '👁‍🗨'}
            </button>
          </div>

          <div style={label}>CONFERMA PASSWORD</div>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Ripeti la password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            style={{ ...inp, marginBottom: '6px' }}
          />

          {error && (
            <div style={{ color: '#E85C1A', fontSize: '12px', marginBottom: '12px', paddingLeft: '2px' }}>{error}</div>
          )}

          <button
            onClick={handleSave}
            disabled={loading || !password || !confirm}
            style={{ ...btn, opacity: !password || !confirm ? 0.4 : 1, marginTop: '16px' }}
          >
            {loading ? 'SALVATAGGIO...' : '✓ SALVA NUOVA PASSWORD'}
          </button>
        </div>
      )}
    </div>
  )
}

const label = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '16px 18px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }
const btn = { width: '100%', background: '#D95C1A', border: 'none', borderRadius: '4px', padding: '17px', color: '#fff', fontSize: '15px', fontWeight: '700', letterSpacing: '3px', fontFamily: 'Barlow Condensed, sans-serif', cursor: 'pointer' }
const eyeBtn = { position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '18px', lineHeight: 1, padding: '4px' }
