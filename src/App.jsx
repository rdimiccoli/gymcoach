import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Home from './pages/Home'
import TurnDetail from './pages/TurnDetail'
import ClientProfile from './pages/ClientProfile'
import CyclesList from './pages/CyclesList'
import CycleForm from './pages/CycleForm'
import Settings from './pages/Settings'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stack, setStack] = useState([{ page: 'home', params: {} }])

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

  const navigate = (page, params = {}) => setStack(prev => [...prev, { page, params }])
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
  }

  const Page = pages[current.page] || Home
  return <Page {...props} />
}

function Splash() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111' }}>
      <div style={{ color: '#D95C1A', fontSize: '28px', fontWeight: '700', letterSpacing: '2px' }}>GYMCOACH</div>
    </div>
  )
}
