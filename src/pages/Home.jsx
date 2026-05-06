import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import BottomNav from '../components/BottomNav'

const WEEKDAYS = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']

const PHASES = [
  {
    num: 1, label: 'SETTIMANA 1 — 2', sub: 'Fase iniziale della scheda',
    weekRange: [1,2],
    img: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=70',
    accent: '#D95C1A',
  },
  {
    num: 2, label: 'SETTIMANA 3 — 4', sub: 'Fase intermedia della scheda',
    weekRange: [3,4],
    img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=70',
    accent: '#1A6ED9',
  },
  {
    num: 3, label: 'SETTIMANA 5 — 6', sub: 'Fase finale della scheda',
    weekRange: [5,6],
    img: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&q=70',
    accent: '#1AAD5C',
  },
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
  const dateStr = `${today.getDate().toString().padStart(2,'0')}·${(today.getMonth()+1).toString().padStart(2,'0')}·${today.getFullYear()}`

  useEffect(() => { loadData() }, [])

  async function loadData() {
    let { data: c } = await supabase.from('coaches').select('*').eq('id', session.user.id).single()
    if (!c) {
      const name = session.user.email.split('@')[0]
      const { data: nc } = await supabase.from('coaches')
        .insert({ id: session.user.id, email: session.user.email, name, home_type: 'phases' })
        .select().single()
      c = nc
    }
    setCoach(c)

    const { data: t } = await supabase.from('turns').select('*').eq('coach_id', session.user.id).order('time')
    setTurns(t || [])

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

  // TURNS LIST
  if (selectedPhase) {
    return (
      <div style={page}>
        {/* Hero header */}
        <div style={{ position: 'relative', height: '160px', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${selectedPhase.img})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'brightness(0.35)',
          }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 0%, #0a0a0a 100%)` }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setSelectedPhase(null)} style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '3px', width: '34px', height: '34px',
              color: '#fff', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>‹</button>
            <div>
              <div style={{ color: selectedPhase.accent, fontSize: '10px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '2px' }}>FASE {selectedPhase.num}</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: '800', color: '#fff', letterSpacing: '1px' }}>{selectedPhase.label}</div>
            </div>
          </div>
        </div>

        <div style={scroll}>
          <div style={sectionLabel}>SELEZIONA TURNO</div>
          {turns.length === 0 && <Empty />}
          {turns.map((turn, i) => (
            <div key={turn.id} className={`fadeUp-${Math.min(i+1,3)}`}>
              <TurnCard turn={turn} cycle={cycles[turn.id]} count={clientCounts[turn.id]} accent={selectedPhase.accent}
                onPress={() => navigate('turn', { turn, cycle: cycles[turn.id], phase: selectedPhase })} />
            </div>
          ))}
        </div>
        <BottomNav active="home" navigate={navigate} goHome={goHome} />
      </div>
    )
  }

  // HOME — 3 phase cards with gym images
  return (
    <div style={page}>
      <div style={scroll}>

        {/* Header */}
        <div style={{ paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
              {dayName.toUpperCase()} · {dateStr}
            </div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '32px', fontWeight: '900', letterSpacing: '1px', lineHeight: 1 }}>
              COACH <span style={{ color: '#D95C1A' }}>{coach?.name?.toUpperCase()}</span>
            </div>
          </div>
          <img src="/logo_OAD.png" alt="OAD" style={{ height: '44px', mixBlendMode: 'screen', flexShrink: 0 }} />
        </div>

        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '12px' }}>
          SELEZIONA FASE DELLA SCHEDA
        </div>

        {/* Phase cards */}
        {PHASES.map((ph, i) => (
          <div key={ph.num} className={`fadeUp-${i+1}`} onClick={() => setSelectedPhase(ph)} style={{
            position: 'relative', height: '140px', borderRadius: '6px',
            marginBottom: '10px', overflow: 'hidden', cursor: 'pointer',
          }}>
            {/* Background image */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${ph.img})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'brightness(0.4)',
              transition: 'transform 0.3s ease',
            }} />

            {/* Color overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(135deg, ${ph.accent}55 0%, rgba(0,0,0,0.5) 100%)`,
            }} />

            {/* Left accent bar */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: ph.accent }} />

            {/* Content */}
            <div style={{ position: 'absolute', inset: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ color: ph.accent, fontSize: '9px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
                FASE {ph.num}
              </div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px', fontWeight: '900', color: '#fff', letterSpacing: '1px', lineHeight: 1 }}>
                {ph.label}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '4px', fontWeight: '300' }}>
                {ph.sub}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: '24px' }}>›</div>
          </div>
        ))}

        <div style={{ height: '12px' }} />
      </div>
      <BottomNav active="home" navigate={navigate} goHome={goHome} />
    </div>
  )
}

function TurnCard({ turn, cycle, count, onPress, accent = '#D95C1A' }) {
  return (
    <div onClick={onPress} style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '6px',
      padding: '16px 18px',
      marginBottom: '8px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      cursor: 'pointer', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: accent }} />
      <div style={{ paddingLeft: '8px' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>{turn.name}</div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '2px' }}>
          {cycle ? cycle.name : 'Nessuna scheda attiva'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', padding: '4px 10px', borderRadius: '3px', letterSpacing: '0.5px' }}>{count} ATL</div>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px' }}>›</div>
      </div>
    </div>
  )
}

function Empty() {
  return (
    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', textAlign: 'center', padding: '40px 16px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }}>
      Nessun turno. Vai in Setup per aggiungerne uno.
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0a', gap: '12px' }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '36px', fontWeight: '900', letterSpacing: '4px' }}>
        GYM<span style={{ color: '#D95C1A' }}>COACH</span>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', letterSpacing: '2px' }}>CARICAMENTO...</div>
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '20px 16px' }
const sectionLabel = { color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: '700', letterSpacing: '2px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '12px' }
