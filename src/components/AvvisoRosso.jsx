/**
 * Il banner rosso che precede ogni cancellazione.
 *
 * Regola dell'app: niente sparisce senza che prima si sia letto, in rosso,
 * cosa sparisce. Dove si può si dicono i numeri veri («si cancellano 214
 * carichi»): «verranno eliminati i dati associati» non lo legge nessuno, un
 * numero sì.
 *
 * `perdite`:
 *   - undefined → si sta ancora contando: lo si dice;
 *   - null      → il conto non è riuscito: si dice la frase generica
 *                 `senzaNumeri`, che deve essere comunque vera;
 *   - [testi]   → l'elenco di cosa si perde. Vuoto = non si perde niente.
 */
export default function AvvisoRosso({ perdite, senzaNumeri, nienteDaPerdere }) {
  if (perdite !== undefined && perdite !== null && perdite.length === 0) {
    return (
      <div style={{ color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
        {nienteDaPerdere || 'Non ci sono dati collegati: non si perde niente.'}
      </div>
    )
  }
  return (
    <div style={riquadro} role="alert">
      <div style={titolo}>⚠ ATTENZIONE</div>
      {perdite === undefined && <div style={testo}>Controllo cosa si perde…</div>}
      {perdite === null && <div style={testo}>{senzaNumeri}</div>}
      {Array.isArray(perdite) && (<>
        <div style={testo}>Si cancellano per sempre:</div>
        <ul style={{ margin: '6px 0 0', paddingLeft: '20px', color: '#fff', fontSize: '14px', lineHeight: 1.6 }}>
          {perdite.map(p => <li key={p}><b>{p}</b></li>)}
        </ul>
      </>)}
      <div style={{ color: '#fca5a5', fontSize: '13px', fontWeight: '700', marginTop: '8px' }}>
        Non si può tornare indietro.
      </div>
    </div>
  )
}

const riquadro = { border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.10)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }
const titolo = { color: '#f87171', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '900', letterSpacing: '1px', fontSize: '17px', marginBottom: '4px' }
const testo = { color: '#fff', fontSize: '14px', lineHeight: 1.5 }
