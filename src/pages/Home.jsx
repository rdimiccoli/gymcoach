import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import BottomNav from '../components/BottomNav'

const WEEKDAYS = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']

const PHASES = [
  { num: 1, label: 'Ciclo 1', weeks: 'Settimana 1 e 2', weekRange: [1,2], gradient: 'linear-gradient(135deg,#D95C1A,#E87A40)' },
  { num: 2, label: 'Ciclo 2', weeks: 'Settimana 3 e 4', weekRange: [3,4], gradient: 'linear-gradient(135deg,#1A6ED9,#409CE8)' },
  { num: 3, label: 'Ciclo 3', weeks: 'Settimana 5 e 6', weekRange: [5,6], gradient: 'linear-gradient(135deg,#1AAD5C,#40C87A)' },
]

export default function Home({ navigate, goHome, session }) {
  const [coach, setCoach] = useState(null)
  const [turns, setTurns] = useState([])
  const [cycles, setCycles] = useState({})
  const [clientCounts, setClientCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedPhase, setSelectedPhase] = useState(null)

  const today = new Date()
  const dayName = WEEKDAYS[today.getDay()]
  const dateStr = `${dayName} ${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`

  useEffect(() => { loadData() }, [])

  async function loadData() {
    // Load or create coach profile
    let { data: c } = await supabase.from('coaches').select('*').eq('id', session.user.id).single()
    if (!c) {
      const name = session.user.email.split('@')[0]
      const { data: nc } = await supabase.from('coaches')
        .insert({ id: session.user.id, email: session.user.email, name, home_type: 'turns' })
        .select().single()
      c = nc
    }
    setCoach(c)

    // Load turns
    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time')
    setTurns(t || [])

    // Load active cycles and client counts per turn
    if (t?.length) {
      const cycleMap = {}, countMap = {}
      await Promise.all(t.map(async turn => {
        const { data: cy } = await supabase.from('cycles').select('*').eq('turn_id', turn.id).eq('is_active', true).limit(1)
        if (cy?.[0]) cycleMap[turn.id] = cy[0]
        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('turn_id', turn.id).eq('is_active', true)
        countMap[turn.id] = count || 0
      }))
      setCycles(cycleMap)
      setClientCounts(countMap)
    }
    setLoading(false)
  }

  if (loading) return <Loader />

  // PHASES VIEW (Deborah)
  if (coach?.home_type === 'phases') {
    if (selectedPhase) {
      return (
        <div style={page}>
          <div style={topBar}>
            <button onClick={() => setSelectedPhase(null)} style={backBtn}>‹</button>
            <div>
              <div style={topTitle}>{selectedPhase.label}</div>
              <div style={topSub}>{selectedPhase.weeks}</div>
            </div>
          </div>
          <div style={scroll}>
            <div style={sectionLabel}>I tuoi turni</div>
            {turns.length === 0 && <Empty text="Nessun turno ancora. Vai in Impostazioni per aggiungerne uno." />}
            {turns.map(turn => (
              <TurnCard key={turn.id} turn={turn} cycle={cycles[turn.id]} count={clientCounts[turn.id]}
                onPress={() => navigate('turn', { turn, cycle: cycles[turn.id], phase: selectedPhase })} />
            ))}
          </div>
          <BottomNav active="home" navigate={navigate} goHome={goHome} />
        </div>
      )
    }

    return (
      <div style={page}>
        <div style={scroll}>
          <div style={{ color: '#555', fontSize: '12px', marginBottom: '2px' }}>Buongiorno,</div>
          <div style={{ color: '#fff', fontSize: '21px', fontWeight: '700', marginBottom: '4px' }}>Coach {coach.name} 👋</div>
          <div style={{ color: '#444', fontSize: '11px', marginBottom: '18px' }}>{dateStr}</div>
          <div style={sectionLabel}>Seleziona la fase del ciclo</div>
          {PHASES.map(ph => (
            <div key={ph.num} onClick={() => setSelectedPhase(ph)}
              style={{ background: ph.gradient, borderRadius: '14px', padding: '16px 14px', marginBottom: '10px', cursor: 'pointer', position: 'relative' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Fase {ph.num}</div>
              <div style={{ color: '#fff', fontSize: '17px', fontWeight: '700', marginBottom: '2px' }}>{ph.label}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{ph.weeks}</div>
              <div style={{ position: 'absolute', bottom: '14px', right: '16px', color: 'rgba(255,255,255,0.5)', fontSize: '20px' }}>›</div>
            </div>
          ))}
        </div>
        <BottomNav active="home" navigate={navigate} goHome={goHome} />
      </div>
    )
  }

  // DEFAULT VIEW (altri coach)
  return (
    <div style={page}>
      <div style={scroll}>
        <div style={{ color: '#555', fontSize: '12px', marginBottom: '2px' }}>Buongiorno,</div>
        <div style={{ color: '#fff', fontSize: '21px', fontWeight: '700', marginBottom: '4px' }}>Coach {coach?.name} 👋</div>
        <div style={{ color: '#444', fontSize: '11px', marginBottom: '18px' }}>{dateStr}</div>
        <div style={sectionLabel}>I tuoi turni</div>
        {turns.length === 0 && <Empty text="Nessun turno ancora. Vai in Impostazioni per aggiungerne uno." />}
        {turns.map(turn => (
          <TurnCard key={turn.id} turn={turn} cycle={cycles[turn.id]} count={clientCounts[turn.id]}
            onPress={() => navigate('turn', { turn, cycle: cycles[turn.id] })} />
        ))}
      </div>
      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )
}

function TurnCard({ turn, cycle, count, onPress }) {
  return (
    <div onClick={onPress} style={{
      background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '13px',
      padding: '13px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
    }}>
      <div>
        <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600' }}>{turn.name}</div>
        <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>
          {cycle ? cycle.name : 'Nessun ciclo attivo'} · {count} clienti
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ background: '#2a2a2a', color: '#666', fontSize: '11px', padding: '3px 10px', borderRadius: '20px' }}>{count}</div>
        <div style={{ color: '#444', fontSize: '18px' }}>›</div>
      </div>
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '32px 16px', background: '#1a1a1a', borderRadius: '12px' }}>{text}</div>
}

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111' }}>
      <div style={{ color: '#D95C1A', fontSize: '22px', fontWeight: '700' }}>GYMCOACH</div>
    </div>
  )
}

// Shared styles
const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '20px 16px' }
const sectionLabel = { color: '#555', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }
const topBar = { padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '0.5px solid #2a2a2a', flexShrink: 0 }
const backBtn = { background: '#2a2a2a', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const topTitle = { color: '#fff', fontSize: '14px', fontWeight: '600' }
const topSub = { color: '#555', fontSize: '11px', marginTop: '1px' }
