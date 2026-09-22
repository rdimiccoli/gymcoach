import { comePulsante } from '../lib/stile'
import { tocco } from '../lib/aptico'

/**
 * «A chi è assegnata?» — la stessa domanda quando si crea una scheda e quando
 * la si modifica.
 *
 * `scelte` è null per «tutto il turno», un Set di id per «solo alcune
 * persone». Null e non «tutti gli id»: una scheda per tutto il turno deve
 * includere anche chi verrà aggiunto più avanti, e un elenco di id si
 * fermerebbe a chi c'era il giorno in cui è stata salvata.
 *
 * Passando a «solo alcune» l'elenco parte vuoto: la scheda per pochi è il
 * caso per cui esiste la domanda, e spuntare i pochi è più rapido che
 * togliere i molti.
 */
export default function ScegliPersone({ atleti, scelte, onChange }) {
  if (!atleti?.length) return null
  const perTutti = scelte === null
  // Si contano solo le persone visibili: una assegnata e poi disattivata resta
  // nell'insieme ma non nell'elenco, e contarla farebbe dire «2 scelte»
  // accanto a una sola spunta.
  const spuntate = perTutti ? 0 : atleti.filter(a => scelte.has(a.id)).length

  function alterna(id) {
    tocco()
    const next = new Set(scelte)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(next)
  }

  return (
    <div>
      <div style={etichetta}>A CHI È ASSEGNATA?</div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: perTutti ? 0 : '12px' }}>
        <button type="button" onClick={() => onChange(null)} style={scelta(perTutti)}>
          TUTTO IL TURNO
        </button>
        <button type="button" onClick={() => { if (perTutti) onChange(new Set()) }} style={scelta(!perTutti)}>
          SOLO ALCUNE PERSONE
        </button>
      </div>

      {perTutti && (
        <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', lineHeight: 1.45, marginTop: '8px' }}>
          Vale anche per chi aggiungerai al turno più avanti.
        </div>
      )}

      {!perTutti && (
        <>
          <div style={{ maxHeight: '38vh', overflowY: 'auto' }}>
            {atleti.map(a => {
              const dentro = scelte.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => alterna(a.id)}
                  style={{
                    ...comePulsante,
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '12px', marginBottom: '6px', borderRadius: '8px',
                    background: dentro ? 'var(--acc-riempimento)' : 'var(--sup)',
                    border: `1px solid ${dentro ? 'var(--acc-bordo-forte)' : 'transparent'}`,
                    textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <span style={{
                    flexShrink: 0, width: '24px', height: '24px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: dentro ? 'var(--accento)' : 'transparent',
                    border: dentro ? 'none' : '1px solid var(--bordo-forte)',
                    color: '#fff', fontSize: '14px', lineHeight: 1,
                  }}>{dentro ? '✓' : ''}</span>
                  <span style={{
                    flex: 1, minWidth: 0,
                    fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700',
                    letterSpacing: '0.5px', color: dentro ? '#fff' : 'var(--testo-forte)',
                  }}>{a.surname} {a.name}</span>
                </button>
              )
            })}
          </div>
          <div style={{ color: spuntate ? 'var(--testo-medio)' : 'var(--attenzione)', fontSize: '13px', marginTop: '4px' }}>
            {spuntate
              ? `${spuntate} ${spuntate === 1 ? 'persona scelta' : 'persone scelte'}`
              : 'Scegli almeno una persona.'}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Vero se la scelta si può salvare: «solo alcune» senza nessuno non ha senso.
 *
 * Senza `atleti` (turno vuoto, o elenco non ancora arrivato) si lascia
 * salvare: l'elenco non compare, quindi chiedere di spuntare qualcuno
 * bloccherebbe il pulsante senza offrire un modo per sbloccarlo.
 */
export const sceltaValida = (scelte, atleti = []) =>
  scelte === null || !atleti.length || atleti.some(a => scelte.has(a.id))

const etichetta = {
  color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', letterSpacing: '1.5px',
  fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px',
}

const scelta = attiva => ({
  ...comePulsante,
  flex: 1, padding: '13px 8px', borderRadius: '8px', cursor: 'pointer',
  background: attiva ? 'var(--accento)' : 'var(--sup)',
  border: `1px solid ${attiva ? 'var(--accento)' : 'var(--bordo)'}`,
  color: attiva ? '#fff' : 'var(--testo-medio)',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', fontWeight: '800',
  letterSpacing: '1px', textAlign: 'center',
})
