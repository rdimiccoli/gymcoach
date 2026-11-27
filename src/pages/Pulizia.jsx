import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk } from '../lib/notify'
import { capacita } from '../lib/capacita'
import { comePulsante } from '../lib/stile'
import { nomeCompleto } from '../lib/nomi'
import { maiAllenati, giornoCorto } from '../lib/assenti'
import { caricaUltimi, personeAttive } from '../lib/assentiDb'
import { personeDoppie, eserciziDoppi, chiTenere } from '../lib/pulizia'
import { archiviaPersone, unisciPersone } from '../lib/puliziaDb'
import { unisciEsercizi } from '../lib/eserciziDb'
import { turnoDOrigine, daDove } from '../lib/ospitiDb'
import { ScheletroElenco } from '../components/Scheletro'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

/**
 * METTERE IN ORDINE — da IMPOSTAZIONI.
 *
 * Tre pulizie, una alla volta e sempre con conferma. Nessuna cancella dati:
 *  - chi è attivo ma non ha mai fatto un allenamento si ARCHIVIA (si
 *    riattiva da ATLETI → MOSTRA ARCHIVIO);
 *  - una persona iscritta due volte si UNISCE: lo storico va tutto su una
 *    riga, l'altra si archivia;
 *  - due esercizi uguali a meno di uno spazio si UNISCONO: le schede passano
 *    a uno solo, con i loro pesi.
 * Il 27/11/2026 erano 80 persone senza allenamenti, 3 doppie, 3 esercizi doppi.
 */
