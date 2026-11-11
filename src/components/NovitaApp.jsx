import { useState } from 'react'

/**
 * Il tutorial delle novità: compare una volta dopo un aggiornamento.
 *
 * Una novità per schermata, con il pulsante AVANTI grande in basso e il
 * conto («2 DI 4») sempre in vista: si sa quante ne mancano e non si deve
 * indovinare che c'è dell'altro scorrendo di lato. Ogni schermata dice cosa
 * fa la novità e la strada per trovarla, un riquadro per tocco.
 *
 * `schede`: quelle di novita.js. `aggiornata`: vero quando si apre da sola
 * dopo l'aggiornamento (e allora lo dice), falso quando la si riapre dalle
 * impostazioni.
 */
export default function NovitaApp({ schede, nome, aggiornata = true, onChiudi }) {
  const [passo, setPasso] = useState(0)
  const [verso, setVerso] = useState('avanti')
  const s = schede[passo]
  const ultima = passo === schede.length - 1
  if (!s) return null

  function vai(n) {
    setVerso(n > passo ? 'avanti' : 'indietro')
    setPasso(n)
  }

  return (
    <div className="velo-entra" role="dialog" aria-label="Cosa c'è di nuovo" style={{
      position: 'fixed', inset: 0, zIndex: 2600, background: 'var(--fondo)',
      maxWidth: 'var(--colonna)', marginInline: 'auto',
      display: 'flex', flexDirection: 'column', padding: '26px 22px 24px', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <img src="/logo_OAD.png" alt="OAD" style={{ height: '26px', mixBlendMode: 'screen' }} />
        {!ultima && (
          <button type="button" onClick={onChiudi} style={{ background: 'none', border: 'none', color: 'var(--testo-medio)', fontSize: '15px', padding: '6px 2px' }}>
            Salta
          </button>
        )}
      </div>

      <div style={{ color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800', letterSpacing: '2px' }}>
        {aggiornata ? '🆕 L\'APP È STATA AGGIORNATA' : '🆕 COSA C\'È DI NUOVO'}
      </div>
      {aggiornata && passo === 0 && (
        <div style={{ color: 'var(--testo-forte)', fontSize: '16px', lineHeight: 1.45, marginTop: '4px' }}>
          {nome ? `Ciao ${nome}, ecco` : 'Ecco'} cosa è cambiato.
        </div>
      )}

      {/* Il conto: tanti trattini quante le novità, accesi fino a questa. */}
      {schede.length > 1 && (
        <div style={{ margin: '16px 0 4px' }}>
          <div style={{ display: 'flex', gap: '5px' }} aria-hidden="true">
            {schede.map((_, i) => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= passo ? 'var(--accento)' : 'var(--sup-alta)', transition: 'background 200ms' }} />
            ))}
          </div>
          <div style={{ color: 'var(--testo-medio)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '700', letterSpacing: '1.5px', marginTop: '7px' }}>
            NOVITÀ {passo + 1} DI {schede.length}
          </div>
        </div>
      )}

      {/* La key fa ripartire l'animazione a ogni novità. */}
      <div key={passo} className={`passo-${verso}`} style={{ flex: 1, paddingTop: '18px' }}>
        <div style={{
          width: '76px', height: '76px', borderRadius: '50%', marginBottom: '18px',
          background: 'var(--acc-riempimento)', border: '1px solid var(--acc-bordo)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '38px', color: 'var(--accento)', fontWeight: '900',
        }} aria-hidden="true">{s.icona}</div>

        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '30px', fontWeight: '900', color: '#fff', letterSpacing: '0.5px', lineHeight: 1.05, marginBottom: '10px' }}>
          {s.titolo}
        </div>
        <div style={{ color: 'var(--testo-forte)', fontSize: '17px', lineHeight: 1.5 }}>
          {s.testo}
        </div>

        <div style={{ color: 'var(--testo-medio)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: '700', letterSpacing: '2px', margin: '22px 0 8px' }}>
          DOVE LA TROVI
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          {s.dove.map((tappa, i) => {
            const fine = i === s.dove.length - 1
            return (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  padding: '8px 12px', borderRadius: '6px',
                  background: fine ? 'var(--acc-fondo-forte)' : 'var(--sup-alta)',
                  border: `1px solid ${fine ? 'var(--acc-bordo-forte)' : 'var(--bordo)'}`,
                  color: fine ? 'var(--accento)' : '#fff',
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800', letterSpacing: '0.5px',
                }}>{tappa}</span>
                {!fine && <span style={{ color: 'var(--testo-medio)', fontSize: '18px' }} aria-hidden="true">›</span>}
              </span>
            )
          })}
        </div>

        {s.nota && (
          <div style={{ color: 'var(--ok)', fontSize: '15px', lineHeight: 1.45, marginTop: '18px' }}>
            ✓ {s.nota}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '26px' }}>
        {passo > 0 && (
          <button type="button" onClick={() => vai(passo - 1)} style={{
            flex: '0 0 34%', background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '8px',
            padding: '18px 8px', color: 'var(--testo-chiaro)',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '800', letterSpacing: '1.5px',
          }}>← INDIETRO</button>
        )}
        <button type="button" onClick={() => (ultima ? onChiudi() : vai(passo + 1))} style={{
          flex: 1, background: 'var(--accento)', border: 'none', borderRadius: '8px', padding: '18px',
          color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px', fontWeight: '800', letterSpacing: '2px',
        }}>
          {ultima ? 'HO CAPITO' : 'AVANTI →'}
        </button>
      </div>
      {ultima && (
        <div style={{ color: 'var(--testo-medio)', fontSize: '13px', textAlign: 'center', marginTop: '11px' }}>
          Le rivedi quando vuoi da IMPOST. → Cosa c&apos;è di nuovo.
        </div>
      )}
    </div>
  )
}
