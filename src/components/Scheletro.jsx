/**
 * Scheletri di caricamento.
 *
 * Ogni schermata mostrava la scritta «Caricamento…» su fondo vuoto: con la
 * connessione della palestra si guarda il nulla per secondi. Rettangoli della
 * forma del contenuto che sta arrivando fanno percepire l'app più veloce a
 * parità di tempo reale, perché l'occhio ha già dove posarsi e la pagina non
 * salta quando i dati arrivano.
 *
 * Le forme imitano quello che davvero comparirà: una riga di elenco ha un
 * titolo, un sottotitolo e un valore a destra. Uno scheletro che non somiglia
 * al risultato è solo rumore che si muove.
 */

function Osso({ larghezza = '100%', altezza = 12, raggio = 3, stile }) {
  return (
    <div
      className="osso"
      style={{ width: larghezza, height: altezza, borderRadius: raggio, ...stile }}
    />
  )
}

/** Righe di elenco: turni, schede, atlete. */
export function ScheletroElenco({ righe = 4 }) {
  // Larghezze diverse per riga: tutte uguali sembrerebbero una tabella, non
  // dei nomi propri.
  const larghezze = ['58%', '44%', '66%', '38%', '52%', '47%']
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {Array.from({ length: righe }, (_, i) => (
        <div key={i} style={{
          background: 'var(--sup)', border: '1px solid var(--sup-alta)', borderRadius: '6px',
          padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Osso larghezza={larghezze[i % larghezze.length]} altezza={13} />
            <Osso larghezza="30%" altezza={9} />
          </div>
          <Osso larghezza="52px" altezza={20} raggio={3} />
        </div>
      ))}
    </div>
  )
}

/** Blocchi grandi: le card delle fasi in home. */
export function ScheletroSchede({ righe = 3 }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {Array.from({ length: righe }, (_, i) => (
        <Osso key={i} altezza={140} raggio={6} />
      ))}
    </div>
  )
}

/** Storico di un'atleta: il grafico più qualche voce. */
export function ScheletroStorico() {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Osso altezza={62} raggio={8} />
      <Osso altezza={92} raggio={6} />
      <Osso altezza={44} raggio={6} />
      <Osso altezza={44} raggio={6} />
    </div>
  )
}

export default ScheletroElenco
