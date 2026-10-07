import { useState } from 'react'
import { comePulsante } from '../lib/stile'
import { tocco } from '../lib/aptico'
import AvatarCoach from './AvatarCoach'

/**
 * «Chi sei?» — la scelta del profilo, dopo l'accesso.
 *
 * Da ottobre 2026 la credenziale è una sola per tutti e due i coach, quindi
 * l'account non dice più per chi si sta lavorando: lo dice questa schermata.
 *
 * Un nome per riga, grandi, senza niente altro intorno: è la prima cosa che
 * si vede aprendo l'app e deve rispondersi in un tocco. La scelta resta nel
 * telefono, quindi in pratica si vede una volta sola per telefono.
 *
 * Il nome scelto è anche quello che comparirà in grande sulla Home («COACH
 * SANDRO»): se uno sbaglia riga se ne accorge subito dopo.
 *
 * Quando `cambio` è vero siamo arrivati qui da IMPOSTAZIONI e non da
 * un accesso: cambia il titolo, e si può tornare indietro.
 */
export default function ScegliCoach({ coaches, attuale, onScelto, onAnnulla, cambio = false }) {
  // Senza nessun profilo nel database non si può lavorare. Non ne creiamo uno
  // da soli: con la credenziale comune un profilo creato in automatico
  // sarebbe un terzo coach fantasma accanto a Sandro e Manu, e nessuno
  // capirebbe da dove è uscito. Meglio un pulsante che si tocca apposta.
  const vuoto = !coaches?.length

  return (
    <div style={pagina}>
      <img src="/logo_OAD.png" alt="OAD" style={{ height: '30px', mixBlendMode: 'screen', marginBottom: '22px', alignSelf: 'flex-start' }} />

      <div style={titolo}>{cambio ? 'CAMBIA COACH' : 'CHI SEI?'}</div>
      <div style={sottotitolo}>
        {cambio
          ? 'Tocca il nome del coach con cui vuoi lavorare. I turni, le schede e i carichi che vedrai saranno i suoi.'
          : 'Tocca il tuo nome. Vedrai i tuoi turni, le tue schede e i tuoi carichi.'}
      </div>

      {vuoto ? (
        <div style={avviso}>
          Questo accesso non è ancora collegato a nessun profilo coach.
          Avvisa chi gestisce l'app.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {coaches.map(c => {
            const sei = c.id === attuale
            return (
              <button key={c.id} type="button"
                onClick={() => { tocco(); onScelto(c) }}
                style={{ ...riga, ...(sei ? rigaAttuale : null) }}>
                <AvatarCoach coach={c} size={52} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={nome}>{(c.name || c.email || '—').toUpperCase()}</span>
                  {sei && <span style={etichettaSei}>SEI TU ADESSO</span>}
                </span>
                <span style={{ color: 'var(--testo-fioco)', fontSize: '22px', flexShrink: 0 }}>›</span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{ flex: 1, minHeight: '20px' }} />

      {cambio && (
        <button type="button" onClick={onAnnulla} style={annulla}>ANNULLA</button>
      )}

      <div style={nota}>
        Si cambia quando si vuole da IMPOSTAZIONI.
      </div>
    </div>
  )
}

/**
 * La conferma prima di cambiare davvero.
 *
 * Il 29 settembre due coach si sono ritrovati i turni a vicenda perché
 * un'azione importante stava a un tocco solo, senza conferma. Cambiare
 * profilo non dà via niente a nessuno, ma porta a segnare i carichi sulle
 * atlete di un altro: la conferma dice a chiare lettere cosa cambia.
 */
export function ConfermaCambio({ coach, onConferma, onAnnulla }) {
  const [attesa, setAttesa] = useState(false)
  return (
    <div style={sfondo} onClick={onAnnulla}>
      <div style={foglio} onClick={e => e.stopPropagation()}>
        {/* Anche qui il segno di chi si sta per diventare: la conferma deve
            far vedere la stessa cosa che si è appena toccata. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <AvatarCoach coach={coach} size={42} />
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '21px', fontWeight: '900', color: '#fff', letterSpacing: '1px', lineHeight: 1.1 }}>
            LAVORARE COME {(coach.name || coach.email || '').toUpperCase()}?
          </div>
        </div>
        <div style={{ color: 'var(--testo-medio)', fontSize: '15px', lineHeight: 1.5, marginBottom: '20px' }}>
          Da adesso vedrai i turni, le schede e le atlete di {coach.name || coach.email}.
          I carichi che segnerai finiranno sulle sue atlete.
        </div>
        <button type="button" disabled={attesa}
          onClick={() => { setAttesa(true); onConferma() }}
          style={{ ...pulsante, background: 'var(--accento)', color: '#fff', opacity: attesa ? 0.6 : 1 }}>
          SÌ, CAMBIA
        </button>
        <button type="button" onClick={onAnnulla}
          style={{ ...pulsante, marginTop: '10px', background: 'var(--sup-alta)', border: '1px solid var(--bordo)', color: '#fff' }}>
          NO, RESTO COME SONO
        </button>
      </div>
    </div>
  )
}

const pagina = {
  position: 'fixed', inset: 0, zIndex: 2600, background: 'var(--fondo)',
  display: 'flex', flexDirection: 'column', padding: '30px 24px 26px', overflowY: 'auto',
}

const titolo = {
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '34px', fontWeight: '900',
  color: '#fff', letterSpacing: '1px', lineHeight: 1.05, marginBottom: '8px',
}

const sottotitolo = {
  color: 'var(--testo-medio)', fontSize: '16px', lineHeight: 1.5, marginBottom: '26px',
}

const riga = {
  ...comePulsante,
  display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
  padding: '18px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
  background: 'var(--sup)', border: '1px solid var(--sup-alta)',
  borderLeft: '3px solid var(--accento)',
}

const rigaAttuale = {
  background: 'var(--acc-riempimento)', border: '1px solid var(--acc-bordo-forte)',
  borderLeft: '3px solid var(--accento)',
}

const nome = {
  display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '26px',
  fontWeight: '900', letterSpacing: '1px', color: '#fff', lineHeight: 1.1,
}

const etichettaSei = {
  display: 'block', marginTop: '3px', color: 'var(--accento)', fontSize: '12px',
  fontWeight: '800', letterSpacing: '1.5px', fontFamily: 'Barlow Condensed, sans-serif',
}

const avviso = {
  color: 'var(--testo-forte)', fontSize: '15px', lineHeight: 1.5, padding: '20px',
  border: '1px dashed var(--sup-alta)', borderRadius: '8px',
}

const annulla = {
  ...comePulsante,
  width: '100%', padding: '16px', borderRadius: '8px', cursor: 'pointer',
  background: 'var(--sup-alta)', border: '1px solid var(--bordo)', color: '#fff',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800',
  letterSpacing: '2px', textAlign: 'center',
}

const nota = {
  color: 'var(--testo-fioco)', fontSize: '13px', textAlign: 'center', marginTop: '14px',
}

const sfondo = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2700,
  display: 'flex', alignItems: 'flex-end',
}

const foglio = {
  background: 'var(--superficie-modale)', borderTop: '1px solid var(--bordo)',
  borderRadius: '16px 16px 0 0', padding: '24px 16px 30px', width: '100%',
  boxSizing: 'border-box',
}

const pulsante = {
  ...comePulsante,
  width: '100%', padding: '16px', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px', fontWeight: '800',
  letterSpacing: '2px', textAlign: 'center',
}
