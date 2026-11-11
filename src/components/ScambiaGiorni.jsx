import { useState } from 'react'
import { elencoGiorni } from '../lib/giorni'
import { vociDelGiorno } from '../lib/scambiaGiorni'

/**
 * La finestra per scambiare due giorni di una scheda.
 *
 * Non scambia niente da sola: si scelgono i due giorni, si vede subito cosa
 * finisce dove, e solo il pulsante grande conferma. Non si chiude toccando
 * fuori: un tocco nervoso non deve né confermare né annullare.
 *
 * `mappa`: gli esercizi per giorno, come li tiene l'editor ({ 1: [...] }).
 */
export default function ScambiaGiorni({ giorni, mappa, iniziale, lavorando, onConferma, onAnnulla }) {
  const tutti = elencoGiorni({ giorni })
  const [a, setA] = useState(iniziale)
  const [b, setB] = useState(() => tutti.find(d => d !== iniziale) ?? iniziale)

  function scegliA(d) {
    setA(d)
    // Lo stesso giorno da tutte e due le parti non vuol dire niente: il
    // secondo passa al primo giorno libero.
    if (d === b) setB(tutti.find(x => x !== d))
  }

  const vuoti = !(mappa[a]?.length) && !(mappa[b]?.length)

  return (
    <div className="velo-entra" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="foglio-entra" role="dialog" aria-label="Scambia i giorni" style={{
        background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0',
        padding: '24px 16px 30px', width: '100%', maxWidth: 'var(--colonna)', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px', marginBottom: '6px' }}>
          ⇄ SCAMBIA I GIORNI
        </div>
        <div style={{ color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.45, marginBottom: '18px' }}>
          Tutti gli esercizi di un giorno passano all&apos;altro, e viceversa.
        </div>

        <Scelta etichetta="IL GIORNO" giorni={tutti} scelto={a} onScegli={scegliA} nome="primo" />
        <Scelta etichetta="CON IL GIORNO" giorni={tutti} scelto={b} escluso={a} onScegli={setB} nome="secondo" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '18px 0 12px' }}>
          <Anteprima da={a} a={b} esercizi={mappa[a]} />
          <Anteprima da={b} a={a} esercizi={mappa[b]} />
        </div>

        <div style={{ color: 'var(--ok)', fontSize: '13px', lineHeight: 1.45, marginBottom: '18px' }}>
          ✓ I carichi e le note dei clienti restano con i loro esercizi: non si perde niente.
        </div>

        <button onClick={() => onConferma(a, b)} disabled={vuoti || lavorando} style={{
          width: '100%', background: 'var(--accento)', border: 'none', borderRadius: '4px', padding: '15px',
          color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800', letterSpacing: '1.5px',
          marginBottom: '10px', opacity: vuoti || lavorando ? 0.4 : 1,
        }}>
          {lavorando ? 'SCAMBIO IN CORSO…' : `⇄ SÌ, SCAMBIA GIORNO ${a} E GIORNO ${b}`}
        </button>
        {vuoti && (
          <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', textAlign: 'center', marginBottom: '6px' }}>
            Tutti e due i giorni sono vuoti: non c&apos;è niente da scambiare.
          </div>
        )}
        <button onClick={onAnnulla} disabled={lavorando} style={{ background: 'transparent', border: 'none', color: 'var(--testo-fioco)', width: '100%', padding: '8px', fontSize: '14px' }}>
          Annulla
        </button>
      </div>
    </div>
  )
}

function Scelta({ etichetta, giorni, scelto, escluso, onScegli, nome }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>
        {etichetta}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {giorni.map(d => {
          const attivo = d === scelto
          const spento = d === escluso
          return (
            <button key={d} type="button" disabled={spento} onClick={() => onScegli(d)}
              aria-label={`Giorno ${d} (${nome})`} aria-pressed={attivo}
              style={{
                flex: 1, padding: '12px 0', borderRadius: '4px',
                border: `1px solid ${attivo ? 'var(--accento)' : 'var(--bordo)'}`,
                background: attivo ? 'var(--accento)' : 'var(--sup-alta)',
                color: attivo ? '#fff' : 'var(--testo-chiaro)', opacity: spento ? 0.25 : 1,
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: '800',
              }}>{d}</button>
          )
        })}
      </div>
    </div>
  )
}

function Anteprima({ da, a, esercizi }) {
  const voci = vociDelGiorno(esercizi || [])
  return (
    <div style={{ background: 'var(--sup)', border: '1px solid var(--bordo)', borderRadius: '6px', padding: '11px 13px' }}>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800', letterSpacing: '1px', color: '#fff', marginBottom: '5px' }}>
        GIORNO {da} <span style={{ color: 'var(--accento)' }}>→ DIVENTA GIORNO {a}</span>
      </div>
      {voci.length
        ? voci.map((v, i) => (
          <div key={i} style={{ color: 'var(--testo-forte)', fontSize: '14px', lineHeight: 1.45 }}>• {v}</div>
        ))
        : <div style={{ color: 'var(--testo-fioco)', fontSize: '14px' }}>Nessun esercizio</div>}
    </div>
  )
}
