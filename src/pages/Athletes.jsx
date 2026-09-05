import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run } from '../lib/notify'
import { ScheletroElenco } from '../components/Scheletro'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

/**
 * Elenco di tutte le atlete di tutti i turni, con ricerca.
 *
 * Prima l'unica lista stava dentro Impostazioni, a tre tocchi di distanza e
 * senza ricerca: con decine di atlete, trovarne una senza ricordare il suo
 * turno voleva dire scorrere.
 */
// `session` non serve più: chi vede cosa lo decide la policy del database.
export default function Athletes({ navigate, goHome }) {
  const [atlete, setAtlete] = useState([])
  const [cerca, setCerca] = useState('')
  const [mostraArchiviate, setMostraArchiviate] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: turni } = await run(
      // Filtro a carico della policy: coprendo un collega servono le sue atlete.
      supabase.from('turns').select('id, name'),
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

      <div style={{ padding: '12px 16px 8px', flexShrink: 0, borderBottom: '1px solid var(--sup-alta)' }}>
        <input
          value={cerca}
          onChange={e => setCerca(e.target.value)}
          placeholder="Cerca per nome, cognome o turno..."
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--sup-alta)', border: '1px solid var(--bordo)',
            borderRadius: '6px', padding: '13px 14px', color: '#fff', fontSize: '16px', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ color: 'var(--testo-fioco)', fontSize: '13px' }}>
            {visibili.length} {visibili.length === 1 ? 'risultato' : 'risultati'}
          </span>
          <button onClick={() => setMostraArchiviate(v => !v)} style={{
            background: mostraArchiviate ? 'var(--acc-riempimento)' : 'var(--sup)',
            border: `1px solid ${mostraArchiviate ? 'var(--acc-bordo-forte)' : 'var(--bordo)'}`,
            borderRadius: '3px', padding: '5px 10px',
            color: mostraArchiviate ? 'var(--accento)' : 'var(--testo-debole)',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer',
          }}>
            {mostraArchiviate ? '● CON ARCHIVIATE' : 'MOSTRA ARCHIVIATE'}
          </button>
        </div>
      </div>

      <div style={scroll}>
        {loading && <ScheletroElenco righe={5} />}
        {!loading && visibili.length === 0 && (
          <div style={vuoto}>
            {testo ? `Nessuna atleta trovata per "${cerca.trim()}".` : 'Nessuna atleta. Aggiungile dalla scheda del turno.'}
          </div>
        )}

        {visibili.map(a => (
          <div key={a.id} onClick={() => navigate('athlete-profile', { client: a })} style={{
            background: 'var(--sup)', border: '1px solid var(--sup-alta)',
            borderRadius: '6px', padding: '12px 14px', marginBottom: '7px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', opacity: a.is_active ? 1 : 0.45,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                {a.surname} {a.name}
                {!a.is_active && <span style={{ color: 'var(--testo-debole)', fontSize: '12px', marginLeft: '7px', letterSpacing: '1px' }}>ARCHIVIATA</span>}
              </div>
              <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginTop: '2px' }}>{a.turnName}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ color: 'var(--testo-fioco)', fontSize: '18px' }}>›</span>
            </div>
          </div>
        ))}
        <div style={{ height: '20px' }} />
      </div>

      <BottomNav active="athletes" navigate={navigate} goHome={goHome} />
    </div>
  )
}

const page = { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--fondo)', overflow: 'hidden' }
const scroll = { flex: 1, overflowY: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }
const vuoto = { color: 'var(--testo-fioco)', fontSize: '14px', textAlign: 'center', padding: '40px 16px', border: '1px dashed var(--sup-alta)', borderRadius: '6px' }
