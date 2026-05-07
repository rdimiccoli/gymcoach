import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

export default function Settings({ navigate, goHome, session }) {
  const [coach, setCoach] = useState(null)
  const [stats, setStats] = useState({ turns: 0, clients: 0 })
  const [view, setView] = useState('main')
  const [coachName, setCoachName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: c } = await supabase.from('coaches').select('*').eq('id', session.user.id).single()
    if (c) { setCoach(c); setCoachName(c.name) }
    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id)
    let totalClients = 0
    if (t?.length) {
      for (const turn of t) {
        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('turn_id', turn.id).eq('is_active', true)
        totalClients += count || 0
      }
    }
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

  async function signOut() {
    await supabase.auth.signOut()
  }

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

  return (
    <div style={page}>
      <TopBar title="IMPOSTAZIONI" />
      <div style={scroll}>
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
const scroll = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
const fieldLabel = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }
const inp = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '13px 14px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
const bigBtn = { width: '100%', background: '#D95C1A', border: 'none', color: '#fff', padding: '14px', borderRadius: '4px', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '2px' }
