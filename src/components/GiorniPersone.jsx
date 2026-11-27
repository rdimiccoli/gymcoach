import { useState } from 'react'
import { elencoGiorni } from '../lib/giorni'
import { cambiaGiorno, normalizza } from '../lib/giorniPersona'
import { nomeCompleto } from '../lib/nomi'

/**
 * Chi fa quali giorni di una scheda: una riga per persona, con un pulsante
 * per giorno da accendere e spegnere. Tutti accesi = fa tutta la scheda,
 * che è la scelta di partenza.
 *
 * Si salva solo con il pulsante SALVA: toccare un giorno per prova non
 * scrive niente. L'ultimo giorno acceso di una persona non si spegne.
 *
 * `scelteIniziali`: { idPersona: [giorni] } — chi non c'è fa tutti i giorni.
 * `onSalva(cambiate)`: solo le persone toccate, { idPersona: [giorni] | null }.
 */
export default function GiorniPersone({ scheda, giorni, persone, scelteIniziali, salvando, onSalva, onAnnulla }) {
  const [scelte, setScelte] = useState(scelteIniziali)
  const tutti = elencoGiorni({ giorni })

  const cambiate = Object.fromEntries(persone
    .filter(p => String(normalizza(scelte[p.id], giorni)) !== String(normalizza(scelteIniziali[p.id], giorni)))
    .map(p => [p.id, normalizza(scelte[p.id], giorni)]))
  const quanteCambiate = Object.keys(cambiate).length

  return (
    <div className="velo-entra" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="foglio-entra" role="dialog" aria-label="Giorni di ognuno" style={{
        background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)', borderRadius: '16px 16px 0 0',
        padding: '22px 16px 28px', width: '100%', maxWidth: 'var(--colonna)', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '1px' }}>
          📅 GIORNI DI OGNUNO
        </div>
        <div style={{ color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '700', marginTop: '2px' }}>
          {scheda.name}
        </div>
        <div style={{ color: 'var(--testo-medio)', fontSize: '14px', lineHeight: 1.45, margin: '8px 0 16px' }}>
          Spegni i giorni che una persona non fa. Tutti accesi = fa tutta la scheda.
          In seduta, chi non fa quel giorno va in fondo, in grigio.
        </div>

        {persone.map(p => {
          const sue = normalizza(scelte[p.id], giorni)
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: '1px solid var(--sup-alta)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nomeCompleto(p)}
                </div>
                <div style={{ color: sue ? 'var(--accento)' : 'var(--testo-medio)', fontSize: '13px', marginTop: '1px' }}>
                  {sue ? `Solo ${sue.map(g => `G${g}`).join(' e ')}` : 'Tutti i giorni'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {tutti.map(g => {
                  const acceso = !sue || sue.includes(g)
                  const ultimo = acceso && sue?.length === 1
                  return (
                    <button key={g} type="button" aria-pressed={acceso}
                      aria-label={`${nomeCompleto(p)}: giorno ${g} ${acceso ? 'acceso' : 'spento'}`}
                      onClick={() => setScelte(s => ({ ...s, [p.id]: cambiaGiorno(normalizza(s[p.id], giorni), g, giorni) }))}
                      disabled={ultimo}
                      style={{
                        width: '46px', height: '42px', borderRadius: '6px',
                        border: `1px solid ${acceso ? 'var(--accento)' : 'var(--bordo)'}`,
                        background: acceso ? 'var(--accento)' : 'var(--sup)',
                        color: acceso ? '#fff' : 'var(--testo-debole)',
                        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800',
                        textDecoration: acceso ? 'none' : 'line-through',
                      }}>G{g}</button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <button onClick={() => onSalva(cambiate)} disabled={!quanteCambiate || salvando} style={{
          width: '100%', marginTop: '18px', background: 'var(--accento)', border: 'none', borderRadius: '6px', padding: '15px',
          color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '1.5px',
          opacity: !quanteCambiate || salvando ? 0.35 : 1,
        }}>
          {salvando ? 'SALVO…' : '✓ SALVA'}
        </button>
        <button onClick={onAnnulla} disabled={salvando} style={{ background: 'transparent', border: 'none', color: 'var(--testo-medio)', width: '100%', padding: '10px', fontSize: '15px' }}>
          Annulla
        </button>
      </div>
    </div>
  )
}
