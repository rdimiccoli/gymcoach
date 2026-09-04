import { settimanaDaCalendario } from '../lib/schede'
import { comePulsante } from '../lib/stile'

/**
 * La card di un turno nella schermata iniziale.
 *
 * Deve dire in un colpo d'occhio, senza leggere: che ora è il turno, che
 * scheda sta girando, a che punto delle sei settimane siamo e se qualcuna è
 * rimasta indietro. Prima queste informazioni erano sparse fra la scelta
 * della fase e la schermata del turno.
 */
export default function CardTurno({ turno, scheda, atlete = [], mostraOrario = true, onApri }) {
  const settimana = settimanaDaCalendario(scheda)
  const indietro = settimana ? atlete.filter(a => a.current_week < settimana).length : 0

  // L'orario è l'identificatore vero del turno: è così che le coach lo chiamano
  // fra loro. Il nome completo («09:00 — Femminile») è ridondante.
  const orario = turno.time || turno.name?.split('—')[0]?.trim() || ''
  const tipo = turno.type || turno.name?.split('—')[1]?.trim() || ''

  return (
    <button type="button" onClick={onApri} style={card}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '14px' }}>

        <div style={{ flexShrink: 0, minWidth: '64px' }}>
          {mostraOrario ? (
            <>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '30px', fontWeight: '900', color: 'var(--accento)', lineHeight: 1, letterSpacing: '0.5px' }}>
                {orario}
              </div>
              <div style={{ color: 'var(--testo-debole)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', marginTop: '4px' }}>
                {tipo.toUpperCase()}
              </div>
            </>
          ) : (
            // Secondo giro: stesso turno, altra scheda attiva. Senza questo
            // segno sembrerebbero due turni diversi allo stesso orario.
            <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '1px', paddingTop: '4px' }}>
              ↳ ANCHE
            </div>
          )}
        </div>

        <div style={{ width: '1px', background: 'var(--sup-alta)', flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {scheda ? (
            <>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {scheda.name}
              </div>

              {settimana && <BarraSettimane settimana={settimana} />}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                {settimana && (
                  <span style={{ color: 'var(--testo-forte)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>
                    SETTIMANA {settimana} DI 6
                  </span>
                )}
                {mostraOrario && atlete.length > 0 && (
                  <span style={{ color: 'var(--testo-debole)', fontSize: '13px' }}>
                    {atlete.length} {atlete.length === 1 ? 'atleta' : 'atlete'}
                  </span>
                )}
                {indietro > 0 && (
                  <span style={etichettaIndietro}>⚠ {indietro} INDIETRO</span>
                )}
              </div>
            </>
          ) : (
            <div style={{ paddingTop: '3px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: 'var(--testo-medio)', letterSpacing: '0.3px' }}>
                Nessuna scheda attiva
              </div>
              <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginTop: '3px' }}>
                {atlete.length > 0 ? `${atlete.length} atlete in attesa` : 'Creane una da SCHEDE'}
              </div>
            </div>
          )}
        </div>

        <div style={{ color: 'var(--testo-fioco)', fontSize: '20px', alignSelf: 'center', flexShrink: 0 }}>›</div>
      </div>
    </button>
  )
}

/** Sei tacche: a che punto siamo, senza doverlo leggere. */
function BarraSettimane({ settimana }) {
  return (
    <div style={{ display: 'flex', gap: '3px', marginTop: '9px' }} aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map(n => (
        <div key={n} style={{
          flex: 1, height: '4px', borderRadius: '2px',
          background: n <= settimana ? 'var(--accento)' : 'var(--sup-alta)',
        }} />
      ))}
    </div>
  )
}

const card = {
  ...comePulsante,
  width: '100%', textAlign: 'left', cursor: 'pointer',
  background: 'var(--sup)', border: '1px solid var(--sup-alta)',
  borderLeft: '3px solid var(--accento)',
  borderRadius: '8px', padding: '15px 14px', marginBottom: '9px',
}

const etichettaIndietro = {
  color: 'var(--attenzione)', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif',
  fontWeight: '700', letterSpacing: '0.5px',
  background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)',
  borderRadius: '3px', padding: '2px 7px',
}
