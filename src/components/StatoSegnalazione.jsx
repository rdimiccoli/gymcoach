import { STATI } from '../lib/segnalazioni'

/**
 * Il cartellino «a che punto è» di una segnalazione: arancione per una
 * nuova, giallo mentre ci si lavora, verde quando è fatta, grigio quando non
 * si fa. Lo usano l'elenco delle segnalazioni e la pagina RISPONDI.
 */
export const COLORE_STATO = {
  nuova: { sfondo: 'var(--acc-riempimento)', bordo: 'var(--acc-bordo-forte)', testo: 'var(--accento)' },
  letta: { sfondo: 'var(--sup-alta)', bordo: 'var(--bordo-forte)', testo: 'var(--testo-forte)' },
  in_corso: { sfondo: 'rgba(234,179,8,0.12)', bordo: 'rgba(234,179,8,0.45)', testo: 'var(--attenzione)' },
  fatta: { sfondo: 'rgba(34,197,94,0.12)', bordo: 'rgba(34,197,94,0.45)', testo: 'var(--ok)' },
  no: { sfondo: 'var(--sup)', bordo: 'var(--bordo)', testo: 'var(--testo-medio)' },
}

export default function StatoSegnalazione({ stato }) {
  const c = COLORE_STATO[stato] || COLORE_STATO.letta
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: c.sfondo, border: `1px solid ${c.bordo}`,
      color: c.testo, fontSize: '12px', fontWeight: '800', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.5px',
    }}>
      {stato === 'fatta' ? '✓ ' : ''}{(STATI[stato]?.nome || stato).toUpperCase()}
    </span>
  )
}
