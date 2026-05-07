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
import CycleShare from './pages/CycleShare'
import ChangePassword from './pages/ChangePassword'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)
  const [stack, setStack] = useState([{ page: 'home', params: {} }])
  const stackRef = useRef(stack)

  useEffect(() => { stackRef.current = stack }, [stack])

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setIsRecovery(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
      if (!session) {
        setStack([{ page: 'home', params: {} }])
        setIsRecovery(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    window.history.pushState({ gymcoach: true }, '')
    const handlePopState = () => {
      const current = stackRef.current
      if (current.length > 1) {
        setStack(prev => prev.slice(0, -1))
        window.history.pushState({ gymcoach: true }, '')
      } else {
        const leave = window.confirm('Vuoi uscire da GymCoach?')
        if (leave) {
          window.history.back()
        } else {
          window.history.pushState({ gymcoach: true }, '')
        }
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (page, params = {}) => setStack(prev => [...prev, { page, params }])
  const goBack = () => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  const goHome = () => setStack([{ page: 'home', params: {} }])

  if (loading) return <Splash />

  if (isRecovery && session) {
    return <ChangePassword onDone={() => {
      setIsRecovery(false)
      window.history.replaceState(null, '', window.location.pathname)
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
    settings: Settings,
    turns: Turns,
    'cycle-share': CycleShare,
  }

  const Page = pages[current.page] || Home
  return <Page {...props} />
}

function Splash() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a', gap: '20px' }}>
      <img src="/logo_OAD.png" alt="OAD" style={{ width: '120px', mixBlendMode: 'screen' }} />
      <div style={{ color: '#D95C1A', fontSize: '28px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>GYMCOACH</div>
    </div>
  )
}
