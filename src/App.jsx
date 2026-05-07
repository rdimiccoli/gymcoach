import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Home from './pages/Home'
import TurnDetail from './pages/TurnDetail'
import ClientProfile from './pages/ClientProfile'
import CyclesList from './pages/CyclesList'
import CycleForm from './pages/CycleForm'
import CycleShare from './pages/CycleShare'
import Settings from './pages/Settings'
import Turns from './pages/Turns'
import ChangePassword from './pages/ChangePassword'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)
  const [stack, setStack] = useState([{ page: 'home', params: {} }])
  const [showExitModal, setShowExitModal] = useState(false)
  const stackRef = useRef(stack)
  const recoveryRef = useRef(false)

  useEffect(() => { stackRef.current = stack }, [stack])

  useEffect(() => {
    // Check for recovery token in hash BEFORE anything else
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      recoveryRef.current = true
      setIsRecovery(true)
      // Clean URL immediately
      window.history.replaceState(null, '', window.location.pathname)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true
        setIsRecovery(true)
        window.history.replaceState(null, '', window.location.pathname)
      }
      setSession(session)
      if (!session) {
        setStack([{ page: 'home', params: {} }])
        setIsRecovery(false)
        recoveryRef.current = false
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Back button handler ───────────────────────────────────────────────────
  useEffect(() => {
    // Push one dummy state so we can intercept back
    window.history.pushState({ gymcoach: true }, '')

    const handlePopState = (e) => {
      // Never intercept during recovery flow
      if (recoveryRef.current) {
        window.history.pushState({ gymcoach: true }, '')
        return
      }

      const current = stackRef.current
      if (current.length > 1) {
        // Go back within the app
        setStack(prev => prev.slice(0, -1))
        window.history.pushState({ gymcoach: true }, '')
      } else {
        // On home — show our custom modal instead of window.confirm
        window.history.pushState({ gymcoach: true }, '')
        setShowExitModal(true)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  // ─────────────────────────────────────────────────────────────────────────

  const navigate = (page, params = {}) => setStack(prev => [...prev, { page, params }])
  const goBack = () => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  const goHome = () => setStack([{ page: 'home', params: {} }])

  if (loading) return <Splash />

  if (isRecovery && session) {
    return <ChangePassword onDone={() => {
      setIsRecovery(false)
      recoveryRef.current = false
    }} />
  }

  if (!session) return <Login />

  const current = stack[stack.length - 1]
  const props = { navigate, goBack, goHome, params: current.params, session }

  const pages = {
    home: Home,
    turn: TurnDetail,
    client: ClientProfile,
    cycles: CyclesList,
    'cycle-form': CycleForm,
    'cycle-share': CycleShare,
    settings: Settings,
    turns: Turns,
  }

  const Page = pages[current.page] || Home

  return (
    <>
      <Page {...props} />

      {/* Custom exit modal — replaces window.confirm */}
      {showExitModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '28px 24px', width: '100%', maxWidth: '320px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>👋</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '8px' }}>
              USCIRE DA GYMCOACH?
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', marginBottom: '24px' }}>
              Sei sicura di voler uscire dall'app?
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowExitModal(false)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '13px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
                RESTA
              </button>
              <button onClick={() => { setShowExitModal(false); window.history.go(-2) }}
                style={{ flex: 1, background: 'rgba(217,92,26,0.15)', border: '1px solid rgba(217,92,26,0.4)', borderRadius: '6px', padding: '13px', color: '#D95C1A', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
                ESCI
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Splash() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a', gap: '20px' }}>
      <img src="/logo_OAD.png" alt="OAD" style={{ width: '120px', mixBlendMode: 'screen' }} />
      <div style={{ color: '#D95C1A', fontSize: '28px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>GYMCOACH</div>
    </div>
  )
}