export default function Pulizia({ navigate, goBack, goHome, coach }) {
  const [caricando, setCaricando] = useState(true)
  const [conUltimi, setConUltimi] = useState(false)
  const [senzaAllenamenti, setSenzaAllenamenti] = useState([])
  const [scelte, setScelte] = useState(() => new Set())
  const [doppie, setDoppie] = useState([])
  const [pesiDi, setPesiDi] = useState({})
  const [esDoppi, setEsDoppi] = useState([])
  const [conferma, setConferma] = useState(null) // { tipo, ... }
  const [lavoro, setLavoro] = useState(false)

  useEffect(() => { carica() }, [coach?.id])

  async function carica() {
    setCaricando(true)
    const caps = await capacita()
    const { data: turni } = await run(supabase.from('turns').select('id').eq('coach_id', coach.id),
      'Impossibile caricare i turni.')
    const [mie, tutte, esercizi, ultimi] = await Promise.all([
      personeAttive((turni || []).map(t => t.id)),
      run(supabase.from('clients').select('*, turns!clients_turn_id_fkey(name, time, coaches!turns_coach_id_fkey(name))')
        .eq('is_active', true), 'Impossibile caricare le persone.').then(r => r.data || []),
      run(supabase.from('exercises').select('id, name, created_at').order('name'),
        'Impossibile caricare gli esercizi.').then(r => r.data || []),
      caps.ultimiAllenamenti ? caricaUltimi() : null,
    ])
    setConUltimi(Boolean(ultimi))
    setSenzaAllenamenti(ultimi ? maiAllenati(mie, ultimi) : [])
    setPesiDi(Object.fromEntries(Object.entries(ultimi || {}).map(([id, u]) => [id, u.pesi])))
    setDoppie(personeDoppie(tutte))
    setEsDoppi(eserciziDoppi(esercizi))
    setScelte(new Set())
    setCaricando(false)
  }

  function alterna(id) {
    setScelte(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function esegui() {
    setLavoro(true)
    if (conferma.tipo === 'archivia') {
      if (await archiviaPersone([...scelte])) notifyOk(`${scelte.size} ${scelte.size === 1 ? 'persona archiviata' : 'persone archiviate'}`)
    } else if (conferma.tipo === 'persone') {
      const togliere = conferma.gruppo.filter(p => p.id !== conferma.tenere.id)
      let tutto = true
      for (const p of togliere) {
        const esito = await unisciPersone(conferma.tenere.id, p.id)
        if (!esito.ok) { tutto = false; break }
      }
      if (tutto) notifyOk(`Unite: ora c'è solo ${nomeCompleto(conferma.tenere)} delle ${turnoDOrigine(conferma.tenere)}`)
    } else if (conferma.tipo === 'esercizi') {
      let tutto = true
      for (const e of conferma.gruppo.filter(x => x.id !== conferma.tenere.id)) {
        if (!await unisciEsercizi(e.id, conferma.tenere.id)) { tutto = false; break }
      }
      if (tutto) notifyOk(`Uniti in «${conferma.tenere.name}»`)
    }
    setLavoro(false)
    setConferma(null)
    carica()
  }

  return (
    <div style={pagina}>
      <TopBar title="METTERE IN ORDINE" subtitle="Elenchi più corti, storico in un posto" onBack={goBack} />
      <div style={scorrimento}>
        {caricando && <ScheletroElenco righe={5} />}

        {!caricando && (<>
          <div style={titolo}>SENZA NESSUN ALLENAMENTO · {conUltimi ? senzaAllenamenti.length : '—'}</div>
          {!conUltimi ? (
            <p style={nota}>Per saperlo serve la query «migrazione-nota-e-ultimo-allenamento.sql» su Supabase.</p>
          ) : senzaAllenamenti.length === 0 ? (
            <p style={nota}>Nei tuoi turni tutti hanno almeno un peso segnato.</p>
          ) : (<>
            <p style={nota}>Attive nei tuoi turni, ma senza un solo peso segnato. Scegli chi archiviare: chi è appena arrivato lascialo.</p>
            <div style={riquadro}>
              {senzaAllenamenti.map(p => (
                <button key={p.id} type="button" onClick={() => alterna(p.id)} aria-pressed={scelte.has(p.id)} style={riga}>
                  <span style={{ ...spunta, ...(scelte.has(p.id) && spuntaAccesa) }}>{scelte.has(p.id) ? '✓' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={nome}>{nomeCompleto(p)}</span>
                    <span style={sotto}>
                      {turnoDOrigine(p)}{p.created_at ? ` · aggiunta il ${giornoCorto(new Date(p.created_at))}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" disabled={!scelte.size} onClick={() => setConferma({ tipo: 'archivia' })}
              style={{ ...grande, opacity: scelte.size ? 1 : 0.35 }}>
              ARCHIVIA {scelte.size ? `LE ${scelte.size} SCELTE` : ''}
            </button>
          </>)}

          <div style={{ ...titolo, marginTop: '28px' }}>PERSONE ISCRITTE DUE VOLTE · {doppie.length}</div>
          {doppie.length === 0 ? <p style={nota}>Nessuna.</p> : (<>
            <p style={nota}>Stesso nome e cognome in due righe: lo storico è diviso in due. Si possono unire in una.</p>
            {doppie.map(g => {
              const tenere = chiTenere(g, p => pesiDi[p.id] || 0)
              return (
                <div key={g.map(p => p.id).join()} style={{ ...riquadro, marginBottom: '10px' }}>
                  {g.map(p => (
                    <div key={p.id} style={{ ...riga, cursor: 'default' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={nome}>{nomeCompleto(p)}</span>
                        <span style={sotto}>{daDove(p)} · {quantiPesi(pesiDi[p.id])}</span>
                      </span>
                    </div>
                  ))}
                  <button type="button" onClick={() => setConferma({ tipo: 'persone', gruppo: g, tenere })} style={{ ...riga, justifyContent: 'center', color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800', letterSpacing: '1px' }}>
                    UNISCI…
                  </button>
                </div>
              )
            })}
          </>)}

          <div style={{ ...titolo, marginTop: '28px' }}>ESERCIZI DOPPI · {esDoppi.length}</div>
          {esDoppi.length === 0 ? <p style={nota}>Nessuno.</p> : (<>
            <p style={nota}>Lo stesso esercizio scritto in due modi. Unendoli, le schede e i pesi passano a uno solo.</p>
            {esDoppi.map(g => (
              <div key={g.map(e => e.id).join()} style={{ ...riquadro, marginBottom: '10px' }}>
                {g.map(e => (
                  <div key={e.id} style={{ ...riga, cursor: 'default' }}><span style={nome}>«{e.name}»</span></div>
                ))}
                <button type="button" onClick={() => setConferma({ tipo: 'esercizi', gruppo: g, tenere: g[0] })} style={{ ...riga, justifyContent: 'center', color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '800', letterSpacing: '1px' }}>
                  UNISCI…
                </button>
              </div>
            ))}
          </>)}
        </>)}
        <div style={{ height: '20px' }} />
      </div>

      {conferma && (
        <div className="velo-entra" style={velo} onClick={() => !lavoro && setConferma(null)}>
          <div className="foglio-entra" role="dialog" aria-label="Conferma" style={foglio} onClick={e => e.stopPropagation()}>
            {conferma.tipo === 'archivia' && (<>
              <div style={titoloFoglio}>ARCHIVIARE {scelte.size} {scelte.size === 1 ? 'PERSONA' : 'PERSONE'}?</div>
              <p style={testoFoglio}>Escono dagli elenchi dei turni. Non si perde niente: si riattivano da ATLETI → MOSTRA ARCHIVIO.</p>
            </>)}
            {conferma.tipo === 'persone' && (<>
              <div style={titoloFoglio}>UNIRE IN UNA SOLA RIGA?</div>
              <p style={testoFoglio}>Quale tenere? Quella scelta resta nel suo turno e riceve tutto lo storico; le altre si archiviano.</p>
              {conferma.gruppo.map(p => (
                <button key={p.id} type="button" onClick={() => setConferma(c => ({ ...c, tenere: p }))} aria-pressed={conferma.tenere.id === p.id} style={{ ...riga, borderRadius: '8px', border: `1px solid ${conferma.tenere.id === p.id ? 'var(--accento)' : 'var(--bordo)'}`, marginBottom: '8px' }}>
                  <span style={{ ...spunta, ...(conferma.tenere.id === p.id && spuntaAccesa) }}>{conferma.tenere.id === p.id ? '✓' : ''}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={nome}>{nomeCompleto(p)}</span>
                    <span style={sotto}>{daDove(p)} · {quantiPesi(pesiDi[p.id])}</span>
                  </span>
                </button>
              ))}
              <p style={testoFoglio}>Dopo resta solo nel turno delle {turnoDOrigine(conferma.tenere)}: se viene anche nell'altro, lì si aggiunge come ospite. Non si perde nessun peso.</p>
            </>)}
            {conferma.tipo === 'esercizi' && (<>
              <div style={titoloFoglio}>UNIRE GLI ESERCIZI?</div>
              <p style={testoFoglio}>Quale nome tenere? Le schede che usano gli altri passano a questo, con i loro pesi.</p>
              {conferma.gruppo.map(e => (
                <button key={e.id} type="button" onClick={() => setConferma(c => ({ ...c, tenere: e }))} aria-pressed={conferma.tenere.id === e.id} style={{ ...riga, borderRadius: '8px', border: `1px solid ${conferma.tenere.id === e.id ? 'var(--accento)' : 'var(--bordo)'}`, marginBottom: '8px' }}>
                  <span style={{ ...spunta, ...(conferma.tenere.id === e.id && spuntaAccesa) }}>{conferma.tenere.id === e.id ? '✓' : ''}</span>
                  <span style={nome}>«{e.name}»</span>
                </button>
              ))}
            </>)}
            <button type="button" onClick={esegui} disabled={lavoro} style={{ ...grande, marginTop: '10px', opacity: lavoro ? 0.5 : 1 }}>
              {lavoro ? 'UN MOMENTO…' : conferma.tipo === 'archivia' ? '✓ SÌ, ARCHIVIA' : '✓ SÌ, UNISCI'}
            </button>
            <button type="button" onClick={() => setConferma(null)} disabled={lavoro} style={annulla}>Annulla</button>
          </div>
        </div>
      )}

      <BottomNav active="settings" navigate={navigate} goHome={goHome} />
    </div>
  )
}

// «1 peso», «22 pesi»: al singolare quando serve.
const quantiPesi = n => `${n || 0} ${n === 1 ? 'peso' : 'pesi'}`

const pagina = { maxWidth: 'var(--colonna)', marginInline: 'auto', width: '100%', display: 'flex', flexDirection: 'column', height: 'var(--schermo)', background: 'var(--fondo)', overflow: 'hidden', position: 'relative' }
const scorrimento = { flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }
const titolo = { color: 'var(--testo-medio)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800', letterSpacing: '1.5px', marginBottom: '6px' }
const nota = { color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.45, margin: '0 0 10px' }
const riquadro = { background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '8px', overflow: 'hidden' }
const riga = { ...comePulsante, display: 'flex', alignItems: 'center', gap: '12px', width: '100%', minHeight: '54px', padding: '8px 14px', borderTop: '1px solid var(--sup-alta)', textAlign: 'left', cursor: 'pointer', background: 'transparent', color: '#fff' }
const nome = { display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const sotto = { display: 'block', color: 'var(--testo-medio)', fontSize: '13px', marginTop: '1px' }
const spunta = { flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--bordo-forte)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px' }
const spuntaAccesa = { background: 'var(--accento)', border: 'none' }
const grande = { width: '100%', minHeight: '52px', marginTop: '12px', background: 'var(--accento)', border: 'none', borderRadius: '6px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '1.5px', cursor: 'pointer' }
const annulla = { ...comePulsante, width: '100%', minHeight: '44px', marginTop: '6px', color: 'var(--testo-medio)', fontSize: '15px', textAlign: 'center', cursor: 'pointer' }
const velo = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const foglio = { background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '22px 16px 28px', width: '100%', maxWidth: 'var(--colonna)', maxHeight: '90vh', overflowY: 'auto' }
const titoloFoglio = { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '8px' }
const testoFoglio = { color: 'var(--testo-medio)', fontSize: '15px', lineHeight: 1.45, margin: '0 0 12px' }
