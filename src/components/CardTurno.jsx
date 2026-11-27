import { settimanaDaCalendario } from '../lib/schede'
import { settimaneDi } from '../lib/settimane'
import { comePulsante } from '../lib/stile'
import { statoScheda, turnoInCorso } from '../lib/avvisiTurno'

/**
 * La card di un turno nella schermata iniziale.
 *
 * Deve dire in un colpo d'occhio, senza leggere: che ora è il turno, che
 * scheda sta girando, a che punto delle sue settimane siamo e quante persone
 * ci sono. Prima queste informazioni erano sparse fra la scelta della fase e
 * la schermata del turno.
 *
 * L'avviso «⚠ N INDIETRO» non c'è più: segnalava che il contatore manuale di
 * qualcuno non stava al passo del calendario. Ora il calendario è l'unica
 * fonte, e non può essere in disaccordo con sé stesso.
 *
 * `ospiti`: nomi delle persone Silver venute da un altro turno. La card
 * allora mostra loro come titolo e la LORO scheda, che non è quella del turno.
 * `senzaScheda`: quante persone del turno non sono in nessuna scheda attiva —
 * l'unico avviso rimasto, perché segnala qualcuno che in allenamento non
 * comparirebbe da nessuna parte.
 */
export default function CardTurno({
  turno, scheda, atlete = [], mostraOrario = true, mostraConteggio = mostraOrario,
  ospiti = null, provenienza = '', senzaScheda = 0, altreSchede = [], onApri,
}) {
  const settimana = settimanaDaCalendario(scheda)
  const totale = settimaneDi(scheda)

  // L'orario è l'identificatore vero del turno: è così che le coach lo chiamano
  // fra loro. Il nome completo («09:00 — Femminile») è ridondante.
  const orario = turno.time || turno.name?.split('—')[0]?.trim() || ''
  const tipo = turno.type || turno.name?.split('—')[1]?.trim() || ''
  // Il turno di adesso si accende: il tablet passato di mano apre quello
  // giusto senza cercarlo. Solo sulla prima card del turno.
  const adesso = mostraOrario && turnoInCorso(orario)
  const stato = altreSchede.length === 0 ? statoScheda(scheda) : null

  return (
    <button type="button" onClick={onApri} style={adesso ? { ...card, boxShadow: '0 0 0 2px var(--accento)' } : card}
      aria-label={adesso ? `${orario}, turno in corso` : undefined}>
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
            // Secondo giro: stesso turno, altra scheda attiva — oppure qualcuno
            // venuto da un altro turno. Senza questo segno sembrerebbero turni
            // diversi allo stesso orario.
            <div style={{ color: ospiti ? 'var(--accento)' : 'var(--testo-fioco)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: ospiti ? '800' : '400', letterSpacing: '1px', paddingTop: '4px' }}>
              ↳ {ospiti ? (ospiti.length === 1 ? 'OSPITE' : 'OSPITI') : 'ANCHE'}
            </div>
          )}
        </div>

        <div style={{ width: '1px', background: 'var(--sup-alta)', flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {scheda ? (
            <>
              {ospiti && (
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.3px', lineHeight: 1.2 }}>
                  {ospiti.join(', ')}
                </div>
              )}
              <div style={ospiti
                ? { color: 'var(--testo-medio)', fontSize: '14px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
                : { fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {scheda.name}
              </div>

              {/* Il turno ha più schede attive e si apre per atleta: la barra
                  delle settimane mostrerebbe quella di una sola, e le altre
                  sarebbero a un punto diverso. Meglio dire quante sono. */}
              {altreSchede.length > 0 && (
                <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  + {altreSchede.join(' · ')}
                </div>
              )}

              {settimana && altreSchede.length === 0 && <BarraSettimane settimana={settimana} totale={totale} />}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                {settimana && altreSchede.length === 0 && (
                  <span style={{ color: 'var(--testo-forte)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>
                    SETTIMANA {settimana} DI {totale}
                  </span>
                )}
                {altreSchede.length > 0 && (
                  <span style={{ color: 'var(--testo-forte)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px' }}>
                    {altreSchede.length + 1} SCHEDE ATTIVE
                  </span>
                )}
                {provenienza && (
                  <span style={{ color: 'var(--testo-debole)', fontSize: '13px' }}>dal turno {provenienza}</span>
                )}
                {mostraConteggio && atlete.length > 0 && (
                  <span style={{ color: 'var(--testo-debole)', fontSize: '13px' }}>
                    {atlete.length} {atlete.length === 1 ? 'persona' : 'persone'}
                  </span>
                )}
              </div>
              {(adesso || stato) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {adesso && <span style={{ ...distintivo, ...arancione }}>ORA IN CORSO</span>}
                  {stato === 'ultima' && <span style={{ ...distintivo, ...giallo }}>ULTIMA SETTIMANA</span>}
                  {stato === 'finita' && <span style={{ ...distintivo, ...rosso }}>FINITA · PREPARA LA NUOVA</span>}
                </div>
              )}
              {senzaScheda > 0 && (
                <div style={{ color: 'var(--attenzione)', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: '700', letterSpacing: '0.5px', marginTop: '6px' }}>
                  ⚠ {senzaScheda} {senzaScheda === 1 ? 'PERSONA' : 'PERSONE'} SENZA SCHEDA
                </div>
              )}
            </>
          ) : (
            <div style={{ paddingTop: '3px' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', color: 'var(--testo-medio)', letterSpacing: '0.3px' }}>
                Nessuna scheda attiva
              </div>
              <div style={{ color: 'var(--testo-debole)', fontSize: '13px', marginTop: '3px' }}>
                {atlete.length > 0 ? `${atlete.length} ${atlete.length === 1 ? 'persona' : 'persone'} in attesa` : 'Creane una da SCHEDE'}
              </div>
              {adesso && <div style={{ marginTop: '8px' }}><span style={{ ...distintivo, ...arancione }}>ORA IN CORSO</span></div>}
            </div>
          )}
        </div>

        <div style={{ color: 'var(--testo-fioco)', fontSize: '20px', alignSelf: 'center', flexShrink: 0 }}>›</div>
      </div>
    </button>
  )
}

/** Una tacca per settimana: a che punto siamo, senza doverlo leggere. */
function BarraSettimane({ settimana, totale }) {
  return (
    <div style={{ display: 'flex', gap: '3px', marginTop: '9px' }} aria-hidden="true">
      {Array.from({ length: totale }, (_, i) => i + 1).map(n => (
        <div key={n} style={{
          flex: 1, height: '4px', borderRadius: '2px',
          background: n <= settimana ? 'var(--accento)' : 'var(--sup-alta)',
        }} />
      ))}
    </div>
  )
}

const distintivo = {
  display: 'inline-block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '800',
  letterSpacing: '1px', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap',
}
const arancione = { color: 'var(--accento)', background: 'var(--acc-riempimento)', border: '1px solid var(--acc-bordo-forte)' }
const giallo = { color: 'var(--attenzione)', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.45)' }
const rosso = { color: '#ff8a7a', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)' }

const card = {
  ...comePulsante,
  width: '100%', textAlign: 'left', cursor: 'pointer',
  background: 'var(--sup)', border: '1px solid var(--sup-alta)',
  borderLeft: '3px solid var(--accento)',
  borderRadius: '8px', padding: '15px 14px', marginBottom: '9px',
}
