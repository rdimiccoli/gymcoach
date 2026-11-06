import { SETTIMANE_MIN, SETTIMANE_MAX, fasi, etichettaFase } from '../lib/settimane'

/**
 * Quante settimane dura la scheda, e ogni quante cambiano le ripetizioni.
 *
 * Due righe uguali: un meno, il numero, un più. Sotto, subito, come si
 * divideranno le caselle delle ripetizioni («1-2 · 3-4 · 5-6 · 7-8»), così
 * chi sceglie vede l'effetto prima ancora di entrare nella scheda.
 *
 * La seconda riga (il passo) compare solo se chi la usa passa
 * `onCambiaOgni`, cioè solo se il database ha già le colonne per tenere più
 * di tre caselle. `ogni` a null vuol dire «tre fasi automatiche», il modo di
 * prima: lo si dice, e il primo tocco su − o + sceglie un passo vero.
 *
 * Pulsanti grandi e non un menu a tendina: con due tocchi si va da 6 a 8, e
 * non c'è niente da scorrere.
 */
export default function SceltaSettimane({ valore, onChange, ogni = null, onCambiaOgni }) {
  const passo = ogni === null || ogni === undefined ? null : Math.min(valore, ogni)
  const elenco = fasi(valore, onCambiaOgni ? passo : null)
  return (
    <div>
      <Riga etichetta="QUANTE SETTIMANE"
        testo={<>{valore} <Piccolo>{valore === 1 ? 'settimana' : 'settimane'}</Piccolo></>}
        meno={valore > SETTIMANE_MIN && (() => onChange(valore - 1))}
        piu={valore < SETTIMANE_MAX && (() => onChange(valore + 1))}
        nome="settimana" />

      {onCambiaOgni && (
        <div style={{ marginTop: '12px' }}>
          <Riga etichetta="LE RIPETIZIONI CAMBIANO OGNI"
            testo={passo === null
              ? <Piccolo>3 fasi automatiche</Piccolo>
              : <>{passo} <Piccolo>{passo === 1 ? 'settimana' : 'settimane'}</Piccolo></>}
            meno={(passo === null || passo > 1) && (() => onCambiaOgni(passo === null ? 2 : passo - 1))}
            piu={(passo === null || passo < valore) && (() => onCambiaOgni(passo === null ? 2 : passo + 1))}
            nome="passo" />
        </div>
      )}

      <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', marginTop: '6px', lineHeight: 1.4 }}>
        {elenco.length === 1
          ? 'Le ripetizioni non cambiano: una casella sola.'
          : elenco.every(f => f.da === f.a)
            ? `Una casella di ripetizioni per ogni settimana: ${elenco.length} caselle.`
            : `${elenco.length} caselle di ripetizioni: ${elenco.map(etichettaFase).join(' · ')}`}
      </div>
    </div>
  )
}

function Riga({ etichetta, testo, meno, piu, nome }) {
  return (
    <>
      <div style={stileEtichetta}>{etichetta}</div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
        <button type="button" aria-label={`Meno (${nome})`} disabled={!meno} onClick={meno || undefined}
          style={{ ...tasto, opacity: meno ? 1 : 0.3 }}>−</button>
        <div style={numero}>{testo}</div>
        <button type="button" aria-label={`Più (${nome})`} disabled={!piu} onClick={piu || undefined}
          style={{ ...tasto, opacity: piu ? 1 : 0.3 }}>+</button>
      </div>
    </>
  )
}

const Piccolo = ({ children }) => <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--testo-medio)' }}>{children}</span>

const stileEtichetta = { color: 'var(--testo-fioco)', fontSize: '12px', fontWeight: '700', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }
const tasto = { width: '52px', flexShrink: 0, background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px', color: '#fff', fontSize: '22px', fontWeight: '700', cursor: 'pointer' }
const numero = { flex: 1, textAlign: 'center', background: 'var(--sup-alta)', border: '1px solid var(--bordo-forte)', borderRadius: '4px', padding: '10px', color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: '800' }
