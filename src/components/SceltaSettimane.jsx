import { SETTIMANE_MIN, SETTIMANE_MAX, fasi, etichettaFase } from '../lib/settimane'

/**
 * Quante settimane dura la scheda: un meno, il numero, un più.
 *
 * Sotto dice subito come si divideranno le ripetizioni, così chi sceglie 8
 * vede che le tre caselle diventano «1-3 · 4-6 · 7-8» prima ancora di
 * entrare nella scheda, e non ha sorprese.
 *
 * Pulsanti grandi e non un menu a tendina: con due tocchi si va da 6 a 8, e
 * non c'è niente da scorrere.
 */
export default function SceltaSettimane({ valore, onChange }) {
  const elenco = fasi(valore)
  return (
    <div>
      <div style={etichetta}>QUANTE SETTIMANE</div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
        <button type="button" aria-label="Una settimana in meno" disabled={valore <= SETTIMANE_MIN}
          onClick={() => onChange(Math.max(SETTIMANE_MIN, valore - 1))}
          style={{ ...tasto, opacity: valore <= SETTIMANE_MIN ? 0.3 : 1 }}>−</button>
        <div style={numero}>
          {valore} <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--testo-medio)' }}>{valore === 1 ? 'settimana' : 'settimane'}</span>
        </div>
        <button type="button" aria-label="Una settimana in più" disabled={valore >= SETTIMANE_MAX}
          onClick={() => onChange(Math.min(SETTIMANE_MAX, valore + 1))}
          style={{ ...tasto, opacity: valore >= SETTIMANE_MAX ? 0.3 : 1 }}>+</button>
      </div>
      <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', marginTop: '6px', lineHeight: 1.4 }}>
        Le ripetizioni cambiano {elenco.length === 1 ? 'mai: una sola casella' : `in ${elenco.length} fasi`}: {elenco.map(etichettaFase).join(' · ')}
      </div>
    </div>
  )
}

const etichetta = { color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }
const tasto = { width: '52px', flexShrink: 0, background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px', color: '#fff', fontSize: '22px', fontWeight: '700', cursor: 'pointer' }
const numero = { flex: 1, textAlign: 'center', background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '4px', padding: '10px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: '800' }
