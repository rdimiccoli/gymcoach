import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run } from '../lib/notify'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

/**
 * Elenco di tutte le atlete di tutti i turni, con ricerca.
 *
 * Prima l'unica lista stava dentro Impostazioni, a tre tocchi di distanza e
 * senza ricerca: con decine di atlete, trovarne una senza ricordare il suo
 * turno voleva dire scorrere.
 */
export default function Athletes({ navigate, goHome, session }) {
  const [atlete, setAtlete] = useState([])
  const [cerca, setCerca] = useState('')
  const [mostraArchiviate, setMostraArchiviate] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: turni } = await run(
      supabase.from('turns').select('id, name').eq('coach_id', session.user.id),
      'Impossibile caricare i turni.'
    )
    if (!turni?.length) { setAtlete([]); setLoading(false); return }

    const nomiTurni = Object.fromEntries(turni.map(t => [t.id, t.name]))
    const { data: clienti } = await run(
      supabase.from('clients').select('*').in('turn_id', turni.map(t => t.id)).order('surname'),
      'Impossibile caricare le atlete.'
    )
    setAtlete((clienti || []).map(c => ({ ...c, turnName: nomiTurni[c.turn_id] || '' })))
    setLoading(false)
  }

  const testo = cerca.trim().toLowerCase()
  const visibili = atlete
    .filter(a => mostraArchiviate || a.is_active)
    .filter(a => !testo || `${a.surname} ${a.name} ${a.turnName}`.toLowerCase().includes(testo))

  const attive = atlete.filter(a => a.is_active).length

  return (
    <div style={page}>
      <TopBar title="ATLETI" subtitle={`${attive} attive${mostraArchiviate ? ` · ${atlete.length - attive} archiviate` : ''}`} />

      <div style={{ padding: '12px 16px 8px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <input
          value={cerca}
          onChange={e => setCerca(e.target.value)}
          placeholder="Cerca per nome, cognome o turno..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '6px', padding: '13px 14px', color: '#fff', fontSize: '16px', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>
            {visibili.length} {visibili.length === 1 ? 'risultato' : 'risultati'}
          </span>
          <button onClick={() => setMostraArchiviate(v => !v)} style={{
            background: mostraArchiviate ? 'rgba(217,92,26,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${mostraArchiviate ? 'rgba(217,92,26,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '3px', padding: '5px 10px',
            color: mostraArchiviate ? '#D95C1A' : 'rgba(255,255,255,0.35)',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
          }}>
            {mostraArchiviate ? '● CON ARCHIVIATE' : 'MOSTRA ARCHIVIATE'}
          </button>
        </div>
      </div>

      <div style={scroll}>
        {loading && <div style={vuoto}>Caricamento...</div>}
        {!loading && visibili.length === 0 && (
          <div style={vuoto}>
            {testo ? `Nessuna atleta trovata per "${cerca.trim()}".` : 'Nessuna atleta. Aggiungile dalla scheda del turno.'}
          </div>
        )}

        {visibili.map(a => (
          <div key={a.id} onClick={() => navigate('athlete-profile', { client: a })} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '6px', padding: '12px 14px', marginBottom: '7px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', opacity: a.is_active ? 1 : 0.45,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                {a.surname} {a.name}
                {!a.is_active && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginLeft: '7px', letterSpacing: '1px' }}>ARCHIVIATA</span>}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>{a.turnName}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ background: 'rgba(217,92,26,0.15)', borderRadius: '3px', padding: '4px 9px' }}>
                <span style={{ color: '#D95C1A', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px' }}>
                  SETT. {a.current_week}
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '18px' }}>›</span>
            </div>
          </div>
        ))}
        <div style={{ height: '20px' }} />
      </div>

      <BottomNav active="athletes" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0a', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }
const vuoto = { color: 'rgba(255,255,255,0.2)', fontSize: '13px', textAlign: 'center', padding: '40px 16px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '6px' }
