import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Home from './pages/Home'
import TurnDetail from './pages/TurnDetail'
import ClientProfile from './pages/ClientProfile'
import CyclesList from './pages/CyclesList'
import CycleForm from './pages/CycleForm'
import Settings from './pages/Settings'
import Turns from './pages/Turns'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stack, setStack] = useState([{ page: 'home', params: {} }])
  const stackRef = useRef(stack)

  useEffect(() => { stackRef.current = stack }, [stack])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
      if (!session) setStack([{ page: 'home', params: {} }])
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Back button / gesture handler ──────────────────────────────────────────
  useEffect(() => {
    // Push a dummy state so we always have something to pop
    window.history.pushState({ gymcoach: true }, '')

    const handlePopState = () => {
      const current = stackRef.current
      if (current.length > 1) {
        // Go back within the app
        setStack(prev => prev.slice(0, -1))
        // Re-push state so next back press is also intercepted
        window.history.pushState({ gymcoach: true }, '')
      } else {
        // On home: ask confirmation before leaving
        const leave = window.confirm('Vuoi uscire da GymCoach?')
        if (leave) {
          // Let the browser navigate away
          window.history.back()
        } else {
          // Stay: re-push state
          window.history.pushState({ gymcoach: true }, '')
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  // ──────────────────────────────────────────────────────────────────────────

  const navigate = (page, params = {}) => {
    setStack(prev => [...prev, { page, params }])
  }
  const goBack = () => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  const goHome = () => setStack([{ page: 'home', params: {} }])

  if (loading) return <Splash />
  if (!session) return <Login />

  const current = stack[stack.length - 1]
  const props = { navigate, goBack, goHome, params: current.params, session }

  const pages = {
    home: Home,
    turn: TurnDetail,
    client: ClientProfile,
    cycles: CyclesList,
    'cycle-form': CycleForm,
    settings: Settings,
    turns: Turns,
  }

  const Page = pages[current.page] || Home
  return <Page {...props} />
}

function Splash() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#111' }}>
      <div style={{ color: '#D95C1A', fontSize: '28px', fontWeight: '700', letterSpacing: '2px' }}>GYMCOACH</div>
    </div>
  )
}
