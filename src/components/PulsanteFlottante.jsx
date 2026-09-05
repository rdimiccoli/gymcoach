/**
 * Pulsante dell'azione principale, in basso a destra.
 *
 * Con il telefono in una mano il pollice copre comodamente solo la metà bassa
 * dello schermo: l'angolo in alto a destra — dove stavano «+ AGGIUNGI» e
 * simili — è il punto più scomodo che esista, e costringe a cambiare presa.
 * Qui l'azione sta dove il pollice arriva già.
 *
 * ── Perché c'è un div alto zero ──────────────────────────────────────────
 * Nella prima versione il pulsante era posizionato rispetto all'intera
 * pagina, e `bottom: 16px` finiva quindi SOPRA la barra di navigazione,
 * coprendo ATLETI e IMPOSTAZIONI.
 *
 * Ora il componente si ancora al confine fra il contenuto e la barra: si
 * inserisce come elemento alto zero fra i due, e il pulsante cresce verso
 * l'alto a partire da lì. Va montato subito prima di <BottomNav>.
 *
 * Un div alto zero invece dell'altezza della barra scritta a mano perché
 * quel numero sarebbe una copia: cambia il corpo di un'etichetta, cambia la
 * barra, e il pulsante torna a coprirla senza che nessuno se ne accorga.
 */
export default function PulsanteFlottante({ etichetta, onClick, icona = '+' }) {
  return (
    <div style={{ position: 'relative', height: 0, flexShrink: 0, zIndex: 40 }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          position: 'absolute', right: '16px', bottom: '14px',
          display: 'flex', alignItems: 'center', gap: '9px',
          background: 'var(--accento)', border: 'none', borderRadius: '30px',
          padding: '15px 22px', color: '#fff',
          fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px',
          fontWeight: '800', letterSpacing: '1.5px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.55)',
          touchAction: 'manipulation', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '-2px' }}>{icona}</span>
        {etichetta}
      </button>
    </div>
  )
}
