import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { run, notifyOk } from '../lib/notify'
import { eserciziDaCsv } from '../lib/csv'

/**
 * Importa una scheda incollando il CSV esportato dal database.
 *
 * Costruire un giorno da 12 esercizi dentro l'app significa 12 ricerche e 36
 * campi di ripetizioni digitati sul telefono. Chi le schede se le prepara
 * comunque in tabella fuori dall'app, qui le incolla e basta.
 *
 * L'anteprima si vede PRIMA di scrivere qualsiasi cosa: importare nella scheda
 * sbagliata sarebbe difficile da disfare.
 */
export default function ImportaCsv({ cycleId, esistentiPerGiorno, onFatto, onClose }) {
  const [testo, setTesto] = useState('')
  const [inCorso, setInCorso] = useState(false)

  const { esercizi, problemi } = testo.trim() ? eserciziDaCsv(testo) : { esercizi: [], problemi: [] }

  const perGiorno = {}
  esercizi.forEach(e => { perGiorno[e.giorno] = (perGiorno[e.giorno] || 0) + 1 })
  const giorniToccati = Object.keys(perGiorno).map(Number).sort()
  const giorniGiaPieni = giorniToccati.filter(g => (esistentiPerGiorno?.[g] || 0) > 0)

  async function importa() {
    if (!esercizi.length || !cycleId) return
    setInCorso(true)

    // 1. Il catalogo è piccolo: lo prendo tutto e abbino qui, senza una query
    //    per esercizio.
    const { data: catalogo } = await run(
      supabase.from('exercises').select('id, name'),
      'Impossibile leggere il catalogo esercizi.'
    )
    const perNome = new Map((catalogo || []).map(e => [e.name.trim().toLowerCase(), e.id]))

    // 2. I nomi che non esistono si creano in una volta sola.
    const mancanti = [...new Set(
      esercizi.map(e => e.nome).filter(n => !perNome.has(n.trim().toLowerCase()))
    )]
    if (mancanti.length) {
      const { data: creati } = await run(
        supabase.from('exercises').insert(mancanti.map(name => ({ name }))).select('id, name'),
        'Impossibile creare i nuovi esercizi.'
      )
      if (!creati) { setInCorso(false); return }
      creati.forEach(e => perNome.set(e.name.trim().toLowerCase(), e.id))
    }

    // 3. Le righe si accodano a quelle già presenti, mantenendo l'ordine del CSV.
    const contatori = { ...esistentiPerGiorno }
    const righe = [...esercizi]
      .sort((a, b) => a.giorno - b.giorno || a.ordine - b.ordine)
      .map(e => {
        const posizione = (contatori[e.giorno] || 0)
        contatori[e.giorno] = posizione + 1
        return {
          cycle_id: cycleId,
          exercise_id: perNome.get(e.nome.trim().toLowerCase()),
          day: e.giorno,
          reps_a: e.repsA, reps_b: e.repsB, reps_c: e.repsC,
          superset_group: e.gruppo,
          sort_order: posizione,
        }
      })

    const { error } = await run(
      supabase.from('cycle_exercises').insert(righe),
      'Importazione non riuscita: nessun esercizio è stato aggiunto.'
    )
    setInCorso(false)
    if (error) return
    notifyOk(`${righe.length} esercizi importati`)
    onFatto()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 250, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0', padding: '22px 16px 32px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '4px' }}>
          IMPORTA DA CSV
        </div>
        <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginBottom: '14px', lineHeight: 1.5 }}>
          Incolla il file esportato, oppure le celle copiate da un foglio di calcolo.
          <br />
          <span style={{ color: 'var(--testo-chiaro)' }}>Obbligatorie:</span>{' '}
          <code style={{ fontFamily: 'monospace', color: 'var(--accento)' }}>exercise_name</code> e{' '}
          <code style={{ fontFamily: 'monospace', color: 'var(--accento)' }}>day</code> (1, 2 o 3).
          <br />
          <span style={{ color: 'var(--testo-debole)' }}>Facoltative:</span>{' '}
          <code style={{ fontFamily: 'monospace' }}>reps_a</code>{' '}
          <code style={{ fontFamily: 'monospace' }}>reps_b</code>{' '}
          <code style={{ fontFamily: 'monospace' }}>reps_c</code>{' '}
          <code style={{ fontFamily: 'monospace' }}>superset_group</code>{' '}
          <code style={{ fontFamily: 'monospace' }}>sort_order</code>. L'ordine
          delle colonne non conta, e quelle in più vengono ignorate.
        </div>

        <textarea
          value={testo}
          onChange={e => setTesto(e.target.value)}
          placeholder={'id,sort_order,day,reps_a,reps_b,reps_c,superset_group,exercise_name\n...'}
          rows={6}
          style={{
            width: '100%', boxSizing: 'border-box', background: 'var(--sup)',
            border: '1px solid var(--bordo)', borderRadius: '6px', padding: '11px',
            color: '#fff', fontSize: '16px', fontFamily: 'monospace', outline: 'none', resize: 'vertical',
          }}
        />

        {problemi.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '10px 12px', marginTop: '12px' }}>
            <div style={{ color: '#fca5a5', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', marginBottom: '5px' }}>
              ⚠ {problemi.length} {problemi.length === 1 ? 'RIGA SCARTATA' : 'RIGHE SCARTATE'}
            </div>
            {problemi.slice(0, 5).map((p, i) => (
              <div key={i} style={{ color: 'var(--testo-medio)', fontSize: '13px', lineHeight: 1.4 }}>{p}</div>
            ))}
            {problemi.length > 5 && (
              <div style={{ color: 'var(--testo-fioco)', fontSize: '13px' }}>...e altre {problemi.length - 5}</div>
            )}
          </div>
        )}

        {esercizi.length > 0 && (
          <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '11px 13px', marginTop: '12px' }}>
            <div style={{ color: '#86efac', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '1px', marginBottom: '5px' }}>
              ✓ {esercizi.length} ESERCIZI PRONTI
            </div>
            {giorniToccati.map(g => (
              <div key={g} style={{ color: 'var(--testo-chiaro)', fontSize: '13px' }}>
                Giorno {g}: {perGiorno[g]} esercizi
                {(esistentiPerGiorno?.[g] || 0) > 0 && (
                  <span style={{ color: 'var(--attenzione)' }}> · si aggiungono ai {esistentiPerGiorno[g]} già presenti</span>
                )}
              </div>
            ))}
            {giorniGiaPieni.length > 0 && (
              <div style={{ color: 'rgba(234,179,8,0.8)', fontSize: '13px', marginTop: '6px', lineHeight: 1.4 }}>
                Gli esercizi vengono <strong>aggiunti</strong>, non sostituiti. Se vuoi rifare
                un giorno da zero, cancella prima quelli che ci sono.
              </div>
            )}
          </div>
        )}

        <button onClick={importa} disabled={!esercizi.length || inCorso}
          style={{
            width: '100%', marginTop: '16px', background: 'var(--accento)', border: 'none', borderRadius: '4px',
            padding: '15px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: '14px', fontWeight: '800', letterSpacing: '2px',
            opacity: !esercizi.length || inCorso ? 0.35 : 1, cursor: 'pointer',
          }}>
          {inCorso ? 'IMPORTAZIONE...' : `✓ IMPORTA ${esercizi.length || ''}`.trim()}
        </button>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '10px', fontSize: '14px', cursor: 'pointer' }}>
          Annulla
        </button>
      </div>
    </div>
  )
}
