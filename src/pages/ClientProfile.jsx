import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import TopBar from '../components/TopBar'

export default function ClientProfile({ navigate, goBack, params }) {
  const { client: initialClient, turn } = params
  const [client, setClient] = useState(initialClient)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    // Load all loads for this client across all cycles
    const { data } = await supabase
      .from('client_loads')
      .select(`
        kg, updated_at,
        cycle_exercises (
          reps_a, reps_b, reps_c, day,
          exercises (name),
          cycles (name, is_active)
        )
      `)
      .eq('client_id', client.id)
      .gt('kg', 0)
      .order('updated_at', { ascending: false })

    // Group by exercise name
    const grouped = {}
    data?.forEach(l => {
      const exName = l.cycle_exercises?.exercises?.name
      const cycleName = l.cycle_exercises?.cycles?.name
      if (!exName) return
      if (!grouped[exName]) grouped[exName] = []
      grouped[exName].push({ kg: l.kg, cycle: cycleName, date: l.updated_at })
    })
    setHistory(grouped)
    setLoading(false)
  }

  const initials = `${client.name[0]}${client.surname[0]}`.toUpperCase()

  return (
    <div style={page}>
      <TopBar title={`${client.name} ${client.surname}`} subtitle={turn?.name} onBack={goBack} />
      <div style={scroll}>

        {/* Profile header */}
        <div style={{ background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '13px', padding: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#D95C1A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: '700', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>{client.name} {client.surname}</div>
            <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{turn?.name}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <div style={statBox}>
            <div style={statLabel}>Settimana</div>
            <div style={statVal}>{client.current_week} <span style={{ color: '#444', fontSize: '12px' }}>/ 6</span></div>
          </div>
          <div style={statBox}>
            <div style={statLabel}>Stato</div>
            <div style={{ color: client.is_active ? '#4CAF50' : '#E85C1A', fontSize: '17px', fontWeight: '700' }}>
              {client.is_active ? 'Attivo' : 'Archiviato'}
            </div>
          </div>
        </div>

        {/* Exercise history */}
        <div style={sectionLabel}>Storico carichi per esercizio</div>

        {loading && <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Caricamento...</div>}

        {!loading && Object.keys(history).length === 0 && (
          <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '24px', background: '#1a1a1a', borderRadius: '12px' }}>
            Nessun carico registrato ancora.
          </div>
        )}

        {Object.entries(history).map(([exName, entries]) => {
          const latest = entries[0]
          const prev = entries[1]
          const diff = prev ? (latest.kg - prev.kg) : null
          return (
            <div key={exName} style={{ background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '11px', padding: '11px 13px', marginBottom: '7px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#ccc', fontSize: '13px', flex: 1, paddingRight: '8px' }}>{exName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ color: '#fff', fontSize: '15px', fontWeight: '700' }}>{latest.kg} kg</div>
                  {diff !== null && (
                    <div style={{ fontSize: '11px', color: diff > 0 ? '#4CAF50' : diff < 0 ? '#E85C1A' : '#555' }}>
                      {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '= —'}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ color: '#444', fontSize: '10px', marginTop: '3px' }}>{latest.cycle}</div>
            </div>
          )
        })}

        {/* Archive button */}
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={async () => {
              await supabase.from('clients').update({ is_active: !client.is_active }).eq('id', client.id)
              setClient(c => ({ ...c, is_active: !c.is_active }))
            }}
            style={{ background: '#1e1e1e', border: '0.5px solid #2a2a2a', color: '#888', width: '100%', padding: '12px', borderRadius: '11px', fontSize: '13px' }}>
            {client.is_active ? '📦 Archivia cliente' : '✅ Riattiva cliente'}
          </button>
        </div>
        <div style={{ height: '20px' }} />
      </div>
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '14px 16px' }
const sectionLabel = { color: '#555', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }
const statBox = { background: '#1e1e1e', border: '0.5px solid #2a2a2a', borderRadius: '11px', padding: '11px 13px' }
const statLabel = { color: '#444', fontSize: '10px', marginBottom: '4px' }
const statVal = { color: '#fff', fontSize: '17px', fontWeight: '700' }
