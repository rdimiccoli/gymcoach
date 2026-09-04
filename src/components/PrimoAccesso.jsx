/**
 * Le tre cose da sapere, la prima volta che si entra.
 *
 * Una coach nuova apriva l'app e trovava una schermata con dei turni (o
 * vuota), senza sapere cosa fossero le schede né dove si segnano i carichi.
 *
 * Una schermata sola con tre punti, non un carosello da far scorrere: chi ha
 * oltre cinquant'anni non deve indovinare che c'è dell'altro a destra. Testi
 * grandi, e si vede una volta e basta.
 */

const CHIAVE = 'gymcoach.intro-vista'

export function introDaMostrare() {
  try { return localStorage.getItem(CHIAVE) !== '1' } catch { return false }
}

function segnaVista() {
  try { localStorage.setItem(CHIAVE, '1') } catch { /* modalità privata */ }
}

const PUNTI = [
  {
    n: '1',
    titolo: 'I TURNI',
    testo: 'Un turno è una fascia oraria con le sue atlete — per esempio «09:00 — Femminile». È da qui che si comincia.',
  },
  {
    n: '2',
    titolo: 'LE SCHEDE',
    testo: 'Una scheda dura sei settimane e ha tre giorni di esercizi. Si assegna a un turno, e vale per tutte le atlete di quel turno.',
  },
  {
    n: '3',
    titolo: 'I CARICHI',
    testo: 'Durante l\'allenamento apri il turno e segni i pesi con + e −. Si salvano da soli, anche quando il telefono non prende.',
  },
]

export default function PrimoAccesso({ nome, onChiudi }) {
  function chiudi() {
    segnaVista()
    onChiudi()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2600, background: 'var(--fondo)',
      display: 'flex', flexDirection: 'column', padding: '30px 24px 26px', overflowY: 'auto',
    }}>
      <img src="/logo_OAD.png" alt="OAD" style={{ height: '30px', mixBlendMode: 'screen', marginBottom: '18px', alignSelf: 'flex-start' }} />

      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '34px', fontWeight: '900', color: '#fff', letterSpacing: '1px', lineHeight: 1.05, marginBottom: '8px' }}>
        CIAO{nome ? <>,<br /><span style={{ color: 'var(--accento)' }}>{nome.toUpperCase()}</span></> : ''}
      </div>
      <div style={{ color: 'var(--testo-medio)', fontSize: '16px', lineHeight: 1.5, marginBottom: '30px' }}>
        Tre cose, e si parte.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', flex: 1 }}>
        {PUNTI.map(p => (
          <div key={p.n} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
            <div style={{
              flexShrink: 0, width: '34px', height: '34px', borderRadius: '50%',
              background: 'var(--acc-riempimento)', border: '1px solid var(--acc-bordo)',
              color: 'var(--accento)', fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '18px', fontWeight: '900',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{p.n}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '19px', fontWeight: '800', color: '#fff', letterSpacing: '1.5px', marginBottom: '4px' }}>
                {p.titolo}
              </div>
              <div style={{ color: 'var(--testo-forte)', fontSize: '16px', lineHeight: 1.5 }}>
                {p.testo}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={chiudi} style={{
        width: '100%', marginTop: '30px', background: 'var(--accento)', border: 'none',
        borderRadius: '8px', padding: '19px', color: '#fff',
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '17px',
        fontWeight: '800', letterSpacing: '2px', cursor: 'pointer',
      }}>
        HO CAPITO, COMINCIAMO
      </button>
      <div style={{ color: 'var(--testo-fioco)', fontSize: '13px', textAlign: 'center', marginTop: '11px' }}>
        Non ricomparirà più.
      </div>
    </div>
  )
}
