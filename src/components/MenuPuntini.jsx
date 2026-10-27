import { useState, useRef, useEffect } from 'react'

/**
 * Il pulsante ⋮ e la sua tendina.
 *
 * Nasce per le schede: ogni scheda aveva in vista cinque pulsanti —
 * CONDIVIDI, MODIFICA, CSV, COMPLETA, ELIMINA — e con tre schede per turno
 * la pagina era un muro di pulsanti dove il nome della scheda si perdeva.
 * Ora in vista resta solo quello che si usa sempre (APRI); il resto sta
 * qui dentro.
 *
 * La tendina sta dentro la pagina e non sopra (niente portal): sul tablet
 * l'app è ingrandita con `zoom`, e una tendina appesa al body andrebbe
 * posizionata facendo i conti con l'ingrandimento. Qui dentro si appoggia
 * al pulsante e basta.
 *
 * Si apre verso l'alto quando sotto non c'è posto, cioè per l'ultima scheda
 * in fondo alla schermata. Il posto si misura sul contenitore che scorre
 * (segnato con `data-scorre`), non sulla finestra: le due misure stanno
 * nello stesso sistema anche con lo zoom.
 *
 * `voci`: [{ icona, testo, azione, pericolo? }] — le voci false si saltano,
 * così chi chiama può scrivere `attiva && { ... }`.
 */
export default function MenuPuntini({ voci, etichetta = 'Altre azioni' }) {
  const [aperto, setAperto] = useState(false)
  const [versoAlto, setVersoAlto] = useState(false)
  const pulsante = useRef(null)
  const tendina = useRef(null)

  // Un tocco fuori la chiude. Il pulsante stesso è escluso: altrimenti il
  // tocco che la chiude la riaprirebbe subito dopo.
  useEffect(() => {
    if (!aperto) return
    function fuori(e) {
      if (tendina.current?.contains(e.target) || pulsante.current?.contains(e.target)) return
      setAperto(false)
    }
    document.addEventListener('pointerdown', fuori)
    return () => document.removeEventListener('pointerdown', fuori)
  }, [aperto])

  function apriChiudi() {
    if (aperto) { setAperto(false); return }
    const sotto = pulsante.current.getBoundingClientRect().bottom
    const contenitore = pulsante.current.closest('[data-scorre]')
    const fondo = contenitore ? contenitore.getBoundingClientRect().bottom : window.innerHeight
    setVersoAlto(fondo - sotto < ALTEZZA_STIMATA)
    setAperto(true)
  }

  const elenco = voci.filter(Boolean)

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button ref={pulsante} type="button" onClick={apriChiudi}
        aria-label={etichetta} aria-haspopup="menu" aria-expanded={aperto}
        style={{ ...stilePulsante, ...(aperto ? stileAcceso : null) }}>
        ⋮
      </button>

      {aperto && (
        <div ref={tendina} role="menu" className="tendina-entra"
          style={{
            ...stileTendina,
            // Si apre partendo dal pulsante: dall'angolo in alto a destra, o
            // da quello in basso quando si apre verso l'alto.
            ...(versoAlto
              ? { bottom: 'calc(100% + 6px)', transformOrigin: 'bottom right' }
              : { top: 'calc(100% + 6px)', transformOrigin: 'top right' }),
          }}>
          {elenco.map((v, i) => (
            <button key={v.testo} type="button" role="menuitem"
              onClick={() => { setAperto(false); v.azione() }}
              style={{
                ...stileVoce,
                // Le voci pericolose stanno in fondo, staccate dalle altre:
                // un tocco impreciso sulla voce sopra non deve arrivarci.
                ...(v.pericolo ? { color: '#f87171', borderTop: i > 0 ? '1px solid var(--bordo)' : 'none', marginTop: i > 0 ? '4px' : 0 } : null),
              }}>
              <span style={{ width: '24px', textAlign: 'center', flexShrink: 0 }}>{v.icona}</span>
              <span>{v.testo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Cinque voci da 48px più i margini: se sotto c'è meno di così, si apre in su.
const ALTEZZA_STIMATA = 290

const stilePulsante = {
  width: '40px', height: '34px', padding: 0,
  background: 'var(--sup-alta)', border: '1px solid var(--bordo)', borderRadius: '4px',
  color: '#fff', fontSize: '20px', fontWeight: '700', lineHeight: 1, cursor: 'pointer',
}
const stileAcceso = { background: 'var(--acc-riempimento)', border: '1px solid var(--accento)', color: 'var(--accento)' }
const stileTendina = {
  position: 'absolute', right: 0, zIndex: 40, minWidth: '210px',
  background: 'var(--superficie-modale)', border: '1px solid var(--bordo-forte)', borderRadius: '8px',
  padding: '4px', boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
}
const stileVoce = {
  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minHeight: '48px',
  padding: '0 12px', background: 'transparent', border: 'none', borderRadius: '6px',
  color: '#fff', textAlign: 'left', cursor: 'pointer',
  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '16px', fontWeight: '700', letterSpacing: '0.5px',
}
