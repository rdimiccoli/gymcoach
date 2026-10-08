import { IconaHome, IconaSchede, IconaTurni, IconaAtleti, IconaImpostazioni } from './Icone'

/**
 * Il menu dell'app.
 *
 * Su un telefono sta in basso, dove arriva il pollice senza cambiare presa.
 * Su un tablet SDRAIATO — che è come lo tengono in palestra — quella
 * posizione costa cara: lo schermo è già basso di suo (820px), la barra se ne
 * mangia 88, e intanto ai lati restano cinquecento pixel vuoti. Lì diventa
 * una colonna di sinistra: ridà al contenuto l'altezza che gli serve e occupa
 * spazio che era sprecato.
 *
 * Il passaggio avviene in `index.css`, con una media query sulle classi qui
 * sotto: è l'unico modo di cambiare impaginazione a seconda dello schermo,
 * perché gli stili scritti dentro il JSX non sanno quanto è largo.
 *
 * Il nome del file resta BottomNav perché è richiamato in dieci pagine e
 * rinominarlo sarebbe un diff enorme per zero sostanza.
 */
export default function BottomNav({ active, navigate, goHome }) {
  const items = [
    { id: 'home',     Icona: IconaHome,          label: 'HOME',    action: goHome },
    { id: 'cycles',   Icona: IconaSchede,        label: 'SCHEDE',  action: () => navigate('cycles') },
    { id: 'turns',    Icona: IconaTurni,         label: 'TURNI',   action: () => navigate('turns') },
    { id: 'athletes', Icona: IconaAtleti,        label: 'ATLETI',  action: () => navigate('athletes') },
    { id: 'settings', Icona: IconaImpostazioni,  label: 'IMPOST.', action: () => navigate('settings') },
  ]
  return (
    <div className="barra-navigazione">
      {items.map(item => (
        <div key={item.id} onClick={item.action} className="voce-navigazione">
          {active === item.id && <div className="segno-attivo" />}
          <div style={{ color: active === item.id ? 'var(--accento)' : '#4a4643', display: 'flex', lineHeight: 1 }}>
            <item.Icona />
          </div>
          <div style={{
            fontSize: '13px',
            letterSpacing: '0.5px',
            fontFamily: 'Barlow Condensed, sans-serif',
            fontWeight: '700',
            color: active === item.id ? 'var(--accento)' : '#555',
            textAlign: 'center',
            lineHeight: 1,
          }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}
