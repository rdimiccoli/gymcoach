/**
 * Pulsante dell'azione principale, in basso a destra.
 *
 * Con il telefono in una mano il pollice copre comodamente solo la metà bassa
 * dello schermo: l'angolo in alto a destra — dove stavano «+ AGGIUNGI» e
 * simili — è il punto più scomodo che esista, e costringe a cambiare presa.
 * Qui l'azione sta dove il pollice arriva già.
 *
 * Sta sopra la barra di navigazione, non sopra il contenuto: la pagina lascia
 * uno spazio in fondo perché l'ultima riga dell'elenco non ci finisca sotto.
 */
export default function PulsanteFlottante({ etichetta, onClick, icona = '+' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute', right: '16px', bottom: '16px', zIndex: 40,
        display: 'flex', alignItems: 'center', gap: '9px',
        background: 'var(--accento)', border: 'none', borderRadius: '30px',
        padding: '15px 22px', color: '#fff',
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px',
        fontWeight: '800', letterSpacing: '1.5px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.55)',
        touchAction: 'manipulation', cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '-2px' }}>{icona}</span>
      {etichetta}
    </button>
  )
}
